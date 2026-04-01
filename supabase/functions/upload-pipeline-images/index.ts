import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Upload images to Google Gemini File API.
 * Called ONCE at pipeline start. Returns fileUris that can be reused
 * across all subsequent remaster calls, eliminating redundant base64 transfers.
 * 
 * Input: { images: Array<{ key: string, base64: string }> }
 * Output: { fileUris: Record<string, { uri: string, mimeType: string }> }
 */

async function uploadToGeminiFileApi(
  base64Data: string,
  mimeType: string,
  apiKey: string,
  displayName: string,
): Promise<{ uri: string; mimeType: string }> {
  // Decode base64 to binary
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const metadata = JSON.stringify({ file: { displayName } });
  const boundary = "---GEMINI_UPLOAD_" + crypto.randomUUID().replace(/-/g, "");

  // Build multipart/related body
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(metadataPart.length + bytes.length + suffix.length);
  body.set(metadataPart, 0);
  body.set(bytes, metadataPart.length);
  body.set(suffix, metadataPart.length + bytes.length);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini File API upload failed (${response.status}):`, errText);
    throw new Error(`File upload failed: ${response.status}`);
  }

  const result = await response.json();
  return {
    uri: result.file.uri,
    mimeType: result.file.mimeType || mimeType,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await sb.auth.getClaims(token);
    if (authError || !authData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const { images } = await req.json() as {
      images: Array<{ key: string; base64: string }>;
    };

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[upload-pipeline-images] Uploading ${images.length} images to Gemini File API...`);

    const fileUris: Record<string, { uri: string; mimeType: string }> = {};
    const CONCURRENCY = 4;
    const queue = [...images];
    let uploaded = 0;

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queue.length) },
      async () => {
        while (queue.length > 0) {
          const item = queue.shift()!;
          try {
            // Extract raw base64 and detect MIME type
            const isDataUrl = item.base64.startsWith("data:");
            const mimeMatch = isDataUrl
              ? item.base64.match(/^data:(image\/\w+);base64,/)
              : null;
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
            const rawBase64 = isDataUrl
              ? item.base64.split(",")[1]
              : item.base64;

            const result = await uploadToGeminiFileApi(
              rawBase64,
              mimeType,
              GEMINI_API_KEY,
              item.key
            );
            fileUris[item.key] = result;
            uploaded++;
            console.log(
              `[upload-pipeline-images] ${uploaded}/${images.length} uploaded: ${item.key} → ${result.uri.slice(-20)}`
            );
          } catch (err) {
            console.error(
              `[upload-pipeline-images] Failed to upload ${item.key}:`,
              err
            );
            // Don't fail entire batch – just skip this image
          }
        }
      }
    );

    await Promise.all(workers);

    console.log(
      `[upload-pipeline-images] Done: ${Object.keys(fileUris).length}/${images.length} uploaded successfully`
    );

    return new Response(JSON.stringify({ fileUris }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("upload-pipeline-images error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
