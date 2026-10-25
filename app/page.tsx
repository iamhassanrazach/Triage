"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import TriagePanel from "./components/TriagePanel";
import SmokePanel from "./components/SmokePanel";
import { SettingsBar, type ModelOptions, type Settings } from "./components/Settings";

type Tab = "chat" | "triage" | "smoke";

export default function Home() {
  const [tab, setTab] = useState<Tab>("triage");
  const [options, setOptions] = useState<ModelOptions | null>(null);
  const [settings, setSettings] = useState<Settings>({ strategy: "llm", llmModel: "", dmModel: "" });

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((o: ModelOptions) => {
        setOptions(o);
        setSettings((s) => ({ ...s, llmModel: o.llm_models[0] ?? "", dmModel: o.dm_models[0] ?? "" }));
      })
      .catch(() => {});
  }, []);

  return (
    <main className="app">
      <header>
        <h1>Support ticket triage</h1>
        <Link href="/admin">/admin</Link>
      </header>
      <nav className="tabs">
        {(["chat", "triage", "smoke"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)} type="button">
            {t === "smoke" ? "smoke test" : t}
          </button>
        ))}
      </nav>
      <SettingsBar options={options} value={settings} onChange={setSettings} showStrategy={tab !== "chat"} />
      {tab === "chat" && <ChatPanel settings={settings} />}
      {tab === "triage" && <TriagePanel settings={settings} />}
      {tab === "smoke" && <SmokePanel settings={settings} />}
    </main>
  );
}
