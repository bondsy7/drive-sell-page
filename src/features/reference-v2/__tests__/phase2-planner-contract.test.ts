import { describe, expect, it } from "vitest";
import {
  PHASE2_MAX_SECONDARY_REFERENCES,
  PHASE2_PLANNER_VERSION,
  PlannerContractError,
  PlannerInputSchema,
  PlannerItemSchema,
  PlannerOutputSchema,
  parsePlannerInput,
  parsePlannerOutput,
  projectForSemanticFirewall,
  type PlannerItem,
} from "../phase2/planner-contract";
import { SemanticFirewallError } from "../phase1-5/analyzer-contract";
import { evaluateIngestion } from "../phase1/ingestion";
import { getPerspectiveMasterEntry } from "../phase1/perspective-master";
import { PERSPECTIVE_REGISTRY_VERSION } from "../domain/perspectives/registry";
import { PERSPECTIVE_MASTER_VERSION } from "../phase1/perspective-master";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type {
  ReferenceAssetRecord,
  VehicleMasterRecord,
} from "../phase1/vehicle-master";

const CLUSTER = "cluster_a";
const NOW_ISO = "2026-09-01T11:00:00.000Z";
const P_FRONT: PerspectiveId = "EXT_FRONT";
const P_REAR: PerspectiveId = "EXT_REAR";

function intake(perspectiveId: PerspectiveId): VisionIntakeResult {
  const entry = getPerspectiveMasterEntry(perspectiveId);
  return {
    schemaVersion: 1,
    assetId: "asset_1",
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: CLUSTER,
    sameVehicleConfidence: 0.95,
    pose: {
      canonicalPerspectiveId: perspectiveId,
      ...(entry.azimuthDeg !== null ? { azimuthDeg: entry.azimuthDeg } : {}),
      elevationProfile: entry.elevationProfile,
    },
    visibility: {
      front: perspectiveId.includes("FRONT") ? 0.95 : 0.2,
      rear: perspectiveId.includes("REAR") ? 0.95 : 0.2,
      leftSide: 0.4,
      rightSide: 0.4,
      roof: 0.6,
    },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: [
        "front_left",
        "front_right",
        "rear_left",
        "rear_right",
      ],
    },
    quality: {
      sharpness: 0.9,
      occlusion: 0.02,
      glare: 0.05,
      resolutionAdequacy: 0.95,
      usableScore: 0.92,
    },
    classificationConfidence: 0.95,
    issues: [],
  };
}

function asset(id: string, perspectiveId: PerspectiveId): ReferenceAssetRecord {
  const evaluation = evaluateIngestion({
    vehicleClass: "car",
    identityClusterId: CLUSTER,
    requestedPerspectiveId: perspectiveId,
    intake: intake(perspectiveId),
    framing: {
      sourceAspectRatio: 3 / 2,
      fullVehicleVisible: true,
      paddingPct: 25,
    },
    fileAvailable: true,
    isAutomatic: true,
  });
  return {
    id,
    vehicleMasterId: "vm_1",
    requestedPerspectiveId: perspectiveId,
    fileName: `${id}.jpg`,
    previewUrl: `blob:local/${id}`,
    createdAtIso: NOW_ISO,
    intake: intake(perspectiveId),
    analysis: {
      fileId: "files/abc",
      providerId: "gemini-file-api",
      mimeType: "image/jpeg",
      status: "analyzed",
      analyzerSchemaVersion: "1",
      analyzedAtIso: NOW_ISO,
      fileExpiresAtIso: "2026-09-02T11:00:00.000Z",
      perspectiveConfidence: 0.95,
    },
    scores: evaluation.scores,
    weightedScore: evaluation.weightedScore,
    hardFailures: [...evaluation.hardFailures],
    blockers: [...evaluation.blockers],
    warnings: [...evaluation.warnings],
    role: evaluation.role,
    protection: "unprotected",
    outputReadyFormats: [...evaluation.outputReadyFormats],
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
  };
}

function vehicleMaster(
  overrides: Partial<VehicleMasterRecord> = {},
): VehicleMasterRecord {
  return {
    id: "vm_1",
    label: "Fleet unit A",
    vehicleClass: "car",
    colorFamily: null,
    identityClusterId: CLUSTER,
    createdAtIso: NOW_ISO,
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
    assets: [asset("asset_1", P_FRONT)],
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    vehicleMaster: vehicleMaster(),
    requestedPerspectiveIds: [P_FRONT],
    policy: { maxSecondaryReferences: 2, allowAdjacentSubstitution: false },
    nowIso: NOW_ISO,
    ...overrides,
  };
}

function coverage() {
  return {
    requiredSurfaces: ["front"],
    items: [
      {
        surface: "front",
        visibilityScore: 0.95,
        met: true,
        sourceAssetIds: ["asset_1"],
      },
    ],
    allMandatorySurfacesMet: true,
    requiredWheelPositions: ["front_left", "front_right"],
    visibleWheelPositions: ["front_left", "front_right"],
  };
}

function readyItem(overrides: Record<string, unknown> = {}) {
  return {
    perspectiveSpecId: P_FRONT,
    perspectiveSpecVersion: 1,
    state: "READY",
    fineGrainedReadiness: "READY_EXACT",
    selection: {
      primary: {
        assetId: "asset_1",
        perspectiveId: P_FRONT,
        role: "primary",
        exactPerspective: true,
      },
      secondaryReferences: [],
    },
    coverage: coverage(),
    outputFormatReadiness: [{ format: "4:5", ready: true }],
    substitution: null,
    reasons: [],
    generationAllowed: true,
    ...overrides,
  };
}

function blockedItem(overrides: Record<string, unknown> = {}) {
  return {
    ...readyItem(),
    state: "BLOCKED",
    fineGrainedReadiness: "INSUFFICIENT_REFERENCE",
    selection: { secondaryReferences: [] },
    generationAllowed: false,
    reasons: [
      {
        code: "NO_ELIGIBLE_PRIMARY",
        severity: "BLOCKING",
        messageDe: "Keine geeignete Hauptreferenz vorhanden",
      },
    ],
    ...overrides,
  };
}

function output(items: unknown[], summaryOverrides: Record<string, unknown> = {}) {
  const list = items as PlannerItem[];
  return {
    plannerVersion: PHASE2_PLANNER_VERSION,
    registryVersion: PERSPECTIVE_REGISTRY_VERSION,
    perspectiveMasterVersion: PERSPECTIVE_MASTER_VERSION,
    plannedAtIso: NOW_ISO,
    items,
    summary: {
      readyCount: list.filter((i) => i.state === "READY").length,
      reviewCount: list.filter((i) => i.state === "REVIEW").length,
      blockedCount: list.filter((i) => i.state === "BLOCKED").length,
      generationAllowed: list.every(
        (i) => i.state === "READY" && i.generationAllowed,
      ),
      ...summaryOverrides,
    },
  };
}

describe("Phase 2.0 planner input contract", () => {
  it("parses a valid minimal input", () => {
    const parsed = parsePlannerInput(input());
    expect(parsed.requestedPerspectiveIds).toEqual([P_FRONT]);
    expect(parsed.policy.allowAdjacentSubstitution).toBe(false);
    expect(PHASE2_MAX_SECONDARY_REFERENCES).toBe(2);
  });

  it("rejects duplicate requestedPerspectiveIds", () => {
    expect(() =>
      parsePlannerInput(input({ requestedPerspectiveIds: [P_FRONT, P_FRONT] })),
    ).toThrow(PlannerContractError);
  });

  it("rejects maxSecondaryReferences > 2", () => {
    expect(() =>
      parsePlannerInput(
        input({
          policy: { maxSecondaryReferences: 3, allowAdjacentSubstitution: false },
        }),
      ),
    ).toThrow(PlannerContractError);
  });

  it("rejects semantic identity fields", () => {
    for (const extra of [
      { make: "x" },
      { model: "x" },
      { year: 2020 },
      { vin: "WUAZZZF26SN907953" },
    ]) {
      expect(() => parsePlannerInput({ ...input(), ...extra })).toThrow();
    }
  });
});

describe("Phase 2.0 ISO handling and semantic firewall", () => {
  it("accepts valid ISO values in nowIso, createdAtIso, atIso and analysis fields", () => {
    const parsed = parsePlannerInput(input());
    expect(parsed.nowIso).toBe(NOW_ISO);
    expect(parsed.vehicleMaster.createdAtIso).toBe(NOW_ISO);
    expect(parsed.vehicleMaster.history[0].atIso).toBe(NOW_ISO);
    expect(parsed.vehicleMaster.assets[0]?.analysis?.analyzedAtIso).toBe(NOW_ISO);
    expect(parsePlannerOutput(output([readyItem()])).plannedAtIso).toBe(NOW_ISO);
  });

  it("rejects a non-ISO semantic string inside an existing *Iso field before projection", () => {
    const vm = vehicleMaster();
    const bad = {
      ...input(),
      vehicleMaster: {
        ...vm,
        history: [{ version: 1, atIso: "modelljahr 2020", action: "created" }],
      },
    };
    expect(() => parsePlannerInput(bad)).toThrow(PlannerContractError);
  });

  it("keeps semantic text in label rejected by the existing firewall", () => {
    const bad = {
      ...input(),
      vehicleMaster: { ...vehicleMaster(), label: "model 2025" },
    };
    expect(() => parsePlannerInput(bad)).toThrow(SemanticFirewallError);
  });

  it("keeps semantic text in a non-Iso planner string rejected", () => {
    const item = readyItem({
      state: "REVIEW",
      generationAllowed: false,
      fineGrainedReadiness: "NEEDS_CONFIRMATION",
      reasons: [
        {
          code: "SCORE_BELOW_MINIMUM",
          severity: "REVIEW",
          messageDe: "Hersteller unbekannt",
        },
      ],
    });
    expect(() => parsePlannerOutput(output([item]))).toThrow(
      SemanticFirewallError,
    );
  });

  it("rejects an unknown top-level fooIso field via the strict schema", () => {
    expect(() =>
      parsePlannerInput({ ...input(), fooIso: "modelljahr 2020" }),
    ).toThrow(PlannerContractError);
  });

  it("projects only *Iso values and keeps every key", () => {
    const projected = projectForSemanticFirewall({
      nowIso: NOW_ISO,
      nested: { atIso: NOW_ISO, note: "ok" },
    }) as Record<string, unknown>;
    expect(projected.nowIso).toBe("TIMESTAMP");
    expect((projected.nested as Record<string, unknown>).atIso).toBe("TIMESTAMP");
    expect((projected.nested as Record<string, unknown>).note).toBe("ok");
  });
});

describe("Phase 2.0 planner item invariants", () => {
  it("rejects READY without primary", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({ selection: { secondaryReferences: [] } }),
      ).success,
    ).toBe(false);
  });

  it("rejects READY with substitution", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          substitution: {
            sourcePerspectiveId: P_REAR,
            targetPerspectiveId: P_FRONT,
            azimuthDeltaDeg: 45,
            rationale: "n/a",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects READY with a BLOCKING reason", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          reasons: [
            {
              code: "MIRROR_RISK",
              severity: "BLOCKING",
              messageDe: "Spiegelungsrisiko",
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects BLOCKED with generationAllowed=true", () => {
    expect(
      PlannerItemSchema.safeParse(blockedItem({ generationAllowed: true }))
        .success,
    ).toBe(false);
  });

  it("rejects BLOCKED without a BLOCKING reason", () => {
    expect(
      PlannerItemSchema.safeParse(blockedItem({ reasons: [] })).success,
    ).toBe(false);
  });

  it("rejects REVIEW with generationAllowed=true", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          state: "REVIEW",
          fineGrainedReadiness: "NEEDS_CONFIRMATION",
          generationAllowed: true,
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a secondary without scope", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          selection: {
            primary: {
              assetId: "asset_1",
              perspectiveId: P_FRONT,
              role: "primary",
              exactPerspective: true,
            },
            secondaryReferences: [
              { assetId: "asset_2", perspectiveId: P_REAR, role: "secondary" },
            ],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects the same asset as primary and secondary", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          selection: {
            primary: {
              assetId: "asset_1",
              perspectiveId: P_FRONT,
              role: "primary",
              exactPerspective: true,
            },
            secondaryReferences: [
              {
                assetId: "asset_1",
                perspectiveId: P_REAR,
                role: "secondary",
                scopes: ["rear"],
              },
            ],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects more than two secondaries", () => {
    const secondary = (id: string) => ({
      assetId: id,
      perspectiveId: P_REAR,
      role: "secondary",
      scopes: ["rear"],
    });
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          selection: {
            primary: {
              assetId: "asset_1",
              perspectiveId: P_FRONT,
              role: "primary",
              exactPerspective: true,
            },
            secondaryReferences: [
              secondary("a"),
              secondary("b"),
              secondary("c"),
            ],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects duplicate secondary asset IDs", () => {
    const secondary = {
      assetId: "asset_2",
      perspectiveId: P_REAR,
      role: "secondary",
      scopes: ["rear"],
    };
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          selection: {
            primary: {
              assetId: "asset_1",
              perspectiveId: P_FRONT,
              role: "primary",
              exactPerspective: true,
            },
            secondaryReferences: [secondary, { ...secondary }],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects duplicate coverage surfaces", () => {
    const cov = coverage();
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          coverage: { ...cov, items: [cov.items[0], { ...cov.items[0] }] },
        }),
      ).success,
    ).toBe(false);
  });
});

describe("Phase 2.0 hardened invariants", () => {
  it("rejects an invalid calendar ISO value in a nested *Iso field", () => {
    const bad = {
      ...input(),
      vehicleMaster: {
        ...vehicleMaster(),
        history: [
          { version: 1, atIso: "2026-13-45T11:00:00.000Z", action: "created" },
        ],
      },
    };
    expect(() => parsePlannerInput(bad)).toThrow(PlannerContractError);
  });

  it("rejects duplicate requestedOutputFormats", () => {
    expect(
      PlannerInputSchema.safeParse(
        input({ requestedOutputFormats: ["4:5", "4:5"] }),
      ).success,
    ).toBe(false);
  });

  it("rejects empty requiredSurfaces", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          coverage: { ...coverage(), requiredSurfaces: [], items: [] },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a missing coverage item for a required surface", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          coverage: {
            ...coverage(),
            requiredSurfaces: ["front", "grille"],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a coverage item outside requiredSurfaces", () => {
    const cov = coverage();
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          coverage: {
            ...cov,
            items: [
              ...cov.items,
              {
                surface: "grille",
                visibilityScore: 0.5,
                met: true,
                sourceAssetIds: ["asset_1"],
              },
            ],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects allMandatorySurfacesMet contradicting item.met", () => {
    const cov = coverage();
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          coverage: {
            ...cov,
            items: [{ ...cov.items[0], met: false }],
            allMandatorySurfacesMet: true,
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects READY with NEEDS_CONFIRMATION", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({ fineGrainedReadiness: "NEEDS_CONFIRMATION" }),
      ).success,
    ).toBe(false);
  });

  it("rejects REVIEW with READY_EXACT", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          state: "REVIEW",
          generationAllowed: false,
          fineGrainedReadiness: "READY_EXACT",
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects BLOCKED with READY_EXACT", () => {
    expect(
      PlannerItemSchema.safeParse(
        blockedItem({ fineGrainedReadiness: "READY_EXACT" }),
      ).success,
    ).toBe(false);
  });

  it("rejects READY with primary exactPerspective=false", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          selection: {
            primary: {
              assetId: "asset_1",
              perspectiveId: P_FRONT,
              role: "primary",
              exactPerspective: false,
            },
            secondaryReferences: [],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects READY with a primary perspective different from the target", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          selection: {
            primary: {
              assetId: "asset_1",
              perspectiveId: P_REAR,
              role: "primary",
              exactPerspective: true,
            },
            secondaryReferences: [],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects READY with unmet coverage", () => {
    const cov = coverage();
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          coverage: {
            ...cov,
            items: [{ ...cov.items[0], met: false }],
            allMandatorySurfacesMet: false,
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects READY with an output format that is not ready", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          outputFormatReadiness: [
            { format: "4:5", ready: false, reason: "Rand zu klein" },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts READY with an empty outputFormatReadiness array", () => {
    expect(
      PlannerItemSchema.safeParse(readyItem({ outputFormatReadiness: [] }))
        .success,
    ).toBe(true);
  });

  it("rejects READY_MULTI_REFERENCE without a secondary", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({ fineGrainedReadiness: "READY_MULTI_REFERENCE" }),
      ).success,
    ).toBe(false);
  });

  it("rejects a substitution target different from the item perspective", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          state: "REVIEW",
          generationAllowed: false,
          fineGrainedReadiness: "NEEDS_CONFIRMATION",
          substitution: {
            sourcePerspectiveId: P_FRONT,
            targetPerspectiveId: P_REAR,
            azimuthDeltaDeg: 45,
            rationale: "Ersatzansicht",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a substitution source different from the primary perspective", () => {
    expect(
      PlannerItemSchema.safeParse(
        readyItem({
          state: "REVIEW",
          generationAllowed: false,
          fineGrainedReadiness: "NEEDS_CONFIRMATION",
          substitution: {
            sourcePerspectiveId: P_REAR,
            targetPerspectiveId: P_FRONT,
            azimuthDeltaDeg: 45,
            rationale: "Ersatzansicht",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects all-READY items with summary.generationAllowed=false", () => {
    expect(
      PlannerOutputSchema.safeParse(
        output([readyItem()], { generationAllowed: false }),
      ).success,
    ).toBe(false);
  });
});

describe("Phase 2.0 planner output contract", () => {

  it("parses a valid READY output", () => {
    const parsed = parsePlannerOutput(output([readyItem()]));
    expect(parsed.summary).toEqual({
      readyCount: 1,
      reviewCount: 0,
      blockedCount: 0,
      generationAllowed: true,
    });
  });

  it("parses a valid BLOCKED output", () => {
    const parsed = parsePlannerOutput(output([blockedItem()]));
    expect(parsed.summary.blockedCount).toBe(1);
    expect(parsed.summary.generationAllowed).toBe(false);
  });

  it("rejects duplicate perspectiveSpecId", () => {
    expect(
      PlannerOutputSchema.safeParse(output([readyItem(), readyItem()])).success,
    ).toBe(false);
  });

  it("rejects incorrect summary counts", () => {
    expect(
      PlannerOutputSchema.safeParse(output([readyItem()], { readyCount: 2 }))
        .success,
    ).toBe(false);
  });

  it("rejects summary.generationAllowed when an item is not READY", () => {
    expect(
      PlannerOutputSchema.safeParse(
        output([blockedItem()], { generationAllowed: true }),
      ).success,
    ).toBe(false);
  });

  it("does not duplicate or weaken the semantic firewall", () => {
    const src = PlannerInputSchema.toString();
    expect(src).toBeTruthy();
    expect(() =>
      parsePlannerInput({
        ...input(),
        vehicleMaster: { ...vehicleMaster(), label: "Baujahr" },
      }),
    ).toThrow(SemanticFirewallError);
  });
});
