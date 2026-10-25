// Smoke test runner: sample N tickets, triage each one with the chosen strategy, compare with labels.
import { promises as fs } from "node:fs";
import path from "node:path";
import { runTriage } from "./triage";
import { logRun } from "./store";
import type { Category, Priority, RunRecord, SmokeRequest, SmokeResponse, SmokeTicketRow } from "./schemas";

type RawTicket = {
  ticket_id: string;
  subject: string;
  body: string;
  language?: string;
  customer_plan?: string;
  category?: Category;
  priority?: Priority;
};

const FILES = {
  labelled_100: "support_tickets_100_labelled.json",
  tickets_500: "support_tickets_500.json",
} as const;

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function runSmokeTest(req: SmokeRequest): Promise<SmokeResponse> {
  const file = path.join(process.cwd(), "data", FILES[req.dataset]);
  const all = JSON.parse(await fs.readFile(file, "utf8")) as RawTicket[];
  const picked = sample(all, req.sample_size);
  const labelled = req.dataset === "labelled_100";
  const concurrency = Number(process.env.SMOKE_CONCURRENCY ?? 3);

  const wall0 = Date.now();
  let modelLabel = "";
  let llmModel: string | null = null;
  let dmModel: string | null = null;
  const tokens = { llm_input: 0, llm_output: 0, dm_input: 0 };

  const rows: SmokeTicketRow[] = await pool(picked, concurrency, async (t) => {
    const expected = labelled && t.category && t.priority ? { category: t.category, priority: t.priority } : null;
    try {
      const r = await runTriage(
        { subject: t.subject ?? "", body: t.body, customer_plan: t.customer_plan, language: t.language },
        req.strategy,
        { llmModel: req.llm_model, dmModel: req.dm_model },
      );
      modelLabel = r.meta.model_label;
      llmModel = r.meta.llm_model;
      dmModel = r.meta.dm_model;
      tokens.llm_input += r.meta.llm_usage?.input_tokens ?? 0;
      tokens.llm_output += r.meta.llm_usage?.output_tokens ?? 0;
      tokens.dm_input += r.meta.dm_usage?.input_tokens ?? 0;
      return {
        ticket_id: t.ticket_id,
        subject: t.subject,
        predicted: {
          category: r.result.category,
          priority: r.result.priority,
          needs_human_review: r.result.needs_human_review,
        },
        expected,
        category_match: expected ? expected.category === r.result.category : null,
        priority_match: expected ? expected.priority === r.result.priority : null,
        error: null,
        latency_ms: r.meta.latency_ms,
        cost_usd: r.meta.cost_usd,
        escalated_to_llm: r.meta.escalated_to_llm,
        llm_fallback: r.meta.llm_fallback,
      };
    } catch (e) {
      return {
        ticket_id: t.ticket_id,
        subject: t.subject,
        predicted: null,
        expected,
        category_match: null,
        priority_match: null,
        error: e instanceof Error ? e.message : String(e),
        latency_ms: 0,
        cost_usd: 0,
        escalated_to_llm: false,
        llm_fallback: false,
      };
    }
  });

  const okRows = rows.filter((r) => r.predicted);
  const lat = okRows.map((r) => r.latency_ms).sort((a, b) => a - b);
  const avg = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0;
  const p95 = lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : 0;
  const catMis = okRows.filter((r) => r.category_match === false).length;
  const priMis = okRows.filter((r) => r.priority_match === false).length;

  const run: RunRecord = {
    id: `run_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    dataset: req.dataset,
    sample_size: picked.length,
    strategy: req.strategy,
    model_label: modelLabel || "(no successful call)",
    llm_model: llmModel,
    dm_model: dmModel,
    outcomes: {
      ok: okRows.length,
      failed: rows.length - okRows.length,
      escalated_to_llm: rows.filter((r) => r.escalated_to_llm).length,
      llm_fallback: rows.filter((r) => r.llm_fallback).length,
    },
    labelled,
    accuracy: labelled && okRows.length ? { category: 1 - catMis / okRows.length, priority: 1 - priMis / okRows.length } : null,
    mismatches: labelled ? { category: catMis, priority: priMis } : null,
    latency_ms: { avg: Math.round(avg), p95, total_wall: Date.now() - wall0 },
    cost_usd: rows.reduce((s, r) => s + r.cost_usd, 0),
    tokens,
  };
  await logRun(run);
  return { run, rows };
}
