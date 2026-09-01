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

interface IntakeOverrides {
  readonly assetId?: string;
  readonly perspectiveId?: PerspectiveId;
  readonly azimuthDeg?: number;
  readonly visibility?: VisionIntakeResult["visibility"];
  readonly wheels?: readonly string[];
  readonly usable?: number;
  readonly identityClusterId?: string;
  readonly sameVehicleConfidence?: number;
  readonly elevationProfile?: "standard" | "elevated" | "low";
}

function intake(o: IntakeOverrides = {}): VisionIntakeResult {
  const usable = o.usable ?? 1;
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
    visibility: o.visibility ?? {
      front: 1,
      rear: 0,
      leftSide: 1,
      rightSide: 0,
      roof: 0.5,
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
  readonly analysis?: ReferenceAnalysisRecord | undefined;
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
    analysis: "analysis" in o ? o.analysis : analysis(),
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
      allowAdjacentSubstitution: false,
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
// J — source purity guards
// --------------------------------------------------------------------------

describe("Phase 2.3 source purity", () => {
  const source = readFileSync(
    resolve(__dirname, "../phase2/planner.ts"),
    "utf8",
  )
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("/*") && !line.trim().startsWith("//"))
    .join("\n");

  it("never reads stored Phase-1 evaluation fields", () => {
    expect(source).not.toMatch(/asset\.scores/);
    expect(source).not.toMatch(/asset\.weightedScore/);
    expect(source).not.toMatch(/outputReadyFormats/);
    expect(source).not.toMatch(/requestedPerspectiveId[^s]/);
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
