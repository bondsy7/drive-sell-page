import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Upload images to Google Gemini File API.
 * Returns file URIs that can be used in subsequent generateContent calls,
 * avoiding repeated base64 inline_data payloads.
 *
 * Input:  { images: string[] }  — array of base64 data URLs
 * Output: { fileUris: { uri: string; mimeType: string }[] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await sb.auth.getClaims(token);
    if (authErr || !authData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "Keine Bilder angegeben" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;

    const t0 = Date.now();
    const uploadOne = async (dataUrl: string, idx: number): Promise<{ uri: string; mimeType: string } | null> => {
      try {
        const isDataUrl = dataUrl.startsWith("data:");
        let mimeType = "image/jpeg";
        let raw = dataUrl;
        if (isDataUrl) {
          const match = dataUrl.match(/^data:(image\/\w+);base64,/);
          if (match) mimeType = match[1];
          raw = dataUrl.split(",")[1];
        }
        const binaryStr = atob(raw);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const startResp = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(bytes.length),
            "X-Goog-Upload-Header-Content-Type": mimeType,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file: { display_name: `pipeline_${Date.now()}_${idx}` } }),
        });
        if (!startResp.ok) {
          console.error(`File API start failed: ${startResp.status}`, await startResp.text());
          return null;
        }
        const uploadUri = startResp.headers.get("X-Goog-Upload-URL");
        if (!uploadUri) return null;
        const uploadResp = await fetch(uploadUri, {
          method: "PUT",
          headers: {
            "Content-Length": String(bytes.length),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
          },
          body: bytes,
        });
        if (!uploadResp.ok) {
          console.error(`File API upload failed: ${uploadResp.status}`, await uploadResp.text());
          return null;
        }
        const uploadResult = await uploadResp.json();
        const uri = uploadResult?.file?.uri;
        return uri ? { uri, mimeType } : null;
      } catch (err) {
        console.error("[upload-pipeline-images] Single upload error:", err);
        return null;
      }
    };

    // Parallel (max 8 gleichzeitig), Reihenfolge bleibt erhalten; Fehlversuche 1× wiederholen.
    const results: ({ uri: string; mimeType: string } | null)[] = new Array(images.length).fill(null);
    const CONCURRENCY = 8;
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, images.length) }, async () => {
      while (next < images.length) {
        const i = next++;
        results[i] = (await uploadOne(images[i], i)) ?? (await uploadOne(images[i], i));
      }
    }));

    // Nur vollständige, indexgenaue Ergebnisse zurückgeben – sonst Fallback im Client.
    const complete = results.every(Boolean);
    const fileUris = complete ? (results as { uri: string; mimeType: string }[]) : [];

    console.log(`[upload-pipeline-images] Uploaded ${results.filter(Boolean).length}/${images.length} images in ${Date.now() - t0}ms (complete=${complete})`);

    return new Response(JSON.stringify({ fileUris }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("upload-pipeline-images error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
