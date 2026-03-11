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

    const vehicleNode = data?.data?.vehicle ?? {};
    const streamMap = vehicleNode?.stream_map ?? {};

    const getStreamText = (key: string): string => {
      const node = streamMap?.[key]?.stream_result;
      if (!node) return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (typeof node === "object") {
        const first = Object.values(node)[0] as Record<string, unknown> | undefined;
        if (!first) return "";
        return String(first.translation?.translationCurrent || first.description || first.code || "");
      }
      return "";
    };

    // Extract equipment/options list from stream_map
    const extractEquipment = (): string[] => {
      const items: string[] = [];
      const equipKeys = ["equipment", "options", "standard_equipment", "optional_equipment", "special_equipment", "packages"];
      for (const key of equipKeys) {
        const node = streamMap?.[key]?.stream_result;
        if (!node || typeof node !== "object") continue;
        for (const entry of Object.values(node) as any[]) {
          const desc = entry?.translation?.translationCurrent || entry?.description || entry?.text || "";
          if (desc && typeof desc === "string" && desc.length > 1) {
            items.push(desc);
          }
        }
      }
      // Also check top-level equipment arrays
      if (Array.isArray(vehicleNode?.equipment)) {
        for (const e of vehicleNode.equipment) {
          const desc = typeof e === "string" ? e : (e?.description || e?.name || e?.text || "");
          if (desc && !items.includes(desc)) items.push(desc);
        }
      }
      return [...new Set(items)];
    };

    const equipment = extractEquipment();

    const mapped = {
      brand: vehicleNode?.make?.make || "",
      model: getStreamText("model"),
      variant: getStreamText("variant"),
      year: Number(getStreamText("model_year")) || null,
      fuelType: getStreamText("fuel_type"),
      transmission: getStreamText("transmission"),
      power: getStreamText("power_kw") ? `${getStreamText("power_kw")} kW` : "",
      color: getStreamText("color_code"),
      displacement: getStreamText("displacement"),
      driveType: getStreamText("drive_type"),
      bodyType: getStreamText("body_type"),
      doors: Number(getStreamText("number_of_doors")) || null,
      seats: Number(getStreamText("number_of_seats")) || null,
      equipment,
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
