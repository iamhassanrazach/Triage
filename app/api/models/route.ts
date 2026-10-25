import { llmModels } from "@/lib/llm";
import { dmModels } from "@/lib/dm";
import { STRATEGIES } from "@/lib/schemas";

export async function GET() {
  return Response.json({ strategies: STRATEGIES, llm_models: llmModels(), dm_models: dmModels() });
}
