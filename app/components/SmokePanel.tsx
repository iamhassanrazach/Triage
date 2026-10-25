"use client";

import { useState, type FormEvent } from "react";
import type { SmokeResponse } from "@/lib/schemas";
import type { Settings } from "./Settings";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function SmokePanel({ settings }: { settings: Settings }) {
  const [dataset, setDataset] = useState<"labelled_100" | "tickets_500">("labelled_100");
  const [size, setSize] = useState("10");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [res, setRes] = useState<SmokeResponse | null>(null);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors([]);
    setRes(null);
    try {
      const r = await fetch("/api/smoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          sample_size: size,
          strategy: settings.strategy,
          llm_model: settings.strategy !== "dm" ? settings.llmModel || undefined : undefined,
          dm_model: settings.strategy !== "llm" ? settings.dmModel || undefined : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErrors(Array.isArray(data.issues) ? data.issues : [data.error ?? "Smoke test failed."]);
        return;
      }
      setRes(data as SmokeResponse);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Network error."]);
    } finally {
      setLoading(false);
    }
  }

  const run_ = res?.run;
  return (
    <section>
      <form onSubmit={run} aria-busy={loading}>
        <div className="row">
          <label>
            Dataset
            <select value={dataset} onChange={(e) => setDataset(e.target.value as typeof dataset)}>
              <option value="labelled_100">Labelled 100 tickets</option>
              <option value="tickets_500">500 tickets (no labels)</option>
            </select>
          </label>
          <label>
            Tickets to sample
            <input type="number" min={1} max={500} value={size} onChange={(e) => setSize(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Running... (can take a minute)" : `Run smoke test (${settings.strategy})`}
        </button>
        {errors.length > 0 && (
          <div role="alert" className="error">
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {run_ && res && (
        <>
          <div className="card">
            <h3>Summary — {run_.model_label}</h3>
            <p>
              {run_.outcomes.ok} ok · {run_.outcomes.failed} failed · strategy <b>{run_.strategy}</b>
              {run_.strategy === "dm+llm" && ` · ${run_.outcomes.escalated_to_llm} escalated to LLM · ${run_.outcomes.llm_fallback} LLM failures (DM answer kept)`}
            </p>
            {run_.labelled && run_.accuracy && run_.mismatches ? (
              <p>
                Category mismatches: <b>{run_.mismatches.category}</b> ({pct(run_.accuracy.category)} accurate) · Priority
                mismatches: <b>{run_.mismatches.priority}</b> ({pct(run_.accuracy.priority)} accurate)
              </p>
            ) : (
              <p>This dataset has no labels, so there is no accuracy to compute.</p>
            )}
            <p>
              Avg latency {run_.latency_ms.avg} ms · p95 {run_.latency_ms.p95} ms · wall time {(run_.latency_ms.total_wall / 1000).toFixed(1)} s ·
              cost ${run_.cost_usd.toFixed(6)}
            </p>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Predicted category</th>
                  <th>Predicted priority</th>
                  {run_.labelled && <th>Expected category</th>}
                  {run_.labelled && <th>Expected priority</th>}
                  <th>ms</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((r) => (
                  <tr key={r.ticket_id} className={r.error ? "bad" : ""}>
                    <td title={r.subject}>{r.ticket_id}</td>
                    {r.error || !r.predicted ? (
                      <td colSpan={run_.labelled ? 4 : 2}>{r.error}</td>
                    ) : (
                      <>
                        <td className={r.category_match === false ? "bad" : ""}>{r.predicted.category}</td>
                        <td className={r.priority_match === false ? "bad" : ""}>{r.predicted.priority}</td>
                        {r.expected && <td>{r.expected.category}</td>}
                        {r.expected && <td>{r.expected.priority}</td>}
                      </>
                    )}
                    <td>{r.latency_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
