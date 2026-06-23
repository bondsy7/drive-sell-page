import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";
import { deductCredits } from "../_shared/credits.ts";

// Music Studio – Google Lyria 3 (Interactions API)
// Endpoint: POST https://generativelanguage.googleapis.com/v1beta/interactions
// Models: 'lyria-3-pro-preview' | 'lyria-3-clip-preview'

interface ReqBody {
  prompt: string;
  model?: "lyria-3-pro-preview" | "lyria-3-clip-preview";
  responseFormat?: "mp3" | "wav";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseAdmin.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as ReqBody;
    const prompt = (body.prompt || "").trim();
    if (!prompt || prompt.length < 3) {
      return new Response(JSON.stringify({ error: "Prompt zu kurz" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = body.model === "lyria-3-clip-preview" ? "lyria-3-clip-preview" : "lyria-3-pro-preview";
    const wantWav = body.responseFormat === "wav" && model === "lyria-3-pro-preview";

    // Credits: Pro Song (bis 3 Min) = 1 Cr (~82% Marge bei 0,49€/Cr, EK $0.08)
    //          Clip (30 Sek)        = 1 Cr (~90% Marge,             EK $0.04)
    const cost = 1;
    await deductCredits(
      supabaseAdmin,
      userId,
      cost,
      "music_generate",
      model,
      `Lyria Musik – ${prompt.slice(0, 80)}`,
    );

    const apiKey = await getSecret("GEMINI_API_KEY", supabaseAdmin);
    if (!apiKey) {
      // Refund
      await supabaseAdmin.rpc("add_credits", {
        _user_id: userId,
        _amount: cost,
        _action_type: "admin_adjustment",
        _description: "Refund: missing GEMINI_API_KEY",
      });
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY fehlt" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = { model, input: prompt };
    if (wantWav) {
      payload.response_format = { type: "audio", format: "wav" };
    }

    console.log("[generate-music] model=", model, "wav=", wantWav, "user=", userId);

    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("[generate-music] Lyria error", resp.status, txt);
      // Refund
      await supabaseAdmin.rpc("add_credits", {
        _user_id: userId,
        _amount: cost,
        _action_type: "admin_adjustment",
        _description: `Refund: Lyria ${resp.status}`,
      });
      return new Response(JSON.stringify({ error: `Lyria API ${resp.status}`, details: txt.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();

    // Parse: steps[] → model_output → content[] → audio/text
    let audioBase64: string | null = null;
    let mimeType = wantWav ? "audio/wav" : "audio/mpeg";
    const lyricsParts: string[] = [];

    const steps = data?.steps ?? [];
    for (const step of steps) {
      if (step?.type === "model_output" && Array.isArray(step.content)) {
        for (const block of step.content) {
          if (block?.type === "audio" && block.data && !audioBase64) {
            audioBase64 = block.data as string;
            if (block.mime_type) mimeType = block.mime_type as string;
          } else if (block?.type === "text" && block.text) {
            lyricsParts.push(block.text as string);
          }
        }
      }
    }

    if (!audioBase64) {
      console.error("[generate-music] No audio in response", JSON.stringify(data).slice(0, 800));
      await supabaseAdmin.rpc("add_credits", {
        _user_id: userId,
        _amount: cost,
        _action_type: "admin_adjustment",
        _description: "Refund: kein Audio",
      });
      return new Response(JSON.stringify({ error: "Keine Audio-Daten erhalten" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        audioBase64,
        mimeType,
        lyrics: lyricsParts.join("\n").trim(),
        model,
        creditsUsed: cost,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-music] fatal", msg);
    const status = msg.includes("Nicht genug Credits") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
