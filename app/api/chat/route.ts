import { chatCompletion, type ChatMessage } from "@/lib/llm";
import { ChatRequestSchema } from "@/lib/schemas";
import { errorResponse, readJson } from "@/lib/route-utils";
import { logCall } from "@/lib/store";

const SYSTEM = "You are a friendly, concise customer-support assistant. Use the conversation so far to answer.";

// The browser sends the WHOLE conversation each time: that is the chat's "memory".
export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    const { messages, model } = ChatRequestSchema.parse(await readJson(request));
    const history: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...messages];
    const r = await chatCompletion({ messages: history, model, temperature: 0.4, maxTokens: 500 });
    await logCall({
      timestamp: new Date().toISOString(),
      kind: "chat",
      strategy: "chat",
      model_label: r.model,
      latency_ms: Date.now() - t0,
      cost_usd: r.cost_usd,
      ok: true,
    });
    return Response.json({ answer: r.text, model: r.model, usage: r.usage });
  } catch (e) {
    await logCall({
      timestamp: new Date().toISOString(),
      kind: "chat",
      strategy: "chat",
      model_label: "unknown",
      latency_ms: Date.now() - t0,
      cost_usd: 0,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return errorResponse(e);
  }
}
