// Read-only Auto3 inventory adapter. Never writes to Auto3.
// Actions: list (inventory + import status), import (attach selected Auto3 vehicles to vehicle records).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AUTO3_BASE = (Deno.env.get("AUTO3_API_BASE") || "https://dev-api.autoversus.de").replace(/\/$/, "");
const AUTO3_X_BASEURL = Deno.env.get("AUTO3_X_BASEURL") || "https://schmitt.indicar.de";
const SOURCE = "auto3";
const MODULE = "website-publishing";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function auto3Get(path: string) {
  const res = await fetch(`${AUTO3_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", "X-BASEURL": AUTO3_X_BASEURL },
  });
  if (!res.ok) { await res.text(); throw new Error(`Auto3 ${res.status}`); }
  return res.json();
}

// deno-lint-ignore no-explicit-any
type Raw = Record<string, any>;

const VIN_KEYS = /^(vin|fin|fahrgestellnummer|fahrgestellnummer \(fin\)|fahrzeugidentifizierungsnummer|fahrzeug-identifizierungsnummer|chassisnumber|chassis_number)$/i;

export function normalizeVin(v: unknown): string | null {
  const s = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(s) ? s : null;
}

function extractVin(r: Raw): { vin: string | null; field: string | null } {
  for (const k of Object.keys(r)) {
    if (VIN_KEYS.test(k)) { const v = normalizeVin(r[k]); if (v) return { vin: v, field: k }; }
  }
  const t = (r.technicalData || {}) as Raw;
  for (const k of Object.keys(t)) {
    if (VIN_KEYS.test(k.trim()) || /fahrgestell|identifizierungsnummer|\bfin\b|\bvin\b/i.test(k)) {
      const v = normalizeVin(t[k]); if (v) return { vin: v, field: `technicalData.${k}` };
    }
  }
  return { vin: null, field: null };
}

function images(r: Raw): string[] {
  const out: string[] = [];
  const push = (u: unknown) => { if (typeof u === "string" && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u); };
  for (const m of (r.media || []) as Raw[]) push(m?.path || m?.url || m?.thumbnail);
  if (!out.length) push(r.thumbnailImage);
  return out;
}

const mask = (vin: string) => `${vin.slice(0, 3)}••••••••••${vin.slice(-4)}`;

function summary(r: Raw) {
  return {
    externalVehicleId: String(r.id),
    internalNumber: r.interneNummer ?? null,
    brand: r.vehicleModel?.brand?.name ?? null,
    model: r.vehicleModel?.model ?? r.model ?? null,
    variant: r.modelDescription ?? null,
    year: r.yearOfManufacture ? Number(r.yearOfManufacture) || null : null,
    used: typeof r.used === "boolean" ? r.used : null,
    thumbnail: r.thumbnailImage || images(r)[0] || null,
  };
}

async function detail(id: string): Promise<Raw> {
  const d = await auto3Get(`/v1/vehicle/vehicle/buy/${encodeURIComponent(id)}`);
  return Array.isArray(d?.content) ? d.content[0] : d;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Nicht angemeldet" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: claims, error: authErr } = await sb.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (authErr || !userId) return json({ error: "Nicht angemeldet" }, 401);

    const { data: access } = await sb.from("user_module_access").select("enabled")
      .eq("user_id", userId).eq("module_key", MODULE).maybeSingle();
    if (!access?.enabled) return json({ error: "Auto3-Bestand ist für dieses Konto nicht freigeschaltet." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "list") {
      const raws: Raw[] = [];
      for (let page = 0; page < 20; page++) {
        const r = await auto3Get(`/v1/vehicle/vehicle/buy?page=${page}&pageSize=100&includeImages=true`);
        raws.push(...((r?.content || []) as Raw[]));
        if (page + 1 >= (r?.totalPages ?? 1)) break;
      }
      // VIN only exists in the detail record → fetch details server-side, never return plain VIN.
      const details = await pool(raws, 10, async (r) => { try { return await detail(String(r.id)); } catch { return null; } });

      const { data: vehicles } = await sb.from("vehicles").select("id, vin, external_vehicle_id, source_system").eq("user_id", userId);
      const byExt = new Map<string, Raw>(); const byVin = new Map<string, Raw>();
      for (const v of vehicles || []) {
        if (v.source_system === SOURCE && v.external_vehicle_id) byExt.set(v.external_vehicle_id, v);
        if (v.vin) byVin.set(String(v.vin).toUpperCase(), v);
      }
      const ids = (vehicles || []).map((v) => v.id);
      const assetSet = new Set<string>(); const pubMap = new Map<string, string>();
      if (ids.length) {
        const [{ data: imgs }, { data: pubs }] = await Promise.all([
          sb.from("project_images").select("vehicle_id").in("vehicle_id", ids),
          sb.from("website_publications").select("vehicle_id, status").eq("user_id", userId).in("vehicle_id", ids),
        ]);
        for (const i of imgs || []) assetSet.add(i.vehicle_id as string);
        for (const p of pubs || []) pubMap.set(p.vehicle_id as string, p.status as string);
      }

      const items = raws.map((r, idx) => {
        const d = details[idx];
        const { vin } = d ? extractVin(d) : { vin: null };
        const s = summary(d || r);
        let v = byExt.get(s.externalVehicleId);
        let conflict: string | null = null;
        if (!v && vin) {
          const m = byVin.get(vin);
          if (m) {
            if (m.source_system === SOURCE && m.external_vehicle_id && m.external_vehicle_id !== s.externalVehicleId) {
              conflict = `VIN ist bereits Auto3-ID ${m.external_vehicle_id} zugeordnet`;
            } else v = m;
          }
        }
        const linked = !!v && v.source_system === SOURCE && v.external_vehicle_id === s.externalVehicleId;
        const status = !vin ? "no_vin" : !linked ? "not_imported"
          : pubMap.get(v!.id) === "live" ? "website_live"
          : pubMap.get(v!.id) === "draft" ? "website_draft"
          : assetSet.has(v!.id) ? "assets" : "imported";
        return { ...s, vinMasked: vin ? mask(vin) : null, vinValid: !!vin, status, vehicleId: linked ? v!.id : null, conflict, imageCount: d ? images(d).length : 0 };
      });
      const noVin = items.filter((i) => !i.vinValid).length;
      console.log(`[auto3-inventory] list user=${userId} total=${items.length} no_vin=${noVin}`);
      return json({ items, total: items.length, noVin });
    }

    if (action === "import") {
      const ids: string[] = Array.isArray(body?.externalVehicleIds) ? body.externalVehicleIds.map(String).filter((s: string) => /^\d{1,12}$/.test(s)).slice(0, 25) : [];
      if (!ids.length) return json({ error: "Keine gültigen Auto3-IDs übergeben" }, 400);
      const results = [];
      for (const extId of ids) {
        try {
          const d = await detail(extId);
          if (!d || String(d.id) !== extId) { results.push({ externalVehicleId: extId, ok: false, error: "Fahrzeug nicht im Auto3-Bestand gefunden" }); continue; }
          const { vin } = extractVin(d);
          if (!vin) { results.push({ externalVehicleId: extId, ok: false, error: "Keine gültige 17-stellige VIN – nicht importiert" }); continue; }
          const s = summary(d);
          const imgs = images(d).map((url, i) => ({ url, sortOrder: i }));
          const patch = {
            source_system: SOURCE, external_vehicle_id: extId,
            external_internal_number: s.internalNumber, external_images: imgs,
          };
          const { data: ext } = await sb.from("vehicles").select("id").eq("user_id", userId)
            .eq("source_system", SOURCE).eq("external_vehicle_id", extId).maybeSingle();
          const { data: byVin } = await sb.from("vehicles").select("id, source_system, external_vehicle_id")
            .eq("user_id", userId).eq("vin", vin).maybeSingle();
          if (byVin && byVin.external_vehicle_id && byVin.external_vehicle_id !== extId) {
            results.push({ externalVehicleId: extId, ok: false, error: `Konflikt: Diese VIN ist bereits Auto3-ID ${byVin.external_vehicle_id} zugeordnet` }); continue;
          }
          if (ext && byVin && ext.id !== byVin.id) {
            results.push({ externalVehicleId: extId, ok: false, error: "Konflikt: Auto3-ID und VIN gehören zu verschiedenen Fahrzeugakten" }); continue;
          }
          const targetId = ext?.id || byVin?.id;
          if (targetId) {
            const { error } = await sb.from("vehicles").update(patch).eq("id", targetId).eq("user_id", userId);
            if (error) throw error;
            results.push({ externalVehicleId: extId, ok: true, vehicleId: targetId, created: false });
          } else {
            const title = [s.brand, s.model, s.variant].filter(Boolean).join(" ") || null;
            const { data, error } = await sb.from("vehicles").insert({
              user_id: userId, vin, brand: s.brand, model: s.model, year: s.year, title,
              vehicle_data: {}, cover_image_url: imgs[0]?.url || null, ...patch,
            }).select("id").single();
            if (error) throw error;
            results.push({ externalVehicleId: extId, ok: true, vehicleId: data.id, created: true });
          }
        } catch (e) {
          console.error(`[auto3-inventory] import ext=${extId}`, e);
          results.push({ externalVehicleId: extId, ok: false, error: "Import fehlgeschlagen" });
        }
      }
      return json({ results });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    console.error("[auto3-inventory]", e);
    return json({ error: "Auto3-Bestand konnte nicht geladen werden." }, 502);
  }
});
