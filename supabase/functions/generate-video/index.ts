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

async function deductCredits(userId: string, amount: number, actionType: string, description: string): Promise<{ success: boolean; balance?: number; error?: string }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("deduct_credits", {
    _user_id: userId,
    _amount: amount,
    _action_type: actionType,
    _description: description,
    _model: "veo-3.1-generate-preview",
  });
  if (error) return { success: false, error: error.message };
  const result = data as any;
  if (!result.success) return { success: false, error: result.error, balance: result.balance };
  return { success: true, balance: result.balance };
}

const DEFAULT_VIDEO_PROMPT = `Erstelle ein professionelles 8-Sekunden Showroom-Video des Fahrzeugs. Das Auto dreht sich langsam auf einer Drehscheibe in einem modernen, hell beleuchteten Autohaus-Showroom. Weiche Beleuchtung, Reflexionen auf dem Lack, polierter Boden. Cinematische Kamerafahrt. Professionelle Autohaus-Atmosphäre.`;

const DEFAULT_SPIN360_VIDEO_PROMPT = `A seamless, perfect 360-degree rotation of the provided car. The car is placed realistically on the turntable inside the provided empty showroom environment. The camera is mounted on a tripod, completely locked, and perfectly static. The car rotates smoothly around its own vertical center axis at a constant speed. No audio, no background shifting, and no original backgrounds from the reference images. The entire sequence happens strictly inside the showroom lighting and environment. Do not mention any specific car brands.`;

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Extract raw base64 data and mime type from a data URI or raw base64 string */
function parseImageBase64(input: string): { data: string; mimeType: string } {
  if (input.startsWith("data:")) {
    const match = input.match(/^data:(image\/\w+);base64,(.+)$/s);
    if (match) return { data: match[2], mimeType: match[1] };
  }
  // Assume raw base64
  return { data: input.replace(/^data:image\/\w+;base64,/, ""), mimeType: "image/jpeg" };
}

async function handleVideoStart(req: Request, GEMINI_API_KEY: string, body: any): Promise<Response> {
  const authResult = await authenticateUser(req);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  const { imageBase64, images, prompt: userPrompt, action } = body;
  const isSpin360 = action === "spin360_start";
  const creditAmount = 10;
  const creditAction = "image_generate";
  const creditDesc = isSpin360 ? "360° Video-Spin (Veo)" : "Video-Generierung (Veo)";

  const creditResult = await deductCredits(userId, creditAmount, creditAction, creditDesc);
  if (!creditResult.success) {
    return new Response(JSON.stringify({
      error: creditResult.error === "insufficient_credits" ? "insufficient_credits" : creditResult.error,
      balance: creditResult.balance, cost: creditAmount,
    }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const promptKey = isSpin360 ? "spin360_video" : "video_generate";
  const defaultPrompt = isSpin360 ? DEFAULT_SPIN360_VIDEO_PROMPT : DEFAULT_VIDEO_PROMPT;
  const systemPrompt = await getCustomPrompt(promptKey, defaultPrompt);
  const finalPrompt = userPrompt || systemPrompt;

  let requestBody: any;

  // Multi-image spin360 flow (3 images: front_34, rear_34, showroom)
  if (isSpin360 && Array.isArray(images) && images.length > 0) {
    const imageInstances = images.map((img: { base64: string; label: string }) => {
      const parsed = parseImageBase64(img.base64);
      return { bytesBase64Encoded: parsed.data, mimeType: parsed.mimeType };
    });

    // Build prompt with context about the images
    const enhancedPrompt = `${finalPrompt}\n\nIMPORTANT: The first image is the 3/4 front view of the car. The second image is the 3/4 rear view of the car. The third image is the empty showroom environment with turntable where the car must be placed. Remove all original backgrounds from the car images completely — the car must appear ONLY inside the showroom from frame 1. No flickering of original backgrounds allowed.`;

    if (imageInstances.length === 1) {
      requestBody = {
        instances: [{ prompt: enhancedPrompt, image: imageInstances[0] }],
      };
    } else {
      // Veo API: pass multiple images via the prompt context
      // We pass the first image as main reference and include others as additional context
      requestBody = {
        instances: [{
          prompt: enhancedPrompt,
          image: imageInstances[0],
        }],
      };

      // If API supports multiple images, add them
      if (imageInstances.length > 1) {
        requestBody.instances[0].referenceImages = imageInstances.slice(1);
      }
    }
  } else if (imageBase64) {
    // Legacy single-image flow
    const parsed = parseImageBase64(imageBase64);
    requestBody = {
      instances: [{ prompt: finalPrompt, image: { bytesBase64Encoded: parsed.data, mimeType: parsed.mimeType } }],
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

  // If spin360, update job status
  if (isSpin360 && body.jobId) {
    const sb = createServiceClient();
    await sb.from("spin360_jobs").update({ status: "generating_video", updated_at: new Date().toISOString() }).eq("id", body.jobId);
  }

  return new Response(JSON.stringify({ operationName: genData.name, status: "started" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handlePoll(req: Request, GEMINI_API_KEY: string, body: any): Promise<Response> {
  const { operationName } = body;
  if (!operationName) {
    return new Response(JSON.stringify({ error: "operationName fehlt" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authResult = await authenticateUser(req);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

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

    const videoBytes = await videoResponse.arrayBuffer();
    const sb = createServiceClient();
    const fileName = `${userId}/videos/${crypto.randomUUID()}.mp4`;

    const { error: uploadError } = await sb.storage
      .from("vehicle-images")
      .upload(fileName, videoBytes, { contentType: "video/mp4", upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
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
    const body = await req.json();
    const { action } = body;

    if (action === "start" || action === "spin360_start") {
      return handleVideoStart(req, GEMINI_API_KEY, body);
    }

    if (action === "poll") {
      return handlePoll(req, GEMINI_API_KEY, body);
    }

    return new Response(JSON.stringify({ error: "Ungültige action. Verwende 'start', 'spin360_start' oder 'poll'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-video error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
