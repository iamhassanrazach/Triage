// Client for any OpenAI-compatible chat endpoint (OpenRouter, Groq, Gemini, OpenAI, Ollama...).
import { AppError, configError } from "./errors";
import { postJson } from "./http";
import type { Usage } from "./schemas";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function llmModels(): string[] {
  const list = (process.env.LLM_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const single = process.env.LLM_MODEL?.trim();
  if (single && !list.includes(single)) list.unshift(single);
  return list;
}

export function defaultLlmModel(): string {
  const m = llmModels()[0];
  if (!m) throw configError("LLM_MODEL");
  return m;
}

export function resolveLlmModel(requested?: string): string {
  const allowed = llmModels();
  if (!requested) return defaultLlmModel();
  if (!allowed.includes(requested)) throw new AppError(`Unknown LLM model "${requested}".`, 400);
  return requested;
}

export function llmCost(u: Usage): number {
  const inP = Number(process.env.LLM_PRICE_INPUT_PER_M ?? 0);
  const outP = Number(process.env.LLM_PRICE_OUTPUT_PER_M ?? 0);
  return (u.input_tokens * inP + u.output_tokens * outP) / 1_000_000;
}

type RawCompletion = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

/**
 * "Thinking" models spend part of max_tokens on hidden reasoning, and can return an EMPTY answer if the budget
 * runs out. So we (1) ask for low reasoning effort, (2) add headroom to max_tokens, (3) retry once with double.
 */
export async function chatCompletion(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ text: string; usage: Usage; model: string; cost_usd: number }> {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY;
  if (!baseUrl) throw configError("LLM_BASE_URL");
  if (!apiKey) throw configError("LLM_API_KEY");
  const model = resolveLlmModel(opts.model);

  const effort = process.env.LLM_REASONING_EFFORT ?? "low"; // set to "" to not send the option
  const headroom = Number(process.env.LLM_REASONING_HEADROOM ?? 1500);
  let maxTokens = (opts.maxTokens ?? 500) + headroom;

  let input = 0;
  let output = 0;
  let lastFinish = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = (await postJson(
      `${baseUrl}/chat/completions`,
      apiKey,
      {
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0,
        max_tokens: maxTokens,
        ...(effort ? { reasoning: { effort } } : {}),
      },
      { label: "LLM provider", timeoutMs: 90_000 },
    )) as RawCompletion;

    input += data.usage?.prompt_tokens ?? 0;
    output += data.usage?.completion_tokens ?? 0;
    const text = data.choices?.[0]?.message?.content;
    lastFinish = data.choices?.[0]?.finish_reason ?? "";
    if (typeof text === "string" && text.trim()) {
      const usage: Usage = { input_tokens: input, output_tokens: output, total_tokens: input + output };
      return { text, usage, model, cost_usd: llmCost(usage) };
    }
    maxTokens *= 2; // empty answer: the model probably ran out of tokens while thinking
  }
  throw new AppError(
    `LLM provider returned no text${lastFinish ? ` (finish_reason: ${lastFinish})` : ""}. The model may be overloaded or spending all its tokens thinking.`,
    502,
  );
}
