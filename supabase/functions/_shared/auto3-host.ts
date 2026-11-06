// Resolves which Auto3 host serves a dealer tenant.
// Production (api.auto3.de) is the live source that also powers the dealer website.
// Some tenants only exist on the staging host (dev-api.autoversus.de); those fall back there.
// Resolution is deterministic per tenant so listing and import always use the same IDs.

const PROD = "https://api.auto3.de";
const DEV = "https://dev-api.autoversus.de";

function candidates(): string[] {
  const configured = (Deno.env.get("AUTO3_API_BASE") || "").replace(/\/$/, "");
  const list = [PROD, DEV];
  if (configured && !list.includes(configured)) list.unshift(configured);
  return list;
}

const cache = new Map<string, { host: string; at: number }>();
const TTL_MS = 10 * 60 * 1000;

async function probe(host: string, tenant: string): Promise<boolean> {
  try {
    const res = await fetch(`${host}/v1/vehicle/vehicle/buy?page=0&pageSize=1&includeImages=false`, {
      headers: { Accept: "application/json", "X-BASEURL": tenant },
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

export async function auto3Fetch(path: string, tenant: string) {
  const host = await resolveAuto3Host(tenant);
  const res = await fetch(`${host}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", "X-BASEURL": tenant },
  });
  if (!res.ok) { await res.text(); throw new Error(`Auto3 ${res.status}`); }
  return res.json();
}
