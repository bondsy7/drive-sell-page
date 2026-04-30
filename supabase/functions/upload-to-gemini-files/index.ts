// upload-to-gemini-files
// Uploads images to Google Generative Language File API ("Gemini File API")
// once and returns reusable file URIs. Pipeline / banner / video can then
// reference the URIs without re-encoding base64.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

interface InImage {
  id: string;
  imageBase64: string;
  /** Optional display name */
  displayName?: string;
}

interface OutFile {
  id: string;
  uri: string;
  mimeType: string;
  expirationTime?: string;
}

function detectMime(b64: string): string {
  if (b64.startsWith("data:image/png")) return "image/png";
  if (b64.startsWith("data:image/webp")) return "image/webp";
  return "image/jpeg";
}

function base64ToBytes(b64: string): Uint8Array {
  const raw = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function uploadOne(apiKey: string, img: InImage): Promise<OutFile> {
  const mimeType = detectMime(img.imageBase64);
  const bytes = base64ToBytes(img.imageBase64);

  // 1. Start resumable upload
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { displayName: img.displayName || img.id } }),
    },
  );
  if (!startRes.ok) {
    throw new Error(`upload start failed: ${startRes.status} ${await startRes.text()}`);
  }
  const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("no upload url returned");

  // 2. Upload bytes + finalize
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!upRes.ok) {
    throw new Error(`upload finalize failed: ${upRes.status} ${await upRes.text()}`);
  }
  const meta = await upRes.json();
  const file = meta.file ?? meta;
  if (!file?.uri) throw new Error("no file uri in response");

  return {
    id: img.id,
    uri: file.uri as string,
    mimeType,
    expirationTime: file.expirationTime,
  };
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

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("GEMINI_API_KEY not configured", 500);

    const results: OutFile[] = [];
    const errors: { id: string; error: string }[] = [];

    // Sequential to keep memory low; uploads are tiny.
    for (const img of images) {
      try {
        results.push(await uploadOne(apiKey, img));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`upload ${img.id} failed:`, msg);
        errors.push({ id: img.id, error: msg });
      }
    }

    return jsonResponse({ files: results, errors });
  } catch (e) {
    console.error("upload-to-gemini-files error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
