// Auto3 → OneShot background orchestrator.
// Treats an imported Auto3 vehicle as if the dealer had placed ONE master photo into the
// OneShot single-upload field plus the Auto3 datasheet, then runs the existing generators
// (remaster-vehicle-image, generate-banner, generate-video) step by step on the server.
// Every paid step is charged by the generator itself for the acting user; the job pauses on
// missing credits/budget and never auto-publishes anything.
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { analyzeVehicleOriginals, type OriginalAnalysis } from "../_shared/auto3-analysis.ts";
import { selectMaster, masterScore } from "../_shared/auto3-master.ts";

const MODULE = "website-publishing";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNNABLE = ["queued", "oneshot_processing", "generating_perspectives", "generating_banner", "generating_video"];
const ACTIVE = [...RUNNABLE];
const MAX_HOPS = 80;
const MAX_ATTEMPTS = 3;
const LEASE_MS = 140_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

type Job = Record<string, any>;
interface PlanItem { key: string; label: string; prompt: string; cost: number; interior?: boolean; referenceFile?: string | null }
interface BannerItem { formatId: string; label: string; w: number; h: number; prompt: string; cost: number }
interface Plan {
  vehicleDescription: string; modelTier: string; manufacturerLogoUrl?: string | null;
  hero: { prompt: string; cost: number };
  perspectives: PlanItem[];
  banners: BannerItem[];
  video: { enabled: boolean; prompt?: string | null; cost: number };
}

// ── Datasheet from structured Auto3 vehicle_data only (no OCR, no guessing) ──
function datasheetFrom(vd: any, veh: any): Record<string, string> {
  const v = vd?.vehicle || {};
  const pick = (...vals: unknown[]) => { for (const x of vals) { const s = String(x ?? "").trim(); if (s) return s; } return ""; };
  const out: Record<string, string> = {
    brand: pick(v.brand, vd?.brand, veh?.brand), model: pick(v.model, vd?.model, veh?.model),
    variant: pick(v.variant, vd?.variant), year: pick(v.year, vd?.year, veh?.year),
    power: pick(v.power, vd?.power), mileage: pick(vd?.mileage), fuelType: pick(v.fuelType, vd?.fuelType),
    transmission: pick(v.transmission, vd?.transmission), color: pick(v.color, vd?.color, veh?.color),
    firstRegistration: pick(vd?.firstRegistration, v.firstRegistration), price: pick(vd?.finance?.totalPrice, vd?.price),
    co2Class: pick(vd?.co2Class), consumption: pick(vd?.notes), bodyType: pick(vd?.bodyType),
  };
  return Object.fromEntries(Object.entries(out).filter(([, x]) => x));
}

function validatePlan(p: any): Plan | null {
  if (!p || typeof p !== "object") return null;
  const str = (s: unknown, max = 60000) => typeof s === "string" && s.length > 0 && s.length <= max;
  const cost = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100;
  if (!str(p.vehicleDescription, 500) || !str(p.modelTier, 30) || !str(p.hero?.prompt) || !cost(p.hero?.cost)) return null;
  if (!Array.isArray(p.perspectives) || p.perspectives.length > 20) return null;
  if (!Array.isArray(p.banners) || p.banners.length > 10) return null;
  for (const x of p.perspectives) if (!str(x?.key, 80) || !str(x?.prompt) || !cost(x?.cost)) return null;
  for (const b of p.banners) if (!str(b?.formatId, 40) || !str(b?.prompt) || !cost(b?.cost) || !(b.w > 0 && b.h > 0)) return null;
  if (typeof p.video?.enabled !== "boolean" || !cost(p.video?.cost)) return null;
  return p as Plan;
}

export function planTotal(p: Plan): number {
  return p.hero.cost + p.perspectives.reduce((s, x) => s + x.cost, 0) + p.banners.reduce((s, x) => s + x.cost, 0) + (p.video.enabled ? p.video.cost : 0);
}

// ── Helpers ──
async function balanceOf(sb: SupabaseClient, userId: string): Promise<number> {
  const { data } = await sb.from("credit_balances").select("balance").eq("user_id", userId).maybeSingle();
  return data?.balance ?? 0;
}

async function hasModule(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("user_module_access").select("enabled").eq("user_id", userId).eq("module_key", MODULE).maybeSingle();
  return !!data?.enabled;
}

async function toDataUrl(blob: Blob, fallbackMime = "image/jpeg") {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || fallbackMime};base64,${encodeBase64(bytes)}`;
}

async function originalDataUrl(sb: SupabaseClient, job: Job, file: string) {
  const { data, error } = await sb.storage.from("originals").download(`${job.user_id}/${job.vehicle_id}/${file}`);
  if (error || !data) throw new Error(`Original ${file} nicht lesbar`);
  return toDataUrl(data);
}

async function urlDataUrl(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Bild nicht ladbar (${r.status})`);
  return toDataUrl(await r.blob(), "image/png");
}

function b64ToBytes(b64: string) {
  const raw = b64.includes(",") ? b64.split(",")[1] : b64;
  return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
}

async function saveGalleryImage(sb: SupabaseClient, job: Job, b64: string, name: string, perspective: string, sort: number) {
  const path = `${job.user_id}/auto3-jobs/${job.vehicle_id}/${job.id}/${name}.png`;
  const { error } = await sb.storage.from("vehicle-images").upload(path, b64ToBytes(b64), { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
  const url = sb.storage.from("vehicle-images").getPublicUrl(path).data.publicUrl;
  const folder = job.plan?.galleryFolder || `OneShot Auto3 – ${job.plan?.vehicleDescription || "Fahrzeug"}`;
  const { error: insErr } = await sb.from("project_images").insert({
    vehicle_id: job.vehicle_id, user_id: job.user_id, project_id: null, image_url: url, image_base64: "",
    perspective, sort_order: sort, gallery_folder: folder,
  });
  if (insErr && insErr.code !== "23505") throw new Error(`Galerie-Eintrag fehlgeschlagen: ${insErr.message}`);
  const { data: v } = await sb.from("vehicles").select("cover_image_url").eq("id", job.vehicle_id).maybeSingle();
  if (v && !v.cover_image_url) await sb.from("vehicles").update({ cover_image_url: url }).eq("id", job.vehicle_id);
  return url;
}

async function callGenerator(fn: string, body: unknown, userId: string): Promise<{ status: number; data: any }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json",
        "x-internal-job": "auto3-processing", "x-acting-user-id": userId,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  } catch (e) {
    return { status: 599, data: { error: e instanceof Error ? e.message : "Netzwerkfehler" } };
  }
}

function kick(jobId: string, hop: number, delayMs = 1500) {
  const p = (async () => {
    await sleep(delayMs);
    await fetch(`${SUPABASE_URL}/functions/v1/auto3-processing-job`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-internal-job": "auto3-processing" },
      body: JSON.stringify({ action: "tick", jobId, hop }),
    }).then((r) => r.text()).catch((e) => console.error("[auto3-job] kick failed", e));
  })();
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}

async function update(sb: SupabaseClient, id: string, patch: Record<string, unknown>) {
  const { error } = await sb.from("auto3_processing_jobs").update(patch).eq("id", id);
  if (error) console.error("[auto3-job] update failed", error.message);
}

function progressOf(job: Job, steps: any) {
  const p: Plan = job.plan;
  const total = 1 + p.perspectives.length + p.banners.length + (p.video.enabled ? 1 : 0);
  let done = steps.hero?.status === "done" ? 1 : 0;
  for (const x of p.perspectives) if (["done", "skipped"].includes(steps.perspectives?.[x.key]?.status)) done++;
  for (const b of p.banners) if (["done", "skipped"].includes(steps.banners?.[b.formatId]?.status)) done++;
  if (p.video.enabled && ["done", "skipped"].includes(steps.video?.status)) done++;
  return { progress_done: done, progress_total: total };
}

// ── One step per tick ──
async function runTick(sb: SupabaseClient, jobId: string, hop: number) {
  const nowIso = new Date().toISOString();
  const { data: job } = await sb.from("auto3_processing_jobs")
    .update({ lease_until: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("id", jobId).in("status", RUNNABLE).or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .select("*").maybeSingle();
  if (!job) return { skipped: true };
  const release = (patch: Record<string, unknown>) => update(sb, job.id, { ...patch, lease_until: null });

  if (!(await hasModule(sb, job.user_id))) { await release({ status: "paused", pause_reason: "module", error: "Auto3-Modul ist für dieses Konto nicht mehr freigeschaltet." }); return { paused: true }; }
  const plan: Plan = job.plan;
  if (!plan) { await release({ status: "failed", error: "Kein Aufbereitungsplan vorhanden." }); return { failed: true }; }
  const { data: profile } = await sb.from("vehicle_processing_profiles").select("approved_at, approved_max_credits_per_job").eq("user_id", job.user_id).maybeSingle();
  const cap = profile?.approved_at ? (profile.approved_max_credits_per_job ?? 0) : 0;
  const steps = structuredClone(job.steps || {});
  steps.perspectives ||= {}; steps.banners ||= {};

  // Determine next step
  type Next = { kind: "hero" } | { kind: "perspective"; item: PlanItem } | { kind: "banner"; item: BannerItem } | { kind: "video" } | { kind: "done" };
  let next: Next = { kind: "done" };
  if (steps.hero?.status !== "done") next = { kind: "hero" };
  else {
    const p = plan.perspectives.find((x) => !["done", "skipped"].includes(steps.perspectives[x.key]?.status));
    const b = !p && plan.banners.find((x) => !["done", "skipped"].includes(steps.banners[x.formatId]?.status));
    if (p) next = { kind: "perspective", item: p };
    else if (b) next = { kind: "banner", item: b };
    else if (plan.video.enabled && !["done", "skipped"].includes(steps.video?.status)) next = { kind: "video" };
  }

  if (next.kind === "done") {
    await release({ status: "ready_for_review", finished_at: new Date().toISOString(), progress_label: "Fertig – Ergebnisse prüfen", ...progressOf(job, steps), pause_reason: null, error: null });
    return { done: true };
  }

  const stepCost = next.kind === "hero" ? plan.hero.cost : next.kind === "video" ? (steps.video?.operationName ? 0 : plan.video.cost) : next.item.cost;
  if (job.credits_spent + stepCost > cap) {
    await release({ status: "paused", pause_reason: "budget", error: `Freigegebenes Budget von ${cap} Credits pro Fahrzeug würde überschritten.` });
    return { paused: true };
  }

  const fail = async (status: number, message: string) => {
    if (status === 402) { await release({ status: "paused", pause_reason: "credits", error: "Nicht genügend Credits – bitte Guthaben aufladen und erneut versuchen.", steps }); return; }
    const transient = status === 429 || status >= 500;
    const attempts = job.attempts + 1;
    if (transient && attempts < MAX_ATTEMPTS) {
      await release({ attempts, error: `Vorübergehender Fehler, neuer Versuch (${attempts}/${MAX_ATTEMPTS - 1})`, steps });
      if (hop < MAX_HOPS) kick(job.id, hop + 1, 20_000 * attempts);
      return;
    }
    await release({ status: "failed", attempts, error: message.slice(0, 300), steps });
  };

  const masterUrl = await originalDataUrl(sb, job, job.master_file);
  const vehicleCtx = { vehicleDescription: plan.vehicleDescription, modelTier: plan.modelTier, manufacturerLogoUrl: plan.manufacturerLogoUrl || null };

  if (next.kind === "hero") {
    await update(sb, job.id, { status: "oneshot_processing", progress_label: "OneShot-Masterbild wird erstellt", started_at: job.started_at || new Date().toISOString() });
    // Exactly the OneShot hero call: one strict reference, full OneShot master prompt.
    const r = await callGenerator("remaster-vehicle-image", {
      imageBase64: masterUrl, mainImageRole: "Auto3 master photo – exact same-angle identity source",
      dynamicPrompt: plan.hero.prompt, ...vehicleCtx,
    }, job.user_id);
    if (r.status !== 200 || !r.data?.imageBase64) return void (await fail(r.status === 200 ? 502 : r.status, r.data?.error || "Masterbild fehlgeschlagen"));
    const url = await saveGalleryImage(sb, job, r.data.imageBase64, "master", "OneShot: Master-Bild", 0);
    steps.hero = { status: "done", url };
  } else if (next.kind === "perspective") {
    const item = next.item;
    await update(sb, job.id, { status: "generating_perspectives", progress_label: `Perspektive: ${item.label}` });
    let body: Record<string, unknown>;
    if (item.interior) {
      if (!item.referenceFile) { steps.perspectives[item.key] = { status: "skipped", note: "Keine passende Innenraum-Aufnahme" }; }
      body = { imageBase64: item.referenceFile ? await originalDataUrl(sb, job, item.referenceFile) : null, mainImageRole: "interior reference – same vehicle interior", dynamicPrompt: item.prompt, ...vehicleCtx };
    } else {
      const heroUrl = await urlDataUrl(steps.hero.url);
      body = {
        imageBase64: heroUrl, mainImageRole: "identity_anchor_exterior_34_front – remastered OneShot master",
        additionalImages: [masterUrl], additionalImageRoles: ["original Auto3 master photo – same vehicle"],
        dynamicPrompt: item.prompt, ...vehicleCtx,
      };
    }
    if (steps.perspectives[item.key]?.status !== "skipped") {
      const r = await callGenerator("remaster-vehicle-image", body, job.user_id);
      if (r.status !== 200 || !r.data?.imageBase64) return void (await fail(r.status === 200 ? 502 : r.status, r.data?.error || `${item.label} fehlgeschlagen`));
      const idx = plan.perspectives.indexOf(item) + 1;
      const url = await saveGalleryImage(sb, job, r.data.imageBase64, item.key.toLowerCase(), `OneShot: ${item.label}`, idx);
      steps.perspectives[item.key] = { status: "done", url };
    }
  } else if (next.kind === "banner") {
    const item = next.item;
    await update(sb, job.id, { status: "generating_banner", progress_label: `Banner: ${item.label}` });
    const heroUrl = await urlDataUrl(steps.hero.url);
    const r = await callGenerator("generate-banner", { prompt: item.prompt, imageBase64: heroUrl, modelTier: plan.modelTier, width: item.w, height: item.h }, job.user_id);
    if (r.status !== 200 || !r.data?.imageBase64) return void (await fail(r.status === 200 ? 502 : r.status, r.data?.error || "Banner fehlgeschlagen"));
    const path = `${job.user_id}/${job.vehicle_id}/${Date.now()}-oneshot-${item.formatId}.png`;
    const { error } = await sb.storage.from("banners").upload(path, b64ToBytes(r.data.imageBase64), { contentType: "image/png" });
    if (error) return void (await fail(500, `Banner speichern fehlgeschlagen: ${error.message}`));
    steps.banners[item.formatId] = { status: "done", url: sb.storage.from("banners").getPublicUrl(path).data.publicUrl };
  } else if (next.kind === "video") {
    await update(sb, job.id, { status: "generating_video", progress_label: "Video wird erstellt" });
    if (!steps.video?.operationName) {
      const heroUrl = await urlDataUrl(steps.hero.url);
      const r = await callGenerator("generate-video", { action: "start", imageBase64: heroUrl, prompt: plan.video.prompt || undefined }, job.user_id);
      if (r.status !== 200 || !r.data?.operationName) return void (await fail(r.status === 200 ? 502 : r.status, r.data?.error || "Video-Start fehlgeschlagen"));
      steps.video = { status: "running", operationName: r.data.operationName, polls: 0 };
      await release({ steps, credits_spent: job.credits_spent + plan.video.cost, attempts: 0, ...progressOf(job, steps) });
      if (hop < MAX_HOPS) kick(job.id, hop + 1, 20_000);
      return { step: "video_started" };
    }
    const r = await callGenerator("generate-video", { action: "poll", operationName: steps.video.operationName, vehicleId: job.vehicle_id }, job.user_id);
    if (r.data?.done) {
      const url = r.data.videoUrl || r.data.videoUri || null;
      steps.video = url ? { ...steps.video, status: "done", url } : { ...steps.video, status: "failed", error: r.data.error || "Video fehlgeschlagen" };
      if (!url) { await release({ status: "failed", error: "Video konnte nicht erstellt werden.", steps }); return { failed: true }; }
    } else {
      steps.video.polls = (steps.video.polls || 0) + 1;
      if (steps.video.polls > 40) { await release({ status: "failed", error: "Video: Zeitüberschreitung", steps }); return { failed: true }; }
      await release({ steps });
      if (hop < MAX_HOPS) kick(job.id, hop + 1, 20_000);
      return { step: "video_polling" };
    }
  }

  const skipped = next.kind === "perspective" && steps.perspectives[next.item.key]?.status === "skipped";
  const spent = job.credits_spent + (skipped ? 0 : stepCost);
  await release({ steps, credits_spent: spent, attempts: 0, error: null, ...progressOf(job, steps) });
  if (hop < MAX_HOPS) kick(job.id, hop + 1);
  else await update(sb, job.id, { progress_label: "Wartet auf Fortsetzung" });
  return { step: next.kind };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const internal = req.headers.get("x-internal-job") === "auto3-processing" && token === SERVICE_KEY;

    if (internal && body?.action === "tick" && isUuid(body.jobId)) {
      const hop = Number(body.hop) || 0;
      try {
        return json(await runTick(sb, body.jobId, hop));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Schritt fehlgeschlagen";
        console.error("[auto3-job] tick crashed", msg);
        const { data: j } = await sb.from("auto3_processing_jobs").select("attempts").eq("id", body.jobId).maybeSingle();
        const attempts = (j?.attempts ?? 0) + 1;
        await update(sb, body.jobId, attempts < MAX_ATTEMPTS
          ? { attempts, lease_until: null, error: `Vorübergehender Fehler: ${msg}`.slice(0, 300) }
          : { attempts, lease_until: null, status: "failed", error: msg.slice(0, 300) });
        if (attempts < MAX_ATTEMPTS && hop < MAX_HOPS) kick(body.jobId, hop + 1, 20_000 * attempts);
        return json({ error: msg }, 500);
      }
    }

    if (!token) return json({ error: "Nicht angemeldet" }, 401);
    const { data: claims, error: authErr } = await sb.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (authErr || !userId) return json({ error: "Nicht angemeldet" }, 401);
    if (!(await hasModule(sb, userId))) return json({ error: "Auto3-Automatik ist für dieses Konto nicht freigeschaltet." }, 403);

    const action = body?.action;
    const vehicleId = String(body?.vehicleId || "");

    if (action === "prepare") {
      if (!isUuid(vehicleId)) return json({ error: "Ungültige Fahrzeug-ID" }, 400);
      const { data: veh } = await sb.from("vehicles").select("id, brand, model, year, color, vehicle_data, source_system").eq("id", vehicleId).eq("user_id", userId).maybeSingle();
      if (!veh) return json({ error: "Fahrzeugakte nicht gefunden" }, 404);
      const { data: existing } = await sb.from("auto3_processing_jobs").select("id, status").eq("vehicle_id", vehicleId).maybeSingle();
      if (existing && ACTIVE.includes(existing.status)) return json({ error: "Für dieses Fahrzeug läuft bereits eine Aufbereitung." }, 409);

      const { data: prep } = await sb.from("auto3_oneshot_preparations").select("analysis").eq("vehicle_id", vehicleId).maybeSingle();
      let analysis = (Array.isArray(prep?.analysis) ? prep!.analysis : []) as OriginalAnalysis[];
      if (!analysis.length || body?.reanalyze) {
        const r = await analyzeVehicleOriginals(sb, userId, vehicleId);
        if ("error" in r) return json({ error: r.error }, r.status);
        analysis = r.analysis;
      }
      let master = selectMaster(analysis);
      if (body?.masterFile) {
        const chosen = analysis.find((a) => a.file === body.masterFile);
        const s = chosen ? masterScore(chosen) : null;
        if (!chosen || s === null) return json({ error: "Dieses Bild ist als Masterbild nicht geeignet (nur vollständige Außenaufnahmen)." }, 400);
        master = { file: chosen.file, category: chosen.category, quality: chosen.quality, score: s, reason: "Manuell gewählt", alternatives: master?.alternatives || [] };
      }
      if (!master) return json({ error: "Kein geeignetes Masterbild unter den Originalen (vollständige Außenaufnahme benötigt)." }, 422);
      const datasheet = datasheetFrom(veh.vehicle_data, veh);
      const row = {
        user_id: userId, vehicle_id: vehicleId, status: "master_selected", master_file: master.file, master_reason: master.reason,
        master_alternatives: master.alternatives, datasheet, plan: null, steps: {}, progress_done: 0, progress_total: 0,
        progress_label: `${analysis.length} Originale · Master erkannt`, cost_estimate: 0, credits_spent: 0,
        pause_reason: null, error: null, attempts: 0, lease_until: null, started_at: null, finished_at: null,
      };
      const { data: saved, error } = await sb.from("auto3_processing_jobs").upsert(row, { onConflict: "vehicle_id" }).select("*").single();
      if (error) return json({ error: "Job konnte nicht gespeichert werden." }, 500);
      return json({ job: saved, master, originals: analysis.length });
    }

    if (action === "start" || action === "retry") {
      const { data: job } = await sb.from("auto3_processing_jobs").select("*").eq(isUuid(body?.jobId) ? "id" : "vehicle_id", isUuid(body?.jobId) ? body.jobId : vehicleId).eq("user_id", userId).maybeSingle();
      if (!job) return json({ error: "Kein vorbereiteter Job gefunden." }, 404);
      if (action === "start" && !["master_selected", "paused", "failed", "ready_for_review"].includes(job.status)) return json({ error: "Job läuft bereits." }, 409);
      if (action === "retry" && !["paused", "failed"].includes(job.status) && !(RUNNABLE.includes(job.status) && (!job.lease_until || new Date(job.lease_until) < new Date()))) return json({ error: "Job kann gerade nicht fortgesetzt werden." }, 409);
      const plan = action === "start" && body?.plan ? validatePlan(body.plan) : job.plan;
      if (!plan) return json({ error: "Ungültiger Aufbereitungsplan." }, 400);
      const total = planTotal(plan);
      const { data: profile } = await sb.from("vehicle_processing_profiles").select("id, approved_at, approved_max_credits_per_job").eq("user_id", userId).maybeSingle();
      if (!profile?.approved_at) return json({ error: "Bitte das Aufbereitungsprofil zuerst ausdrücklich freigeben." }, 403);
      if (total > (profile.approved_max_credits_per_job ?? 0)) return json({ error: `Job kostet ${total} Credits, freigegeben sind ${profile.approved_max_credits_per_job} Credits pro Fahrzeug.` }, 403);
      const fresh = action === "start" && (job.status === "master_selected" || job.status === "ready_for_review" || !!body?.plan);
      const remaining = Math.max(0, total - (fresh ? 0 : job.credits_spent));
      const balance = await balanceOf(sb, userId);
      const base = {
        plan, profile_id: profile.id, cost_estimate: total, attempts: 0, error: null, lease_until: null,
        ...(fresh ? { steps: {}, credits_spent: 0, started_at: null, finished_at: null } : {}),
      };
      if (balance < remaining) {
        await update(sb, job.id, { ...base, status: "paused", pause_reason: "credits", error: `Nicht genügend Credits: benötigt ${remaining}, verfügbar ${balance}.` });
        return json({ status: "paused", pause_reason: "credits", needed: remaining, balance });
      }
      await update(sb, job.id, { ...base, status: "queued", pause_reason: null, progress_label: "In Warteschlange" });
      kick(job.id, 0, 200);
      return json({ status: "queued", jobId: job.id, cost: total });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    console.error("[auto3-processing-job]", e);
    return json({ error: "Auto3-Aufbereitung vorübergehend nicht möglich." }, 500);
  }
});
