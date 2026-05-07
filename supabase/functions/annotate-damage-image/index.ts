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

async function annotateImage(apiKey: string, imageBase64: string | null, imageFileUri: { uri: string; mimeType?: string } | null, schaeden: any[]): Promise<string | null> {
  if (!schaeden || schaeden.length === 0) return null;
  const list = schaeden.map((s: any) =>
    `${s.nr}. ${s.position} (${s.bauteil}) – ${s.art}, Maßnahme: ${s.massnahme}, Markierung: ${s.markierung?.typ || 'box'}, Priorität: ${s.markierung?.prioritaet || 'mittel'}`
  ).join("\n");

  const prompt = `Markiere die folgenden Schäden direkt in diesem Fahrzeugbild wie ein professioneller KFZ-Sachverständiger.

Schäden zum Markieren:
${list}

REGELN:
- Nummerierte Markierungen passend zur Schadensliste (1, 2, 3 ...).
- Sichtbare Schäden: durchgezogene rote Box.
- Mögliche verdeckte Schäden: gestrichelte gelbe Box mit "prüfen".
- Kleine Schäden: Pfeil mit Kreis.
- Große Schäden: halbtransparente rote Fläche.
- Beschriftung kurz: "Nr. Bauteil – Maßnahme" mit weißer Hintergrundbox.
- Keine unbeschädigten Bereiche markieren.
- Markierungen dürfen wichtige Fahrzeugdetails NICHT verdecken.
- Fahrzeug, Farbe, Perspektive, Hintergrund EXAKT beibehalten – nur Annotationen hinzufügen.`;

  let imagePart: any;
  if (imageFileUri?.uri) {
    imagePart = { file_data: { mime_type: imageFileUri.mimeType || "image/jpeg", file_uri: imageFileUri.uri } };
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

  const models = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 55_000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      });
      if (!r.ok) {
        console.warn(`[annotate] ${model} ${r.status}`);
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
      console.warn(`[annotate] ${model} timeout/error`, e instanceof Error ? e.message : e);
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

    // Deduct 1 credit per annotation
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: result } = await admin.rpc("deduct_credits", {
      _user_id: userId, _amount: 1, _action_type: "image_remaster",
      _description: "Schadensanalyse Annotation",
    });
    const r = result as any;
    if (!r?.success) {
      return new Response(JSON.stringify({ error: "insufficient_credits", balance: r?.balance || 0 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const annotated = await annotateImage(GEMINI_API_KEY, image || null, imageFileUri || null, schaeden || []);
    return new Response(JSON.stringify({ annotated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[annotate-damage-image] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
