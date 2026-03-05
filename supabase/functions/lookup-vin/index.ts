import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vin } = await req.json();
    if (!vin || typeof vin !== "string" || vin.length !== 17) {
      throw new Error("Invalid VIN: must be exactly 17 characters");
    }

    const OUTVIN_API_KEY = Deno.env.get("OUTVIN_API_KEY");
    if (!OUTVIN_API_KEY) throw new Error("OUTVIN_API_KEY not configured");

    const response = await fetch(`https://www.outvin.com/api/v1/vehicle/${encodeURIComponent(vin)}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${OUTVIN_API_KEY}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OutVin API error:", response.status, errText);
      throw new Error(`OutVin API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("OutVin response keys:", Object.keys(data));

    // Map OutVin response to our internal format
    const mapped = {
      brand: data.make || data.brand || "",
      model: data.model || "",
      variant: data.variant || data.trim || data.version || "",
      year: data.year || data.modelYear || data.model_year || null,
      fuelType: data.fuelType || data.fuel_type || data.fuel || "",
      transmission: data.transmission || data.gearbox || "",
      power: data.power || data.kw ? `${data.kw || data.power} kW` : "",
      color: data.color || data.exteriorColor || "",
      displacement: data.displacement || data.engineDisplacement || data.engine_displacement || "",
      driveType: data.driveType || data.drive_type || data.drivetrain || "",
      bodyType: data.bodyType || data.body_type || data.body || "",
      doors: data.doors || data.numberOfDoors || null,
      seats: data.seats || data.numberOfSeats || null,
      // Raw data for debugging
      _raw: data,
    };

    return new Response(JSON.stringify({ success: true, vehicle: mapped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lookup-vin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
