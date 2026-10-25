"use client";

import type { Strategy } from "@/lib/schemas";

export type ModelOptions = { strategies: Strategy[]; llm_models: string[]; dm_models: string[] };
export type Settings = { strategy: Strategy; llmModel: string; dmModel: string };

const STRATEGY_HELP: Record<Strategy, string> = {
  llm: "The LLM decides everything (slower, more expensive, writes a real summary).",
  dm: "The decision model decides the labels in one fast pass. No LLM call.",
  "dm+llm": "The decision model decides; the LLM only writes the summary (and takes over if the DM is unsure).",
};

export function SettingsBar({
  options,
  value,
  onChange,
  showStrategy = true,
}: {
  options: ModelOptions | null;
  value: Settings;
  onChange: (s: Settings) => void;
  showStrategy?: boolean;
}) {
  const usesLlm = value.strategy !== "dm";
  const usesDm = value.strategy !== "llm";
  return (
    <div className="settings">
      {showStrategy && (
        <label>
          Strategy
          <select value={value.strategy} onChange={(e) => onChange({ ...value, strategy: e.target.value as Strategy })}>
            {(options?.strategies ?? ["llm", "dm", "dm+llm"]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      {(usesLlm || !showStrategy) && (
        <label>
          LLM model
          <select value={value.llmModel} onChange={(e) => onChange({ ...value, llmModel: e.target.value })}>
            {(options?.llm_models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      )}
      {showStrategy && usesDm && (
        <label>
          Decision model
          <select value={value.dmModel} onChange={(e) => onChange({ ...value, dmModel: e.target.value })}>
            {(options?.dm_models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      )}
      {showStrategy && <small className="hint">{STRATEGY_HELP[value.strategy]}</small>}
    </div>
  );
}
