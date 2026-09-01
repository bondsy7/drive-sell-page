import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReferencePlannerFromCurrentFramingSidecar,
  PlannerFromCurrentFramingSidecarInputError,
} from "../phase2/planner-from-framing-sidecar";
import { buildReferencePlannerWithCurrentFraming } from "../phase2/planner-with-framing";
import { buildReferencePlanner } from "../phase2/planner";
import {
  currentFramingEvidenceForPlanner,
  emptyCurrentFramingEvidenceSidecar,
  upsertCurrentFramingEvidence,
  CurrentFramingEvidenceSidecarError,
  type CurrentFramingEvidenceSidecar,
} from "../phase2/framing-evidence-sidecar";
import {
  CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
  type CurrentFramingEvidence,
} from "../phase2/framing-evidence";
import type { PlannerOutput } from "../phase2/planner-contract";
import { REFERENCE_V2_PROVIDER_ID } from "../phase1-5/provider-adapter";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type {
  ReferenceAssetRecord,
  VehicleMasterRecord,
} from "../phase1/vehicle-master";
import type { ReferenceAnalysisRecord } from "../phase1-5/analysis-record";

/**
 * Phase 2.4D — direkter Planner-Adapter aus eingefrorenem 2.4C-Sidecar.
 * Alle Tests nutzen die ECHTEN eingefrorenen Module, keine Mocks.
 */

const NOW_ISO = "2026-09-01T11:00:00.000Z";
const FUTURE_ISO = "2026-09-02T11:00:00.000Z";
const CLUSTER = "cluster_a";
const P_34_FRONT_LEFT: PerspectiveId = "EXT_34_FRONT_LEFT";
const BOTH_FORMATS = ["4:5", "1.91:1"] as const;

function analysis(): ReferenceAnalysisRecord {
  return {
    fileId: "files/abc",
    providerId: REFERENCE_V2_PROVIDER_ID,
    mimeType: "image/jpeg",
    fileExpiresAtIso: FUTURE_ISO,
    status: "analyzed",
    analyzerSchemaVersion: "1",
    analyzedAtIso: NOW_ISO,
    perspectiveConfidence: 0.98,
  } as unknown as ReferenceAnalysisRecord;
}

function intake(
  assetId: string,
  overrides: { identityClusterId?: string } = {},
): VisionIntakeResult {
  return {
    schemaVersion: 1,
    assetId,
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: overrides.identityClusterId ?? CLUSTER,
    sameVehicleConfidence: 0.99,
    pose: {
      canonicalPerspectiveId: P_34_FRONT_LEFT,
      azimuthDeg: -45,
    },
    visibility: { front: 1, rear: 0, leftSide: 1, rightSide: 0, roof: 0.5 },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: ["front_left", "rear_left", "front_right"],
    },
    quality: {
      sharpness: 1,
      occlusion: 0,
      glare: 0,
      resolutionAdequacy: 1,
      usableScore: 1,
    },
    classificationConfidence: 0.99,
    issues: [],
  } as unknown as VisionIntakeResult;
}

function asset(
  id: string,
  overrides: { identityClusterId?: string } = {},
): ReferenceAssetRecord {
  return {
    id,
    vehicleMasterId: "vm_1",
    requestedPerspectiveId: P_34_FRONT_LEFT,
    fileName: `${id}.jpg`,
    previewUrl: "blob:preview",
    createdAtIso: NOW_ISO,
    intake: intake(id, overrides),
    analysis: analysis(),
    scores: {
      cameraAngle: 1,
      sideAndSurfaceCorrectness: 1,
      requiredSurfaceCoverage: 1,
      quality: 1,
      framing: 1,
    },
    weightedScore: 1,
    hardFailures: [],
    blockers: [],
    warnings: [],
    role: "primary",
    protection: "unprotected",
    outputReadyFormats: ["4:5", "1.91:1"],
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
  } as unknown as ReferenceAssetRecord;
}

function master(assets: readonly ReferenceAssetRecord[]): VehicleMasterRecord {
  return {
    id: "vm_1",
    label: "Testfahrzeug",
    vehicleClass: "car",
    colorFamily: "grey",
    identityClusterId: CLUSTER,
    createdAtIso: NOW_ISO,
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
    assets: [...assets],
  } as unknown as VehicleMasterRecord;
}

function plannerInputOf(
  assets: readonly ReferenceAssetRecord[],
  formats?: readonly string[],
) {
  return {
    vehicleMaster: master(assets),
    requestedPerspectiveIds: [P_34_FRONT_LEFT],
    ...(formats ? { requestedOutputFormats: [...formats] } : {}),
    policy: { maxSecondaryReferences: 2, allowAdjacentSubstitution: false },
    nowIso: NOW_ISO,
  };
}

function evidence(
  assetId: string,
  overrides: Partial<CurrentFramingEvidence> = {},
): CurrentFramingEvidence {
  return {
    schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
    assetId,
    sourceAspectRatio: 1,
    fullVehicleVisible: true,
    cropped: false,
    paddingPct: 39,
    ...overrides,
  };
}

function sidecarOf(
  entries: readonly CurrentFramingEvidence[],
): CurrentFramingEvidenceSidecar {
  return entries.reduce<CurrentFramingEvidenceSidecar>(
    (acc, e) => upsertCurrentFramingEvidence(acc, e),
    emptyCurrentFramingEvidenceSidecar(),
  );
}

describe("Phase 2.4D — buildReferencePlannerFromCurrentFramingSidecar", () => {
  it("deep-equals manual composition of frozen 2.4C projection + 2.4B", () => {
    const assets = [asset("ref_1")];
    const plannerInput = plannerInputOf(assets, BOTH_FORMATS);
    const framingSidecar = sidecarOf([evidence("ref_1")]);

    const direct: PlannerOutput = buildReferencePlannerFromCurrentFramingSidecar({
      plannerInput,
      framingSidecar,
    });
    const manual: PlannerOutput = buildReferencePlannerWithCurrentFraming({
      plannerInput,
      framingEvidence: currentFramingEvidenceForPlanner(
        framingSidecar,
        assets.map((a) => a.id),
      ),
    });
    expect(direct).toEqual(manual);
  });

  it("derives known ids only from plannerInput vehicleMaster assets", () => {
    const assets = [asset("ref_1")];
    // Evidenz fuer ein Asset, das NICHT im plannerInput liegt -> fail-closed.
    const framingSidecar = sidecarOf([evidence("ref_1"), evidence("ref_foreign")]);
    expect(() =>
      buildReferencePlannerFromCurrentFramingSidecar({
        plannerInput: plannerInputOf(assets, BOTH_FORMATS),
        framingSidecar,
      }),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it("throws the 2.4C error for stale evidence", () => {
    expect(() =>
      buildReferencePlannerFromCurrentFramingSidecar({
        plannerInput: plannerInputOf([asset("ref_1")]),
        framingSidecar: sidecarOf([evidence("ref_stale")]),
      }),
    ).toThrow(/stale evidence for unknown asset ids/);
  });

  it("blocks requested formats when the selected primary evidence is missing", () => {
    const out: PlannerOutput = buildReferencePlannerFromCurrentFramingSidecar({
      plannerInput: plannerInputOf([asset("ref_1")], BOTH_FORMATS),
      framingSidecar: emptyCurrentFramingEvidenceSidecar(),
    });
    const manual: PlannerOutput = buildReferencePlannerWithCurrentFraming({
      plannerInput: plannerInputOf([asset("ref_1")], BOTH_FORMATS),
      framingEvidence: [],
    });
    expect(out).toEqual(manual);
    expect(out.items[0]!.state).not.toBe("READY");
  });

  it("ready evidence never changes reference selection/coverage vs 2.4B baseline", () => {
    const assets = [asset("ref_1")];
    const withEvidence: PlannerOutput = buildReferencePlannerFromCurrentFramingSidecar({
      plannerInput: plannerInputOf(assets, BOTH_FORMATS),
      framingSidecar: sidecarOf([evidence("ref_1")]),
    });
    const baseline: PlannerOutput = buildReferencePlanner(plannerInputOf(assets));
    expect(withEvidence.items[0]!.selection).toEqual(
      baseline.items[0]!.selection,
    );
    expect(withEvidence.items[0]!.substitution).toEqual(
      baseline.items[0]!.substitution,
    );
    expect(withEvidence.items[0]!.coverage).toEqual(baseline.items[0]!.coverage);
  });

  it("keeps baseline BLOCKED items BLOCKED despite ready format evidence", () => {
    const conflicting = asset("ref_1", { identityClusterId: "cluster_b" });
    const baseline: PlannerOutput = buildReferencePlanner(plannerInputOf([conflicting]));
    const out: PlannerOutput = buildReferencePlannerFromCurrentFramingSidecar({
      plannerInput: plannerInputOf([conflicting], BOTH_FORMATS),
      framingSidecar: sidecarOf([evidence("ref_1")]),
    });
    expect(baseline.items[0]!.state).toBe("BLOCKED");
    expect(out.items[0]!.state).toBe("BLOCKED");
  });

  it("preserves frozen reference-only behaviour without requestedOutputFormats", () => {
    const assets = [asset("ref_1")];
    const out: PlannerOutput = buildReferencePlannerFromCurrentFramingSidecar({
      plannerInput: plannerInputOf(assets),
      framingSidecar: sidecarOf([evidence("ref_1")]),
    });
    const baseline: PlannerOutput = buildReferencePlanner(plannerInputOf(assets));
    expect(out.items[0]!.state).toEqual(baseline.items[0]!.state);
    expect(out.items[0]!.selection).toEqual(baseline.items[0]!.selection);
  });

  it("rejects unknown top-level keys and non-objects", () => {
    expect(() =>
      buildReferencePlannerFromCurrentFramingSidecar({
        plannerInput: plannerInputOf([asset("ref_1")]),
        framingSidecar: emptyCurrentFramingEvidenceSidecar(),
        extra: true,
      }),
    ).toThrow(PlannerFromCurrentFramingSidecarInputError);
    expect(() =>
      buildReferencePlannerFromCurrentFramingSidecar([]),
    ).toThrow(PlannerFromCurrentFramingSidecarInputError);
    expect(() =>
      buildReferencePlannerFromCurrentFramingSidecar({
        plannerInput: plannerInputOf([asset("ref_1")]),
      }),
    ).toThrow(/framingSidecar: required/);
  });
});

// --------------------------------------------------------------------------
// Purity / source guards
// --------------------------------------------------------------------------

describe("Phase 2.4D — adapter source purity", () => {
  const source = readFileSync(
    path.join(
      process.cwd(),
      "src/features/reference-v2/phase2/planner-from-framing-sidecar.ts",
    ),
    "utf8",
  );
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("uses exactly the frozen authorities", () => {
    for (const symbol of [
      "parsePlannerInput",
      "parseCurrentFramingEvidenceSidecar",
      "currentFramingEvidenceForPlanner",
      "buildReferencePlannerWithCurrentFraming",
    ]) {
      expect(code).toContain(symbol);
    }
  });

  it("never reimplements readiness or reads stored authority", () => {
    for (const forbidden of [
      "outputReadyFormats",
      "evaluateOutputFormatReadiness",
      "OUTPUT_FORMAT_RATIOS",
      "weightedScore",
      "candidate-scoring",
      "eligibility",
      "./planner\"",
      "Math.random",
      "Date.now",
      "fetch(",
      "document",
      "react",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
