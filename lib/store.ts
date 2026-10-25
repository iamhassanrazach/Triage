// Tiny file-based log (server only). Good enough for a course project; no database needed.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { RunRecord, Strategy } from "./schemas";

const DIR = path.join(process.cwd(), "data", "logs");
const RUNS = path.join(DIR, "runs.jsonl");
const CALLS = path.join(DIR, "calls.jsonl");

export type CallRecord = {
  timestamp: string;
  kind: "triage" | "chat";
  strategy: Strategy | "chat";
  model_label: string;
  latency_ms: number;
  cost_usd: number;
  ok: boolean;
  error?: string;
};

async function append(file: string, obj: unknown) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.appendFile(file, JSON.stringify(obj) + "\n", "utf8");
}

async function readAll<T>(file: string): Promise<T[]> {
  try {
    const text = await fs.readFile(file, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

export const logRun = (r: RunRecord) => append(RUNS, r);
export const logCall = (c: CallRecord) => append(CALLS, c).catch(() => {});
export const readRuns = () => readAll<RunRecord>(RUNS);
export const readCalls = () => readAll<CallRecord>(CALLS);
