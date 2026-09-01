// reference-v2-analyze-image
// Reference V2 (Vehicle Reference Engine V2) — automatic vision intake.
//
// The reference image defines WHAT the vehicle is. Metadata only describes
// what we know ABOUT it. Metadata must never override visible vehicle identity.
//
// Strictly isolated from the legacy remaster/OneShot functions.
// Hard rules:
//  - image input ONLY via provider file references (fileId), never base64
//  - NO business metadata (make/model/trim/year/VIN/title) in or out
//  - strict JSON response, validated; never optimistic defaults

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

const ANALYZER_SCHEMA_VERSION = "reference-v2-vision-1";
const MODEL = "gemini-2.5-flash";

const FORBIDDEN_KEYS = [
  "make", "brand", "manufacturer", "marke", "hersteller", "model", "modell",
  "modelname", "variant", "trim", "ausstattung", "generation", "facelift",
  "modelyear", "year", "baujahr", "vin", "fin", "chassisnumber",
  "fahrgestellnummer", "title", "vehicletitle", "commercialtitle",
  "listingtitle", "price", "preis",
];
const FORBIDDEN_VALUE_PATTERNS = [/\b(19|20)\d{2}\b/, /\b[A-HJ-NPR-Z0-9]{17}\b/];

function firewall(value: unknown, path = "", out: string[] = [], depth = 0): string[] {
  if (depth > 12) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => firewall(v, `${path}[${i}]`, out, depth + 1));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nk = k.toLowerCase().replace(/[^a-z]/g, "");
      if (FORBIDDEN_KEYS.includes(nk)) out.push(`forbidden key "${k}"`);
      firewall(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    for (const re of FORBIDDEN_VALUE_PATTERNS) {
      if (re.test(value)) {
        out.push(`forbidden semantic content at "${path}"`);
        break;
      }
    }
  }
  return out;
}

const SYSTEM_INSTRUCTION = `You are a strict VISUAL vehicle reference analyzer.

ABSOLUTE PROHIBITIONS — never identify, infer, guess, name or hint at:
- manufacturer / brand / marque
- model or model name
- variant / trim / equipment line
- model year or production year
- facelift / generation designation
- VIN or any identification number
- commercial or listing title, price

You describe ONLY what is visible: geometry, proportions, surfaces, camera pose,
framing and image quality. Any brand/model/year statement is a critical failure.

Return STRICT JSON ONLY, no markdown, matching exactly the requested shape.
Never invent values. If something is not determinable, use null (where allowed)
and lower the confidence instead of guessing.

Scoring semantics:
- visibility scores: 0..1, high = well visible
- sharpness / resolutionAdequacy: 0..1, high = good
- occlusion / glare: SEVERITY 0..1, 0 = none, 1 = strong

Perspective classification: choose exactly one canonical perspective id from the
provided closed list, using vehicle-relative side convention (never viewer side).
Azimuth is the vehicle-relative camera azimuth in degrees, (-180, 180], 0 = front.
If no id fits confidently, return null and a low perspectiveConfidence.`;

function buildUserPrompt(vehicleClass: string, allowedIds: string[], anchors: number) {
  return `Visual vehicle class of this reference set: ${vehicleClass} (visual body typology only).

Allowed canonical perspective ids (closed list, choose exactly one or null):
${allowedIds.join(", ")}

${anchors > 0
    ? `The additional ${anchors} image(s) are already accepted reference images of the SAME physical vehicle. Compare visible morphology only (silhouette, lamp geometry, front panel, bumper, roofline, wheels, mirrors, handles, trim, roof equipment) and return sameVehicleConfidence 0..1. Do not use brand or model reasoning.`
    : `No anchor images were provided. Return sameVehicleConfidence = null.`}

Respond with JSON exactly of this shape:
{
  "schemaVersion": "${ANALYZER_SCHEMA_VERSION}",
  "vehicleDetected": boolean,
  "vehicleClass": "car"|"van"|"motorhome"|"truck"|"motorcycle"|"trailer"|null,
  "canonicalPerspectiveId": string|null,
  "perspectiveConfidence": number,
  "azimuthDeg": number|null,
  "pitchDeg": number|null,
  "elevationProfile": "low"|"standard"|"elevated"|"interior"|"close_detail"|null,
  "visibility": { "front": number, "rear": number, "leftSide": number, "rightSide": number, "roof": number },
  "framing": { "fullVehicleVisible": boolean, "cropped": boolean, "visibleWheelPositions": string[], "estimatedPaddingPct": number },
  "quality": { "sharpness": number, "occlusion": number, "glare": number, "resolutionAdequacy": number },
  "mirroredSuspected": boolean,
  "classificationConfidence": number,
  "sameVehicleConfidence": number|null,
  "identityEvidence": {
    "bodySilhouette": string, "proportions": string, "headlampGeometry": string,
    "taillampGeometry": string, "frontPanelGeometry": string, "bumperGeometry": string,
    "windowAndRoofline": string, "wheelDesign": string, "mirrorsAndHandles": string,
    "trimPlacement": string, "roofEquipment": string
  },
  "issues": [{ "code": string, "severity": "critical"|"major"|"minor", "message": string }]
}

visibleWheelPositions must use: front_left, front_right, rear_left, rear_right.
identityEvidence entries are short purely descriptive phrases without any brand,
model or year wording. Omit an evidence key entirely if not visible.`;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const correlationId = crypto.randomUUID();

  try {
    await authenticateRequest(req);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("Invalid request body", 400);
    }
    const {
      fileId,
      mimeType,
      vehicleClass,
      allowedPerspectiveIds,
      anchorFileIds = [],
    } = body as Record<string, any>;

    // Fail closed on any inbound business metadata.
    const inboundViolations = firewall(body);
    if (inboundViolations.length > 0) {
      return errorResponse(
        `SEMANTIC_FIREWALL: ${inboundViolations.join("; ")}`,
        400,
      );
    }
    if (typeof fileId !== "string" || !fileId) {
      return errorResponse(
        "FILE_REFERENCE_UNSUPPORTED: fileId is required — base64 image data is not accepted.",
        400,
      );
    }
    if (JSON.stringify(body).includes("base64")) {
      return errorResponse(
        "FILE_REFERENCE_UNSUPPORTED: inline image data is not accepted.",
        400,
      );
    }
    if (!Array.isArray(allowedPerspectiveIds) || allowedPerspectiveIds.length === 0) {
      return errorResponse("allowedPerspectiveIds is required", 400);
    }
    if (typeof vehicleClass !== "string") {
      return errorResponse("vehicleClass is required", 400);
    }

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) {
      return errorResponse(
        "ANALYSIS_UNAVAILABLE: no vision provider configured for Reference V2.",
        503,
      );
    }

    const anchors: string[] = Array.isArray(anchorFileIds)
      ? anchorFileIds.filter((x: unknown) => typeof x === "string").slice(0, 3)
      : [];

    const parts: unknown[] = [
      { text: buildUserPrompt(vehicleClass, allowedPerspectiveIds, anchors.length) },
      { fileData: { fileUri: fileId, mimeType: mimeType || "image/jpeg" } },
      ...anchors.map((uri) => ({
        fileData: { fileUri: uri, mimeType: "image/jpeg" },
      })),
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      return errorResponse(
        `ANALYSIS_UNAVAILABLE: provider ${res.status} ${detail.slice(0, 300)}`,
        502,
      );
    }

    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? undefined;
    if (!text) {
      return errorResponse("ANALYSIS_UNAVAILABLE: empty provider response", 502);
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
    } catch {
      return errorResponse("INVALID_ANALYZER_JSON: response is not valid JSON", 502);
    }

    const outboundViolations = firewall(analysis);
    if (outboundViolations.length > 0) {
      return errorResponse(
        `SEMANTIC_FIREWALL: analyzer returned identity data (${outboundViolations.join("; ")})`,
        502,
      );
    }

    if (
      typeof analysis !== "object" ||
      analysis === null ||
      (analysis as any).schemaVersion !== ANALYZER_SCHEMA_VERSION
    ) {
      return errorResponse("INVALID_ANALYZER_JSON: schemaVersion mismatch", 502);
    }

    return jsonResponse({ analysis, correlationId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse(msg, msg === "Not authenticated" ? 401 : 500);
  }
});
