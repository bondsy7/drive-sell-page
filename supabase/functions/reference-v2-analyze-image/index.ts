// reference-v2-analyze-image
// Reference V2 (Vehicle Reference Engine V2) — automatic vision intake.
//
// The reference image defines WHAT the vehicle is. Metadata only describes
// what we know ABOUT it. Metadata must never override visible vehicle identity.
//
// Strictly isolated from the legacy remaster/OneShot functions.
// Hard rules:
//  - image input ONLY via provider file references (fileId), never base64
//  - the EXPECTED vehicle class is never sent here; the model must infer the
//    visual class purely from pixels (the client gates the comparison)
//  - perspective definitions come from the generated PerspectiveMaster v1
//    artifact, never from the browser
//  - strict server-side request AND response validation; no optimistic defaults

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";
import {
  referenceV2PerspectiveDefinitionLines,
  REFERENCE_V2_MASTER_VERSION,
  REFERENCE_V2_SIDE_CONVENTION,
  REFERENCE_V2_VEHICLE_CLASSES,
} from "../_shared/reference-v2-perspective-master.generated.ts";
import {
  ANALYZER_SCHEMA_VERSION,
  semanticViolations,
  validateAnalyzeRequest,
  validateAnalyzerResponse,
} from "../_shared/reference-v2-analyzer-validation.ts";

const MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You are a strict VISUAL vehicle reference analyzer.

ABSOLUTE PROHIBITIONS — never identify, infer, guess, name or hint at:
- manufacturer / brand / marque
- model or model name
- variant / trim / equipment line
- model year or production year
- facelift / generation designation
- VIN or any identification number
- commercial or listing title, price
Never use those words in any free-text field either. Describe pure morphology.

You describe ONLY what is visible: geometry, proportions, surfaces, camera pose,
framing and image quality. Any brand/model/year statement is a critical failure.

Return STRICT JSON ONLY, no markdown, matching exactly the requested shape.
Never invent values. If something is not determinable, use null (where allowed)
and lower the confidence instead of guessing.

Scoring semantics:
- visibility scores: 0..1, high = well visible
- sharpness / resolutionAdequacy: 0..1, high = good
- occlusion / glare: SEVERITY 0..1, 0 = none, 1 = strong

Side convention is ${REFERENCE_V2_SIDE_CONVENTION}: "left"/"right" always refer to
the vehicle's own left/right, never the viewer's. Azimuth is the vehicle-relative
camera azimuth in degrees, (-180, 180], 0 = straight-on front, +90 = the vehicle's
right side faces the camera, -90 = the vehicle's left side faces the camera.

The visual vehicle class must be DETECTED from the image alone. You are never
told what class to expect, and you must not assume one.`;

function buildUserPrompt(anchors: number): string {
  return `Determine the visual vehicle class from the image alone. Allowed values:
${(REFERENCE_V2_VEHICLE_CLASSES as readonly string[]).join(", ")} (pure body typology, no brand reasoning).

Canonical perspective definitions (PerspectiveMaster v${REFERENCE_V2_MASTER_VERSION}, closed list —
choose exactly one id or null). Each line: id | category | azimuth spec | elevation |
sideMustMatch | framing | required visible surfaces | applicable classes:
${referenceV2PerspectiveDefinitionLines()}

Pick the perspective whose azimuth, elevation, framing and required visible
surfaces actually match the image. The chosen perspective must be applicable to
the vehicle class you detected. If nothing fits within its tolerance, return null
and a low perspectiveConfidence.

${anchors > 0
    ? `The additional ${anchors} image(s) are already accepted reference images of the SAME physical vehicle. Compare visible morphology only (silhouette, lamp geometry, front panel, bumper, roofline, wheels, mirrors, handles, trim, roof equipment) and return sameVehicleConfidence 0..1.`
    : `No anchor images were provided. Return sameVehicleConfidence = null.`}

Respond with JSON exactly of this shape (no extra keys):
{
  "schemaVersion": "${ANALYZER_SCHEMA_VERSION}",
  "vehicleDetected": boolean,
  "vehicleClass": string|null,
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
identityEvidence entries are short purely descriptive phrases (max 240 chars)
without any brand, model, trim, generation or year wording. Omit an evidence key
entirely if that area is not visible.`;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const correlationId = crypto.randomUUID();

  try {
    await authenticateRequest(req);

    const raw = await req.json().catch(() => null);

    // Fail closed on any inbound business metadata before anything else.
    const inbound = semanticViolations(raw);
    if (inbound.length > 0) {
      return errorResponse(`SEMANTIC_FIREWALL: ${inbound.join("; ")}`, 400);
    }
    if (JSON.stringify(raw ?? null).includes("base64")) {
      return errorResponse(
        "FILE_REFERENCE_UNSUPPORTED: inline image data is not accepted.",
        400,
      );
    }

    const validated = validateAnalyzeRequest(raw);
    if (!validated.ok) return errorResponse(validated.error, 400);
    const { fileId, mimeType, anchors } = validated.request;

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) {
      return errorResponse(
        "ANALYSIS_UNAVAILABLE: no vision provider configured for Reference V2.",
        503,
      );
    }

    const parts: unknown[] = [
      { text: buildUserPrompt(anchors.length) },
      { fileData: { fileUri: fileId, mimeType } },
      ...anchors.map((a) => ({
        fileData: { fileUri: a.fileId, mimeType: a.mimeType },
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
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      undefined;
    if (!text) {
      return errorResponse("ANALYSIS_UNAVAILABLE: empty provider response", 502);
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
    } catch {
      return errorResponse("INVALID_ANALYZER_JSON: response is not valid JSON", 502);
    }

    const outbound = semanticViolations(analysis);
    if (outbound.length > 0) {
      return errorResponse(
        `SEMANTIC_FIREWALL: analyzer returned identity data (${outbound.join("; ")})`,
        502,
      );
    }

    const checked = validateAnalyzerResponse(analysis);
    if (!checked.ok) {
      return errorResponse(
        `INVALID_ANALYZER_JSON: ${checked.issues.join("; ")}`,
        502,
      );
    }

    return jsonResponse({ analysis: checked.response, correlationId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse(msg, msg === "Not authenticated" ? 401 : 500);
  }
});
