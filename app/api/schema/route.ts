import { triageRequestJsonSchema, triageResponseJsonSchema } from "@/lib/schemas";

// The JSON Schemas of the triage request/response, generated from the Zod schemas.
export async function GET() {
  return Response.json({ request: triageRequestJsonSchema(), response: triageResponseJsonSchema() });
}
