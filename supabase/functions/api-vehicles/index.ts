import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  try {
    // GET /api-vehicles — list all vehicles
    if (subPath.length === 0) {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("id, title, template_id, vehicle_data, main_image_url, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ vehicles: projects }), {
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
          id: project.id,
          title: project.title,
          template_id: project.template_id,
          vehicle_data: project.vehicle_data,
          main_image_url: project.main_image_url,
          images: (images || []).map((img: any) => ({
            id: img.id,
            url: img.image_url,
            perspective: img.perspective,
            sort_order: img.sort_order,
          })),
          created_at: project.created_at,
          updated_at: project.updated_at,
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
