import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // Always serve fresh data — vehicle edits must be visible via the API immediately.
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith("ak_")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid API key. Send header: x-api-key" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Look up user by api_key
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("api_key", apiKey)
    .single();

  if (profileErr || !profile) {
    return new Response(
      JSON.stringify({ error: "Invalid API key" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId = profile.id;
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path after /api-vehicles: e.g. [] or [":id"] or [":id", "html"]
  const subPath = pathParts.slice(pathParts.indexOf("api-vehicles") + 1);

  // Helper: merge project + linked vehicles row.
  // The PDF/Landing-Page editor auto-saves every manual change into
  // projects.vehicle_data. That is the single source of truth and MUST win.
  // The vehicles-row scalar columns (brand/model/year/color/vin/title) only
  // serve as a fallback when a field has never been touched in the editor.
  const overlayVehicle = (project: any, vehicle: any) => {
    const pData = (project.vehicle_data as Record<string, any>) || {};
    const pNested = (pData.vehicle as Record<string, any>) || {};
    const vData = ((vehicle?.vehicle_data as Record<string, any>) || {});
    const vNested = (vData.vehicle as Record<string, any>) || {};
    const nonEmpty = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
    const identity: Record<string, any> = { ...vNested, ...pNested };
    if (vehicle) {
      for (const k of ['brand', 'model', 'year', 'color', 'vin'] as const) {
        if (!nonEmpty(identity[k]) && nonEmpty(vehicle[k])) identity[k] = vehicle[k];
      }
    }

    // ─── Zwei getrennte Titel ─────────────────────────────────────────────
    // 1) offerTitle  = Angebotsseiten-/Preview-H1-Titel.
    //    Aus projects.vehicle_data.vehicle: titleOverride ODER brand+model+variant.
    //    Keine Normalisierung.
    // 2) dashboardTitle = Marketing-/Fahrzeugkarten-Titel.
    //    Priorität: dashboardTitleOverride → vehicles.title → brand+model → offerTitle.
    // 3) title  = Backward-Compat-Alias für offerTitle.
    const override = nonEmpty(identity.titleOverride) ? String(identity.titleOverride).trim() : '';
    const brand = String(identity.brand || '').trim();
    const model = String(identity.model || '').trim();
    const variant = String(identity.variant || '').trim();
    let offerTitle: string;
    if (override) {
      // titleOverride ist bereits der finale H1-Titel — variant NICHT anhängen.
      offerTitle = override;
    } else {
      const base = `${brand} ${model}`.trim();
      offerTitle = base;
      if (variant && !base.toLowerCase().includes(variant.toLowerCase())) {
        offerTitle = `${base} ${variant}`.trim();
      }
    }
    const fallbackTitle = (project.title || vehicle?.title || '').trim();
    offerTitle = offerTitle || fallbackTitle;

    const dashboardOverride = nonEmpty(identity.dashboardTitleOverride)
      ? String(identity.dashboardTitleOverride).trim()
      : '';
    const vTitle = String(vehicle?.title || '').trim();
    const vBrand = String(vehicle?.brand || '').trim();
    const vModel = String(vehicle?.model || '').trim();
    const vBrandModel = (vBrand || vModel) ? `${vBrand} ${vModel}`.trim() : '';
    const dashboardTitle =
      dashboardOverride ||
      vTitle ||
      vBrandModel ||
      offerTitle;


    return {
      ...project,
      title: offerTitle,
      offerTitle,
      dashboardTitle,
      vehicle_data: { ...pData, vehicle: identity },
    };
  };

  // Bankangaben / Pflichthinweise — kategorieabhängig aus dealer.* zusammensetzen.
  // Quelle: vehicle_data.dealer.{leasingLegalText, financingLegalText, defaultLegalText,
  // leasingBank, financingBank}. Identisch zur Tool-Preview (buildLegalTextHTML).
  const computeLegalNotice = (vd: any) => {
    const dealer = (vd?.dealer as Record<string, any>) || {};
    const category = String(vd?.category || '').toLowerCase();
    const isLeasing = category.includes('leasing');
    const isFinancing = category.includes('finanzierung') || category.includes('kredit');

    let type: 'leasing' | 'financing' | 'default' | null = null;
    let text = '';
    let bank = '';
    if (isLeasing && dealer.leasingLegalText) {
      type = 'leasing';
      text = String(dealer.leasingLegalText || '');
      bank = String(dealer.leasingBank || '');
    } else if (isFinancing && dealer.financingLegalText) {
      type = 'financing';
      text = String(dealer.financingLegalText || '');
      bank = String(dealer.financingBank || '');
    } else if (dealer.defaultLegalText) {
      type = 'default';
      text = String(dealer.defaultLegalText || '');
    }
    if (!text && !bank) return null;
    return {
      label: 'Bankangaben / Pflichthinweise',
      type,
      bank: bank || null,
      text,               // Zeilenumbrüche (\n) bleiben erhalten — nicht kürzen.
      footnoteMarker: (isLeasing || isFinancing) ? '1' : null,
    };
  };

  try {
    // GET /api-vehicles — list all vehicles
    // Sortierung identisch zum Dashboard (get_vehicle_dashboard_page):
    //   1) Fahrzeuge nach vehicles.updated_at DESC NULLS LAST, created_at DESC, id
    //   2) Projekte ohne verknüpftes Fahrzeug am Ende, nach projects.updated_at DESC
    if (subPath.length === 0) {
      const { data: vehiclesOrdered, error: vErr } = await supabase
        .from("vehicles")
        .select("id, title, brand, model, year, color, vin, vehicle_data, updated_at, created_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
      if (vErr) throw vErr;

      const vehicleMap: Record<string, any> = {};
      const vehicleOrder = new Map<string, number>();
      (vehiclesOrdered || []).forEach((v: any, i: number) => {
        vehicleMap[v.id] = v;
        vehicleOrder.set(v.id, i);
      });

      const { data: projects, error } = await supabase
        .from("projects")
        .select("id, title, template_id, vehicle_data, main_image_url, vehicle_id, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const sorted = [...(projects || [])].sort((a: any, b: any) => {
        const ai = a.vehicle_id ? (vehicleOrder.get(a.vehicle_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        const bi = b.vehicle_id ? (vehicleOrder.get(b.vehicle_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        const at = new Date(a.updated_at || 0).getTime();
        const bt = new Date(b.updated_at || 0).getTime();
        if (at !== bt) return bt - at;
        return String(a.id).localeCompare(String(b.id));
      });

      const merged = sorted.map((p: any) => {
        const { vehicle_id, ...rest } = p;
        const m = overlayVehicle(rest, vehicleMap[vehicle_id]);
        return { ...m, legalNotice: computeLegalNotice(m.vehicle_data) };
      });

      return new Response(JSON.stringify({ vehicles: merged }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectId = subPath[0];
    const format = subPath[1]; // "html" or undefined

    // Fetch single project
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projErr || !project) {
      return new Response(
        JSON.stringify({ error: "Vehicle not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api-vehicles/:id/html — return HTML fragment
    if (format === "html") {
      const html = project.html_content || "<p>No HTML content generated yet.</p>";
      // Strip <html>, <head>, <body> wrappers to return just the content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const fragment = bodyMatch ? bodyMatch[1] : html;

      return new Response(fragment, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Overlay the linked vehicles row (authoritative for user edits)
    let linkedVehicle: any = null;
    if (project.vehicle_id) {
      const { data: v } = await supabase
        .from("vehicles")
        .select("id, title, brand, model, year, color, vin, vehicle_data")
        .eq("id", project.vehicle_id)
        .eq("user_id", userId)
        .maybeSingle();
      linkedVehicle = v;
    }
    const merged = overlayVehicle(project, linkedVehicle);

    // GET /api-vehicles/:id — return JSON
    // Also fetch images
    const { data: images } = await supabase
      .from("project_images")
      .select("id, image_url, perspective, sort_order")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("sort_order");

    return new Response(
      JSON.stringify({
        vehicle: {
          id: merged.id,
          title: merged.title,
          offerTitle: merged.offerTitle,
          dashboardTitle: merged.dashboardTitle,
          internalNumber: (merged.vehicle_data?.vehicle?.internalNumber ?? null),
          template_id: merged.template_id,
          vehicle_data: merged.vehicle_data,
          legalNotice: computeLegalNotice(merged.vehicle_data),
          main_image_url: merged.main_image_url,
          images: (images || []).map((img: any) => ({
            id: img.id,
            url: img.image_url,
            perspective: img.perspective,
            sort_order: img.sort_order,
          })),
          created_at: merged.created_at,
          updated_at: merged.updated_at,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
