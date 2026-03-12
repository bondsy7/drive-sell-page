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
      if (Array.isArray(vehicleNode?.equipment)) {
        for (const e of vehicleNode.equipment) {
          const desc = typeof e === "string" ? e : (e?.description || e?.name || e?.text || "");
          if (desc && !items.includes(desc)) items.push(desc);
        }
      }
      return [...new Set(items)];
    };

    const rawEquipment = extractEquipment();
    console.log(`Raw equipment count: ${rawEquipment.length}`);

    // Translate equipment via Lovable AI
    let translatedEquipment: string[] = rawEquipment;
    if (rawEquipment.length > 0) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `Du bist ein Fahrzeug-Ausstattungsexperte. Übersetze und kürze die folgende Ausstattungsliste eines Fahrzeugs ins Deutsche.

Regeln:
- Entferne alle "Ohne"/"Without"-Einträge komplett
- Entferne technische Codes und interne Referenzen
- Entferne triviale Einträge (Warndreieck, Verbandkasten, Feuerlöscher, Betriebsanleitung, Frostschutz, Gewichtsbereiche, Produktionsdaten)
- Kürze auf max. 4-5 Wörter pro Eintrag
- Fasse ähnliche Einträge zusammen (z.B. mehrere Airbags → "Front-, Seiten- & Kopfairbags")
- Gib nur relevante Ausstattungsmerkmale zurück die für einen Käufer interessant sind
- Antwort als JSON-Array von Strings, nichts anderes`
                },
                {
                  role: "user",
                  content: JSON.stringify(rawEquipment)
                }
              ],
              temperature: 0.1,
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData?.choices?.[0]?.message?.content || "";
            try {
              // Try to parse JSON from content
              const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              const parsed = JSON.parse(cleaned);
              if (Array.isArray(parsed) && parsed.length > 0) {
                translatedEquipment = parsed.filter((s: any) => typeof s === "string" && s.length > 0);
                console.log(`Translated equipment count: ${translatedEquipment.length}`);
              }
            } catch (parseErr) {
              console.error("AI translation parse error:", parseErr, "content:", content.slice(0, 200));
            }
          } else {
            console.error("AI translation error:", aiResp.status);
          }
        }
      } catch (aiErr) {
        console.error("AI translation failed:", aiErr);
      }
    }

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
      equipment: translatedEquipment,
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
