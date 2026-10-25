"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RunRecord } from "@/lib/schemas";

type Call = {
  timestamp: string;
  kind: string;
  strategy: string;
  model_label: string;
  latency_ms: number;
  cost_usd: number;
  ok: boolean;
  error?: string;
};

const pct = (n: number | undefined) => (n === undefined ? "-" : `${(n * 100).toFixed(1)}%`);

export default function Admin() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/runs")
      .then((r) => r.json())
      .then((d) => {
        setRuns(d.runs);
        setCalls(d.calls);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2))); // keep max 2
  const [a, b] = picked.map((id) => runs.find((r) => r.id === id)).filter(Boolean) as RunRecord[];

  const rows: [string, (r: RunRecord) => string][] = [
    ["Model(s)", (r) => r.model_label],
    ["Strategy", (r) => r.strategy],
    ["Dataset", (r) => `${r.dataset} (${r.sample_size})`],
    ["Category accuracy", (r) => pct(r.accuracy?.category)],
    ["Priority accuracy", (r) => pct(r.accuracy?.priority)],
    ["Outcomes", (r) => `${r.outcomes.ok} ok / ${r.outcomes.failed} failed / ${r.outcomes.escalated_to_llm} escalated / ${r.outcomes.llm_fallback ?? 0} LLM fallback`],
    ["Avg latency", (r) => `${r.latency_ms.avg} ms`],
    ["p95 latency", (r) => `${r.latency_ms.p95} ms`],
    ["Cost", (r) => `$${r.cost_usd.toFixed(6)}`],
    ["Tokens", (r) => `LLM in ${r.tokens.llm_input} / out ${r.tokens.llm_output} · DM in ${r.tokens.dm_input}`],
  ];

  return (
    <main className="app">
      <header>
        <h1>Admin — smoke test runs</h1>
        <Link href="/">← back</Link>
      </header>
      {error && <p className="error">{error}</p>}

      {a && b && (
        <div className="card">
          <h3>Side-by-side comparison</h3>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Run A</th>
                <th>Run B</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, f]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{f(a)}</td>
                  <td>{f(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">Tick two runs to compare them side by side.</p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>When</th>
              <th>Model(s) used</th>
              <th>Strategy</th>
              <th>Dataset</th>
              <th>Cat. acc.</th>
              <th>Prio. acc.</th>
              <th>ok / failed</th>
              <th>Avg ms</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={10}>No runs yet. Start one from the “smoke test” tab.</td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`select ${r.id}`} />
                </td>
                <td>{new Date(r.timestamp).toLocaleString()}</td>
                <td>{r.model_label}</td>
                <td>{r.strategy}</td>
                <td>
                  {r.dataset} ({r.sample_size})
                </td>
                <td>{pct(r.accuracy?.category)}</td>
                <td>{pct(r.accuracy?.priority)}</td>
                <td>
                  {r.outcomes.ok} / {r.outcomes.failed}
                </td>
                <td>{r.latency_ms.avg}</td>
                <td>${r.cost_usd.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Recent calls (chat &amp; triage)</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Kind</th>
              <th>Strategy</th>
              <th>Model(s) used</th>
              <th>ms</th>
              <th>Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c, i) => (
              <tr key={i} className={c.ok ? "" : "bad"}>
                <td>{new Date(c.timestamp).toLocaleString()}</td>
                <td>{c.kind}</td>
                <td>{c.strategy}</td>
                <td>{c.model_label}</td>
                <td>{c.latency_ms}</td>
                <td>${c.cost_usd.toFixed(6)}</td>
                <td>{c.ok ? "ok" : (c.error ?? "error").slice(0, 80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
