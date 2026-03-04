import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealerUserId, projectId, name, email, phone, message, vehicleTitle } = await req.json();

    if (!dealerUserId || !name || !email) {
      return new Response(JSON.stringify({ error: "Name, E-Mail und Händler-ID sind erforderlich." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Ungültige E-Mail-Adresse." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("leads").insert({
      dealer_user_id: dealerUserId,
      project_id: projectId || null,
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 255),
      phone: phone ? String(phone).slice(0, 50) : null,
      message: message ? String(message).slice(0, 2000) : null,
      vehicle_title: vehicleTitle ? String(vehicleTitle).slice(0, 300) : null,
    });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Anfrage konnte nicht gespeichert werden." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lead submission error:", err);
    return new Response(JSON.stringify({ error: "Serverfehler." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
