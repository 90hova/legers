const base = process.env.WORKER_URL;
const secret = process.env.WORKER_SHARED_SECRET;
export async function workerRequest(path: string, body?: unknown, method = "POST") {
  if (!base || !secret) throw new Error("Worker is not configured");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method, headers: { "content-type": "application/json", "x-ledgers-secret": secret },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.WORKER_TIMEOUT_MS || 15000)),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Worker request failed (${response.status})`);
  return data;
}
