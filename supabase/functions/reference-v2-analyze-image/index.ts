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
  REFERENCE_V2_VISUAL_SURFACES,
} from "../_shared/reference-v2-perspective-master.generated.ts";
import {
  ANALYZER_SCHEMA_VERSION,
  EVIDENCE_KEYS,
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

Determine left/right from the vehicle's own forward travel direction: the driver's
left hand side of a forward-facing vehicle is the vehicle's LEFT side, regardless of
where the steering wheel sits and regardless of which way the vehicle points in the
frame. Never derive the side from the viewer's position. azimuthDeg, visibility.leftSide,
visibility.rightSide and the chosen perspective MUST be mutually consistent: if
visibility.leftSide clearly exceeds visibility.rightSide, azimuthDeg must be negative
and the perspective must be a LEFT perspective, and vice versa. If they cannot be made
consistent, set canonicalPerspectiveId to null and lower perspectiveConfidence.


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
  "visibility": { "front": number, "rear": number, "leftSide": number, "rightSide": number, "roof": number, "surfaces": { "<surfaceKey>": number } },
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
visibility.surfaces is a REQUIRED map (use {} when nothing beyond the five
global fields was evaluated) of canonical visual surface keys you ACTUALLY
evaluated (e.g. headlight_left, wheel_front_right, dashboard, steering_wheel,
cargo_area) to a 0..1 visibility score. Include ONLY surfaces that are relevant
for the perspective you chose and that you actually judged; never invent or pad
entries, and never emit a key you did not evaluate. EVERY required visible
surface of the chosen perspective (except front, rear, left_side, right_side,
roof) MUST be present — a surface you cannot see is reported with a LOW score
(0 is allowed), never omitted.
The closed list of allowed visibility.surfaces keys is:
${(REFERENCE_V2_VISUAL_SURFACES as readonly string[]).filter((surface) => !["front", "rear", "left_side", "right_side", "roof"].includes(surface)).join(", ")}.
identityEvidence entries are short purely descriptive phrases (max 240 chars)
without any brand, model, trim, generation or year wording. Omit an evidence key
entirely if that area is not visible.`;
}

/**
 * Best-effort normalization of provider output BEFORE firewall/validation.
 * The vision model occasionally returns slightly out-of-shape data; we repair
 * only non-semantic, safe cases and drop unusable evidence entries instead of
 * failing the whole analysis.
 */
function sanitizeAnalyzerPayload(raw: unknown): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const a = raw as Record<string, unknown>;

  // framing.estimatedPaddingPct: clamp numeric values into the allowed 0..60
  const fr = a.framing;
  if (fr && typeof fr === "object" && !Array.isArray(fr)) {
    const f = fr as Record<string, unknown>;
    const p = f.estimatedPaddingPct;
    const num = typeof p === "number" ? p : Number(p);
    f.estimatedPaddingPct = Number.isFinite(num)
      ? Math.min(60, Math.max(0, num))
      : 0;
  }


  // Gemini occasionally emits sensible but non-canonical detail names such as
  // "windshield" or "roof_rails". They are optional observations, not frozen
  // PerspectiveMaster surfaces, so discard only those extra keys. Required
  // canonical surfaces remain subject to the strict validator below.
  const vis = a.visibility;
  if (vis && typeof vis === "object" && !Array.isArray(vis)) {
    const surfaces = (vis as Record<string, unknown>).surfaces;
    if (surfaces && typeof surfaces === "object" && !Array.isArray(surfaces)) {
      const rec = surfaces as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        if (!(REFERENCE_V2_VISUAL_SURFACES as readonly string[]).includes(key)) {
          delete rec[key];
        }
      }
    }
  }

  // identityEvidence: must be a plain object; drop unusable entries instead
  // of rejecting the entire analysis.
  const ev = a.identityEvidence;
  if (ev !== undefined) {
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) {
      a.identityEvidence = {};
    } else {
      const rec = ev as Record<string, unknown>;
      for (const [k, v] of Object.entries(rec)) {
        const unknownKey = !(EVIDENCE_KEYS as readonly string[]).includes(k);
        const badString = typeof v !== "string" || v.length < 1 || v.length > 240;
        const semantic = typeof v === "string" &&
          semanticViolations(v, `identityEvidence.${k}`).length > 0;
        if (unknownKey || badString || semantic) delete rec[k];
      }
    }
  }

  // issues[].message: free-text field where the model sometimes slips in
  // identity wording. Drop only the offending issue entries instead of
  // failing the whole analysis.
  if (Array.isArray(a.issues)) {
    a.issues = (a.issues as unknown[]).filter((issue) => {
      if (!issue || typeof issue !== "object" || Array.isArray(issue)) return false;
      const rec = issue as Record<string, unknown>;
      const msg = rec.message;
      if (typeof msg !== "string") return false;
      if (semanticViolations(msg, "issues.message").length > 0) return false;
      if (typeof rec.code === "string" && semanticViolations(rec.code, "issues.code").length > 0) {
        return false;
      }
      return true;
    });
  }
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
    const responseParts = data?.candidates?.[0]?.content?.parts as
      | ReadonlyArray<{ text?: string }>
      | undefined;
    const text: string | undefined =
      responseParts?.map((p) => p.text ?? "").join("") || undefined;

    if (!text) {
      return errorResponse("ANALYSIS_UNAVAILABLE: empty provider response", 502);
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
    } catch {
      return errorResponse("INVALID_ANALYZER_JSON: response is not valid JSON", 502);
    }

    sanitizeAnalyzerPayload(analysis);

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
