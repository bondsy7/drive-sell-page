// upload-to-openai-files
// Uploads images ONCE to the OpenAI Files API (purpose=vision) and returns
// reusable file IDs. Used by the Sunburst (Responses API) image path so that
// references never have to be re-sent as base64 per request.
//
// Gemini flows keep using `upload-to-gemini-files` – this function is additive.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

interface InImage {
  id: string;
  imageBase64: string;
  mimeType?: string;
  displayName?: string;
}

interface OutFile {
  id: string;
  fileId: string;
  mimeType: string;
}

function detectMime(b64: string): string {
  if (b64.startsWith("data:image/png")) return "image/png";
  if (b64.startsWith("data:image/webp")) return "image/webp";
  if (b64.startsWith("data:image/")) {
    const m = b64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    if (m) return m[1];
  }
  return "image/jpeg";
}

function base64ToBytes(b64: string): Uint8Array {
  const raw = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(raw.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function extFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

async function uploadOne(apiKey: string, img: InImage): Promise<OutFile> {
  const mimeType = img.mimeType || detectMime(img.imageBase64);
  const bytes = base64ToBytes(img.imageBase64);
  const safeName = (img.displayName || img.id).replace(/[^a-zA-Z0-9_-]/g, "_");

  const form = new FormData();
  form.append("purpose", "vision");
  form.append("file", new Blob([bytes], { type: mimeType }), `${safeName}.${extFor(mimeType)}`);

  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openai files upload failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const meta = await res.json();
  if (!meta?.id) throw new Error("no file id in OpenAI response");
  return { id: img.id, fileId: meta.id as string, mimeType };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await authenticateRequest(req);

    const { images }: { images: InImage[] } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return errorResponse("Keine Bilder übermittelt", 400);
    }
    if (images.length > 20) {
      return errorResponse("Maximal 20 Bilder pro Anfrage", 400);
    }

    const apiKey = await getSecret("OPENAI_API_KEY");
    if (!apiKey) return errorResponse("OPENAI_API_KEY not configured", 500);

    const results: OutFile[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const img of images) {
      try {
        results.push(await uploadOne(apiKey, img));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[openai-files] upload ${img.id} failed:`, msg);
        errors.push({ id: img.id, error: msg });
      }
    }

    console.log(`[openai-files] uploaded=${results.length}/${images.length} failed=${errors.length}`);
    return jsonResponse({ files: results, errors, partial: errors.length > 0 });
  } catch (e) {
    console.error("upload-to-openai-files error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
