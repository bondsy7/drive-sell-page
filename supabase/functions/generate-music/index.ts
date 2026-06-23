import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";
import { deductCredits } from "../_shared/credits.ts";

// Music Studio – Google Lyria 3 (Interactions API)
// Background-mode: deducts credits, responds immediately, then continues
// generating, uploading to storage and inserting a user_songs row even if
// the client navigates away.

interface ReqBody {
  prompt: string;
  model?: "lyria-3-pro-preview" | "lyria-3-clip-preview";
  responseFormat?: "mp3" | "wav";
  title?: string;
}

// deno-lint-ignore no-explicit-any
const EdgeRuntimeAny: any = (globalThis as any).EdgeRuntime;

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
    const title = (body.title || prompt.split("\n")[0]).slice(0, 60) || "Neuer Song";

    // Deduct upfront so the user sees the cost even if they navigate away.
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

    // Background worker — keeps running even if the client disconnects.
    const work = async () => {
      try {
        const payload: Record<string, unknown> = { model, input: prompt };
        if (wantWav) payload.response_format = { type: "audio", format: "wav" };

        console.log("[generate-music:bg] start user=", userId, "model=", model, "wav=", wantWav);

        const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          console.error("[generate-music:bg] Lyria error", resp.status, txt);
          await supabaseAdmin.rpc("add_credits", {
            _user_id: userId,
            _amount: cost,
            _action_type: "admin_adjustment",
            _description: `Refund: Lyria ${resp.status}`,
          });
          return;
        }

        const data = await resp.json();
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
          console.error("[generate-music:bg] no audio in response");
          await supabaseAdmin.rpc("add_credits", {
            _user_id: userId,
            _amount: cost,
            _action_type: "admin_adjustment",
            _description: "Refund: kein Audio",
          });
          return;
        }

        // Decode base64 → bytes
        const bin = atob(audioBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const ext = mimeType.includes("wav") ? "wav" : "mp3";
        const storagePath = `${userId}/${Date.now()}.${ext}`;

        const up = await supabaseAdmin.storage
          .from("songs")
          .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
        if (up.error) {
          console.error("[generate-music:bg] upload error", up.error.message);
          await supabaseAdmin.rpc("add_credits", {
            _user_id: userId,
            _amount: cost,
            _action_type: "admin_adjustment",
            _description: "Refund: Upload fehlgeschlagen",
          });
          return;
        }

        const { error: insErr } = await supabaseAdmin.from("user_songs").insert({
          user_id: userId,
          title,
          prompt,
          lyrics: lyricsParts.join("\n").trim() || null,
          storage_path: storagePath,
          mime_type: mimeType,
          model,
        });
        if (insErr) {
          console.error("[generate-music:bg] insert error", insErr.message);
          return;
        }

        console.log("[generate-music:bg] done user=", userId, "path=", storagePath);
      } catch (e) {
        console.error("[generate-music:bg] fatal", e instanceof Error ? e.message : String(e));
        await supabaseAdmin.rpc("add_credits", {
          _user_id: userId,
          _amount: cost,
          _action_type: "admin_adjustment",
          _description: "Refund: Background error",
        });
      }
    };

    if (EdgeRuntimeAny?.waitUntil) {
      EdgeRuntimeAny.waitUntil(work());
    } else {
      // Fallback for local/dev — fire-and-forget
      work();
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        creditsUsed: cost,
        message: "Song wird im Hintergrund erstellt. Du findest ihn im Dashboard sobald er fertig ist.",
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
