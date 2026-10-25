import { AppError } from "./errors";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch + JSON with a timeout and a few retries on 429 / 5xx / network errors. */
export async function postJson(
  url: string,
  apiKey: string,
  body: unknown,
  opts: { timeoutMs?: number; retries?: number; label: string },
): Promise<unknown> {
  const retries = opts.retries ?? 3;
  let lastError = "unknown error";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      });
      if (res.ok) return await res.json();
      const text = (await res.text()).slice(0, 300);
      lastError = `${opts.label} returned HTTP ${res.status}: ${text}`;
      if (res.status !== 429 && res.status < 500) throw new AppError(lastError, 502);
    } catch (e) {
      if (e instanceof AppError) throw e;
      lastError = `${opts.label} request failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s
  }
  throw new AppError(lastError, 502);
}
