import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type BrandingKind =
  | "lettering"
  | "logo"
  | "sign"
  | "sticker"
  | "banner"
  | "external-accessory";

type BrandingItem = {
  kind: BrandingKind;
  location: string;
  text: string | null;
  color: string | null;
  size: "small" | "medium" | "large" | null;
};

const VALID_KINDS: BrandingKind[] = [
  "lettering",
  "logo",
  "sign",
  "sticker",
  "banner",
  "external-accessory",
];

function normalizeItem(raw: unknown): BrandingItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = typeof r.kind === "string" ? r.kind.toLowerCase().trim() : "";
  if (!VALID_KINDS.includes(kind as BrandingKind)) return null;
  const location = typeof r.location === "string" ? r.location.trim() : "";
  if (!location) return null;
  const text = typeof r.text === "string" && r.text.trim() ? r.text.trim() : null;
  const color = typeof r.color === "string" && r.color.trim() ? r.color.trim() : null;
  const sizeRaw = typeof r.size === "string" ? r.size.toLowerCase().trim() : "";
  const size = sizeRaw === "small" || sizeRaw === "medium" || sizeRaw === "large" ? sizeRaw : null;
  return { kind: kind as BrandingKind, location, text, color, size };
}

function parseItems(text: string): BrandingItem[] {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeItem).filter((x): x is BrandingItem => !!x);
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).items)) {
      return (parsed as any).items.map(normalizeItem).filter((x: BrandingItem | null): x is BrandingItem => !!x);
    }
  } catch { /* fall through */ }
  // Fallback: extract first [ ... ] array in the string
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeItem).filter((x): x is BrandingItem => !!x);
      }
    } catch { /* ignore */ }
  }
  return [];
}

const DETECT_PROMPT = `You are analyzing a vehicle photo (car, van, truck, trailer, or bus). Your job is to identify EVERY non-OEM element visible on the vehicle body that was added by the current operator/fleet after it left the factory.

Look everywhere on the vehicle systematically: front, both sides, rear, roof, mirrors, wind deflector above windshield, A/B/C-pillars, doors, wheel arches, mudflaps, tailgate, box body / cargo area, tarpaulin / curtain sides, trailer walls, rear bumper.

For each such non-OEM element, output a JSON object:
{
  "kind":     one of "lettering" | "logo" | "sign" | "sticker" | "banner" | "external-accessory",
  "location": concrete vehicle region (e.g. "wind deflector above windshield", "driver door lower half", "left B-pillar", "trailer curtain side", "front grille left of manufacturer emblem"),
  "text":     literal text if readable (word-for-word), else null,
  "color":    dominant color(s) as short phrase (e.g. "yellow", "blue on white"), else null,
  "size":     "small" | "medium" | "large"
}

Kind definitions:
- lettering: painted, printed, vinyl, or magnetic TEXT (company names, slogans, URLs, phone numbers, e-mails)
- logo: company/fleet/sponsor emblems (NOT the vehicle manufacturer badge, NOT the model badge)
- sign: attached plates, warning boards, ADR plates, operator plates, route/destination boards, screwed-on identification boards, magnetic signs
- sticker: adhesive decals, foil wraps, promotional stickers, partial wraps, coloured side stripes added post-factory
- banner: printed advertising tarpaulins or curtain-sides on trucks/trailers with company graphics
- external-accessory: non-OEM add-ons carrying branding (flag poles, roof light-bars with company text, extra antennas with logos)

STRICTLY EXCLUDE (do NOT list these):
- the vehicle manufacturer emblem (VW, Mercedes-Benz star, MAN lion, Scania griffin, Volvo iron mark, DAF, Iveco, Renault Trucks, etc.)
- the model badge / model name lettering placed by the OEM (e.g. "Actros", "TGX", "R 500", "FH16")
- OEM type plate / VIN plate
- mandatory legal/safety markings integrated by the OEM (retro-reflective contour tape when factory-fitted, DOT/ECE markings)
- license plates (handled separately)

Output rules:
- Return ONLY a JSON array. No prose, no markdown, no code fences.
- If nothing non-OEM is visible, return exactly: []
- Be exhaustive but conservative: if you cannot tell whether something is OEM or operator-added, omit it.`;

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
    const userId = claimsData.claims.sub;

    const { imageBase64, imageFileUri } = await req.json();
    if (!imageBase64 && !imageFileUri?.uri) {
      return new Response(JSON.stringify({ error: "imageBase64 or imageFileUri required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured", items: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imagePart: any;
    if (imageFileUri?.uri) {
      imagePart = { file_data: { mime_type: imageFileUri.mimeType || "image/jpeg", file_uri: imageFileUri.uri } };
    } else {
      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      imagePart = { inlineData: { mimeType, data: base64Data } };
    }

    const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
    let lastError = "detection failed";

    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [imagePart, { text: DETECT_PROMPT }] }],
            generationConfig: {
              temperature: 0.05,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
            },
          }),
        });
        if (!resp.ok) {
          lastError = `Model ${model} error ${resp.status}`;
          console.warn(`[detect-vehicle-branding] ${lastError}`);
          continue;
        }
        const result = await resp.json();
        const textContent =
          result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("\n") || "";
        const items = parseItems(textContent);
        const kinds = Array.from(new Set(items.map((i) => i.kind))).join(",");
        console.log(
          `[detect-vehicle-branding] model=${model} items=${items.length} kinds=[${kinds}] user=${userId}`,
        );
        return new Response(JSON.stringify({ items }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        lastError = e instanceof Error ? e.message : "network error";
        console.warn(`[detect-vehicle-branding] ${model} exception:`, lastError);
      }
    }

    // Detection failed – return empty items so remaster continues without an inventory
    console.warn(`[detect-vehicle-branding] all models failed: ${lastError}`);
    return new Response(JSON.stringify({ items: [], warning: lastError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[detect-vehicle-branding] fatal:", e);
    return new Response(JSON.stringify({ items: [], error: e instanceof Error ? e.message : "unknown" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
