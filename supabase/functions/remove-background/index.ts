import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Auth via getClaims (project standard – NEVER getUser) */
async function authUser(req: Request): Promise<string | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nicht authentifiziert" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims?.sub) return json({ error: "Nicht authentifiziert" }, 401);
  return data.claims.sub as string;
}

function decodeDataUrl(input: string): { bytes: Uint8Array; mime: string } {
  const raw = input.includes(",") ? input.split(",")[1] : input;
  let mime = "image/jpeg";
  const m = /^data:([^;]+);/.exec(input);
  if (m) mime = m[1];
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

function extFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/** Generates a background scene via Gemini (direct REST, no gateway – project standard). */
async function generateAiBackground(apiKey: string, prompt: string): Promise<string | null> {
  const fullPrompt = `Generate a photorealistic EMPTY background scene for an automotive product photo composite.

Scene description: ${prompt}

HARD RULES:
- ABSOLUTELY NO vehicles, no cars, no trucks, no motorcycles, no people, no animals.
- No text, no watermarks, no logos, no signage, no license plates.
- Leave a large, unobstructed, level ground area in the lower half of the frame where a vehicle will be placed later.
- Camera at vehicle eye level, wide horizontal composition, natural perspective.
- Realistic, consistent lighting from one dominant direction; clean and professional.`;

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });

  const models = ["gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview", "gemini-2.5-flash-image"];
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
        console.warn(`[remove-background] bg-gen ${model} ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
        continue;
      }
      const data = await r.json();
      for (const p of data.candidates?.[0]?.content?.parts ?? []) {
        if (p.inlineData?.data) return `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}`;
      }
    } catch (e) {
      console.warn(`[remove-background] bg-gen ${model} error`, e instanceof Error ? e.message : e);
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

    const payload = await req.json();
    const {
      image,
      mode = "transparent",
      bgColor,
      bgImage,
      aiPrompt,
      type = "car",
      typeLevel = "latest",
      addShadow = false,
      semitransparency = true,
      size = "auto",
      format,
      crop = false,
      cropMargin,
      scale,
      position,
      channels,
    } = payload ?? {};

    if (!image) return json({ error: "Kein Bild übergeben" }, 400);

    const apiKey = await getSecret("REMOVEBG_API_KEY");
    if (!apiKey) return json({ error: "REMOVEBG_API_KEY fehlt – bitte in den Admin-Secrets hinterlegen." }, 500);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Cost: 1 credit for the cut-out, +2 when an AI background has to be generated
    const wantsAiBackground = mode === "ai" && !bgImage;
    const cost = wantsAiBackground ? 3 : 1;

    const { data: balanceRow } = await admin
      .from("credit_balances")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if ((balanceRow?.balance ?? 0) < cost) {
      return json({ error: "insufficient_credits", balance: balanceRow?.balance ?? 0, cost }, 402);
    }

    // ── Resolve background image (AI generation when requested) ──
    let backgroundDataUrl: string | null = bgImage || null;
    if (wantsAiBackground) {
      const geminiKey = await getSecret("GEMINI_API_KEY");
      if (!geminiKey) return json({ error: "GEMINI_API_KEY fehlt" }, 500);
      backgroundDataUrl = await generateAiBackground(geminiKey, String(aiPrompt || "modern empty premium car showroom"));
      if (!backgroundDataUrl) return json({ error: "KI-Hintergrund konnte nicht erzeugt werden" }, 502);
    }

    // ── Build remove.bg multipart request ──
    const fg = decodeDataUrl(image);
    const form = new FormData();
    form.append("image_file", new Blob([fg.bytes], { type: fg.mime }), `vehicle.${extFor(fg.mime)}`);
    form.append("size", String(size));
    form.append("type", String(type));
    if (typeLevel) form.append("type_level", String(typeLevel));
    form.append("semitransparency", semitransparency ? "true" : "false");
    if (crop) {
      form.append("crop", "true");
      if (cropMargin) form.append("crop_margin", String(cropMargin));
    }
    if (scale) form.append("scale", String(scale));
    if (position) form.append("position", String(position));
    if (channels) form.append("channels", String(channels));

    let outFormat = format || "png";
    if (mode === "color" && bgColor) {
      form.append("bg_color", String(bgColor));
      outFormat = format || "jpg";
    } else if ((mode === "template" || mode === "upload" || mode === "ai") && backgroundDataUrl) {
      const bg = decodeDataUrl(backgroundDataUrl);
      form.append("bg_image_file", new Blob([bg.bytes], { type: bg.mime }), `background.${extFor(bg.mime)}`);
      outFormat = format || "jpg";
    }
    // add_shadow is only supported for car / product cut-outs
    if (addShadow && (type === "car" || type === "product" || type === "auto")) {
      form.append("add_shadow", "true");
    }
    form.append("format", outFormat);

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      let title = "";
      try {
        title = JSON.parse(detail)?.errors?.[0]?.title || "";
      } catch { /* non-json body */ }
      console.warn(`[remove-background] remove.bg ${res.status}: ${detail.slice(0, 400)}`);

      if (res.status === 402) {
        return json({ error: "Das remove.bg-Guthaben ist aufgebraucht. Bitte Kontingent aufladen." }, 402);
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        return json({
          error: `Rate-Limit von remove.bg erreicht. Bitte ${retryAfter ? `${retryAfter} Sekunden` : "kurz"} warten.`,
          retryAfter: retryAfter ? Number(retryAfter) : undefined,
        }, 429);
      }
      if (res.status === 401 || res.status === 403) {
        return json({ error: "remove.bg API-Key ungültig oder ohne Berechtigung." }, 502);
      }
      return json({ error: title || `remove.bg Fehler (${res.status})` }, res.status === 400 ? 400 : 502);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    let b64 = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      b64 += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const outMime = outFormat === "jpg" ? "image/jpeg" : "image/png";
    const resultDataUrl = `data:${outMime};base64,${btoa(b64)}`;

    const { data: deducted } = await admin.rpc("deduct_credits", {
      _user_id: userId,
      _amount: cost,
      _action_type: "image_remaster",
      _description: wantsAiBackground ? "Hintergrund tauschen (KI-Hintergrund)" : "Hintergrund tauschen",
    });
    const dr = deducted as any;
    if (!dr?.success) {
      return json({ error: "insufficient_credits", balance: dr?.balance ?? 0, cost }, 402);
    }

    const creditsCharged = Number(res.headers.get("X-Credits-Charged") || 0) || undefined;
    return json({
      image: resultDataUrl,
      background: backgroundDataUrl && mode === "ai" ? backgroundDataUrl : undefined,
      cost,
      removebgCredits: creditsCharged,
    });
  } catch (e) {
    console.error("[remove-background] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, 500);
  }
});
