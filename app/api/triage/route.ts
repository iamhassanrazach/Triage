import { runTriage } from "@/lib/triage";
import { TriageRequestSchema, TriageResponseSchema } from "@/lib/schemas";
import { AppError } from "@/lib/errors";
import { errorResponse, readJson } from "@/lib/route-utils";
import { logCall } from "@/lib/store";

export async function POST(request: Request) {
  const t0 = Date.now();
  let strategy: "llm" | "dm" | "dm+llm" = "llm";
  try {
    // F1: validate the REQUEST with Zod (throws a ZodError -> clear 400 message)
    const req = TriageRequestSchema.parse(await readJson(request));
    strategy = req.strategy;
    const out = await runTriage(req.ticket, req.strategy, { llmModel: req.llm_model, dmModel: req.dm_model });

    // F1: validate the RESPONSE too, before it goes to the user
    const checked = TriageResponseSchema.safeParse(out);
    if (!checked.success) throw new AppError("Internal error: the triage response did not match its schema.", 500);

    await logCall({
      timestamp: new Date().toISOString(),
      kind: "triage",
      strategy,
      model_label: out.meta.model_label,
      latency_ms: out.meta.latency_ms,
      cost_usd: out.meta.cost_usd,
      ok: true,
    });
    return Response.json(checked.data);
  } catch (e) {
    await logCall({
      timestamp: new Date().toISOString(),
      kind: "triage",
      strategy,
      model_label: "unknown",
      latency_ms: Date.now() - t0,
      cost_usd: 0,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return errorResponse(e);
  }
}
