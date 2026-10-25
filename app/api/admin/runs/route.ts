import { readCalls, readRuns } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [runs, calls] = await Promise.all([readRuns(), readCalls()]);
  return Response.json({ runs: runs.reverse(), calls: calls.slice(-100).reverse() });
}
