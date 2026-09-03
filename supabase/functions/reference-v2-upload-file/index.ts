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
import {
  ALLOWED_IMAGE_MIME,
  isValidProviderFileUri,
  MAX_UPLOAD_BYTES,
  REFERENCE_V2_PROVIDER_ID,
} from "../_shared/reference-v2-analyzer-validation.ts";

const PROVIDER_ID = REFERENCE_V2_PROVIDER_ID;
const ALLOWED_MIME = ALLOWED_IMAGE_MIME;
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 700;

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

    // Reject oversized uploads from the declared length BEFORE reading the body.
    const declaredLength = Number(req.headers.get("content-length") ?? NaN);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
      return errorResponse(
        `File too large (${declaredLength} bytes declared, max ${MAX_UPLOAD_BYTES}).`,
        413,
      );
    }

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength === 0) return errorResponse("Empty file body", 400);
    // Retained post-read check for absent or wrong Content-Length headers.
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return errorResponse(
        `File too large (${bytes.byteLength} bytes, max ${MAX_UPLOAD_BYTES}).`,
        413,
      );
    }


    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) {
      return errorResponse(
        "FILE_REFERENCE_UNSUPPORTED: no provider configured for Reference V2 file references.",
        503,
      );
    }

    // Der Dateiname kommt als Query-Parameter: ein eigener Request-Header
    // waere nicht in der CORS-Preflight-Allowlist der Plattform und wuerde
    // den Upload im Browser blockieren.
    const displayName =
      decodeURIComponent(
        new URL(req.url).searchParams.get("filename") ||
          req.headers.get("x-reference-v2-filename") ||
          "",
      ) || `reference-v2-${Date.now()}`;

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
    let file = meta.file ?? meta;
    if (!file?.uri || !isValidProviderFileUri(file.uri)) {
      return errorResponse("FILE_REFERENCE_UNSUPPORTED: no usable file uri", 502);
    }

    // The provider file must be ACTIVE before it can be referenced in a
    // generateContent call — poll instead of optimistically returning.
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (file.state && file.state !== "ACTIVE") {
      if (file.state === "FAILED") {
        return errorResponse(
          "FILE_REFERENCE_UNSUPPORTED: provider file processing failed",
          502,
        );
      }
      if (Date.now() > deadline) {
        return errorResponse(
          "FILE_REFERENCE_UNSUPPORTED: provider file did not become ACTIVE in time",
          504,
        );
      }
      await new Promise((r) => setTimeout(r, READY_POLL_MS));
      const statusRes = await fetch(`${file.uri}?key=${apiKey}`);
      if (!statusRes.ok) {
        return errorResponse(
          `FILE_REFERENCE_UNSUPPORTED: file status check failed (${statusRes.status})`,
          502,
        );
      }
      file = await statusRes.json();
    }

    // Preserve the provider's real MIME type and lifecycle metadata.
    const providerMime =
      typeof file.mimeType === "string" && ALLOWED_MIME.includes(file.mimeType)
        ? file.mimeType
        : mimeType;

    return jsonResponse({
      fileId: file.uri as string,
      providerId: PROVIDER_ID,
      mimeType: providerMime,
      sizeBytes: Number(file.sizeBytes ?? bytes.byteLength),
      state: file.state ?? "ACTIVE",
      createdAtIso: file.createTime ?? undefined,
      updatedAtIso: file.updateTime ?? undefined,
      expiresAtIso: file.expirationTime ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse(msg, msg === "Not authenticated" ? 401 : 500);
  }
});
