// Shared Auto3 original analysis (perspective + quality only). Vehicle facts come only from Auto3 data, never from images.
// Used by auto3-inventory (analyze_originals) and auto3-processing-job (master selection). Never charges credits.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
type Raw = Record<string, any>;

const ANALYSIS_CATEGORIES = ["front", "front_3_4", "side", "rear_3_4", "rear", "interior_front", "cockpit", "front_seats", "rear_seats", "detail", "engine", "other"];
async function geminiUpload(apiKey: string, bytes: Uint8Array, mimeType: string, name: string) {
  const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength), "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { displayName: name } }),
  });
  if (!start.ok) throw new Error(`upload start ${start.status}`);
  const url = start.headers.get("X-Goog-Upload-URL");
  if (!url) throw new Error("no upload url");
  const up = await fetch(url, { method: "POST", headers: { "Content-Length": String(bytes.byteLength), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: bytes });
  if (!up.ok) throw new Error(`upload ${up.status}`);
  const meta = await up.json();
  const f = meta.file ?? meta;
  return { uri: f.uri as string, mimeType };
}
const ANALYSIS_PROMPT = `Du klassifizierst Händlerfotos EINES Fahrzeugs für eine Bildaufbereitung.
Ordne JEDES Bild genau einer Kategorie zu:
front (frontal), front_3_4 (schräg vorne), side (reine Seitenansicht), rear_3_4 (schräg hinten), rear (frontal von hinten),
interior_front (Innenraum vorne mit Sitzen + Lenkrad), cockpit (Armaturenbrett/Mittelkonsole/Instrumente), front_seats (Vordersitze im Fokus),
rear_seats (Rückbank/Fond), detail (Felge, Scheinwerfer, Emblem, Kofferraum o.ä.), engine (Motorraum), other (kein Fahrzeug, Datenblatt, unbrauchbar).
Bewerte quality 0-100 als Eignung als Referenz (Schärfe, Belichtung, Fahrzeug vollständig im Bild, keine starke Verdeckung).
Erkenne KEINE Marke, kein Modell, keine Farbe, keine technischen Daten.
Antworte nur mit JSON: {"items":[{"index":0,"category":"front_3_4","quality":82,"vehicleComplete":true,"note":"kurz, deutsch"}]}`;
async function classifyOriginals(apiKey: string, refs: { file: string; uri: string; mimeType: string }[]) {
  const parts: Raw[] = [{ text: ANALYSIS_PROMPT }];
  refs.forEach((r, i) => { parts.push({ text: `Bild ${i}:` }); parts.push({ file_data: { mime_type: r.mimeType, file_uri: r.uri } }); });
  const reqBody = JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } });
  let text = "";
  outer: for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, body: reqBody,
      });
      if (r.ok) { const d = await r.json(); text = d.candidates?.[0]?.content?.parts?.[0]?.text || ""; if (text) break outer; }
      else { console.error(`[auto3-inventory] classify ${model} ${r.status}`, (await r.text()).slice(0, 300)); }
      if (r.status !== 429 && r.status < 500) break;
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
  if (!text) throw new Error("keine Klassifikation");
  const m = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : text) as { items?: Raw[] };
  return refs.map((r, i) => {
    const it = parsed.items?.find((x) => Number(x.index) === i) || {};
    const category = ANALYSIS_CATEGORIES.includes(it.category) ? it.category : "other";
    const quality = Math.max(0, Math.min(100, Math.round(Number(it.quality) || 0)));
    return { file: r.file, category, quality, vehicleComplete: it.vehicleComplete !== false, note: String(it.note || "").slice(0, 120) };
  });
}


async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export type OriginalAnalysis = { file: string; category: string; quality: number; vehicleComplete: boolean; note: string };

export async function analyzeVehicleOriginals(sb: SupabaseClient, userId: string, vehicleId: string):
  Promise<{ analysis: OriginalAnalysis[]; originals: number } | { error: string; status: number }> {
  const { data: v } = await sb.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", userId).maybeSingle();
  if (!v) return { error: "Fahrzeugakte nicht gefunden", status: 404 };
  const prefix = `${userId}/${vehicleId}`;
  const { data: files } = await sb.storage.from("originals").list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  const originals = (files || []).filter((f) => f.name.startsWith("auto3-")).slice(0, 40);
  const upsert = (patch: Raw) => sb.from("auto3_oneshot_preparations")
    .upsert({ user_id: userId, vehicle_id: vehicleId, ...patch }, { onConflict: "vehicle_id" });
  if (!originals.length) {
    await upsert({ status: "imported", originals_count: 0, error: "Keine Auto3-Originale gespeichert" });
    return { error: "Keine Auto3-Originale in der Fahrzeugakte", status: 409 };
  }
  await upsert({ status: "analyzing_originals", originals_count: originals.length, error: null });
  try {
    const { data: keyRow } = await sb.from("admin_secrets").select("value").eq("key", "GEMINI_API_KEY").maybeSingle();
    const apiKey = (keyRow?.value as string) || Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("Bildanalyse nicht konfiguriert");
    const refs = await pool(originals, 4, async (f) => {
      const { data: blob, error } = await sb.storage.from("originals").download(`${prefix}/${f.name}`);
      if (error || !blob) throw new Error(`Original ${f.name} nicht lesbar`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const mime = blob.type || (f.name.endsWith(".png") ? "image/png" : f.name.endsWith(".webp") ? "image/webp" : "image/jpeg");
      return { file: f.name, ...(await geminiUpload(apiKey, bytes, mime, f.name)) };
    });
    const analysis = await classifyOriginals(apiKey, refs) as OriginalAnalysis[];
    await upsert({ status: "ready_for_oneshot", analysis, analyzed_at: new Date().toISOString(), error: null });
    return { analysis, originals: originals.length };
  } catch (e) {
    console.error("[auto3-analysis] failed", e instanceof Error ? e.message : e);
    await upsert({ status: "analysis_failed", error: "Bildanalyse vorübergehend nicht möglich" });
    return { error: "Bildanalyse vorübergehend nicht möglich. Bitte erneut versuchen.", status: 503 };
  }
}
