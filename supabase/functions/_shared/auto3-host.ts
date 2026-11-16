// Resolves which Auto3 host serves a dealer tenant.
// Production (api.auto3.de) is the live source that also powers the dealer website.
// Some tenants only exist on the staging host (dev-api.autoversus.de); those fall back there.
// Resolution is deterministic per tenant so listing and import always use the same IDs.

const PROD = "https://api.auto3.de";
const DEV = "https://dev-api.autoversus.de";

/**
 * Every Auto3 call runs inside an edge function that the platform kills after 150 s without a
 * response, so each request gets its own timeout and the retries a shared budget.
 */
const PROBE_TIMEOUT_MS = 6_000;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_BUDGET_MS = 45_000;

function candidates(): string[] {
  const configured = (Deno.env.get("AUTO3_API_BASE") || "").replace(/\/$/, "");
  const list = [PROD];
  if (configured && configured !== PROD && configured !== DEV) list.push(configured);
  list.push(DEV);
  return list;
}

const cache = new Map<string, { host: string; at: number }>();
const TTL_MS = 10 * 60 * 1000;

async function probe(host: string, tenant: string): Promise<boolean> {
  try {
    const res = await fetch(`${host}/v1/vehicle/vehicle/buy?page=0&pageSize=1&includeImages=false`, {
      headers: { Accept: "application/json", "X-BASEURL": tenant },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) { await res.text(); return false; }
    const body = await res.json().catch(() => null);
    return Number.isFinite(Number(body?.totalElements)) && Array.isArray(body?.content);
  } catch { return false; }
}

export async function resolveAuto3Host(tenant: string, opts: { fresh?: boolean } = {}): Promise<string> {
  const hit = cache.get(tenant);
  if (!opts.fresh && hit && Date.now() - hit.at < TTL_MS) return hit.host;
  for (const host of candidates()) {
    if (await probe(host, tenant)) { cache.set(tenant, { host, at: Date.now() }); return host; }
  }
  throw new Error("Auto3 tenant not found");
}

/**
 * @param opts.deadlineAt absolute timestamp (ms). No attempt starts without remaining time and no
 * attempt waits longer than the remaining budget, so the caller always answers before the platform
 * drops the request.
 */
export async function auto3Fetch(path: string, tenant: string, opts: { deadlineAt?: number } = {}) {
  const host = await resolveAuto3Host(tenant);
  const deadline = opts.deadlineAt ?? Date.now() + RETRY_BUDGET_MS;
  // Auto3 occasionally answers single pages with transient 5xx/429; retry before failing the whole inventory.
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    if (attempt) await new Promise((r) => setTimeout(r, Math.min(600 * attempt, remaining)));
    let res: Response;
    try {
      res = await fetch(`${host}${path}`, {
        method: "GET",
        headers: { Accept: "application/json", "X-BASEURL": tenant },
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining)),
      });
    } catch (e) { if (attempt === 2) throw e; continue; }
    if (res.ok) return res.json();
    await res.text();
    lastStatus = res.status;
    if (res.status < 500 && res.status !== 429) break;
  }
  throw new Error(`Auto3 ${lastStatus || "timeout"}`);
}
