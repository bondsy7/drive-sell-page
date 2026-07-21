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
    if (!vehicle) return project;
    const vNested = ((vehicle.vehicle_data as Record<string, any>) || {}).vehicle || {};
    const nonEmpty = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
    // Priority per field: project.vehicle_data.vehicle → vehicles.vehicle_data.vehicle → vehicles.<col>
    const identity: Record<string, any> = { ...vNested, ...pNested };
    for (const k of ['brand', 'model', 'year', 'color', 'vin'] as const) {
      if (!nonEmpty(identity[k]) && nonEmpty(vehicle[k])) identity[k] = vehicle[k];
    }
    return {
      ...project,
      title: project.title || vehicle.title,
      vehicle_data: { ...pData, vehicle: identity },
    };
  };

  try {
    // GET /api-vehicles — list all vehicles
    if (subPath.length === 0) {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("id, title, template_id, vehicle_data, main_image_url, vehicle_id, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const vehicleIds = Array.from(new Set((projects || []).map((p: any) => p.vehicle_id).filter(Boolean)));
      let vehicleMap: Record<string, any> = {};
      if (vehicleIds.length) {
        const { data: vehicles } = await supabase
          .from("vehicles")
          .select("id, title, brand, model, year, color, vin, vehicle_data")
          .in("id", vehicleIds);
        (vehicles || []).forEach((v: any) => { vehicleMap[v.id] = v; });
      }

      const merged = (projects || []).map((p: any) => {
        const { vehicle_id, ...rest } = p;
        return overlayVehicle(rest, vehicleMap[vehicle_id]);
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
          template_id: merged.template_id,
          vehicle_data: merged.vehicle_data,
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
