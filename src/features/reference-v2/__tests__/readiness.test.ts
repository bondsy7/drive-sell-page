import { describe, it, expect } from "vitest";
import {
  MATCH_SCORE_WEIGHTS,
  REFERENCE_HARD_FAIL_CODES,
  REFERENCE_READINESS_STATUSES,
  ReferenceReadinessStatusSchema,
  OutputRequestMatchResultSchema,
  computeWeightedMatchScore,
  evaluateReferenceCandidate,
  type MatchComponentScores,
} from "@/features/reference-v2/domain/readiness";

describe("readiness statuses", () => {
  it("defines exactly the specified statuses", () => {
    expect([...REFERENCE_READINESS_STATUSES]).toEqual([
      "READY_EXACT",
      "READY_MULTI_REFERENCE",
      "NEEDS_CONFIRMATION",
      "INSUFFICIENT_REFERENCE",
      "BLOCKED_IDENTITY_CONFLICT",
      "BLOCKED_FILE_UNAVAILABLE",
    ]);
    for (const status of REFERENCE_READINESS_STATUSES) {
      expect(ReferenceReadinessStatusSchema.safeParse(status).success).toBe(
        true,
      );
    }
    expect(ReferenceReadinessStatusSchema.safeParse("READY").success).toBe(
      false,
    );
  });
});

describe("match scoring", () => {
  it("weights sum to 1.0 with the specified distribution", () => {
    expect(MATCH_SCORE_WEIGHTS.cameraAngle).toBe(0.4);
    expect(MATCH_SCORE_WEIGHTS.sideAndSurfaceCorrectness).toBe(0.25);
    expect(MATCH_SCORE_WEIGHTS.requiredSurfaceCoverage).toBe(0.15);
    expect(MATCH_SCORE_WEIGHTS.quality).toBe(0.1);
    expect(MATCH_SCORE_WEIGHTS.framing).toBe(0.1);
    const sum = Object.values(MATCH_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("computes weighted totals", () => {
    const all100: MatchComponentScores = {
      cameraAngle: 100,
      sideAndSurfaceCorrectness: 100,
      requiredSurfaceCoverage: 100,
      quality: 100,
      framing: 100,
    };
    expect(computeWeightedMatchScore(all100)).toBe(100);
    expect(
      computeWeightedMatchScore({
        cameraAngle: 80,
        sideAndSurfaceCorrectness: 100,
        requiredSurfaceCoverage: 60,
        quality: 50,
        framing: 50,
      }),
    ).toBe(76);
  });
});

describe("hard-fail rules are typed separately and never compensated", () => {
  const perfectScores: MatchComponentScores = {
    cameraAngle: 100,
    sideAndSurfaceCorrectness: 100,
    requiredSurfaceCoverage: 100,
    quality: 100,
    framing: 100,
  };

  it("wrong left/right side disqualifies despite a perfect score", () => {
    const evaluation = evaluateReferenceCandidate(perfectScores, [
      "WRONG_VEHICLE_SIDE",
    ]);
    expect(evaluation.weightedScore).toBe(100);
    expect(evaluation.eligible).toBe(false);
  });

  it("every hard-fail code disqualifies", () => {
    for (const code of REFERENCE_HARD_FAIL_CODES) {
      expect(
        evaluateReferenceCandidate(perfectScores, [code]).eligible,
      ).toBe(false);
    }
  });

  it("no hard failures means eligible", () => {
    expect(evaluateReferenceCandidate(perfectScores, []).eligible).toBe(true);
  });
});

describe("OutputRequestMatchResultSchema", () => {
  const base = {
    outputRequestId: "out-1",
    perspectiveSpecId: "EXT_SIDE_LEFT",
    perspectiveSpecVersion: 1,
  };

  it("parses a READY_EXACT result with primary reference", () => {
    const result = OutputRequestMatchResultSchema.safeParse({
      ...base,
      status: "READY_EXACT",
      primaryReferenceAssetId: "asset-1",
      secondaryReferenceAssetIds: ["asset-2"],
      scores: {
        cameraAngle: 95,
        sideAndSurfaceCorrectness: 100,
        requiredSurfaceCoverage: 90,
        quality: 85,
        framing: 88,
      },
      weightedScore: 93.3,
      warnings: [{ code: "LOW_LIGHT", message: "reference slightly dark" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects READY_* without a primary reference", () => {
    const result = OutputRequestMatchResultSchema.safeParse({
      ...base,
      status: "READY_EXACT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects READY_* carrying hard failures", () => {
    const result = OutputRequestMatchResultSchema.safeParse({
      ...base,
      status: "READY_MULTI_REFERENCE",
      primaryReferenceAssetId: "asset-1",
      hardFailures: ["WRONG_VEHICLE_SIDE"],
    });
    expect(result.success).toBe(false);
  });

  it("requires hard failure codes on BLOCKED_* statuses", () => {
    const missing = OutputRequestMatchResultSchema.safeParse({
      ...base,
      status: "BLOCKED_IDENTITY_CONFLICT",
    });
    expect(missing.success).toBe(false);

    const valid = OutputRequestMatchResultSchema.safeParse({
      ...base,
      status: "BLOCKED_IDENTITY_CONFLICT",
      hardFailures: ["IDENTITY_CLUSTER_CONFLICT"],
    });
    expect(valid.success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = OutputRequestMatchResultSchema.safeParse({
      ...base,
      status: "INSUFFICIENT_REFERENCE",
      vehicleDescription: "leak",
    });
    expect(result.success).toBe(false);
  });
});
