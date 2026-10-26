import { blockedAccountResponse } from "../_shared/blocked-accounts.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PROMPT = `You are a VIN (Vehicle Identification Number) OCR expert. Analyze this image and extract the VIN number.

RULES:
- The VIN may appear on a plate, sticker, engraving, registration document, screen, paper or as plain text
- Read it character by character exactly as printed. Do NOT add, repeat or drop characters (e.g. never turn "ZZZ" into "ZZZZ")
- A VIN is exactly 17 characters long, containing digits and uppercase letters (no I, O, Q)
- Return ONLY the VIN in your response, nothing else
- If you cannot find a valid VIN, respond with exactly: NO_VIN_FOUND
- Do NOT guess or make up a VIN`;

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getCustomPrompt(key: string, defaultPrompt: string): Promise<string> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) { console.warn("Custom prompt load failed:", e); }
  return defaultPrompt;
}

async function authenticateAndDeductCredits(req: Request, actionType: string, cost: number): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error } = await sb.auth.getClaims(token);
  if (error || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;
  const serviceSb = createServiceClient();
  const { data: result, error: deductError } = await serviceSb.rpc("deduct_credits", {
    _user_id: userId, _amount: cost, _action_type: actionType, _description: `${actionType} (serverseitig)`,
  });
  if (deductError) {
    return new Response(JSON.stringify({ error: "Credit-Fehler: " + deductError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const r = result as any;
  if (!r?.success) {
    return new Response(JSON.stringify({ error: "insufficient_credits", balance: r?.balance || 0, cost: r?.cost || cost }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId };
}

serve(async (req) => {
  { const __blocked = blockedAccountResponse(req); if (__blocked) return __blocked; }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Auth & credits
    const authResult = await authenticateAndDeductCredits(req, "vin_ocr", 1);
    if (authResult instanceof Response) return authResult;

    const { imageBase64, imageFileUri } = await req.json();
    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    if (!imageBase64 && !imageFileUri?.uri) throw new Error("No image provided");

    // 2. Load custom prompt
    const prompt = await getCustomPrompt("vin_ocr", DEFAULT_PROMPT);

    // 3. Build image part – prefer File API URI
    let imagePart: any;
    if (imageFileUri?.uri) {
      imagePart = { file_data: { mime_type: imageFileUri.mimeType || "image/jpeg", file_uri: imageFileUri.uri } };
    } else {
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const mimeType = imageBase64.startsWith("data:image/png") ? "image/png"
        : imageBase64.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
      imagePart = { inlineData: { mimeType, data: base64Data } };
    }

    const geminiBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, imagePart] }],
      generationConfig: { temperature: 0 },
    });

    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    let response: Response | null = null;
    let lastStatus = 0;
    let lastErrText = "";
    outer: for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(url, {
          method: "POST",
          headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
          body: geminiBody,
        });
        if (r.ok) { response = r; break outer; }
        lastStatus = r.status;
        lastErrText = await r.text();
        console.error(`ocr-vin ${model} attempt ${attempt + 1}: ${r.status}`, lastErrText);
        if (r.status === 503 || r.status === 429 || r.status >= 500) {
          await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    if (!response) {
      // Graceful fallback: don't crash the client, allow manual VIN entry
      return new Response(JSON.stringify({
        vin: null,
        fallback: true,
        error: "OCR_SERVICE_UNAVAILABLE",
        status: lastStatus,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Only accept a token that is EXACTLY 17 chars after removing separators.
    // Never cut a 17-char window out of a longer misread (e.g. 18 chars).
    const cleaned = content.toUpperCase().replace(/[\s\-_.:\/]/g, "");
    const tokens = cleaned.match(/[A-Z0-9]+/g) || [];
    let vinToken = tokens.find((t) => t.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(t));

    // VAG autocorrection: VW/Audi VINs (WV*, WAU, TRU etc.) always carry exactly
    // three "ZZZ" filler characters. If the model misread "ZZZ" as "ZZZZ" the
    // result is 18 chars — collapse the quadruple Z back to triple Z.
    if (!vinToken) {
      for (const t of tokens) {
        if (t.length !== 18 || !t.includes("ZZZZ")) continue;
        const corrected = t.replace("ZZZZ", "ZZZ");
        if (corrected.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(corrected) && /^(WV|WAU|TRU|WUA)/.test(corrected)) {
          console.log(`[ocr-vin] VAG ZZZZ->ZZZ autocorrect: ${t} -> ${corrected}`);
          vinToken = corrected;
          break;
        }
      }
    }

    console.log(`[ocr-vin] raw_len=${cleaned.length} accepted=${!!vinToken}`);
    if (vinToken) {
      return new Response(JSON.stringify({ vin: vinToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ vin: null, raw: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-vin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
