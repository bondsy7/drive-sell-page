// reference-v2-generate-image
// Reference V2 (Vehicle Reference Engine V2) — strict-reference image generation.
//
// Hard rules:
//  - the deterministic prompt is built by the frozen client-side PromptAssembler
//    and must carry the four canonical sections; nothing is invented here
//  - exactly one primary reference plus at most 3 scoped secondary references
//  - no vehicle metadata (brand/model/year/VIN) may reach the provider
//  - strictly isolated from the legacy remaster/OneShot functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

const REQUIRED_PROMPT_SECTIONS = [
  "[CORE]",
  "[PERSPECTIVE]",
  "[ACTIVE_MODULES]",
  "[REFERENCE_MANIFEST]",
];

const FORBIDDEN_PROMPT_PATTERNS: readonly RegExp[] = [
  /\bvin\b/i,
  /\bmodel year\b/i,
  /\btrim level\b/i,
  /\bmanufacturer\b/i,
  /\bbrand name\b/i,
];

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_REFERENCES = 4; // 1 primary + max 3 secondary
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const MODEL_CHAIN: Record<string, readonly string[]> = {
  economy: ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"],
  standard: ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
  premium: ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"],
};

interface ReferencePayload {
  role: "primary" | "secondary";
  assetId: string;
  mimeType: string;
  dataBase64: string;
}

function badRequest(message: string): Response {
  return errorResponse(message, 400);
}

function approxBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const correlationId = crypto.randomUUID();

  try {
    await authenticateRequest(req);
  } catch {
    return errorResponse("Not authenticated", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("INVALID_JSON");
  }

  const perspectiveSpecId = body.perspectiveSpecId;
  const perspectiveSpecVersion = body.perspectiveSpecVersion;
  const prompt = body.prompt;
  const tier = typeof body.tier === "string" ? body.tier : "standard";
  const references = body.references;

  if (typeof perspectiveSpecId !== "string" || perspectiveSpecId.length === 0) {
    return badRequest("INVALID_PERSPECTIVE_ID");
  }
  if (
    typeof perspectiveSpecVersion !== "number" ||
    !Number.isInteger(perspectiveSpecVersion) ||
    perspectiveSpecVersion < 1
  ) {
    return badRequest("INVALID_PERSPECTIVE_VERSION");
  }
  if (typeof prompt !== "string" || prompt.length < 200) {
    return badRequest("INVALID_PROMPT");
  }
  for (const section of REQUIRED_PROMPT_SECTIONS) {
    if (!prompt.includes(section)) {
      return badRequest(`PROMPT_SECTION_MISSING: ${section}`);
    }
  }
  for (const pattern of FORBIDDEN_PROMPT_PATTERNS) {
    if (pattern.test(prompt)) {
      return badRequest("SEMANTIC_FIREWALL: prompt contains identity wording");
    }
  }
  if (!Array.isArray(references) || references.length === 0) {
    return badRequest("NO_REFERENCES");
  }
  if (references.length > MAX_REFERENCES) {
    return badRequest("TOO_MANY_REFERENCES");
  }

  const parsed: ReferencePayload[] = [];
  let totalBytes = 0;
  for (const raw of references) {
    const ref = raw as Partial<ReferencePayload>;
    if (ref.role !== "primary" && ref.role !== "secondary") {
      return badRequest("INVALID_REFERENCE_ROLE");
    }
    if (typeof ref.assetId !== "string" || ref.assetId.length === 0) {
      return badRequest("INVALID_REFERENCE_ASSET_ID");
    }
    if (typeof ref.mimeType !== "string" || !ALLOWED_MIME.has(ref.mimeType)) {
      return badRequest("UNSUPPORTED_REFERENCE_MIME");
    }
    if (typeof ref.dataBase64 !== "string" || ref.dataBase64.length < 100) {
      return badRequest("INVALID_REFERENCE_DATA");
    }
    totalBytes += approxBytes(ref.dataBase64);
    parsed.push(ref as ReferencePayload);
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return badRequest("REFERENCE_PAYLOAD_TOO_LARGE");
  }
  const primaries = parsed.filter((r) => r.role === "primary");
  if (primaries.length !== 1) {
    return badRequest("EXACTLY_ONE_PRIMARY_REQUIRED");
  }

  const apiKey = await getSecret("GEMINI_API_KEY");
  if (!apiKey) return errorResponse("GEMINI_API_KEY not configured", 500);

  // Primary first — reference order is part of the deterministic contract.
  const ordered = [
    ...primaries,
    ...parsed.filter((r) => r.role === "secondary"),
  ];
  const parts: unknown[] = [
    { text: prompt },
    ...ordered.map((r) => ({
      inlineData: { mimeType: r.mimeType, data: r.dataBase64 },
    })),
  ];

  const models = MODEL_CHAIN[tier] ?? MODEL_CHAIN.standard;
  const startedAt = Date.now();
  const HARD_BUDGET_MS = 130_000;
  let lastError = "generation failed";

  for (const model of models) {
    const remaining = HARD_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 15_000) break;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      console.log(
        `[reference-v2-generate-image] ${correlationId} model=${model} refs=${ordered.length} perspective=${perspectiveSpecId}`,
      );
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        },
        Math.min(60_000, remaining - 2_000),
      );

      if (!response.ok) {
        const text = await response.text();
        lastError = `provider ${response.status}`;
        console.error(
          `[reference-v2-generate-image] ${correlationId} ${model} ${response.status} ${text.slice(0, 400)}`,
        );
        continue;
      }

      const data = await response.json();
      const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
      for (const part of responseParts) {
        const inline = part?.inlineData ?? part?.inline_data;
        if (inline?.data) {
          return jsonResponse({
            correlationId,
            perspectiveSpecId,
            perspectiveSpecVersion,
            model,
            mimeType: inline.mimeType ?? inline.mime_type ?? "image/png",
            imageBase64: inline.data,
          });
        }
      }
      lastError = "provider returned no image";
      console.warn(
        `[reference-v2-generate-image] ${correlationId} ${model} returned no image part`,
      );
    } catch (e) {
      lastError = e instanceof Error ? e.message : "provider call failed";
      console.error(
        `[reference-v2-generate-image] ${correlationId} ${model} ${lastError}`,
      );
    }
  }

  return errorResponse(`GENERATION_UNAVAILABLE: ${lastError}`, 502);
});
