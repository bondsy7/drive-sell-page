import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DetectionResult = {
  brand: string;
  model: string;
  confidence: "high" | "medium" | "low";
};

function normalizeDetectionResult(input?: Partial<DetectionResult> | null): DetectionResult {
  const confidence = input?.confidence;
  return {
    brand: typeof input?.brand === "string" ? input.brand.trim() : "",
    model: typeof input?.model === "string" ? input.model.trim() : "",
    confidence: confidence === "high" || confidence === "medium" || confidence === "low"
      ? confidence
      : (input?.brand ? "medium" : "low"),
  };
}

function extractPartialJson(text: string): DetectionResult {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const brand = cleaned.match(/"brand"\s*:\s*"([^"\n}]*)/i)?.[1]?.trim() || "";
  const model = cleaned.match(/"model"\s*:\s*"([^"\n}]*)/i)?.[1]?.trim() || "";
  const confidence = cleaned.match(/"confidence"\s*:\s*"(high|medium|low)/i)?.[1]?.toLowerCase() as DetectionResult["confidence"] | undefined;
  return normalizeDetectionResult({ brand, model, confidence });
}

const DEFAULT_DETECT_PROMPT = `Analyze this vehicle-related image and identify the vehicle manufacturer/brand and model whenever possible.

Possible inputs include:
1. Vehicle photos showing logo, grille, headlights, trunk badge, wheels or body shape
2. Manufacturer labels, VIN stickers, compliance plates or door-jamb stickers
3. Interior photos with steering wheel logo or badges
4. Textual manufacturer references visible on the vehicle or label

Respond with ONLY a JSON object in this exact format:
{"brand":"BrandName","model":"ModelName","confidence":"high"}

Rules:
- Use the official brand name (e.g. "Volkswagen", "Mercedes-Benz", "BMW")
- If you can identify only the brand, return model as ""
- If you cannot identify the brand, return {"brand":"","model":"","confidence":"low"}
- Use "high" when a logo, manufacturer label, VIN sticker text or unmistakable badge is visible
- Use "medium" when design cues strongly suggest the brand
- Use "low" when uncertain`;

async function getCustomPrompt(key: string, defaultPrompt: string): Promise<string> {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) { console.warn("Custom prompt load failed:", e); }
  return defaultPrompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const detectPrompt = await getCustomPrompt("detect_vehicle_brand", DEFAULT_DETECT_PROMPT);
    // Retry with fallback models on 503/429
    const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const MAX_RETRIES = 2;
    let lastError = "AI analysis failed";

    for (const model of MODELS_TO_TRY) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`detect-vehicle-brand: model=${model} attempt=${attempt + 1}`);
          const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: detectPrompt },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 128,
                responseMimeType: "application/json",
              },
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`Gemini ${model} error:`, response.status, errText);
            const isRetryable = response.status === 503 || response.status === 429 || response.status === 500;
            if (isRetryable && attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
              continue;
            }
            lastError = `Model ${model} error (${response.status})`;
            break; // try next model
          }

          const result = await response.json();
          const textContent = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || "";
          const cleanedContent = textContent.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

          try {
            const parsed = JSON.parse(cleanedContent);
            const normalized = normalizeDetectionResult(parsed);
            console.log("Detected vehicle:", normalized);
            return new Response(JSON.stringify(normalized), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch {
            const fallback = extractPartialJson(cleanedContent);
            console.warn("Partial JSON, using fallback:", cleanedContent);
            return new Response(JSON.stringify(fallback), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (fetchErr) {
          console.warn(`Fetch error for ${model}:`, fetchErr);
          lastError = fetchErr instanceof Error ? fetchErr.message : "Network error";
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          }
        }
      }
    }

    return new Response(JSON.stringify({ error: lastError }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-vehicle-brand error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
