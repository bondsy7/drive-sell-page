// analyze-wheel-reference
// Analysiert eine dedizierte Felgen-/Reifenaufnahme mit einem schnellen,
// günstigen Gemini-Vision-Modell und liefert eine strukturierte JSON-Analyse.
// Regel: NICHT raten – unsichere Werte werden null.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an automotive wheel/rim inspection expert.
Analyse ONLY the provided photo of a vehicle wheel. Describe exactly what is VISIBLE.

HARD RULES:
- NEVER guess. If an attribute is not clearly visible, return null (or "unknown" for strings you cannot read).
- Do NOT use generic model knowledge or catalog data. Only the photo counts.
- Count spokes carefully; for split/double spokes count the visual spoke pairs and say so in spokeStyle.

Return ONLY raw JSON, no markdown fences, matching exactly:
{
  "spokeCount": number|null,
  "spokeStyle": string|null,        // e.g. "5-spoke", "double-5-spoke", "y-spoke", "multi-spoke", "turbine", "mesh"
  "finish": string|null,            // e.g. "diamond-cut", "gloss black", "matte black", "silver", "bicolor", "polished"
  "secondaryColor": string|null,
  "concavity": string|null,         // "flat" | "concave" | "deep-concave" | null
  "centerCap": string|null,         // short description of hub cap (logo, colour) or null
  "tireVisible": boolean|null,
  "brakeCaliperVisible": boolean|null,
  "brakeCaliperColor": string|null,
  "description": string|null,       // max 2 short factual sentences
  "confidence": "high"|"medium"|"low"
}`;

function cleanBase64(b64: string): string {
  return b64.includes(",") ? b64.split(",")[1] : b64;
}

function detectMime(b64: string): string {
  if (b64.startsWith("data:image/png")) return "image/png";
  if (b64.startsWith("data:image/webp")) return "image/webp";
  return "image/jpeg";
}

/** Robustes JSON-Parsing (Fences, Prosa drumherum, abgeschnittene Antworten). */
function parseJsonLoose(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const stripped = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch { /* continue */ }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch { /* continue */ }
  }
  return null;
}

function normStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === "unknown" || s.toLowerCase() === "null") return null;
  return s;
}

function normBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, imageFileUri } = await req.json();
    if (!imageBase64 && !imageFileUri?.uri) {
      return new Response(JSON.stringify({ error: "Kein Bild übermittelt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const parts: unknown[] = [{ text: SYSTEM_PROMPT }];
    if (imageFileUri?.uri) {
      parts.push({ file_data: { mime_type: imageFileUri.mimeType || "image/jpeg", file_uri: imageFileUri.uri } });
    } else {
      parts.push({ inlineData: { mimeType: detectMime(imageBase64), data: cleanBase64(imageBase64) } });
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[analyze-wheel-reference] ${resp.status}: ${errText.slice(0, 300)}`);
      // Analysefehler dürfen den Upload nie blockieren → 200 ohne Analyse.
      return new Response(JSON.stringify({ analysis: null, confidence: "unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    const raw = parseJsonLoose(text);

    if (!raw) {
      console.warn("[analyze-wheel-reference] JSON parse failed, returning null analysis");
      return new Response(JSON.stringify({ analysis: null, confidence: "unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spokeCountRaw = raw.spokeCount;
    const analysis = {
      spokeCount: typeof spokeCountRaw === "number" && Number.isFinite(spokeCountRaw) ? spokeCountRaw : null,
      spokeStyle: normStr(raw.spokeStyle),
      finish: normStr(raw.finish),
      secondaryColor: normStr(raw.secondaryColor),
      concavity: normStr(raw.concavity),
      centerCap: normStr(raw.centerCap),
      tireVisible: normBool(raw.tireVisible),
      brakeCaliperVisible: normBool(raw.brakeCaliperVisible),
      brakeCaliperColor: normStr(raw.brakeCaliperColor),
      description: normStr(raw.description),
    };
    const confRaw = normStr(raw.confidence);
    const confidence = confRaw === "high" || confRaw === "medium" || confRaw === "low" ? confRaw : "unknown";

    console.log(`[analyze-wheel-reference] ok spokes=${analysis.spokeCount} style=${analysis.spokeStyle} conf=${confidence}`);

    return new Response(JSON.stringify({ analysis, confidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-wheel-reference] error:", e);
    // Fehler nicht blockierend nach außen geben.
    return new Response(JSON.stringify({ analysis: null, confidence: "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
