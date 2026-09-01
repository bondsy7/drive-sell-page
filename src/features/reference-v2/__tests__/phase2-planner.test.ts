import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReferencePlanner } from "../phase2/planner";
import {
  PHASE2_PLANNER_VERSION,
  parsePlannerOutput,
} from "../phase2/planner-contract";
import { PERSPECTIVE_REGISTRY_VERSION } from "../domain/perspectives/registry";
import { PERSPECTIVE_MASTER_VERSION } from "../phase1/perspective-master";
import { REFERENCE_V2_PROVIDER_ID } from "../phase1-5/provider-adapter";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type {
  ReferenceAssetRecord,
  VehicleMasterRecord,
} from "../phase1/vehicle-master";
import type { ReferenceAnalysisRecord } from "../phase1-5/analysis-record";

/**
 * Phase 2.3 — deterministic reference selection + planner assembly.
 * Alle Tests sind rein (keine Systemzeit, kein I/O).
 */

const NOW_ISO = "2026-09-01T11:00:00.000Z";
const FUTURE_ISO = "2026-09-02T11:00:00.000Z";
const PAST_ISO = "2026-08-31T11:00:00.000Z";
const CLUSTER = "cluster_a";

const P_34_FRONT_LEFT: PerspectiveId = "EXT_34_FRONT_LEFT";
const P_SIDE_LEFT: PerspectiveId = "EXT_SIDE_LEFT";
const P_FRONT: PerspectiveId = "EXT_FRONT";
const P_REAR: PerspectiveId = "EXT_REAR";
const HERO_LEFT: PerspectiveId = "HERO_FRONT_LEFT";
const INT_DASH: PerspectiveId = "INT_DASH_CENTER";
const P_HIGH_FRONT: PerspectiveId = "HIGH_FRONT";
const P_HIGH_REAR: PerspectiveId = "HIGH_REAR";

// --------------------------------------------------------------------------
// Fixtures
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

/** Analyse-Record OHNE Ablaufzeitpunkt (Schluessel fehlt vollstaendig). */
function analysisWithoutExpiry(): ReferenceAnalysisRecord {
  const base = analysis();
  const rest = { ...base } as Record<string, unknown>;
  delete rest.fileExpiresAtIso;
  return rest as unknown as ReferenceAnalysisRecord;
}

interface IntakeOverrides {
  readonly assetId?: string;
  readonly perspectiveId?: PerspectiveId;
  readonly azimuthDeg?: number;
  readonly visibility?: VisionIntakeResult["visibility"];
  readonly surfaces?: Record<string, number>;
  readonly wheels?: readonly string[];
  readonly usable?: number;
  /** Feinsteuerung einzelner Qualitaetskomponenten (fuer Tie-Fixtures). */
  readonly usableScore?: number;
  readonly occlusion?: number;
  readonly glare?: number;
  readonly identityClusterId?: string;
  readonly sameVehicleConfidence?: number;
  readonly elevationProfile?: "standard" | "elevated" | "low";
  readonly issues?: readonly { code: string }[];
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
    identityClusterId: o.identityClusterId ?? CLUSTER,
    sameVehicleConfidence: o.sameVehicleConfidence ?? 0.99,
    pose: {
      canonicalPerspectiveId: o.perspectiveId ?? P_34_FRONT_LEFT,
      azimuthDeg: o.azimuthDeg ?? -45,
      ...(o.elevationProfile ? { elevationProfile: o.elevationProfile } : {}),
    },
    visibility: {
      ...baseVisibility,
      ...(o.surfaces ? { surfaces: { ...o.surfaces } } : {}),
    },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: [
        ...(o.wheels ?? ["front_left", "rear_left", "front_right"]),
      ],
    },
    quality: {
      sharpness: usable,
      occlusion: o.occlusion ?? 0,
      glare: o.glare ?? 0,
      resolutionAdequacy: usable,
      usableScore: o.usableScore ?? usable,
    },
    classificationConfidence: 0.99,
    issues: [...(o.issues ?? [])],
  } as unknown as VisionIntakeResult;
}


interface AssetOverrides {
  readonly id?: string;
  readonly intake?: VisionIntakeResult;
  readonly analysis?: ReferenceAnalysisRecord | undefined;
  readonly role?: string;
  readonly requestedPerspectiveId?: PerspectiveId;
  readonly scores?: Record<string, number>;
  readonly weightedScore?: number;
  readonly outputReadyFormats?: readonly string[];
  readonly hardFailures?: readonly string[];
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
    analysis: "analysis" in o ? o.analysis : analysis(),
    scores: o.scores ?? {
      cameraAngle: 1,
      sideAndSurfaceCorrectness: 1,
      requiredSurfaceCoverage: 1,
      quality: 1,
      framing: 1,
    },
    weightedScore: o.weightedScore ?? 1,
    hardFailures: [...(o.hardFailures ?? [])],
    blockers: [],
    warnings: [],
    role: o.role ?? "primary",
    protection: "unprotected",
    outputReadyFormats: [...(o.outputReadyFormats ?? ["4:5"])],
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
  } as unknown as ReferenceAssetRecord;
}

function master(
  assets: readonly ReferenceAssetRecord[],
  overrides: Partial<VehicleMasterRecord> = {},
): VehicleMasterRecord {
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
    ...overrides,
  } as unknown as VehicleMasterRecord;
}

interface PlanOptions {
  readonly perspectives?: readonly PerspectiveId[];
  readonly formats?: readonly string[];
  readonly maxSecondaryReferences?: number;
  readonly vehicleMaster?: VehicleMasterRecord;
  readonly allowAdjacentSubstitution?: boolean;
}

function plan(
  assets: readonly ReferenceAssetRecord[],
  options: PlanOptions = {},
) {
  return buildReferencePlanner({
    vehicleMaster: options.vehicleMaster ?? master(assets),
    requestedPerspectiveIds: options.perspectives ?? [P_34_FRONT_LEFT],
    ...(options.formats ? { requestedOutputFormats: [...options.formats] } : {}),
    policy: {
      maxSecondaryReferences: options.maxSecondaryReferences ?? 2,
      allowAdjacentSubstitution: options.allowAdjacentSubstitution ?? false,
    },

    nowIso: NOW_ISO,
  });
}

/** Perfekter exakter Primary-Kandidat: weightedScore 100. */
function perfectPrimary(id: string): ReferenceAssetRecord {
  return asset({ id });
}

/** Exakt, aber schwaechere Qualitaet (niedrigerer weightedScore). */
function weakerPrimary(id: string, usable: number): ReferenceAssetRecord {
  return asset({ id, intake: intake({ assetId: id, usable }) });
}

/**
 * Exakter, qualifizierter HIGH_FRONT-Primary OHNE belegte Dach-Flaeche —
 * der einzige Weg zu einem legitimen Multi-Referenz-Fall.
 */
function highFrontPrimary(id: string, roof = 0.45): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: P_HIGH_FRONT,
    intake: intake({
      assetId: id,
      perspectiveId: P_HIGH_FRONT,
      azimuthDeg: 0,
      elevationProfile: "elevated",
      visibility: { front: 1, rear: 0, leftSide: 0.6, rightSide: 0.6, roof },
      wheels: ["front_left", "front_right"],
    }),
  });
}

/** Sekundaerkandidat, der ausschliesslich die Dach-Flaeche belegen kann. */
function roofDonor(id: string, usable = 1): ReferenceAssetRecord {
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
      usable,
    }),
  });
}

/** Reiner Seitenkandidat (linke Seite) — nie exakt fuer 3/4 vorne links. */
function leftSideAsset(id: string, usable = 1): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: P_SIDE_LEFT,
    intake: intake({
      assetId: id,
      perspectiveId: P_SIDE_LEFT,
      azimuthDeg: -90,
      visibility: { front: 0.1, rear: 0.1, leftSide: 1, rightSide: 0, roof: 0.4 },
      wheels: ["front_left", "rear_left"],
      usable,
    }),
  });
}

const item = (output: ReturnType<typeof plan>, index = 0) =>
  output.items[index]!;
const codes = (output: ReturnType<typeof plan>, index = 0) =>
  item(output, index).reasons.map((r) => r.code);

// --------------------------------------------------------------------------
// A — deterministic primary ranking
// --------------------------------------------------------------------------

describe("Phase 2.3 primary ranking", () => {
  it("selects the visually strongest qualified exact candidate", () => {
    const out = plan([weakerPrimary("asset_a", 0.6), perfectPrimary("asset_b")]);
    expect(item(out).state).toBe("READY");
    expect(item(out).selection.primary).toEqual({
      assetId: "asset_b",
      perspectiveId: P_34_FRONT_LEFT,
      role: "primary",
      exactPerspective: true,
    });
  });

  it("breaks a weightedScore tie by the lexicographically smaller assetId", () => {
    const out = plan([perfectPrimary("asset_z"), perfectPrimary("asset_a")]);
    expect(item(out).selection.primary?.assetId).toBe("asset_a");
  });

  it("ignores stored Phase-1 weightedScore and scores when ranking", () => {
    const poisonedWeak = asset({
      id: "asset_a",
      intake: intake({ assetId: "asset_a", usable: 0.6 }),
      weightedScore: 100,
      scores: {
        cameraAngle: 100,
        sideAndSurfaceCorrectness: 100,
        requiredSurfaceCoverage: 100,
        quality: 100,
        framing: 100,
      },
    });
    const poisonedStrong = asset({
      id: "asset_b",
      weightedScore: 0,
      scores: {
        cameraAngle: 0,
        sideAndSurfaceCorrectness: 0,
        requiredSurfaceCoverage: 0,
        quality: 0,
        framing: 0,
      },
    });
    const out = plan([poisonedWeak, poisonedStrong]);
    expect(item(out).selection.primary?.assetId).toBe("asset_b");
  });

  it("ignores the stored requestedPerspectiveId and uses the detected geometry", () => {
    const mislabelled = asset({
      id: "asset_a",
      requestedPerspectiveId: P_REAR,
    });
    const out = plan([mislabelled]);
    expect(item(out).state).toBe("READY");
    expect(item(out).selection.primary?.assetId).toBe("asset_a");
  });

  it("is stable across repeated runs with identical input", () => {
    const assets = [perfectPrimary("asset_b"), perfectPrimary("asset_a")];
    expect(plan(assets)).toEqual(plan(assets));
  });

  it("does not depend on the asset array order", () => {
    const a = perfectPrimary("asset_a");
    const b = perfectPrimary("asset_b");
    expect(plan([a, b]).items[0]!.selection).toEqual(
      plan([b, a]).items[0]!.selection,
    );
  });
});

// --------------------------------------------------------------------------
// B — primary qualification (exactness / thresholds)
// --------------------------------------------------------------------------

describe("Phase 2.3 primary qualification", () => {
  it("never promotes a non-exact candidate to primary", () => {
    const out = plan([leftSideAsset("asset_a")]);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).selection.primary).toBeUndefined();
    expect(codes(out)).toContain("NO_ELIGIBLE_PRIMARY");
  });

  it("blocks with SCORE_BELOW_MINIMUM when the best exact candidate is too weak", () => {
    const weak = asset({
      id: "asset_a",
      intake: intake({ assetId: "asset_a", azimuthDeg: -35, usable: 0.6 }),
    });
    const out = plan([weak]);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).fineGrainedReadiness).toBe("INSUFFICIENT_REFERENCE");
    const scoreReason = item(out).reasons.find(
      (r) => r.code === "SCORE_BELOW_MINIMUM",
    );
    expect(scoreReason?.severity).toBe("BLOCKING");
    expect(scoreReason?.assetId).toBe("asset_a");
    expect(codes(out)).toContain("NO_ELIGIBLE_PRIMARY");
  });

  it("resolves hero targets against the base perspective geometry", () => {
    const out = plan([perfectPrimary("asset_a")], {
      perspectives: [HERO_LEFT],
    });
    expect(item(out).perspectiveSpecId).toBe(HERO_LEFT);
    expect(item(out).selection.primary?.perspectiveId).toBe(P_34_FRONT_LEFT);
    expect(item(out).state).toBe("READY");
  });

  it("emits READY_EXACT with generationAllowed for a single perfect reference", () => {
    const out = plan([perfectPrimary("asset_a")]);
    expect(item(out).fineGrainedReadiness).toBe("READY_EXACT");
    expect(item(out).generationAllowed).toBe(true);
    expect(item(out).substitution).toBeNull();
  });
});

// --------------------------------------------------------------------------
// C — minimal, scoped secondary selection
// --------------------------------------------------------------------------

const HIGH = { perspectives: [P_HIGH_FRONT] } as const;

describe("Phase 2.3 secondary selection", () => {
  it("adds no secondary when the primary proves every required surface", () => {
    const out = plan([perfectPrimary("asset_a"), leftSideAsset("asset_b")]);
    expect(item(out).selection.secondaryReferences).toEqual([]);
    expect(item(out).fineGrainedReadiness).toBe("READY_EXACT");
  });

  it("adds exactly one scoped secondary for a missing required surface", () => {
    const out = plan([highFrontPrimary("asset_a"), roofDonor("asset_b")], HIGH);
    const secondaries = item(out).selection.secondaryReferences;
    expect(secondaries).toHaveLength(1);
    expect(secondaries[0]!.assetId).toBe("asset_b");
    expect(secondaries[0]!.scopes).toEqual(["roof"]);
    expect(secondaries[0]!.role).toBe("secondary");
  });

  it("marks a multi-reference plan as READY_MULTI_REFERENCE", () => {
    const out = plan([highFrontPrimary("asset_a"), roofDonor("asset_b")], HIGH);
    expect(item(out).state).toBe("READY");
    expect(item(out).fineGrainedReadiness).toBe("READY_MULTI_REFERENCE");
    expect(item(out).generationAllowed).toBe(true);
  });

  it("never selects a secondary that adds no missing surface", () => {
    const out = plan(
      [highFrontPrimary("asset_a"), roofDonor("asset_b"), roofDonor("asset_c")],
      HIGH,
    );
    expect(item(out).selection.secondaryReferences).toHaveLength(1);
  });

  it("prefers the visually stronger donor on equal surface gain", () => {
    const out = plan(
      [
        highFrontPrimary("asset_a"),
        roofDonor("asset_b", 0.6),
        roofDonor("asset_c", 1),
      ],
      HIGH,
    );
    expect(item(out).selection.secondaryReferences[0]!.assetId).toBe("asset_c");
  });

  it("reports SECONDARY_BUDGET_TRUNCATED when the budget forbids a possible rescue", () => {
    const out = plan([highFrontPrimary("asset_a"), roofDonor("asset_b")], {
      ...HIGH,
      maxSecondaryReferences: 0,
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).selection.secondaryReferences).toEqual([]);
    expect(codes(out)).toContain("SECONDARY_BUDGET_TRUNCATED");
    expect(codes(out)).toContain("REQUIRED_SURFACE_UNPROVEN");
  });

  it("never exceeds the schema cap for secondary references", () => {
    const out = plan(
      [highFrontPrimary("asset_a"), roofDonor("asset_b"), roofDonor("asset_c")],
      { ...HIGH, maxSecondaryReferences: 2 },
    );
    expect(
      item(out).selection.secondaryReferences.length,
    ).toBeLessThanOrEqual(2);
  });

  it("never lists the primary asset as a secondary reference", () => {
    const out = plan([highFrontPrimary("asset_a"), roofDonor("asset_b")], HIGH);
    const ids = item(out).selection.secondaryReferences.map((s) => s.assetId);
    expect(ids).not.toContain(item(out).selection.primary?.assetId);
  });
});

// --------------------------------------------------------------------------
// D — coverage assembly
// --------------------------------------------------------------------------

describe("Phase 2.3 coverage assembly", () => {
  it("mirrors the registry required surfaces in registry order", () => {
    const out = plan([perfectPrimary("asset_a")]);
    expect(item(out).coverage.requiredSurfaces).toEqual(["front", "left_side"]);
    expect(item(out).coverage.items.map((i) => i.surface)).toEqual([
      "front",
      "left_side",
    ]);
  });

  it("attributes every proven surface to its actual source asset", () => {
    const out = plan([highFrontPrimary("asset_a"), roofDonor("asset_b")], HIGH);
    const front = item(out).coverage.items.find((i) => i.surface === "front")!;
    const roof = item(out).coverage.items.find((i) => i.surface === "roof")!;
    expect(front.sourceAssetIds).toEqual(["asset_a"]);
    expect(roof.sourceAssetIds).toEqual(["asset_b"]);
    expect(item(out).coverage.allMandatorySurfacesMet).toBe(true);
  });

  it("blocks with REQUIRED_SURFACE_UNPROVEN when a surface stays unproven", () => {
    const out = plan([highFrontPrimary("asset_a")], HIGH);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).coverage.allMandatorySurfacesMet).toBe(false);
    const reason = item(out).reasons.find(
      (r) => r.code === "REQUIRED_SURFACE_UNPROVEN",
    );
    expect(reason?.surface).toBe("roof");
    expect(item(out).generationAllowed).toBe(false);
  });
});


// --------------------------------------------------------------------------
// E — wheel evidence (primary framing only)
// --------------------------------------------------------------------------

describe("Phase 2.3 wheel evidence", () => {
  it("accepts a primary that shows all required wheels", () => {
    const out = plan([perfectPrimary("asset_a")]);
    expect(item(out).coverage.requiredWheelPositions).toEqual([
      "front_left",
      "rear_left",
    ]);
    expect(item(out).coverage.visibleWheelPositions).toEqual([
      "front_left",
      "rear_left",
    ]);
  });

  it("blocks when the primary framing misses a required wheel and no secondary can rescue it", () => {
    const noRearWheel = asset({
      id: "asset_a",
      intake: intake({ assetId: "asset_a", wheels: ["front_left"] }),
    });
    const out = plan([noRearWheel, leftSideAsset("asset_b")]);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).coverage.visibleWheelPositions).toEqual(["front_left"]);
    const wheelReason = item(out).reasons.find(
      (r) =>
        r.code === "REQUIRED_SURFACE_UNPROVEN" &&
        r.metadata?.wheelPosition === "rear_left",
    );
    expect(wheelReason?.severity).toBe("BLOCKING");
  });
});

// --------------------------------------------------------------------------
// F — output format readiness fails closed
// --------------------------------------------------------------------------

describe("Phase 2.3 output format readiness", () => {
  it("fails closed for every requested format and blocks the item", () => {
    const out = plan([perfectPrimary("asset_a")], { formats: ["4:5", "1.91:1"] });
    expect(item(out).outputFormatReadiness).toHaveLength(2);
    expect(item(out).outputFormatReadiness.every((f) => !f.ready)).toBe(true);
    expect(item(out).state).toBe("BLOCKED");
    expect(codes(out)).toContain("OUTPUT_FORMAT_NOT_READY");
  });

  it("never derives readiness from stored Phase-1 outputReadyFormats", () => {
    const out = plan(
      [asset({ id: "asset_a", outputReadyFormats: ["4:5", "1.91:1"] })],
      { formats: ["4:5"] },
    );
    expect(item(out).outputFormatReadiness[0]!.ready).toBe(false);
  });

  it("stays READY when no output format was requested", () => {
    const out = plan([perfectPrimary("asset_a")]);
    expect(item(out).outputFormatReadiness).toEqual([]);
    expect(item(out).state).toBe("READY");
  });
});

// --------------------------------------------------------------------------
// G — vehicle class applicability
// --------------------------------------------------------------------------

describe("Phase 2.3 vehicle class applicability", () => {
  it("blocks a target that is not applicable for the vehicle class", () => {
    const out = plan([], {
      perspectives: [INT_DASH],
      vehicleMaster: master([], { vehicleClass: "motorcycle" } as never),
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(codes(out)).toContain("VEHICLE_CLASS_NOT_APPLICABLE");
    expect(item(out).selection.primary).toBeUndefined();
  });
});

// --------------------------------------------------------------------------
// H — blocked classification without a primary
// --------------------------------------------------------------------------

describe("Phase 2.3 blocked classification", () => {
  it("classifies an empty vehicle master as INSUFFICIENT_REFERENCE", () => {
    const out = plan([]);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).fineGrainedReadiness).toBe("INSUFFICIENT_REFERENCE");
    expect(codes(out)).toContain("NO_ELIGIBLE_PRIMARY");
  });

  it("classifies a mixed identity cluster as BLOCKED_IDENTITY_CONFLICT", () => {
    const foreign = asset({
      id: "asset_a",
      intake: intake({
        assetId: "asset_a",
        identityClusterId: "cluster_other",
      }),
    });
    const out = plan([foreign]);
    expect(item(out).fineGrainedReadiness).toBe("BLOCKED_IDENTITY_CONFLICT");
    expect(item(out).state).toBe("BLOCKED");
  });

  it("classifies expired provider files as BLOCKED_FILE_UNAVAILABLE", () => {
    const expired = asset({
      id: "asset_a",
      analysis: analysis({ fileExpiresAtIso: PAST_ISO }),
    });
    const out = plan([expired]);
    expect(item(out).fineGrainedReadiness).toBe("BLOCKED_FILE_UNAVAILABLE");
    expect(item(out).state).toBe("BLOCKED");
  });

  it("classifies a missing analysis record as BLOCKED_FILE_UNAVAILABLE", () => {
    const out = plan([asset({ id: "asset_a", analysis: undefined })]);
    expect(item(out).fineGrainedReadiness).toBe("BLOCKED_FILE_UNAVAILABLE");
  });

  it("propagates compact unique blocking diagnostics per (code, asset)", () => {
    const out = plan([
      asset({ id: "asset_a", analysis: undefined }),
      asset({ id: "asset_b", analysis: undefined }),
    ]);
    const keys = item(out).reasons.map((r) => `${r.code}|${r.assetId ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// --------------------------------------------------------------------------
// I — planner assembly, summary and purity
// --------------------------------------------------------------------------

describe("Phase 2.3 planner assembly", () => {
  it("emits frozen versions and mirrors nowIso into plannedAtIso", () => {
    const out = plan([perfectPrimary("asset_a")]);
    expect(out.plannerVersion).toBe(PHASE2_PLANNER_VERSION);
    expect(out.registryVersion).toBe(PERSPECTIVE_REGISTRY_VERSION);
    expect(out.perspectiveMasterVersion).toBe(PERSPECTIVE_MASTER_VERSION);
    expect(out.plannedAtIso).toBe(NOW_ISO);
  });

  it("keeps item order identical to requestedPerspectiveIds", () => {
    const out = plan([perfectPrimary("asset_a")], {
      perspectives: [P_34_FRONT_LEFT, P_FRONT, HERO_LEFT],
    });
    expect(out.items.map((i) => i.perspectiveSpecId)).toEqual([
      P_34_FRONT_LEFT,
      P_FRONT,
      HERO_LEFT,
    ]);
  });

  it("keeps the summary consistent with item states", () => {
    const out = plan([perfectPrimary("asset_a")], {
      perspectives: [P_34_FRONT_LEFT, P_REAR],
    });
    expect(out.summary.readyCount).toBe(
      out.items.filter((i) => i.state === "READY").length,
    );
    expect(out.summary.blockedCount).toBe(
      out.items.filter((i) => i.state === "BLOCKED").length,
    );
    expect(out.summary.generationAllowed).toBe(false);
  });

  it("allows generation only when every item is READY", () => {
    const out = plan([perfectPrimary("asset_a")]);
    expect(out.summary.generationAllowed).toBe(true);
  });

  it("produces output that re-parses through the frozen Phase-2.0 contract", () => {
    const out = plan([perfectPrimary("asset_a")]);
    expect(() => parsePlannerOutput(out)).not.toThrow();
  });

  it("rejects malformed planner input through the frozen contract", () => {
    expect(() => buildReferencePlanner({})).toThrow();
  });
});

// --------------------------------------------------------------------------
// K — Phase 2.3 hardening: interior multi-surface fixtures
// --------------------------------------------------------------------------

/**
 * INT_WIDE_CABIN verlangt drei Pflicht-Flaechen (dashboard, front_seats,
 * center_console) und KEINE Pflicht-Raeder. Das ist die einzige existierende
 * Registry-Perspektive, bei der ein qualifizierter exakter Primary zugleich
 * ZWEI unbelegte Pflicht-Flaechen haben kann. Die Registry wird nicht mutiert.
 */
const CABIN: PerspectiveId = "INT_WIDE_CABIN";
const CABIN_TARGET = { perspectives: [CABIN] } as const;

/**
 * Exakter, qualifizierter Kabinen-Primary: dashboard belegt, front_seats und
 * center_console knapp UNTER der Belegungsschwelle (0.49 < 0.5), sodass der
 * gewichtete Score mit 94.9 weiterhin >= 92 bleibt.
 */
function cabinPrimary(id: string): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: CABIN,
    intake: intake({
      assetId: id,
      perspectiveId: CABIN,
      visibility: { front: 0, rear: 0, leftSide: 0, rightSide: 0, roof: 0 },
      surfaces: { dashboard: 1, front_seats: 0.49, center_console: 0.49 },
      wheels: [],
    }),
  });
}

interface CabinDonorOptions {
  readonly surfaces: Record<string, number>;
  readonly usableScore?: number;
  readonly usable?: number;
  readonly occlusion?: number;
}

function cabinDonor(
  id: string,
  o: CabinDonorOptions,
): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: "INT_FRONT_SEATS",
    intake: intake({
      assetId: id,
      perspectiveId: "INT_FRONT_SEATS",
      visibility: { front: 0, rear: 0, leftSide: 0, rightSide: 0, roof: 0 },
      surfaces: o.surfaces,
      wheels: [],
      ...(o.usable !== undefined ? { usable: o.usable } : {}),
      ...(o.usableScore !== undefined ? { usableScore: o.usableScore } : {}),
      ...(o.occlusion !== undefined ? { occlusion: o.occlusion } : {}),
    }),
  });
}

describe("Phase 2.3 greedy multi-surface secondary selection", () => {
  it("proves two missing surfaces with exactly one scoped secondary", () => {
    const out = plan(
      [
        cabinPrimary("asset_a"),
        cabinDonor("asset_b", {
          surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
        }),
      ],
      CABIN_TARGET,
    );
    const secondaries = item(out).selection.secondaryReferences;
    expect(secondaries).toHaveLength(1);
    expect(secondaries[0]!.assetId).toBe("asset_b");
    // Registry-Reihenfolge von INT_WIDE_CABIN: dashboard, front_seats, center_console
    expect(secondaries[0]!.scopes).toEqual(["front_seats", "center_console"]);
    expect(item(out).state).toBe("READY");
    expect(item(out).fineGrainedReadiness).toBe("READY_MULTI_REFERENCE");
  });

  it("prefers the larger surface gain over the higher weighted score", () => {
    // asset_b belegt ZWEI fehlende Flaechen bei sehr schlechter Qualitaet
    // (weightedScore ~47.05), asset_c nur EINE bei perfekter Qualitaet
    // (weightedScore ~49.95). Der groessere Gain gewinnt.
    const out = plan(
      [
        cabinPrimary("asset_a"),
        cabinDonor("asset_b", {
          surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
          usable: 0.2,
          occlusion: 0.8,
        }),
        cabinDonor("asset_c", { surfaces: { front_seats: 1 } }),
      ],
      { ...CABIN_TARGET, maxSecondaryReferences: 1 },
    );
    const secondaries = item(out).selection.secondaryReferences;
    expect(secondaries).toHaveLength(1);
    expect(secondaries[0]!.assetId).toBe("asset_b");
  });

  it("breaks an equal-gain secondary tie by the higher weighted score", () => {
    const out = plan(
      [
        cabinPrimary("asset_a"),
        cabinDonor("asset_b", {
          surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
          usable: 0.2,
          occlusion: 0.8,
        }),
        cabinDonor("asset_c", {
          surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
        }),
      ],
      { ...CABIN_TARGET, maxSecondaryReferences: 1 },
    );
    expect(item(out).selection.secondaryReferences[0]!.assetId).toBe("asset_c");
  });

  it("breaks an equal-gain, equal-score secondary tie by the higher quality", () => {
    // asset_z: coverage 67, quality 100 -> 0.15*67 + 0.1*100 = 20.05
    // asset_b: coverage 77, quality 85  -> 0.15*77 + 0.1*85  = 20.05
    // Beide identisch in cameraAngle (0), Seite (25) und Framing (10).
    const out = plan(
      [
        cabinPrimary("asset_a"),
        cabinDonor("asset_z", {
          surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
        }),
        cabinDonor("asset_b", {
          surfaces: { dashboard: 0.3, front_seats: 1, center_console: 1 },
          usableScore: 0.25,
        }),
      ],
      { ...CABIN_TARGET, maxSecondaryReferences: 1 },
    );
    expect(item(out).selection.secondaryReferences[0]!.assetId).toBe("asset_z");
  });

  it("breaks a complete secondary tie by the lexicographically smaller assetId", () => {
    const surfaces = { dashboard: 0, front_seats: 1, center_console: 1 };
    const out = plan(
      [
        cabinPrimary("asset_a"),
        cabinDonor("asset_c", { surfaces }),
        cabinDonor("asset_b", { surfaces }),
      ],
      { ...CABIN_TARGET, maxSecondaryReferences: 1 },
    );
    expect(item(out).selection.secondaryReferences[0]!.assetId).toBe("asset_b");
  });
});

describe("Phase 2.3 secondary budget", () => {
  it("truncates at the budget and keeps the remaining surface unproven", () => {
    const out = plan(
      [
        cabinPrimary("asset_a"),
        cabinDonor("asset_b", { surfaces: { front_seats: 1 } }),
        cabinDonor("asset_c", { surfaces: { center_console: 1 } }),
      ],
      { ...CABIN_TARGET, maxSecondaryReferences: 1 },
    );
    expect(item(out).selection.secondaryReferences).toHaveLength(1);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).coverage.allMandatorySurfacesMet).toBe(false);
    expect(codes(out)).toContain("SECONDARY_BUDGET_TRUNCATED");
    expect(codes(out)).toContain("REQUIRED_SURFACE_UNPROVEN");
  });

  it("does not report budget truncation once full coverage is reached", () => {
    const out = plan(
      [
        cabinPrimary("asset_a"),
        cabinDonor("asset_b", {
          surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
        }),
        cabinDonor("asset_c", {
          surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
        }),
      ],
      { ...CABIN_TARGET, maxSecondaryReferences: 1 },
    );
    expect(item(out).selection.secondaryReferences).toHaveLength(1);
    expect(item(out).state).toBe("READY");
    expect(codes(out)).not.toContain("SECONDARY_BUDGET_TRUNCATED");
  });
});

// --------------------------------------------------------------------------
// L — hardened no-qualified-primary diagnostic
// --------------------------------------------------------------------------

/**
 * Exakter Kandidat, dessen gewichteter Score die Mindestanforderung erfuellt
 * (99), dessen `usableScore` (0.5) aber unter minPrimaryQualityScore (0.55)
 * liegt.
 */
function qualityFailingExact(id: string): ReferenceAssetRecord {
  return asset({
    id,
    intake: intake({ assetId: id, usableScore: 0.5 }),
  });
}

describe("Phase 2.3 no-qualified-primary diagnostic", () => {
  it("reports a truthful SCORE_BELOW_MINIMUM when only the quality gate fails", () => {
    const out = plan([qualityFailingExact("asset_a")]);
    expect(item(out).state).toBe("BLOCKED");
    const reason = item(out).reasons.find(
      (r) => r.code === "SCORE_BELOW_MINIMUM",
    );
    expect(reason).toBeDefined();
    expect(reason!.metadata?.minimumPerspectiveScoreMet).toBe(true);
    expect(reason!.metadata?.primaryQualityThresholdMet).toBe(false);
    expect(reason!.metadata?.minPrimaryQualityScore).toBe(0.55);
    expect(reason!.metadata?.minimumPerspectiveScore).toBe(92);
    expect(typeof reason!.metadata?.weightedScore).toBe("number");
    expect(reason!.messageDe).not.toMatch(/erreicht die Mindestanforderungen/);
    expect(codes(out)).toContain("NO_ELIGIBLE_PRIMARY");
  });

  it("keeps the metadata truthful when the weighted score itself is too low", () => {
    const weak = asset({
      id: "asset_a",
      intake: intake({ assetId: "asset_a", azimuthDeg: -35, usable: 0.6 }),
    });
    const reason = item(plan([weak])).reasons.find(
      (r) => r.code === "SCORE_BELOW_MINIMUM",
    );
    expect(reason!.metadata?.minimumPerspectiveScoreMet).toBe(false);
    expect(reason!.metadata?.minPrimaryQualityScore).toBe(0.55);
  });
});

describe("Phase 2.3 primary qualification hardening", () => {
  it("skips a candidate that fails the primary quality threshold", () => {
    const out = plan([
      qualityFailingExact("asset_a"),
      weakerPrimary("asset_b", 0.9),
    ]);
    expect(item(out).state).toBe("READY");
    expect(item(out).selection.primary?.assetId).toBe("asset_b");
  });

  it("never selects a visually excellent asset with an intrinsic hard failure", () => {
    const mirrored = asset({
      id: "asset_a",
      hardFailures: ["MIRRORED_REFERENCE"],
      // Der Phase-1-Contract erzwingt fuer hart gescheiterte Assets die Rolle
      // "rejected"; der Hard-Failure allein disqualifiziert bereits.
      role: "rejected",
    });
    const out = plan([mirrored, weakerPrimary("asset_b", 0.9)]);
    expect(item(out).selection.primary?.assetId).toBe("asset_b");
  });

  it("blocks when the only strong candidate carries an identity conflict", () => {
    const foreign = asset({
      id: "asset_a",
      intake: intake({
        assetId: "asset_a",
        identityClusterId: "cluster_other",
      }),
    });
    const out = plan([foreign]);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).selection.primary).toBeUndefined();
    expect(item(out).fineGrainedReadiness).toBe("BLOCKED_IDENTITY_CONFLICT");
  });
});

// --------------------------------------------------------------------------
// M — primary comparator tiers (real Phase-2.2 assessments)
// --------------------------------------------------------------------------

/**
 * Alle Fixtures unten sind echte Phase-2.2-Bewertungen; Phase 2.2 wird NICHT
 * gemockt. Die Ties werden ueber die reale gewichtete Formel konstruiert
 * (cameraAngle 0.4, Seite 0.25, Coverage 0.15, Quality 0.1, Framing 0.1) und
 * bleiben in EXT_34_FRONT_LEFT (maxAzimuthErrorDeg = 11).
 */
function exactCandidate(
  id: string,
  o: {
    front: number;
    leftSide: number;
    azimuthDeg?: number;
    occlusion?: number;
  },
): ReferenceAssetRecord {
  return asset({
    id,
    intake: intake({
      assetId: id,
      azimuthDeg: o.azimuthDeg ?? -45,
      visibility: {
        front: o.front,
        rear: 0,
        leftSide: o.leftSide,
        rightSide: 0,
        roof: 0.5,
      },
      ...(o.occlusion !== undefined ? { occlusion: o.occlusion } : {}),
    }),
  });
}

describe("Phase 2.3 primary comparator tiers", () => {
  it("prefers the higher quality on an equal weighted score", () => {
    // asset_z: coverage 90, quality 100 -> 13.5 + 10 = 23.5
    // asset_a: coverage 100, quality 85 -> 15   + 8.5 = 23.5
    const out = plan([
      exactCandidate("asset_z", { front: 0.8, leftSide: 1 }),
      exactCandidate("asset_a", { front: 1, leftSide: 1, occlusion: 0.75 }),
    ]);
    expect(item(out).selection.primary?.assetId).toBe("asset_z");
  });

  it("prefers the higher required-surface coverage on equal score and quality", () => {
    // asset_z: cameraAngle 97 (Azimutfehler 0.66°), coverage 100 -> 38.8 + 15
    // asset_a: cameraAngle 100, coverage 92                      -> 40   + 13.8
    const out = plan([
      exactCandidate("asset_z", {
        front: 1,
        leftSide: 1,
        azimuthDeg: -45.66,
      }),
      exactCandidate("asset_a", { front: 0.84, leftSide: 1 }),
    ]);
    expect(item(out).selection.primary?.assetId).toBe("asset_z");
  });

  it("prefers the higher camera angle on equal score, quality and coverage", () => {
    // asset_z: cameraAngle 100, Seite 92, coverage 95 -> 40 + 23 + 14.25
    // asset_a: cameraAngle 95,  Seite 100, coverage 95 -> 38 + 25 + 14.25
    const out = plan([
      exactCandidate("asset_z", { front: 0.98, leftSide: 0.92 }),
      exactCandidate("asset_a", {
        front: 0.9,
        leftSide: 1,
        azimuthDeg: -46.1,
      }),
    ]);
    expect(item(out).selection.primary?.assetId).toBe("asset_z");
  });

  it("falls back to the ascending assetId on a complete tie", () => {
    const out = plan([
      exactCandidate("asset_z", { front: 1, leftSide: 1 }),
      exactCandidate("asset_a", { front: 1, leftSide: 1 }),
    ]);
    expect(item(out).selection.primary?.assetId).toBe("asset_a");
  });
});

// --------------------------------------------------------------------------
// N — review propagation
// --------------------------------------------------------------------------

describe("Phase 2.3 review propagation", () => {
  it("keeps the visually stronger unpromoted asset and reviews the promotion", () => {
    const strongerUnpromoted = asset({
      id: "asset_a",
      role: "primary_candidate",
    });
    const weakerPromoted = weakerPrimary("asset_b", 0.9);
    const out = plan([strongerUnpromoted, weakerPromoted]);
    expect(item(out).selection.primary?.assetId).toBe("asset_a");
    expect(item(out).state).toBe("REVIEW");
    expect(item(out).fineGrainedReadiness).toBe("NEEDS_CONFIRMATION");
    expect(codes(out)).toContain("PRIMARY_NOT_PROMOTED");
    expect(item(out).generationAllowed).toBe(false);
  });

  it("reviews a selected primary whose file expiry is unknown", () => {
    const unknownExpiry = asset({
      id: "asset_a",
      analysis: analysisWithoutExpiry(),
    });
    const out = plan([unknownExpiry]);
    expect(item(out).state).toBe("REVIEW");
    expect(item(out).selection.primary).toEqual({
      assetId: "asset_a",
      perspectiveId: P_34_FRONT_LEFT,
      role: "primary",
      exactPerspective: true,
    });
    expect(codes(out)).toContain("FILE_EXPIRY_UNKNOWN");
    expect(item(out).generationAllowed).toBe(false);
  });

  it("propagates a REVIEW reason from a selected secondary reference", () => {
    const donor = cabinDonor("asset_b", {
      surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
    });
    const reviewDonor = {
      ...donor,
      analysis: analysisWithoutExpiry(),
    } as ReferenceAssetRecord;
    const out = plan([cabinPrimary("asset_a"), reviewDonor], CABIN_TARGET);
    expect(item(out).state).toBe("REVIEW");
    expect(item(out).fineGrainedReadiness).toBe("NEEDS_CONFIRMATION");
    const secondaries = item(out).selection.secondaryReferences;
    expect(secondaries).toHaveLength(1);
    expect(secondaries[0]!.assetId).toBe("asset_b");
    expect(secondaries[0]!.scopes).toEqual(["front_seats", "center_console"]);
    expect(codes(out)).toContain("FILE_EXPIRY_UNKNOWN");
    expect(item(out).generationAllowed).toBe(false);
  });
});

// --------------------------------------------------------------------------
// O — wheel strictness with an actually selected secondary
// --------------------------------------------------------------------------

describe("Phase 2.3 wheel strictness with a selected secondary", () => {
  it("blocks even when a selected secondary visually contains the missing wheel", () => {
    const primaryMissingWheel = asset({
      id: "asset_a",
      requestedPerspectiveId: P_HIGH_FRONT,
      intake: intake({
        assetId: "asset_a",
        perspectiveId: P_HIGH_FRONT,
        azimuthDeg: 0,
        elevationProfile: "elevated",
        visibility: {
          front: 1,
          rear: 0,
          leftSide: 0.6,
          rightSide: 0.6,
          roof: 0.45,
        },
        wheels: ["front_left"],
      }),
    });
    const out = plan([primaryMissingWheel, roofDonor("asset_b")], HIGH);
    const secondaries = item(out).selection.secondaryReferences;
    expect(secondaries).toHaveLength(1);
    expect(secondaries[0]!.scopes).toEqual(["roof"]);
    expect(item(out).coverage.allMandatorySurfacesMet).toBe(true);
    expect(item(out).coverage.visibleWheelPositions).toEqual(["front_left"]);
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).generationAllowed).toBe(false);
    const wheelReason = item(out).reasons.find(
      (r) => r.metadata?.wheelPosition === "front_right",
    );
    expect(wheelReason?.code).toBe("REQUIRED_SURFACE_UNPROVEN");
    expect(wheelReason?.severity).toBe("BLOCKING");
  });
});

// --------------------------------------------------------------------------
// P — adjacency policy flag has no effect in Phase 2.3
// --------------------------------------------------------------------------

describe("Phase 2.3 adjacency policy flag", () => {
  it("never substitutes an adjacent-looking asset even when the policy allows it", () => {
    const out = plan([leftSideAsset("asset_a")], {
      allowAdjacentSubstitution: true,
    });
    expect(item(out).state).toBe("BLOCKED");
    expect(item(out).selection.primary).toBeUndefined();
    expect(item(out).substitution).toBeNull();
    expect(item(out).generationAllowed).toBe(false);
    expect(codes(out)).toContain("NO_ELIGIBLE_PRIMARY");
  });
});

// --------------------------------------------------------------------------
// Q — output format edge cases
// --------------------------------------------------------------------------

describe("Phase 2.3 output format edge cases", () => {
  it("treats an empty requestedOutputFormats array like an absent one", () => {
    const out = plan([perfectPrimary("asset_a")], { formats: [] });
    expect(item(out).outputFormatReadiness).toEqual([]);
    expect(codes(out)).not.toContain("OUTPUT_FORMAT_NOT_READY");
    expect(item(out).state).toBe("READY");
    expect(out.summary.generationAllowed).toBe(true);
  });
});

// --------------------------------------------------------------------------
// R — stored Phase-1 poison is completely inert
// --------------------------------------------------------------------------

describe("Phase 2.3 stored Phase-1 poison", () => {
  it("produces a deep-equal planner output regardless of stored Phase-1 fields", () => {
    const clean = [
      asset({ id: "asset_a" }),
      cabinDonor("asset_b", {
        surfaces: { dashboard: 0, front_seats: 1, center_console: 1 },
      }),
    ];
    const poisoned = clean.map(
      (a) =>
        ({
          ...a,
          requestedPerspectiveId: P_REAR,
          scores: {
            cameraAngle: 0,
            sideAndSurfaceCorrectness: 0,
            requiredSurfaceCoverage: 0,
            quality: 0,
            framing: 0,
          },
          weightedScore: 0,
          outputReadyFormats: ["1.91:1", "4:5"],
        }) as ReferenceAssetRecord,
    );
    const options = { perspectives: [P_34_FRONT_LEFT, CABIN, P_REAR] } as const;
    expect(plan(poisoned, options)).toEqual(plan(clean, options));
  });
});

// --------------------------------------------------------------------------
// S — mixed-state summary
// --------------------------------------------------------------------------

function rearPrimary(id: string): ReferenceAssetRecord {
  return asset({
    id,
    requestedPerspectiveId: P_REAR,
    intake: intake({
      assetId: id,
      perspectiveId: P_REAR,
      azimuthDeg: 180,
      visibility: { front: 0, rear: 1, leftSide: 0, rightSide: 0, roof: 0.5 },
      wheels: ["rear_left", "rear_right"],
    }),
  });
}

describe("Phase 2.3 mixed-state summary", () => {
  it("counts READY, REVIEW and BLOCKED items exactly", () => {
    const out = plan(
      [asset({ id: "asset_a", role: "primary_candidate" }), rearPrimary("asset_b")],
      { perspectives: [P_34_FRONT_LEFT, P_REAR, INT_DASH] },
    );
    expect(out.items.map((i) => i.state)).toEqual([
      "REVIEW",
      "READY",
      "BLOCKED",
    ]);
    expect(out.summary.readyCount).toBe(1);
    expect(out.summary.reviewCount).toBe(1);
    expect(out.summary.blockedCount).toBe(1);
    expect(out.summary.generationAllowed).toBe(false);
    expect(() => parsePlannerOutput(out)).not.toThrow();
  });
});

// --------------------------------------------------------------------------
// J — source purity guards
// --------------------------------------------------------------------------

/** Entfernt Block- und Zeilenkommentare, damit Guards nicht auf Prosa greifen. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("Phase 2.3 source purity", () => {
  const source = stripComments(
    readFileSync(resolve(__dirname, "../phase2/planner.ts"), "utf8"),
  );

  it("never reads stored Phase-1 evaluation fields", () => {
    expect(source).not.toMatch(/asset\.scores/);
    expect(source).not.toMatch(/asset\.weightedScore/);
    expect(source).not.toMatch(/outputReadyFormats/);
    expect(source).not.toMatch(/requestedPerspectiveId[^s]/);
    expect(source).not.toMatch(/\.\s*scores\b(?!\s*\.)/);
  });

  it("never touches semantic vehicle business fields", () => {
    for (const field of ["vin", "brand", "make", "model", "modelYear", "year"]) {
      expect(source).not.toMatch(new RegExp(`\\.\\s*${field}\\b`));
    }
  });

  it("contains no adjacency, substitution, mirroring or generation logic", () => {
    expect(source).not.toMatch(/adjacen/i);
    expect(source).not.toMatch(/mirrorReference|applySubstitution/);
    expect(source).toMatch(/substitution: null/);
  });

  it("uses no system time source", () => {
    expect(source).not.toMatch(/Date\.now|new Date\(/);
  });
});

