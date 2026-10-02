// Pure serialization helpers for the website-media delivery API (testable without network).

export const MAX_BATCH_IDS = 100;
export const MAX_BODY_BYTES = 16 * 1024;
const SLUG = /^[a-z0-9_-]{2,40}$/;
const EXT_ID = /^[A-Za-z0-9._-]{1,100}$/;

/** Durable public image URL: https, not signed, no token, not banners/originals, image extension. */
export function urlOk(u: unknown): u is string {
  return typeof u === "string"
    && /^https:\/\//i.test(u)
    && !/\/object\/sign\//.test(u)
    && !/[?&]token=/.test(u)
    && !/\/object\/public\/(banners|originals)\//i.test(u)
    && /\.(png|jpe?g|webp|avif)(\?|#|$)/i.test(u);
}

export interface PublicationRow {
  external_vehicle_id: string;
  live_snapshot: any;
  published_at: string | null;
  live_updated_at?: string | null;
  updated_at?: string | null;
  version?: number | null;
}

export interface DeliveredPublication {
  externalVehicleId: string;
  coverMode: "ai" | "auto3";
  galleryMode: "auto3" | "append" | "replace";
  coverImageUrl: string | null;
  images: { url: string; sortOrder: number }[];
  updatedAt: string | null;
  version: number;
}

/**
 * Serializes a live publication. Invalid or missing assets are dropped; remaining images are deduped and
 * re-numbered in stable order. If an AI cover is unusable, falls back to the first remaining AI image,
 * otherwise to the Auto3 cover (coverMode "auto3") — never an empty card.
 */
export function serializePublication(row: PublicationRow, missing: Set<string> = new Set()): DeliveredPublication {
  const s = row.live_snapshot || {};
  const usable = (u: unknown) => urlOk(u) && !missing.has(u as string);
  const galleryMode = (["auto3", "append", "replace"].includes(s.galleryMode) ? s.galleryMode : "auto3") as DeliveredPublication["galleryMode"];
  const seen = new Set<string>();
  const images = galleryMode === "auto3" ? [] : (Array.isArray(s.images) ? s.images : [])
    .map((i: any, idx: number) => ({ url: i?.url, o: Number.isFinite(i?.sortOrder) ? i.sortOrder : idx, idx }))
    .filter((i: any) => usable(i.url) && !seen.has(i.url) && (seen.add(i.url), true))
    .sort((a: any, b: any) => a.o - b.o || a.idx - b.idx)
    .map((i: any, n: number) => ({ url: i.url as string, sortOrder: n }));

  let coverMode: "ai" | "auto3" = s.coverMode === "ai" ? "ai" : "auto3";
  let coverImageUrl: string | null = null;
  if (coverMode === "ai") {
    if (usable(s.coverImageUrl)) coverImageUrl = s.coverImageUrl;
    else if (images[0]) coverImageUrl = images[0].url;
    else coverMode = "auto3";
  }
  // "Nur AI" without any remaining AI image would be an empty gallery → let Schmitt fall back to Auto3.
  const effectiveGallery = galleryMode === "replace" && images.length === 0 ? "auto3" : galleryMode;

  return {
    externalVehicleId: row.external_vehicle_id,
    coverMode,
    galleryMode: effectiveGallery,
    coverImageUrl,
    images,
    updatedAt: row.live_updated_at || row.published_at || row.updated_at || null,
    version: typeof row.version === "number" ? row.version : 0,
  };
}

export function collectUrls(rows: PublicationRow[]): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    const s = r.live_snapshot || {};
    if (urlOk(s.coverImageUrl)) out.add(s.coverImageUrl);
    for (const i of Array.isArray(s.images) ? s.images : []) if (urlOk(i?.url)) out.add(i.url);
  }
  return [...out];
}

export type BatchParse =
  | { ok: true; target: string; source: string; ids: string[] }
  | { ok: false; status: number; error: string };

export function parseBatchBody(raw: string): BatchParse {
  if (raw.length > MAX_BODY_BYTES) return { ok: false, status: 413, error: "payload_too_large" };
  let body: any;
  try { body = JSON.parse(raw); } catch { return { ok: false, status: 400, error: "invalid_json" }; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, status: 400, error: "invalid_parameters" };
  const target = String(body.target ?? "").toLowerCase();
  const source = String(body.source ?? "auto3").toLowerCase();
  if (!SLUG.test(target) || !SLUG.test(source)) return { ok: false, status: 400, error: "invalid_parameters" };
  if (!Array.isArray(body.externalVehicleIds)) return { ok: false, status: 400, error: "invalid_parameters" };
  const ids: string[] = [];
  for (const v of body.externalVehicleIds) {
    const id = typeof v === "number" && Number.isInteger(v) ? String(v) : typeof v === "string" ? v.trim() : null;
    if (!id || !EXT_ID.test(id)) return { ok: false, status: 400, error: "invalid_external_vehicle_id" };
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_BATCH_IDS) return { ok: false, status: 400, error: "too_many_ids", };
  return { ok: true, target, source, ids };
}
