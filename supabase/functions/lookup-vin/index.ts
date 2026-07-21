import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth guard: only signed-in users may trigger the paid OUTVIN call ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await sb.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vin } = await req.json();
    if (!vin || typeof vin !== "string" || vin.length !== 17) {
      throw new Error("Invalid VIN: must be exactly 17 characters");
    }

    const OUTVIN_API_KEY = await getSecret("OUTVIN_API_KEY");
    if (!OUTVIN_API_KEY) throw new Error("OUTVIN_API_KEY not configured");

    let response: Response | null = null;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      response = await fetch(`https://www.outvin.com/api/v1/vehicle/${encodeURIComponent(vin)}`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${OUTVIN_API_KEY}`,
          "Accept": "application/json",
        },
      });

      if (response.ok) break;

      const errText = await response.text();
      console.error(`OutVin API error (attempt ${attempt}/${maxRetries}):`, response.status, errText);

      if ((response.status === 503 || response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 503;
      const isUpstream = !response || status === 503 || status === 429 || status >= 500;
      return new Response(JSON.stringify({
        error: isUpstream
          ? "Der VIN-Dienst (OutVin) ist derzeit nicht erreichbar. Bitte in ein paar Minuten erneut versuchen."
          : `OutVin API error: ${status}`,
        upstream_status: status,
        fallback: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("OutVin response keys:", Object.keys(data));

    const vehicleNode = data?.data?.vehicle ?? {};
    const streamMap = vehicleNode?.stream_map ?? {};

    const getStreamText = (key: string): string => {
      const node = streamMap?.[key]?.stream_result;
      if (node === null || node === undefined) return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) {
        if (node.length === 0) return "";
        const first = node[0] as any;
        if (typeof first === "string" || typeof first === "number") return String(first);
        return String(first?.translation?.translationCurrent || first?.description || first?.code || "");
      }
      if (typeof node === "object") {
        const first = Object.values(node)[0] as Record<string, any> | undefined;
        if (!first) return "";
        return String(first.translation?.translationCurrent || first.description || first.code || "");
      }
      return "";
    };

    // Extract equipment/options list from stream_map
    const extractEquipment = (): string[] => {
      const items: string[] = [];
      const equipKeys = ["options", "equipment", "standard_equipment", "optional_equipment", "special_equipment", "packages"];
      for (const key of equipKeys) {
        const node = streamMap?.[key]?.stream_result;
        if (!node || typeof node !== "object" || Array.isArray(node)) continue;
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

    // Limit items to prevent AI timeout (max 80 items)
    const equipmentForTranslation = rawEquipment.slice(0, 80);

    // Translate equipment via Gemini API with timeout
    let translatedEquipment: string[] = rawEquipment;
    if (equipmentForTranslation.length > 0) {
      try {
        const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
        if (GEMINI_API_KEY) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);

          const aiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: `Du bist ein Fahrzeug-Ausstattungsexperte. Übersetze und kürze die folgende Ausstattungsliste eines Fahrzeugs ins Deutsche.

Regeln:
- Entferne alle "Ohne"/"Without"-Einträge komplett
- Entferne technische Codes und interne Referenzen
- Entferne triviale Einträge (Warndreieck, Verbandkasten, Feuerlöscher, Betriebsanleitung, Frostschutz, Gewichtsbereiche, Produktionsdaten)
- Kürze auf max. 4-5 Wörter pro Eintrag
- Fasse ähnliche Einträge zusammen (z.B. mehrere Airbags → "Front-, Seiten- & Kopfairbags")
- Gib nur relevante Ausstattungsmerkmale zurück die für einen Käufer interessant sind
- Antwort als JSON-Array von Strings, nichts anderes` }] },
                contents: [{ role: "user", parts: [{ text: JSON.stringify(equipmentForTranslation) }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
              }),
              signal: controller.signal,
            },
          );

          clearTimeout(timeoutId);

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            try {
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
            console.error("Gemini API translation error:", aiResp.status);
          }
        }
      } catch (aiErr) {
        if (aiErr instanceof DOMException && aiErr.name === 'AbortError') {
          console.error("AI translation timed out, using raw equipment");
        } else {
          console.error("AI translation failed:", aiErr);
        }
      }
    }

    // Derive year from production_date ("DD.MM.YYYY" or "YYYY-MM-DD"), fall back to model_year
    const parseYear = (): number | null => {
      const prod = getStreamText("production_date") || getStreamText("model_year") || "";
      const m = prod.match(/(\d{4})/g);
      if (!m) return null;
      // Prefer trailing year for "DD.MM.YYYY"
      return Number(m[m.length - 1]) || null;
    };

    // Displacement: API returns liters (e.g. "3.00"). Normalize to "X.Y L".
    const rawDisp = getStreamText("displacement");
    const dispNum = parseFloat(rawDisp.replace(",", "."));
    const displacement = isFinite(dispNum) && dispNum > 0
      ? (dispNum < 20 ? `${dispNum.toFixed(1)} L` : `${Math.round(dispNum)} cm³`)
      : "";

    const powerRaw = getStreamText("system_power") || getStreamText("power_kw");
    const powerNum = parseFloat(powerRaw);

    // Model name description is the granular variant ("630d xDrive Gran Turismo").
    // Series is the model family ("6"). Combine for a user-friendly model.
    const modelName = getStreamText("model_name");
    const series = getStreamText("series");
    const brand = vehicleNode?.make?.make || "";
    // e.g. BMW "6" + "630d xDrive Gran Turismo" → model="6er", variant="630d xDrive Gran Turismo"
    const model = modelName || series || "";
    const variant = (modelName && series && !modelName.startsWith(series)) ? modelName : (modelName && series ? modelName : "");

    const mapped = {
      brand,
      model: series && brand.toLowerCase() === "bmw" ? `${series}er` : (series || modelName),
      variant: modelName || "",
      year: parseYear(),
      fuelType: getStreamText("fuel_type"),
      transmission: getStreamText("transmission_type") || getStreamText("transmission"),
      power: isFinite(powerNum) && powerNum > 0 ? `${Math.round(powerNum)} kW` : "",
      color: getStreamText("color_code"),
      displacement,
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
