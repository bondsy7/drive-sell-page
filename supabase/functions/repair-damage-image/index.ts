import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function authUser(req: Request): Promise<string | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return data.claims.sub as string;
}

async function repairImage(
  apiKey: string,
  imageBase64: string | null,
  imageFileUri: { uri: string; mimeType?: string } | null,
  schaeden: any[],
): Promise<string | null> {
  const list = (schaeden || []).map((s: any) =>
    `${s.nr}. ${s.position} (${s.bauteil}) – ${s.art}: ${s.massnahme}`
  ).join("\n");

  const prompt = `Repariere alle sichtbaren Schäden an diesem Fahrzeug fotorealistisch, wie nach einer professionellen KFZ-Werkstatt-Reparatur.

Erkannte Schäden:
${list || '(alle sichtbaren Schäden am Fahrzeug)'}

REGELN:
- Beulen, Kratzer, Risse, Lackschäden, defekte Teile vollständig reparieren oder ersetzen.
- Alle Lackflächen perfekt eben, glatt und in Original-Farbe.
- Felgen, Scheinwerfer, Stoßfänger, Türen, Kotflügel makellos.
- Fahrzeug-Identität (Marke, Modell, Farbe, Felgendesign, Kennzeichen, Perspektive, Hintergrund) EXAKT beibehalten.
- KEINE Annotationen, KEINE Markierungen, KEINE Texte im Bild.
- Wirkt wie ein Pressefoto eines neuwertigen Fahrzeugs.
- Beleuchtung und Reflexionen realistisch beibehalten.`;

  let imagePart: any;
  if (imageFileUri?.uri) {
    imagePart = { file_data: { mime_type: imageFileUri.mimeType || "image/jpeg", file_uri: imageFileUri.uri } };
    console.log("[repair] using file_uri reference");
  } else if (imageBase64) {
    const raw = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    let mime = "image/jpeg";
    if (imageBase64.startsWith("data:image/png")) mime = "image/png";
    else if (imageBase64.startsWith("data:image/webp")) mime = "image/webp";
    imagePart = { inlineData: { mimeType: mime, data: raw } };
  } else {
    return null;
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, imagePart] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });

  const models = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        console.warn(`[repair] ${model} ${r.status}: ${detail.slice(0, 300)}`);
        continue;
      }
      const data = await r.json();
      const respParts = data.candidates?.[0]?.content?.parts;
      if (respParts) {
        for (const p of respParts) {
          if (p.inlineData?.data) {
            return `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}`;
          }
        }
      }
    } catch (e) {
      console.warn(`[repair] ${model} timeout/error`, e instanceof Error ? e.message : e);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const userId = await authUser(req);
    if (userId instanceof Response) return userId;

    const { image, imageFileUri, schaeden } = await req.json();
    if (!image && !imageFileUri?.uri) {
      return new Response(JSON.stringify({ error: "Kein Bild übergeben" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: balanceRow } = await admin
      .from("credit_balances")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if ((balanceRow?.balance ?? 0) < 2) {
      return new Response(JSON.stringify({ error: "insufficient_credits", balance: balanceRow?.balance || 0 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const repaired = await repairImage(GEMINI_API_KEY, image || null, imageFileUri || null, schaeden || []);
    if (!repaired) {
      return new Response(JSON.stringify({ error: "Reparatur-Bild konnte nicht generiert werden" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: result } = await admin.rpc("deduct_credits", {
      _user_id: userId, _amount: 2, _action_type: "image_remaster",
      _description: "Schadensreparatur-Visualisierung",
    });
    const r = result as any;
    if (!r?.success) {
      return new Response(JSON.stringify({ error: "insufficient_credits", balance: r?.balance || 0 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ repaired }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[repair-damage-image] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
