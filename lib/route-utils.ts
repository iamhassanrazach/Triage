import { ZodError } from "zod";
import { AppError } from "./errors";
import { formatZodIssues } from "./schemas";

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("Invalid JSON body.", 400);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ZodError) {
    const issues = formatZodIssues(e);
    return Response.json({ error: issues.join(" "), issues }, { status: 400 });
  }
  if (e instanceof AppError) return Response.json({ error: e.message }, { status: e.status });
  return Response.json({ error: e instanceof Error ? e.message : "Unexpected server error." }, { status: 500 });
}
