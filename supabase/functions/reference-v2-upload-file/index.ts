// reference-v2-upload-file
// Reference V2 (Vehicle Reference Engine V2) — isolated file-reference upload.
//
// The reference image defines WHAT the vehicle is. Metadata only describes
// what we know ABOUT it. Metadata must never override visible vehicle identity.
//
// Accepts RAW image bytes (no base64, no JSON envelope) and returns a durable
// provider file reference. Fails closed with FILE_REFERENCE_UNSUPPORTED when
// the provider cannot return a real file reference. Completely separate from
// the legacy remaster/upload-to-gemini-files path.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

const PROVIDER_ID = "gemini-file-api";
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await authenticateRequest(req);

    const mimeType = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!ALLOWED_MIME.includes(mimeType)) {
      return errorResponse(
        `Unsupported content-type "${mimeType}" — Reference V2 accepts raw ${ALLOWED_MIME.join(", ")} bytes only.`,
        400,
      );
    }

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength === 0) return errorResponse("Empty file body", 400);

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) {
      return errorResponse(
        "FILE_REFERENCE_UNSUPPORTED: no provider configured for Reference V2 file references.",
        503,
      );
    }

    const displayName =
      decodeURIComponent(req.headers.get("x-reference-v2-filename") || "") ||
      `reference-v2-${Date.now()}`;

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
        body: JSON.stringify({ file: { displayName } }),
      },
    );
    if (!startRes.ok) {
      return errorResponse(
        `FILE_REFERENCE_UNSUPPORTED: upload start failed (${startRes.status})`,
        502,
      );
    }
    const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
      return errorResponse("FILE_REFERENCE_UNSUPPORTED: no upload url", 502);
    }

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
      return errorResponse(
        `FILE_REFERENCE_UNSUPPORTED: upload finalize failed (${upRes.status})`,
        502,
      );
    }
    const meta = await upRes.json();
    const file = meta.file ?? meta;
    if (!file?.uri) {
      return errorResponse("FILE_REFERENCE_UNSUPPORTED: no file uri", 502);
    }

    return jsonResponse({
      fileId: file.uri as string,
      providerId: PROVIDER_ID,
      mimeType,
      expiresAtIso: file.expirationTime ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse(msg, msg === "Not authenticated" ? 401 : 500);
  }
});
