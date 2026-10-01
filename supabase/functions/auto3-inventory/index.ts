// Read-only Auto3 inventory adapter. Never writes to Auto3.
// Actions: list (inventory + import status), import (attach selected Auto3 vehicles to vehicle records).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { analyzeVehicleOriginals } from "../_shared/auto3-analysis.ts";

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

// ---------- Auto3 → VehicleDataRecord mapper ----------
const str = (v: unknown): string => {
  if (v === null || v === undefined || v === true || v === false) return "";
  return String(v).trim().replace(/,\s*$/, "");
};
const tdGet = (td: Raw, ...labels: string[]): string => {
  const keys = Object.keys(td);
  for (const l of labels) {
    const k = keys.find((x) => x.trim().toLowerCase() === l.toLowerCase());
    if (k && str(td[k])) return str(td[k]);
  }
  for (const l of labels) {
    if (l.length < 5) continue; // short labels (HU, kW, HSN) only match exactly
    const k = keys.find((x) => x.toLowerCase().includes(l.toLowerCase()));
    if (k && str(td[k])) return str(td[k]);
  }
  return "";
};
const euro = (cents: unknown): string => {
  const n = Number(cents);
  return Number.isFinite(n) && n > 0 ? (n / 100).toFixed(2) : "";
};
const num = (v: unknown) => { const s = str(v).replace(",", "."); return s && Number.isFinite(Number(s)) ? s : ""; };

export function mapAuto3Record(d: Raw, vin: string): Record<string, string> {
  const td = (d.technicalData || {}) as Raw;
  const env = (d.environmentalData || {}) as Raw;
  const fuel = (env.consumptions?.fuel || {}) as Raw;
  const elec = (env.consumptions?.electric || env.consumptions?.power || {}) as Raw;
  const co2 = (env.emissions?.combined || {}) as Raw;
  const vm = (d.vehicleModel || {}) as Raw;
  const tdPower = tdGet(td, "Leistung (kW)", "Leistung", "kW");
  const ps = Number(vm.horsePower);
  const power = tdPower || (Number.isFinite(ps) && ps > 0 ? `${Math.round(ps * 0.7355)} kW (${ps} PS)` : "");
  const gross = euro(d.price), net = euro(d.priceNet);
  const vat = gross && net ? String(Math.round((Number(gross) / Number(net) - 1) * 100)) : "";
  const booleanFeatures = Object.entries(td).filter(([, v]) => v === true).map(([k]) => k.trim());
  const features = [...new Set([...((d.equipments || []) as string[]).map(String), ...booleanFeatures])];
  const rec: Record<string, string> = {
    vin,
    brand: str(vm.brand?.name) || tdGet(td, "Marke"),
    model: str(d.model) || str(vm.model) || tdGet(td, "Modell"),
    variant: str(d.modelDescription) || tdGet(td, "Modellbeschreibung"),
    year: str(d.yearOfManufacture) || tdGet(td, "Baujahr", "Modelljahr") || (str(d.firstRegistration).match(/(\d{4})/)?.[1] ?? ""),
    color: str(d.colorDetail) || tdGet(td, "Herstellerfarbname", "Außenfarbe") || str(d.color),
    interiorColor: [tdGet(td, "Innenraumfarbe"), tdGet(td, "Innenraumtyp")].filter(Boolean).join(" / "),
    hsnTsn: tdGet(td, "HSN/TSN", "HSN"),
    fuelType: tdGet(td, "Kraftstoffart", "Kraftstoff"),
    transmission: tdGet(td, "Getriebeart", "Getriebe"),
    driveType: tdGet(td, "Antriebsart", "Antrieb"),
    power,
    displacement: tdGet(td, "Hubraum (cm³)", "Hubraum"),
    cylinders: tdGet(td, "Zylinder"),
    topSpeed: tdGet(td, "Höchstgeschwindigkeit"),
    acceleration: tdGet(td, "Beschleunigung"),
    bodyType: str(d.bodyType) || tdGet(td, "Kategorie", "Karosserie"),
    doors: tdGet(td, "Anzahl Türen", "Türen"),
    seats: str(d.seat) || tdGet(td, "Sitzplätze"),
    curbWeight: tdGet(td, "Leergewicht"),
    grossWeight: str(d.licensedWeight) || tdGet(td, "Zulässiges Gesamtgewicht"),
    mileage: str(d.mileage),
    firstRegistration: str(d.firstRegistration) || tdGet(td, "Erstzulassung"),
    previousOwners: tdGet(td, "Vorbesitzer", "Anzahl Fahrzeughalter"),
    inspectionUntil: tdGet(td, "HU", "HU/AU bis", "Hauptuntersuchung"),
    condition: str(d.condition) || tdGet(td, "Zustand"),
    warranty: td["Garantie"] === true ? "Ja" : tdGet(td, "Garantie"),
    consumptionCombined: num(fuel.combined),
    consumptionCity: num(fuel.city),
    consumptionHighway: num(fuel.highway),
    co2Emissions: num(co2.co2),
    co2Class: str(co2.co2Class),
    electricRange: str(vm.range) || tdGet(td, "Elektrische Reichweite", "Reichweite"),
    consumptionElectric: num(elec.combined),
    netPrice: net,
    grossPrice: gross,
    vatRate: vat,
    internalNumber: str(d.interneNummer) || tdGet(td, "Interne Nummer"),
    location: str(d.location?.name ?? d.location) || tdGet(td, "Standort"),
    features: features.join("\n"),
    notes: str(d.emissionText),
  };
  for (const k of Object.keys(rec)) if (!rec[k]) delete rec[k];
  return rec;
}

/** Nested shape used by the existing generator/pipeline (vehicle/consumption sub-objects). */
function nestedVehicleData(rec: Record<string, string>, d: Raw) {
  const env = (d.environmentalData || {}) as Raw;
  const fuel = (env.consumptions?.fuel || {}) as Raw;
  const cm = (env.costModel || {}) as Raw;
  return {
    vehicleClass: "car",
    vehicle: {
      brand: rec.brand || "", model: rec.model || "", variant: rec.variant || "",
      year: Number(rec.year) || 0, color: rec.color || "", fuelType: rec.fuelType || "",
      transmission: rec.transmission || "", power: rec.power || "", vin: rec.vin,
      features: (rec.features || "").split("\n").filter(Boolean),
    },
    consumption: {
      origin: rec.condition || "", mileage: rec.mileage || "", displacement: rec.displacement || "",
      power: rec.power || "", driveType: rec.driveType || "", fuelType: rec.fuelType || "",
      consumptionCombined: rec.consumptionCombined || "", co2Emissions: rec.co2Emissions || "",
      co2Class: rec.co2Class || "", consumptionCity: rec.consumptionCity || "",
      consumptionSuburban: num(fuel.suburban), consumptionRural: num(fuel.rural),
      consumptionHighway: rec.consumptionHighway || "", energyCostPerYear: num(cm.consumptionCosts),
      fuelPrice: num(cm.fuelPrice), co2CostMedium: num(cm.co2Costs?.middle?.accumulated),
      co2CostLow: num(cm.co2Costs?.low?.accumulated), co2CostHigh: num(cm.co2Costs?.high?.accumulated),
      vehicleTax: num(cm.tax), electricRange: rec.electricRange || "", consumptionElectric: rec.consumptionElectric || "",
      warranty: rec.warranty || "", paintColor: rec.color || "",
    },
    finance: { totalPrice: rec.grossPrice || "" },
  };
}

/** Media with stable Auto3 ids, ordered and deduplicated. */
function mediaList(r: Raw): { key: string; url: string }[] {
  const out: { key: string; url: string }[] = []; const seen = new Set<string>();
  const add = (key: string, u: unknown) => {
    if (typeof u !== "string" || !/^https?:\/\//i.test(u)) return;
    const base = u.split("?")[0];
    if (seen.has(base)) return; seen.add(base); out.push({ key, url: u });
  };
  for (const m of (r.media || []) as Raw[]) add(String(m?.id ?? (m?.path || "").split("?")[0].split("/").pop()), m?.path || m?.url);
  if (!out.length) add("thumb", r.thumbnailImage);
  return out;
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
async function downloadImage(url: string): Promise<{ bytes: Uint8Array; type: string }> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(type)) throw new Error(`kein Bild (${type || "unbekannt"})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("Bild zu groß");
    if (buf.byteLength < 1000) throw new Error("Bild leer");
    return { bytes: buf, type: type === "image/jpg" ? "image/jpeg" : type };
  } finally { clearTimeout(t); }
}
const extFor = (t: string) => t === "image/png" ? "png" : t === "image/webp" ? "webp" : "jpg";

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

    // Step 1: structured vehicle data → vehicles + vehicle_data_cache. Returns media count.
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
          const media = mediaList(d);
          const rec = mapAuto3Record(d, vin);
          const { data: ext } = await sb.from("vehicles").select("id, vehicle_data").eq("user_id", userId)
            .eq("source_system", SOURCE).eq("external_vehicle_id", extId).maybeSingle();
          const { data: byVin } = await sb.from("vehicles").select("id, vehicle_data, source_system, external_vehicle_id")
            .eq("user_id", userId).eq("vin", vin).maybeSingle();
          if (byVin && byVin.external_vehicle_id && byVin.external_vehicle_id !== extId) {
            results.push({ externalVehicleId: extId, ok: false, error: `Konflikt: Diese VIN ist bereits Auto3-ID ${byVin.external_vehicle_id} zugeordnet` }); continue;
          }
          if (ext && byVin && ext.id !== byVin.id) {
            results.push({ externalVehicleId: extId, ok: false, error: "Konflikt: Auto3-ID und VIN gehören zu verschiedenen Fahrzeugakten" }); continue;
          }
          const existing = (ext || byVin) as Raw | null;
          const prev = (existing?.vehicle_data || {}) as Raw;
          const nested = nestedVehicleData(rec, d);
          // Auto3 is source of truth for its fields; keep unrelated existing keys (e.g. dealer, manual notes).
          const vehicleData = {
            ...prev, ...rec, ...nested,
            vehicle: { ...(prev.vehicle || {}), ...nested.vehicle },
            consumption: { ...(prev.consumption || {}), ...nested.consumption },
            finance: { ...(prev.finance || {}), ...nested.finance },
            auto3Import: { ...(prev.auto3Import || {}), status: "importing_images", mediaTotal: media.length, dataImportedAt: new Date().toISOString() },
          };
          const columns = {
            vin, brand: rec.brand || null, model: rec.model || null, year: Number(rec.year) || null,
            color: rec.color || null, title: [rec.brand, rec.model, rec.variant].filter(Boolean).join(" ") || null,
            vehicle_data: vehicleData, source_system: SOURCE, external_vehicle_id: extId,
            external_internal_number: s.internalNumber,
            external_images: media.map((m, i) => ({ url: m.url.split("?")[0], mediaId: m.key, sortOrder: i })),
          };
          let vehicleId: string; let created = false;
          if (existing) {
            const { error } = await sb.from("vehicles").update(columns).eq("id", existing.id).eq("user_id", userId);
            if (error) throw error; vehicleId = existing.id;
          } else {
            const { data, error } = await sb.from("vehicles").insert({ user_id: userId, ...columns }).select("id").single();
            if (error) throw error; vehicleId = data.id; created = true;
          }
          const { error: cacheErr } = await sb.from("vehicle_data_cache").upsert([{ user_id: userId, vin, data: rec }], { onConflict: "user_id,vin" });
          if (cacheErr) console.warn(`[auto3-inventory] cache ext=${extId}`, cacheErr.message);
          console.log(`[auto3-inventory] import-data user=${userId} ext=${extId} vehicle=${vehicleId} fields=${Object.keys(rec).length} media=${media.length} created=${created}`);
          results.push({ externalVehicleId: extId, ok: true, vehicleId, created, fieldCount: Object.keys(rec).length, mediaTotal: media.length });
        } catch (e) {
          console.error(`[auto3-inventory] import ext=${extId}`, e);
          results.push({ externalVehicleId: extId, ok: false, error: "Import fehlgeschlagen" });
        }
      }
      return json({ results });
    }

    // Step 2: copy Auto3 originals into private "originals" bucket in batches (idempotent by Auto3 media id).
    if (action === "import_images") {
      const extId = String(body?.externalVehicleId || "");
      if (!/^\d{1,12}$/.test(extId)) return json({ error: "Ungültige Auto3-ID" }, 400);
      const offset = Math.max(0, Number(body?.offset) || 0);
      const limit = Math.min(6, Math.max(1, Number(body?.limit) || 4));
      const { data: v } = await sb.from("vehicles").select("id, vehicle_data, cover_image_url").eq("user_id", userId)
        .eq("source_system", SOURCE).eq("external_vehicle_id", extId).maybeSingle();
      if (!v) return json({ error: "Fahrzeugakte nicht gefunden – bitte zuerst Fahrzeugdaten übernehmen" }, 404);
      const d = await detail(extId);
      const media = mediaList(d);
      const prefix = `${userId}/${v.id}`;
      const { data: files } = await sb.storage.from("originals").list(prefix, { limit: 1000 });
      const existingKeys = new Map<string, string>();
      for (const f of files || []) { const m = f.name.match(/^auto3-\d{3}-(.+)\.(jpg|png|webp)$/); if (m) existingKeys.set(m[1], f.name); }
      const batch = media.slice(offset, offset + limit);
      const warnings: string[] = []; let stored = 0, skipped = 0;
      await pool(batch, 3, async (m) => {
        const idx = media.indexOf(m) + 1;
        if (existingKeys.has(m.key)) { skipped++; return; }
        try {
          const img = await downloadImage(m.url);
          const name = `auto3-${String(idx).padStart(3, "0")}-${m.key}.${extFor(img.type)}`;
          const { error } = await sb.storage.from("originals").upload(`${prefix}/${name}`, img.bytes, { contentType: img.type, upsert: true });
          if (error) throw error;
          stored++;
        } catch (e) {
          warnings.push(`Bild ${idx}: ${e instanceof Error ? e.message : "Fehler"}`);
        }
      });
      const done = offset + limit >= media.length;
      if (done) {
        const { data: after } = await sb.storage.from("originals").list(prefix, { limit: 1000 });
        const count = (after || []).filter((f) => f.name.startsWith("auto3-")).length;
        const prev = (v.vehicle_data || {}) as Raw;
        const patch: Raw = {
          vehicle_data: { ...prev, auto3Import: { ...(prev.auto3Import || {}), status: count > 0 ? "ready_for_pipeline" : "images_missing", originalsStored: count, mediaTotal: media.length, imagesImportedAt: new Date().toISOString() } },
        };
        // Cover only if none yet: Auto3 title image (public CDN without expiring signature not available → keep source URL base).
        if (!v.cover_image_url && media[0]) patch.cover_image_url = media[0].url.split("?")[0];
        await sb.from("vehicles").update(patch).eq("id", v.id).eq("user_id", userId);
        console.log(`[auto3-inventory] import-images user=${userId} ext=${extId} vehicle=${v.id} stored_total=${count}/${media.length}`);
      }
      return json({ vehicleId: v.id, total: media.length, processed: Math.min(offset + limit, media.length), stored, skipped, warnings, done });
    }

    // Step 3: classify stored originals (perspective + quality) – shared with the Auto3 processing job.
    if (action === "analyze_originals") {
      const vehicleId = String(body?.vehicleId || "");
      if (!/^[0-9a-f-]{36}$/.test(vehicleId)) return json({ error: "Ungültige Fahrzeug-ID" }, 400);
      const r = await analyzeVehicleOriginals(sb, userId, vehicleId);
      if ("error" in r) return json({ error: r.error }, r.status);
      return json({ vehicleId, status: "ready_for_oneshot", analysis: r.analysis });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    console.error("[auto3-inventory]", e);
    return json({ error: "Auto3-Bestand konnte nicht geladen werden." }, 502);
  }
});
