// Read-only REST API for landing pages created in autohaus.ai (WordPress plugin source).
// Separate from api-vehicles on purpose – that function must stay untouched.
//
//   GET /api-landingpages                 → lightweight list (incl. recently deleted)
//   GET /api-landingpages/:id             → full structured data (SEO, liveInventory)
//   GET /api-landingpages/:id/html        → HTML fragment (no <html>/<head>/<body>)
//   GET /api-landingpages/:id/inventory   → current vehicles for the liveInventory container
//
// Auth: header `x-api-key: ak_...` (profiles.api_key). Only the key owner's pages are returned.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildFragment, buildSeo, financingStatus, matchVehicles, type LiveConfig } from "./landing-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store, max-age=0",
};
const API_VERSION = "1.0";
const MAX_LIST = 1000;
const DELETED_RETENTION_DAYS = 90;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTO3_BASE = (Deno.env.get("AUTO3_API_BASE") || "https://dev-api.autoversus.de").replace(/\/$/, "");
const LEGACY_AUTO3_X_BASEURL = Deno.env.get("AUTO3_X_BASEURL") || "https://schmitt.indicar.de";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
const err = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function apiBase(req: Request) {
  const u = new URL(req.url);
  return `${Deno.env.get("SUPABASE_URL") || u.origin}/functions/v1/api-landingpages`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return err(405, "method_not_allowed", "Only GET is supported.");

  try {
    const apiKey = req.headers.get("x-api-key") || "";
    if (!apiKey.startsWith("ak_")) return err(401, "unauthorized", "Missing or invalid API key. Send header: x-api-key");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await sb.from("profiles")
      .select("id, auto3_tenant_url, auto3_account_email")
      .eq("api_key", apiKey).maybeSingle();
    if (!profile) return err(401, "unauthorized", "Invalid API key");
    const userId = profile.id as string;

    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const sub = parts.slice(parts.indexOf("api-landingpages") + 1);
    const base = apiBase(req);

    // ── LIST ──
    if (sub.length === 0) {
      const status = url.searchParams.get("status");
      if (status && !["draft", "published", "archived"].includes(status)) return err(400, "invalid_status", "status must be draft, published or archived");
      let q = sb.from("projects").select("id, title, slug, landing_status, updated_at")
        .eq("user_id", userId).eq("template_id", "landing-page")
        .order("updated_at", { ascending: false }).limit(MAX_LIST);
      if (status) q = q.eq("landing_status", status);
      const { data, error } = await q;
      if (error) throw error;
      const items: Row[] = (data || []).map((p) => ({
        id: p.id, title: cleanTitle(p.title), slug: p.slug, status: p.landing_status, updated_at: p.updated_at,
      }));
      if (url.searchParams.get("include_deleted") !== "false" && !status) {
        const since = new Date(Date.now() - DELETED_RETENTION_DAYS * 864e5).toISOString();
        const { data: del } = await sb.from("landing_page_deletions").select("id, title, slug, deleted_at")
          .eq("user_id", userId).gte("deleted_at", since).order("deleted_at", { ascending: false }).limit(MAX_LIST);
        for (const d of del || []) items.push({ id: d.id, title: cleanTitle(d.title), slug: d.slug, status: "deleted", updated_at: d.deleted_at });
      }
      return json({ apiVersion: API_VERSION, total: items.length, items: items.slice(0, MAX_LIST) });
    }

    const id = sub[0];
    if (!UUID_RE.test(id)) return err(404, "not_found", "Landing page not found");
    const action = sub[1] || "";
    if (sub.length > 2 || !["", "html", "inventory"].includes(action)) return err(404, "not_found", "Unknown endpoint");

    const { data: page, error: pageErr } = await sb.from("projects")
      .select("id, title, slug, landing_status, created_at, updated_at, html_content, vehicle_data")
      .eq("id", id).eq("user_id", userId).eq("template_id", "landing-page").maybeSingle();
    if (pageErr) throw pageErr;
    if (!page) {
      const { data: del } = await sb.from("landing_page_deletions").select("id, slug, deleted_at")
        .eq("id", id).eq("user_id", userId).maybeSingle();
      if (del) return json({ error: { code: "deleted", message: "Landing page was deleted" }, id: del.id, slug: del.slug, status: "deleted", deleted_at: del.deleted_at }, 410);
      return err(404, "not_found", "Landing page not found");
    }

    const vd = (page.vehicle_data || {}) as Row;
    const live = (vd.liveInventory && vd.liveInventory.enabled ? vd.liveInventory : null) as LiveConfig | null;

    // ── DETAIL ──
    if (action === "") {
      const pc = (vd.pageContent || {}) as Row;
      return json({
        apiVersion: API_VERSION,
        id: page.id,
        title: cleanTitle(page.title),
        slug: page.slug,
        status: page.landing_status,
        pageType: vd.pageType || null,
        vehicle: { brand: vd.brand || null, model: vd.model || null, variant: vd.variant || null },
        seo: buildSeo(pc, vd.imageMap || {}, page.landing_status, cleanTitle(page.title)),
        content: {
          h1: pc.meta?.h1 || pc.hero?.headline || null,
          hero: pc.hero || null,
          sections: (pc.sections || []).filter((s: Row) => s.enabled !== false)
            .filter((s: Row) => !(pc.removedElements || []).includes(s.id))
            .map((s: Row) => ({ id: s.id, type: s.type, title: s.title ?? null })),
        },
        contactForm: { enabled: vd.contactFormEnabled !== false },
        liveInventory: live ? {
          enabled: true,
          mode: live.mode, brand: live.brand || "", model: live.model || "",
          condition: live.condition || "all", maxItems: live.maxItems || 8,
          selectedIds: live.mode === "manual" ? (live.selectedIds || []) : [],
          layout: live.layout || "slider", title: live.title || "",
          financeBank: live.financeBank || null,
          detailUrlTemplate: live.cardDesign?.detailUrlTemplate || null,
          containerSelector: `[data-autohaus-live-inventory="${page.id}"]`,
          source: { endpoint: `${base}/${page.id}/inventory`, auth: "x-api-key", recommendedCacheSeconds: 900 },
        } : { enabled: false },
        links: { self: `${base}/${page.id}`, html: `${base}/${page.id}/html`, inventory: live ? `${base}/${page.id}/inventory` : null },
        created_at: page.created_at,
        updated_at: page.updated_at,
      });
    }

    // ── HTML FRAGMENT ──
    if (action === "html") {
      if (!page.html_content) return err(404, "no_html", "Landing page has no rendered HTML yet");
      const html = buildFragment(page.html_content, page.id, live ? `${base}/${page.id}/inventory` : null);
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Landingpage-Updated-At": page.updated_at, "X-Landingpage-Status": page.landing_status },
      });
    }

    // ── LIVE INVENTORY ──
    if (!live) return json({ apiVersion: API_VERSION, landingpageId: page.id, enabled: false, total: 0, vehicles: [] });
    const tenant = normalizeTenant(profile.auto3_tenant_url) || (profile.auto3_account_email ? LEGACY_AUTO3_X_BASEURL : null);
    if (!tenant) return err(409, "no_inventory_source", "No inventory connection configured for this account");
    const raws = await fetchAll(tenant);
    const vehicles = matchVehicles(raws, live).map((v) => ({ ...v, financingStatus: financingStatus(v, live.financeBank) }));
    console.log(`[api-landingpages] inventory user=${userId} page=${page.id} total=${vehicles.length}`);
    return json({
      apiVersion: API_VERSION, landingpageId: page.id, enabled: true,
      generated_at: new Date().toISOString(), total: vehicles.length, vehicles,
    });
  } catch (e) {
    console.error("[api-landingpages] error", e instanceof Error ? e.message : e);
    return err(500, "internal_error", "Internal server error");
  }
});

function cleanTitle(t: string | null | undefined) {
  return String(t || "").replace(/\s*–\s*Landing Page$/, "");
}

function normalizeTenant(v: unknown): string | null {
  try {
    const u = new URL(String(v || "").trim());
    return u.protocol === "https:" && !u.username && !u.password ? u.origin : null;
  } catch { return null; }
}

async function auto3Get(path: string, tenant: string) {
  const res = await fetch(`${AUTO3_BASE}${path}`, { headers: { Accept: "application/json", "X-BASEURL": tenant } });
  if (!res.ok) { await res.text(); throw new Error(`Auto3 ${res.status}`); }
  return res.json();
}

async function fetchAll(tenant: string): Promise<Row[]> {
  const first = await auto3Get(`/v1/vehicle/vehicle/buy?page=0&pageSize=100&includeImages=true`, tenant);
  const pages = Math.min(20, Math.max(1, Number(first?.totalPages ?? 1) || 1));
  const out: Row[] = [...(first?.content || [])];
  if (pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) =>
      auto3Get(`/v1/vehicle/vehicle/buy?page=${i + 1}&pageSize=100&includeImages=true`, tenant)));
    for (const r of rest) out.push(...(r?.content || []));
  }
  return out;
}
