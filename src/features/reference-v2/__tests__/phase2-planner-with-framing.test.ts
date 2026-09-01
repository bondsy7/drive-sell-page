import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReferencePlannerWithCurrentFraming,
  PlannerWithCurrentFramingInputError,
} from "../phase2/planner-with-framing";
import { buildReferencePlanner } from "../phase2/planner";
import { parsePlannerOutput } from "../phase2/planner-contract";
import { PlannerContractError } from "../phase2/planner-contract";
import { CurrentFramingEvidenceError } from "../phase2/framing-evidence";
import { CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION } from "../phase2/framing-evidence";
import type { CurrentFramingEvidence } from "../phase2/framing-evidence";
import { REFERENCE_V2_PROVIDER_ID } from "../phase1-5/provider-adapter";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type {
  ReferenceAssetRecord,
  VehicleMasterRecord,
} from "../phase1/vehicle-master";
import type { ReferenceAnalysisRecord } from "../phase1-5/analysis-record";

/**
 * Phase 2.4B — pure planner + current framing integration wrapper.
 * Alle Tests sind rein (keine Systemzeit, kein I/O).
 */

const NOW_ISO = "2026-09-01T11:00:00.000Z";
const FUTURE_ISO = "2026-09-02T11:00:00.000Z";
const CLUSTER = "cluster_a";

const P_34_FRONT_LEFT: PerspectiveId = "EXT_34_FRONT_LEFT";
const P_SIDE_LEFT: PerspectiveId = "EXT_SIDE_LEFT";
const P_REAR: PerspectiveId = "EXT_REAR";
const HERO_LEFT: PerspectiveId = "HERO_FRONT_LEFT";
const P_HIGH_FRONT: PerspectiveId = "HIGH_FRONT";
const P_HIGH_REAR: PerspectiveId = "HIGH_REAR";

const BOTH_FORMATS = ["4:5", "1.91:1"] as const;

// --------------------------------------------------------------------------
// Fixtures (Phase-2.3 kompatibel)
// --------------------------------------------------------------------------

function analysis(
  overrides: Partial<ReferenceAnalysisRecord> = {},
): ReferenceAnalysisRecord {
  return {
    fileId: "files/abc",
    providerId: REFERENCE_V2_PROVIDER_ID,
    mimeType: "image/jpeg",
    fileExpiresAtIso: FUTURE_ISO,
    status: "analyzed",
    analyzerSchemaVersion: "1",
    analyzedAtIso: NOW_ISO,
    perspectiveConfidence: 0.98,
    ...overrides,
  };
}

interface IntakeOverrides {
  readonly assetId?: string;
  readonly perspectiveId?: PerspectiveId;
  readonly azimuthDeg?: number;
  readonly visibility?: VisionIntakeResult["visibility"];
  readonly wheels?: readonly string[];
  readonly usable?: number;
  readonly elevationProfile?: "standard" | "elevated" | "low";
}

function intake(o: IntakeOverrides = {}): VisionIntakeResult {
  const usable = o.usable ?? 1;
  const baseVisibility = o.visibility ?? {
    front: 1,
    rear: 0,
    leftSide: 1,
    rightSide: 0,
    roof: 0.5,
  };
  return {
    schemaVersion: 1,
    assetId: o.assetId ?? "asset_1",
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: CLUSTER,
    sameVehicleConfidence: 0.99,
    pose: {
      canonicalPerspectiveId: o.perspectiveId ?? P_34_FRONT_LEFT,
      azimuthDeg: o.azimuthDeg ?? -45,
      ...(o.elevationProfile ? { elevationProfile: o.elevationProfile } : {}),
    },
    visibility: { ...baseVisibility },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: [
        ...(o.wheels ?? ["front_left", "rear_left", "front_right"]),
      ],
    },
    quality: {
      sharpness: usable,
      occlusion: 0,
      glare: 0,
      resolutionAdequacy: usable,
      usableScore: usable,
    },
    classificationConfidence: 0.99,
    issues: [],
  } as unknown as VisionIntakeResult;
}

interface AssetOverrides {
  readonly id?: string;
  readonly intake?: VisionIntakeResult;
  readonly role?: string;
  readonly requestedPerspectiveId?: PerspectiveId;
  readonly scores?: Record<string, number>;
  readonly weightedScore?: number;
  readonly outputReadyFormats?: readonly string[];
}

function asset(o: AssetOverrides = {}): ReferenceAssetRecord {
  const id = o.id ?? "asset_1";
  return {
    id,
    vehicleMasterId: "vm_1",
    requestedPerspectiveId: o.requestedPerspectiveId ?? P_34_FRONT_LEFT,
    fileName: `${id}.jpg`,
    previewUrl: "blob:preview",
    createdAtIso: NOW_ISO,
    intake: o.intake ?? intake({ assetId: id }),
    analysis: analysis(),
    scores: o.scores ?? {
      cameraAngle: 1,
      sideAndSurfaceCorrectness: 1,
      requiredSurfaceCoverage: 1,
      quality: 1,
      framing: 1,
    },
    weightedScore: o.weightedScore ?? 1,
    hardFailures: [],
    blockers: [],
    warnings: [],
    role: o.role ?? "primary",
    protection: "unprotected",
    outputReadyFormats: [...(o.outputReadyFormats ?? ["4:5"])],
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

function perfectPrimary(id: string): ReferenceAssetRecord {
  return asset({ id });
}

function weakerPrimary(id: string, usable: number): ReferenceAssetRecord {
  return asset({ id, intake: intake({ assetId: id, usable }) });
}

function highFrontPrimary(id: string): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: P_HIGH_FRONT,
    intake: intake({
      assetId: id,
      perspectiveId: P_HIGH_FRONT,
      azimuthDeg: 0,
      elevationProfile: "elevated",
      visibility: { front: 1, rear: 0, leftSide: 0.6, rightSide: 0.6, roof: 0.45 },
      wheels: ["front_left", "front_right"],
    }),
  });
}

function roofDonor(id: string): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: P_HIGH_REAR,
    intake: intake({
      assetId: id,
      perspectiveId: P_HIGH_REAR,
      azimuthDeg: 180,
      elevationProfile: "elevated",
      visibility: { front: 0.1, rear: 1, leftSide: 0.3, rightSide: 0.3, roof: 1 },
      wheels: ["rear_left", "rear_right"],
    }),
  });
}

function leftSideAsset(id: string): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: P_SIDE_LEFT,
    intake: intake({
      assetId: id,
      perspectiveId: P_SIDE_LEFT,
      azimuthDeg: -90,
      visibility: { front: 0.1, rear: 0.1, leftSide: 1, rightSide: 0, roof: 0.4 },
      wheels: ["front_left", "rear_left"],
    }),
  });
}

// --------------------------------------------------------------------------
// Evidence fixtures
// --------------------------------------------------------------------------

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

const croppedEvidence = (assetId: string) =>
  evidence(assetId, { cropped: true });
const thinPaddingEvidence = (assetId: string) =>
  evidence(assetId, { paddingPct: 20 });

// --------------------------------------------------------------------------
// Runners
// --------------------------------------------------------------------------

interface RunOptions {
  readonly perspectives?: readonly PerspectiveId[];
  readonly formats?: readonly string[] | undefined;
  readonly evidence?: readonly CurrentFramingEvidence[];
  readonly maxSecondaryReferences?: number;
}

function plannerInputOf(
  assets: readonly ReferenceAssetRecord[],
  options: RunOptions = {},
) {
  return {
    vehicleMaster: master(assets),
    requestedPerspectiveIds: options.perspectives
      ? [...options.perspectives]
      : [P_34_FRONT_LEFT],
    ...(options.formats ? { requestedOutputFormats: [...options.formats] } : {}),
    policy: {
      maxSecondaryReferences: options.maxSecondaryReferences ?? 2,
      allowAdjacentSubstitution: false,
    },
    nowIso: NOW_ISO,
  };
}

function run(
  assets: readonly ReferenceAssetRecord[],
  options: RunOptions = {},
) {
  return buildReferencePlannerWithCurrentFraming({
    plannerInput: plannerInputOf(assets, options),
    framingEvidence: (options.evidence ?? []).map((e) => ({ ...e })),
  });
}

function baselineOf(
  assets: readonly ReferenceAssetRecord[],
  options: RunOptions = {},
) {
  const input = plannerInputOf(assets, options) as Record<string, unknown>;
  const referenceOnly: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "requestedOutputFormats") continue;
    referenceOnly[k] = v;
  }
  return buildReferencePlanner(referenceOnly);
}

const item = (output: ReturnType<typeof run>, index = 0) =>
  output.items[index]!;
const codes = (output: ReturnType<typeof run>, index = 0) =>
  item(output, index).reasons.map((r) => r.code);

// --------------------------------------------------------------------------
// A — current evidence turns fail-closed formats into READY
// --------------------------------------------------------------------------

describe("Phase 2.4B ready current evidence", () => {
  const assets = [perfectPrimary("asset_a")];

  it("frozen planner blocks requested formats fail-closed", () => {
    const frozen = buildReferencePlanner(
      plannerInputOf(assets, { formats: BOTH_FORMATS }),
    );
    expect(frozen.items[0]!.state).toBe("BLOCKED");
    expect(
      frozen.items[0]!.reasons.some((r) => r.code === "OUTPUT_FORMAT_NOT_READY"),
    ).toBe(true);
  });

  it("becomes READY with sufficient current evidence", () => {
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    expect(item(out).state).toBe("READY");
    expect(item(out).fineGrainedReadiness).toBe("READY_EXACT");
    expect(item(out).generationAllowed).toBe(true);
    expect(item(out).outputFormatReadiness).toEqual([
      { format: "4:5", ready: true },
      { format: "1.91:1", ready: true },
    ]);
    expect(codes(out)).not.toContain("OUTPUT_FORMAT_NOT_READY");
    expect(out.summary).toEqual({
      readyCount: 1,
      reviewCount: 0,
      blockedCount: 0,
      generationAllowed: true,
    });
  });

  it("keeps selection and coverage identical to the reference-only baseline", () => {
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    const base = baselineOf(assets, { formats: BOTH_FORMATS });
    expect(item(out).selection).toEqual(base.items[0]!.selection);
    expect(item(out).coverage).toEqual(base.items[0]!.coverage);
    expect(item(out).substitution).toBeNull();
    expect(item(out).perspectiveSpecId).toBe(base.items[0]!.perspectiveSpecId);
    expect(item(out).perspectiveSpecVersion).toBe(
      base.items[0]!.perspectiveSpecVersion,
    );
  });
});

// --------------------------------------------------------------------------
// B — bad current evidence blocks despite stored readiness
// --------------------------------------------------------------------------

describe("Phase 2.4B bad current evidence", () => {
  const assets = [
    asset({ id: "asset_a", outputReadyFormats: ["4:5", "1.91:1"] }),
  ];

  it("blocks a cropped source for every requested format", () => {
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [croppedEvidence("asset_a")],
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).fineGrainedReadiness).toBe("INSUFFICIENT_REFERENCE");
    expect(item(out).generationAllowed).toBe(false);
    expect(item(out).outputFormatReadiness.every((f) => !f.ready)).toBe(true);
    expect(
      item(out).reasons.filter((r) => r.code === "OUTPUT_FORMAT_NOT_READY"),
    ).toHaveLength(2);
  });

  it("blocks only the format that fails the padding policy", () => {
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [thinPaddingEvidence("asset_a")],
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).outputFormatReadiness[0]).toEqual({
      format: "4:5",
      ready: true,
    });
    expect(item(out).outputFormatReadiness[1]!.ready).toBe(false);
    const blockers = item(out).reasons.filter(
      (r) => r.code === "OUTPUT_FORMAT_NOT_READY",
    );
    expect(blockers).toHaveLength(1);
    expect(blockers[0]!.metadata).toEqual({ format: "1.91:1" });
    expect(blockers[0]!.severity).toBe("BLOCKING");
  });
});

// --------------------------------------------------------------------------
// C — reverse poison: stale Phase-1 readiness never wins
// --------------------------------------------------------------------------

describe("Phase 2.4B reverse poison", () => {
  it("is READY although stored outputReadyFormats is empty", () => {
    const out = run([asset({ id: "asset_a", outputReadyFormats: [] })], {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    expect(item(out).state).toBe("READY");
    expect(item(out).outputFormatReadiness.every((f) => f.ready)).toBe(true);
  });
});

// --------------------------------------------------------------------------
// D — missing evidence
// --------------------------------------------------------------------------

describe("Phase 2.4B missing evidence", () => {
  it("blocks with one false readiness entry per requested format", () => {
    const out = run([perfectPrimary("asset_a")], { formats: BOTH_FORMATS });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).outputFormatReadiness).toEqual([
      {
        format: "4:5",
        ready: false,
        reason: "Aktuelle Framing-Evidenz für die ausgewählte Primary-Referenz fehlt.",
      },
      {
        format: "1.91:1",
        ready: false,
        reason: "Aktuelle Framing-Evidenz für die ausgewählte Primary-Referenz fehlt.",
      },
    ]);
  });

  it("does not let evidence of a known but unselected asset rescue the primary", () => {
    const out = run([perfectPrimary("asset_a"), leftSideAsset("asset_b")], {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_b")],
    });
    expect(item(out).selection.primary?.assetId).toBe("asset_a");
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).outputFormatReadiness.every((f) => !f.ready)).toBe(true);
  });
});

// --------------------------------------------------------------------------
// E — selected-primary routing is untouched by evidence quality
// --------------------------------------------------------------------------

describe("Phase 2.4B selected-primary routing", () => {
  const assets = [weakerPrimary("asset_a", 0.9), perfectPrimary("asset_b")];

  it("keeps the visually stronger primary even if only the weaker has evidence", () => {
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    expect(item(out).selection.primary?.assetId).toBe("asset_b");
    expect(item(out).state).toBe("BLOCKED");
  });

  it("does not change the primary winner when evidence quality is reversed", () => {
    const a = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a"), croppedEvidence("asset_b")],
    });
    const b = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [croppedEvidence("asset_a"), evidence("asset_b")],
    });
    expect(a.items[0]!.selection).toEqual(b.items[0]!.selection);
    expect(a.items[0]!.state).toBe("BLOCKED");
    expect(b.items[0]!.state).toBe("READY");
  });
});

// --------------------------------------------------------------------------
// F — secondaries never own output framing
// --------------------------------------------------------------------------

describe("Phase 2.4B secondary references", () => {
  const assets = [highFrontPrimary("asset_a"), roofDonor("asset_b")];
  const HIGH = { perspectives: [P_HIGH_FRONT] } as const;

  it("stays READY_MULTI_REFERENCE when only the primary framing is good", () => {
    const base = baselineOf(assets, HIGH);
    expect(base.items[0]!.fineGrainedReadiness).toBe("READY_MULTI_REFERENCE");
    const out = run(assets, {
      ...HIGH,
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a"), croppedEvidence("asset_b")],
    });
    expect(item(out).state).toBe("READY");
    expect(item(out).fineGrainedReadiness).toBe("READY_MULTI_REFERENCE");
    expect(item(out).selection.secondaryReferences).toHaveLength(1);
  });

  it("cannot be rescued by good secondary evidence", () => {
    const out = run(assets, {
      ...HIGH,
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_b")],
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).outputFormatReadiness.every((f) => !f.ready)).toBe(true);
  });
});

// --------------------------------------------------------------------------
// G — review precedence
// --------------------------------------------------------------------------

describe("Phase 2.4B review handling", () => {
  const assets = [
    asset({ id: "asset_a", role: "primary_candidate" }),
    weakerPrimary("asset_b", 0.9),
  ];

  it("keeps REVIEW when all current formats are ready", () => {
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    expect(item(out).selection.primary?.assetId).toBe("asset_a");
    expect(item(out).state).toBe("REVIEW");
    expect(item(out).fineGrainedReadiness).toBe("NEEDS_CONFIRMATION");
    expect(item(out).generationAllowed).toBe(false);
    expect(codes(out)).toContain("PRIMARY_NOT_PROMOTED");
    expect(codes(out)).not.toContain("OUTPUT_FORMAT_NOT_READY");
  });

  it("escalates REVIEW to BLOCKED when a format fails", () => {
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [croppedEvidence("asset_a")],
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).fineGrainedReadiness).toBe("INSUFFICIENT_REFERENCE");
    expect(codes(out)).toContain("PRIMARY_NOT_PROMOTED");
    expect(codes(out)).toContain("OUTPUT_FORMAT_NOT_READY");
  });
});

// --------------------------------------------------------------------------
// H — reference blockers are never erased
// --------------------------------------------------------------------------

describe("Phase 2.4B reference blocking", () => {
  it("keeps a no-primary block and reports missing primary readiness", () => {
    const out = run([leftSideAsset("asset_a")], {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).selection.primary).toBeUndefined();
    expect(codes(out)).toContain("NO_ELIGIBLE_PRIMARY");
    expect(item(out).outputFormatReadiness).toEqual([
      {
        format: "4:5",
        ready: false,
        reason:
          "Keine ausgewählte Primary-Referenz mit aktueller Framing-Evidenz vorhanden.",
      },
      {
        format: "1.91:1",
        ready: false,
        reason:
          "Keine ausgewählte Primary-Referenz mit aktueller Framing-Evidenz vorhanden.",
      },
    ]);
  });

  it("preserves the baseline blocked fine-grained readiness", () => {
    const base = baselineOf([leftSideAsset("asset_a")]);
    const out = run([leftSideAsset("asset_a")], {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    expect(item(out).fineGrainedReadiness).toBe(
      base.items[0]!.fineGrainedReadiness,
    );
    expect(item(out).generationAllowed).toBe(false);
  });
});

// --------------------------------------------------------------------------
// I — hero targets
// --------------------------------------------------------------------------

describe("Phase 2.4B hero targets", () => {
  it("evaluates hero output keys against the base geometry", () => {
    const out = run([perfectPrimary("asset_a")], {
      perspectives: [HERO_LEFT],
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    expect(item(out).perspectiveSpecId).toBe(HERO_LEFT);
    expect(item(out).selection.primary?.perspectiveId).toBe(P_34_FRONT_LEFT);
    expect(item(out).state).toBe("READY");
  });
});

// --------------------------------------------------------------------------
// J — multiple targets
// --------------------------------------------------------------------------

describe("Phase 2.4B multiple targets", () => {
  it("uses per-item primary evidence and reports exact summary counts", () => {
    const assets = [
      perfectPrimary("asset_a"),
      highFrontPrimary("asset_b"),
      roofDonor("asset_c"),
    ];
    const out = run(assets, {
      perspectives: [P_34_FRONT_LEFT, P_HIGH_FRONT],
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a"), croppedEvidence("asset_b")],
    });
    expect(out.items).toHaveLength(2);
    expect(item(out, 0).perspectiveSpecId).toBe(P_34_FRONT_LEFT);
    expect(item(out, 0).state).toBe("READY");
    expect(item(out, 1).perspectiveSpecId).toBe(P_HIGH_FRONT);
    expect(item(out, 1).state).toBe("BLOCKED");
    expect(out.summary).toEqual({
      readyCount: 1,
      reviewCount: 0,
      blockedCount: 1,
      generationAllowed: false,
    });
  });
});

// --------------------------------------------------------------------------
// K — requested format order / subset
// --------------------------------------------------------------------------

describe("Phase 2.4B requested format order", () => {
  it("preserves the requested order exactly", () => {
    const out = run([perfectPrimary("asset_a")], {
      formats: ["1.91:1", "4:5"],
      evidence: [evidence("asset_a")],
    });
    expect(item(out).outputFormatReadiness.map((f) => f.format)).toEqual([
      "1.91:1",
      "4:5",
    ]);
  });

  it("returns exactly one entry for a single requested format", () => {
    const out = run([perfectPrimary("asset_a")], {
      formats: ["4:5"],
      evidence: [evidence("asset_a")],
    });
    expect(item(out).outputFormatReadiness).toEqual([
      { format: "4:5", ready: true },
    ]);
  });
});

// --------------------------------------------------------------------------
// L — no requested formats
// --------------------------------------------------------------------------

describe("Phase 2.4B without requested formats", () => {
  const assets = [perfectPrimary("asset_a")];

  it("equals the frozen baseline when requestedOutputFormats is absent", () => {
    const out = run(assets, { evidence: [croppedEvidence("asset_a")] });
    expect(out).toEqual(baselineOf(assets));
    expect(item(out).outputFormatReadiness).toEqual([]);
  });

  it("equals the frozen baseline for an empty requested format array", () => {
    const out = run(assets, {
      formats: [],
      evidence: [evidence("asset_a")],
    });
    expect(out).toEqual(baselineOf(assets));
  });
});

// --------------------------------------------------------------------------
// M — input validation
// --------------------------------------------------------------------------

describe("Phase 2.4B input validation", () => {
  const base = () => ({
    plannerInput: plannerInputOf([perfectPrimary("asset_a")], {
      formats: BOTH_FORMATS,
    }),
    framingEvidence: [evidence("asset_a")],
  });

  it("rejects duplicate framing evidence asset IDs", () => {
    expect(() =>
      buildReferencePlannerWithCurrentFraming({
        ...base(),
        framingEvidence: [evidence("asset_a"), evidence("asset_a")],
      }),
    ).toThrow(PlannerWithCurrentFramingInputError);
  });

  it("rejects framing evidence for an unknown asset ID", () => {
    expect(() =>
      buildReferencePlannerWithCurrentFraming({
        ...base(),
        framingEvidence: [evidence("asset_stale")],
      }),
    ).toThrow(PlannerWithCurrentFramingInputError);
  });

  it("rejects unknown top-level keys", () => {
    expect(() =>
      buildReferencePlannerWithCurrentFraming({ ...base(), extra: true }),
    ).toThrow(PlannerWithCurrentFramingInputError);
  });

  it("rejects a missing framingEvidence array", () => {
    expect(() =>
      buildReferencePlannerWithCurrentFraming({
        plannerInput: plannerInputOf([perfectPrimary("asset_a")]),
      }),
    ).toThrow(PlannerWithCurrentFramingInputError);
  });

  it("rejects non-object input", () => {
    expect(() => buildReferencePlannerWithCurrentFraming([])).toThrow(
      PlannerWithCurrentFramingInputError,
    );
  });

  it("rejects malformed evidence through the frozen Phase-2.4A parser", () => {
    expect(() =>
      buildReferencePlannerWithCurrentFraming({
        ...base(),
        framingEvidence: [{ ...evidence("asset_a"), paddingPct: -1 }],
      }),
    ).toThrow(CurrentFramingEvidenceError);
  });

  it("rejects a malformed plannerInput through the frozen parser", () => {
    expect(() =>
      buildReferencePlannerWithCurrentFraming({
        plannerInput: { nope: true },
        framingEvidence: [],
      }),
    ).toThrow(PlannerContractError);
  });
});

// --------------------------------------------------------------------------
// N — determinism / purity
// --------------------------------------------------------------------------

describe("Phase 2.4B determinism", () => {
  it("returns a deep-equal result for identical input and does not mutate it", () => {
    const raw = {
      plannerInput: plannerInputOf([perfectPrimary("asset_a")], {
        formats: BOTH_FORMATS,
      }),
      framingEvidence: [evidence("asset_a")],
    };
    const snapshot = JSON.parse(JSON.stringify(raw));
    const a = buildReferencePlannerWithCurrentFraming(raw);
    const b = buildReferencePlannerWithCurrentFraming(raw);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(raw))).toEqual(snapshot);
  });

  it("uses the frozen nowIso as plannedAtIso and keeps the version fields", () => {
    const assets = [perfectPrimary("asset_a")];
    const out = run(assets, {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    });
    const base = baselineOf(assets);
    expect(out.plannedAtIso).toBe(NOW_ISO);
    expect(out.plannerVersion).toBe(base.plannerVersion);
    expect(out.registryVersion).toBe(base.registryVersion);
    expect(out.perspectiveMasterVersion).toBe(base.perspectiveMasterVersion);
  });
});

// --------------------------------------------------------------------------
// O — final contract
// --------------------------------------------------------------------------

describe("Phase 2.4B final contract", () => {
  it("parses through the frozen planner output contract", () => {
    const out = run([perfectPrimary("asset_a")], {
      formats: BOTH_FORMATS,
      evidence: [thinPaddingEvidence("asset_a")],
    });
    expect(parsePlannerOutput(out)).toEqual(out);
  });
});

// --------------------------------------------------------------------------
// P — poisoned legacy fields
// --------------------------------------------------------------------------

describe("Phase 2.4B legacy field poisoning", () => {
  it("ignores stored scores, weightedScore, requestedPerspectiveId and formats", () => {
    const clean = [perfectPrimary("asset_a")];
    const poisoned = [
      asset({
        id: "asset_a",
        requestedPerspectiveId: P_REAR,
        weightedScore: 0,
        scores: {
          cameraAngle: 0,
          sideAndSurfaceCorrectness: 0,
          requiredSurfaceCoverage: 0,
          quality: 0,
          framing: 0,
        },
        outputReadyFormats: [],
      }),
    ];
    const options = {
      formats: BOTH_FORMATS,
      evidence: [evidence("asset_a")],
    } as const;
    const a = run(clean, options);
    const b = run(poisoned, options);
    expect(b.items[0]!.selection).toEqual(a.items[0]!.selection);
    expect(b.items[0]!.coverage).toEqual(a.items[0]!.coverage);
    expect(b.items[0]!.outputFormatReadiness).toEqual(
      a.items[0]!.outputFormatReadiness,
    );
    expect(b.items[0]!.state).toBe(a.items[0]!.state);
  });
});

// --------------------------------------------------------------------------
// Source purity
// --------------------------------------------------------------------------

describe("Phase 2.4B source purity", () => {
  const source = readFileSync(
    path.join(
      process.cwd(),
      "src/features/reference-v2/phase2/planner-with-framing.ts",
    ),
    "utf8",
  );
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it.each([
    "buildReferencePlanner",
    "evaluateCurrentFramingEvidence",
    "parsePlannerOutput",
    "parsePlannerInput",
    "parseCurrentFramingEvidence",
  ])("uses the frozen module %s", (needle) => {
    expect(code).toContain(needle);
  });

  it.each([
    "assessTargetRelativeCandidate",
    "evaluateAssetEligibility",
    "evaluateOutputFormatReadiness",
    "OUTPUT_FORMAT_RATIOS",
    "paddingMinPct",
    "4 / 5",
    "1.91",
    "comparePrimaries",
    "adjacen",
    "Adjacen",
    "substitutionFor",
    "mirror",
    "Mirror",
    "outputReadyFormats",
    "requestedPerspectiveId",
    ".scores",
    ".weightedScore",
    ".vin",
    ".brand",
    ".make",
    ".model",
    ".modelYear",
    ".year",
    "Date",
    "Math.random",
    "fetch(",
    "new File",
    "new Image",
    "window",
    "document",
    "localStorage",
    "sessionStorage",
  ])("does not contain %s", (needle) => {
    expect(code).not.toContain(needle);
  });
});
