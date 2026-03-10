import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getCustomPrompt(key: string, defaultPrompt: string): Promise<string> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    if (data?.value && typeof data.value === "object") {
      const prompts = data.value as Record<string, string>;
      if (prompts[key] && prompts[key].trim() !== "" && prompts[key].trim().toLowerCase() !== "default") {
        return prompts[key];
      }
    }
  } catch {}
  return defaultPrompt;
}

async function authenticateUser(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await anonClient.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: user.id };
}

async function deductCredits(userId: string, amount: number, actionType: string): Promise<{ success: boolean; balance?: number; error?: string }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("deduct_credits", {
    _user_id: userId,
    _amount: amount,
    _action_type: actionType,
    _description: `Video-Generierung (Veo)`,
    _model: "veo-3.1-generate-preview",
  });
  if (error) return { success: false, error: error.message };
  const result = data as any;
  if (!result.success) return { success: false, error: result.error, balance: result.balance };
  return { success: true, balance: result.balance };
}

const DEFAULT_VIDEO_PROMPT = `Erstelle ein professionelles 8-Sekunden Showroom-Video des Fahrzeugs. Das Auto dreht sich langsam auf einer Drehscheibe in einem modernen, hell beleuchteten Autohaus-Showroom. Weiche Beleuchtung, Reflexionen auf dem Lack, polierter Boden. Cinematische Kamerafahrt. Professionelle Autohaus-Atmosphäre.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY nicht konfiguriert" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, imageBase64, prompt: userPrompt, operationName } = await req.json();

    // ─── ACTION: start ───
    if (action === "start") {
      // Auth + credits
      const authResult = await authenticateUser(req);
      if (authResult instanceof Response) return authResult;
      const { userId } = authResult;

      const creditResult = await deductCredits(userId, 10, "image_generate");
      if (!creditResult.success) {
        return new Response(JSON.stringify({
          error: creditResult.error === "insufficient_credits" ? "insufficient_credits" : creditResult.error,
          balance: creditResult.balance,
          cost: 10,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get prompt
      const systemPrompt = await getCustomPrompt("video_generate", DEFAULT_VIDEO_PROMPT);
      const finalPrompt = userPrompt || systemPrompt;

      let requestBody: any;

      if (imageBase64) {
        // Image-to-video: use inline image data
        const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        
        // Detect mime type
        let mimeType = "image/jpeg";
        if (imageBase64.startsWith("data:image/png")) mimeType = "image/png";
        else if (imageBase64.startsWith("data:image/webp")) mimeType = "image/webp";

        requestBody = {
          instances: [{
            prompt: finalPrompt,
            image: {
              bytesBase64Encoded: imageData,
              mimeType,
            },
          }],
        };
      } else {
        // Text-to-video
        requestBody = {
          instances: [{ prompt: finalPrompt }],
        };
      }

      // Start video generation
      const genUrl = `${BASE_URL}/models/veo-3.1-generate-preview:predictLongRunning?key=${GEMINI_API_KEY}`;
      const genResponse = await fetch(genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!genResponse.ok) {
        const errBody = await genResponse.text();
        console.error("Video generation start error:", errBody);
        return new Response(JSON.stringify({ error: "Video-Generierung fehlgeschlagen", details: errBody }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const genData = await genResponse.json();
      const opName = genData.name;

      return new Response(JSON.stringify({ operationName: opName, status: "started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: poll ───
    if (action === "poll") {
      if (!operationName) {
        return new Response(JSON.stringify({ error: "operationName fehlt" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pollUrl = `${BASE_URL}/${operationName}?key=${GEMINI_API_KEY}`;
      const pollResponse = await fetch(pollUrl);
      
      if (!pollResponse.ok) {
        const errBody = await pollResponse.text();
        return new Response(JSON.stringify({ error: "Poll fehlgeschlagen", details: errBody }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pollData = await pollResponse.json();

      if (pollData.done) {
        // Extract video URI
        const videoUri =
          pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
          pollData.response?.generatedVideos?.[0]?.video?.uri;

        if (!videoUri) {
          return new Response(JSON.stringify({ done: true, error: "Kein Video in der Antwort", raw: pollData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Download video and convert to base64
        const videoResponse = await fetch(`${videoUri}&key=${GEMINI_API_KEY}`, { redirect: "follow" });
        
        if (!videoResponse.ok) {
          // Try without appending key (might already be in URI)
          const videoResponse2 = await fetch(videoUri, {
            headers: { "x-goog-api-key": GEMINI_API_KEY },
            redirect: "follow",
          });
          if (!videoResponse2.ok) {
            return new Response(JSON.stringify({ done: true, videoUri, error: "Video-Download fehlgeschlagen" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const videoBytes = await videoResponse2.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(videoBytes)));
          const videoBase64 = `data:video/mp4;base64,${base64}`;

          return new Response(JSON.stringify({ done: true, videoBase64 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const videoBytes = await videoResponse.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(videoBytes)));
        const videoBase64 = `data:video/mp4;base64,${base64}`;

        return new Response(JSON.stringify({ done: true, videoBase64 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Not done yet
      return new Response(JSON.stringify({ done: false, status: "processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ungültige action. Verwende 'start' oder 'poll'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-video error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
