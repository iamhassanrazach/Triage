"use client";

import { useState, type FormEvent } from "react";
import type { Settings } from "./Settings";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatPanel({ settings }: { settings: Settings }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending || !text.trim()) return;
    const userMessage: Message = { role: "user", content: text.trim() };
    const history = [...messages, userMessage]; // memory = the whole conversation so far
    setMessages(history);
    setText("");
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model: settings.llmModel || undefined }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || typeof data.answer !== "string") throw new Error(data.error ?? "Unable to get a reply.");
      setMessages([...history, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setMessages(messages); // roll back and give the text back to the user
      setText(userMessage.content);
      setError(e instanceof Error ? e.message : "Unable to send your message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section>
      <p>Chat with the support assistant. It remembers the conversation.</p>
      <div className="messages" role="log" aria-label="Chat messages" aria-live="polite">
        {messages.length === 0 && <p>No messages yet.</p>}
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <strong>{m.role === "user" ? "You" : "Assistant"}</strong>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={send} aria-busy={isSending}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe what you need help with..."
          rows={3}
          disabled={isSending}
        />
        <div className="row">
          <button type="submit" disabled={isSending || !text.trim()}>
            {isSending ? "Sending..." : "Send"}
          </button>
          <button type="button" className="secondary" onClick={() => setMessages([])} disabled={isSending || !messages.length}>
            New conversation
          </button>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
      </form>
    </section>
  );
}
