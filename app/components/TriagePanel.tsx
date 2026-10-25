"use client";

import { useState, type FormEvent } from "react";
import type { TriageResponse } from "@/lib/schemas";
import type { Settings } from "./Settings";

const fmtCost = (n: number) => (n === 0 ? "$0 (free tier)" : `$${n.toFixed(6)}`);

export default function TriagePanel({ settings }: { settings: Settings }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [out, setOut] = useState<TriageResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors([]);
    setOut(null);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: { subject, body },
          strategy: settings.strategy,
          llm_model: settings.strategy !== "dm" ? settings.llmModel || undefined : undefined,
          dm_model: settings.strategy !== "llm" ? settings.dmModel || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // F1: invalid requests show a clear error instead of failing silently
        setErrors(Array.isArray(data.issues) ? data.issues : [data.error ?? "Triage failed."]);
        return;
      }
      setOut(data as TriageResponse);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Network error."]);
    } finally {
      setLoading(false);
    }
  }

  const m = out?.meta;
  return (
    <section>
      <form onSubmit={submit} aria-busy={loading}>
        <label>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short title (optional)" />
        </label>
        <label>
          Ticket body
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Paste the customer message..." />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Triaging..." : `Triage (${settings.strategy})`}
        </button>
        {errors.length > 0 && (
          <div role="alert" className="error">
            <strong>Could not triage this ticket:</strong>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {out && m && (
        <div className="card">
          <h3>Result</h3>
          <div className="badges">
            <span className="badge">category: {out.result.category}</span>
            <span className={`badge p-${out.result.priority}`}>priority: {out.result.priority}</span>
            <span className={`badge ${out.result.needs_human_review ? "p-high" : ""}`}>
              human review: {out.result.needs_human_review ? "yes" : "no"}
            </span>
          </div>
          <p>{out.result.summary}</p>
          <dl className="meta">
            <dt>Strategy</dt>
            <dd>{m.strategy}{m.escalated_to_llm ? " (DM unsure, escalated to LLM)" : ""}{m.llm_fallback ? " (LLM failed, DM answer kept)" : ""}</dd>
            <dt>Model(s) used</dt>
            <dd>{m.model_label}</dd>
            <dt>LLM tokens</dt>
            <dd>
              {m.llm_usage
                ? `input ${m.llm_usage.input_tokens} · output ${m.llm_usage.output_tokens} · total ${m.llm_usage.total_tokens}`
                : "no LLM call"}
            </dd>
            {m.dm_usage && (
              <>
                <dt>DM tokens</dt>
                <dd>input {m.dm_usage.input_tokens} (no output tokens)</dd>
              </>
            )}
            {m.dm_confidence && (
              <>
                <dt>DM confidence</dt>
                <dd>
                  category {m.dm_confidence.category.toFixed(2)} · priority {m.dm_confidence.priority.toFixed(2)} · review{" "}
                  {m.dm_confidence.needs_human_review.toFixed(2)}
                </dd>
              </>
            )}
            <dt>Latency</dt>
            <dd>{m.latency_ms} ms</dd>
            <dt>Cost</dt>
            <dd>{fmtCost(m.cost_usd)}</dd>
          </dl>
        </div>
      )}
    </section>
  );
}
