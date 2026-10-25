import { runSmokeTest } from "@/lib/smoke";
import { SmokeRequestSchema } from "@/lib/schemas";
import { errorResponse, readJson } from "@/lib/route-utils";

export const maxDuration = 300; // a big sample can take a while

export async function POST(request: Request) {
  try {
    const req = SmokeRequestSchema.parse(await readJson(request));
    return Response.json(await runSmokeTest(req));
  } catch (e) {
    return errorResponse(e);
  }
}
