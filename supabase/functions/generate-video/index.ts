import { createClient } from "npm:@supabase/supabase-js@2";

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

async function deductCredits(userId: string, amount: number): Promise<{ success: boolean; balance?: number; error?: string }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("deduct_credits", {
    _user_id: userId,
    _amount: amount,
    _action_type: "image_generate",
    _description: "Video-Generierung (Veo)",
    _model: "veo-3.1-generate-preview",
  });
  if (error) return { success: false, error: error.message };
  const result = data as any;
  if (!result.success) return { success: false, error: result.error, balance: result.balance };
  return { success: true, balance: result.balance };
}

const DEFAULT_VIDEO_PROMPT = `Erstelle ein professionelles 8-Sekunden Showroom-Video des Fahrzeugs. Das Auto dreht sich langsam auf einer Drehscheibe in einem modernen, hell beleuchteten Autohaus-Showroom. Weiche Beleuchtung, Reflexionen auf dem Lack, polierter Boden. Cinematische Kamerafahrt. Professionelle Autohaus-Atmosphäre.`;

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

    if (action === "start") {
      const authResult = await authenticateUser(req);
      if (authResult instanceof Response) return authResult;
      const { userId } = authResult;

      const creditResult = await deductCredits(userId, 10);
      if (!creditResult.success) {
        return new Response(JSON.stringify({
          error: creditResult.error === "insufficient_credits" ? "insufficient_credits" : creditResult.error,
          balance: creditResult.balance,
          cost: 10,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const systemPrompt = await getCustomPrompt("video_generate", DEFAULT_VIDEO_PROMPT);
      const finalPrompt = userPrompt || systemPrompt;

      let requestBody: any;
      if (imageBase64) {
        const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        let mimeType = "image/jpeg";
        if (imageBase64.startsWith("data:image/png")) mimeType = "image/png";
        else if (imageBase64.startsWith("data:image/webp")) mimeType = "image/webp";
        requestBody = {
          instances: [{ prompt: finalPrompt, image: { bytesBase64Encoded: imageData, mimeType } }],
        };
      } else {
        requestBody = { instances: [{ prompt: finalPrompt }] };
      }

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
      return new Response(JSON.stringify({ operationName: genData.name, status: "started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        const videoUri =
          pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
          pollData.response?.generatedVideos?.[0]?.video?.uri;

        if (!videoUri) {
          return new Response(JSON.stringify({ done: true, error: "Kein Video in der Antwort", raw: pollData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Try downloading the video and upload to Supabase Storage
        let downloadUrl = `${videoUri}&key=${GEMINI_API_KEY}`;
        let videoResponse = await fetch(downloadUrl, { redirect: "follow" });
        
        if (!videoResponse.ok) {
          videoResponse = await fetch(videoUri, {
            headers: { "x-goog-api-key": GEMINI_API_KEY },
            redirect: "follow",
          });
        }

        if (!videoResponse.ok) {
          return new Response(JSON.stringify({ done: true, videoUri, error: "Video-Download fehlgeschlagen" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Upload to Supabase Storage instead of returning base64
        const videoBytes = await videoResponse.arrayBuffer();
        const sb = createServiceClient();
        const fileName = `videos/${crypto.randomUUID()}.mp4`;
        
        const { error: uploadError } = await sb.storage
          .from("vehicle-images")
          .upload(fileName, videoBytes, { contentType: "video/mp4", upsert: true });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          // Fallback to base64 for small videos
          const videoBase64 = `data:video/mp4;base64,${encodeBase64(videoBytes)}`;
          return new Response(JSON.stringify({ done: true, videoBase64 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: publicUrlData } = sb.storage.from("vehicle-images").getPublicUrl(fileName);

        return new Response(JSON.stringify({ done: true, videoUrl: publicUrlData.publicUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
