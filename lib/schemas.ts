// Shared schemas (safe to import from both server and browser code).
// Zod is the single source of truth: the JSON Schema is generated from it.
import { z } from "zod";

export const CATEGORIES = ["technical_bug", "billing", "account", "feature_request"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;
export const STRATEGIES = ["llm", "dm", "dm+llm"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Strategy = (typeof STRATEGIES)[number];

// ---------- F1: triage REQUEST ----------
export const TicketInputSchema = z.object({
  subject: z.string().max(500, "Subject is too long (max 500 characters).").default(""),
  body: z
    .string({ error: "Ticket body is required." })
    .trim()
    .min(1, "Ticket body must not be empty.")
    .max(20000, "Ticket body is too long (max 20,000 characters)."),
  language: z.string().max(10).optional(),
  customer_plan: z.string().max(50).optional(),
});

export const TriageRequestSchema = z.object({
  ticket: TicketInputSchema,
  strategy: z.enum(STRATEGIES, { error: "Strategy must be llm, dm or dm+llm." }).default("llm"),
  llm_model: z.string().max(200).optional(),
  dm_model: z.string().max(200).optional(),
});

// ---------- F1: triage RESULT (what the model decides) ----------
export const TriageResultSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  needs_human_review: z.boolean(),
  summary: z.string().max(600),
});

// ---------- F1/F2: triage RESPONSE (what the API returns to the browser) ----------
export const UsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

export const TriageResponseSchema = z.object({
  result: TriageResultSchema,
  meta: z.object({
    strategy: z.enum(STRATEGIES),
    model_label: z.string(), // e.g. "gpt-x" or "vllm-sr/d3-turbo + gpt-x"
    llm_model: z.string().nullable(),
    dm_model: z.string().nullable(),
    escalated_to_llm: z.boolean(), // dm+llm only: DM was not confident enough
    llm_fallback: z.boolean(), // dm+llm only: the LLM failed, so the DM answer was kept
    llm_usage: UsageSchema.nullable(), // token usage of the LLM call(s)
    dm_usage: UsageSchema.nullable(), // token usage of the decision-model call
    latency_ms: z.number().nonnegative(),
    cost_usd: z.number().nonnegative(),
    dm_confidence: z
      .object({ category: z.number(), priority: z.number(), needs_human_review: z.number() })
      .nullable(),
  }),
});

export type TriageRequest = z.infer<typeof TriageRequestSchema>;
export type TriageResult = z.infer<typeof TriageResultSchema>;
export type TriageResponse = z.infer<typeof TriageResponseSchema>;
export type Usage = z.infer<typeof UsageSchema>;

// JSON Schemas generated from the Zod schemas (also sent to the LLM in the prompt).
export const triageRequestJsonSchema = () => z.toJSONSchema(TriageRequestSchema);
export const triageResultJsonSchema = () => z.toJSONSchema(TriageResultSchema);
export const triageResponseJsonSchema = () => z.toJSONSchema(TriageResponseSchema);

/** Turn a ZodError into short, human-readable lines for the front end. */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.join(".");
    return path ? `${path}: ${i.message}` : i.message;
  });
}

// ---------- Smoke test / admin ----------
export const SmokeRequestSchema = z.object({
  dataset: z.enum(["labelled_100", "tickets_500"], { error: "Unknown dataset." }),
  sample_size: z.coerce
    .number({ error: "Sample size must be a number." })
    .int("Sample size must be a whole number.")
    .min(1, "Sample size must be at least 1.")
    .max(500, "Sample size cannot exceed 500."),
  strategy: z.enum(STRATEGIES).default("llm"),
  llm_model: z.string().max(200).optional(),
  dm_model: z.string().max(200).optional(),
});
export type SmokeRequest = z.infer<typeof SmokeRequestSchema>;

export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1, "Messages must not be empty.").max(8000),
      }),
    )
    .min(1, "Send at least one message.")
    .max(60, "Conversation too long (max 60 messages)."),
  model: z.string().max(200).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type SmokeTicketRow = {
  ticket_id: string;
  subject: string;
  predicted: { category: Category; priority: Priority; needs_human_review: boolean } | null;
  expected: { category: Category; priority: Priority } | null;
  category_match: boolean | null;
  priority_match: boolean | null;
  error: string | null;
  latency_ms: number;
  cost_usd: number;
  escalated_to_llm: boolean;
  llm_fallback: boolean;
};

export type RunRecord = {
  id: string;
  timestamp: string;
  dataset: string;
  sample_size: number;
  strategy: Strategy;
  model_label: string;
  llm_model: string | null;
  dm_model: string | null;
  outcomes: { ok: number; failed: number; escalated_to_llm: number; llm_fallback: number };
  labelled: boolean;
  accuracy: { category: number; priority: number } | null; // 0..1, null when not labelled
  mismatches: { category: number; priority: number } | null;
  latency_ms: { avg: number; p95: number; total_wall: number };
  cost_usd: number;
  tokens: { llm_input: number; llm_output: number; dm_input: number };
};

export type SmokeResponse = { run: RunRecord; rows: SmokeTicketRow[] };
