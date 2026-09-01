import { describe, it, expect } from "vitest";
import {
  QA_STRICT_REFERENCE_THRESHOLDS_V0,
  QaResultSchema,
  deriveQaVerdict,
  evaluateQaGate,
  normalizeQaResult,
  type QaMeasurements,
} from "@/features/reference-v2/domain/qa";
import { getPerspectiveSpec } from "@/features/reference-v2/domain/perspectives/registry";

const perfect: QaMeasurements = {
  sideMatch: true,
  mirrorDetected: false,
  perspectiveScore: 100,
  criticalIdentityScore: 100,
  secondaryIdentityScore: 100,
  confidence: 100,
  hardFailures: [],
};

describe("QA thresholds (provisional start values)", () => {
  it("matches the specified start values", () => {
    const t = QA_STRICT_REFERENCE_THRESHOLDS_V0;
    expect(t.requireSideMatch).toBe(true);
    expect(t.forbidMirror).toBe(true);
    expect(t.minPerspectiveScore).toBe(92);
    expect(t.minCriticalIdentityScore).toBe(92);
    expect(t.minSecondaryIdentityScore).toBe(86);
    expect(t.minConfidence).toBe(88);
    expect(t.maxHardFailures).toBe(0);
    expect(t.maxAutomaticAttempts).toBe(2);
    expect(t.calibrationStatus).toBe("provisional");
  });
});

describe("deriveQaVerdict hard-fail logic", () => {
  it("passes a perfect result", () => {
    const result = deriveQaVerdict(perfect, 1);
    expect(result.verdict).toBe("PASS");
    expect(result.hardFailed).toBe(false);
    expect(result.failedChecks).toEqual([]);
  });

  it("wrong side is NEVER compensated by perfect scores", () => {
    const result = deriveQaVerdict({ ...perfect, sideMatch: false }, 1);
    expect(result.verdict).not.toBe("PASS");
    expect(result.verdict).toBe("REPAIR");
    expect(result.hardFailed).toBe(true);
    expect(result.failedChecks).toContain("SIDE_MISMATCH");
  });

  it("mirror detection is NEVER compensated by perfect scores", () => {
    const result = deriveQaVerdict({ ...perfect, mirrorDetected: true }, 1);
    expect(result.verdict).not.toBe("PASS");
    expect(result.hardFailed).toBe(true);
    expect(result.failedChecks).toContain("MIRROR_DETECTED");
  });

  it("identity hard failures never pass", () => {
    const result = deriveQaVerdict(
      { ...perfect, hardFailures: ["IDENTITY_FEATURE_MISMATCH"] },
      1,
    );
    expect(result.verdict).not.toBe("PASS");
    expect(result.hardFailed).toBe(true);
    expect(result.failedChecks).toContain(
      "HARD_FAILURE:IDENTITY_FEATURE_MISMATCH",
    );
  });

  it("escalates to NEEDS_REVIEW at the attempt limit (2 total)", () => {
    const firstAttempt = deriveQaVerdict({ ...perfect, sideMatch: false }, 1);
    expect(firstAttempt.verdict).toBe("REPAIR");
    const secondAttempt = deriveQaVerdict({ ...perfect, sideMatch: false }, 2);
    expect(secondAttempt.verdict).toBe("NEEDS_REVIEW");
    const thirdAttempt = deriveQaVerdict({ ...perfect, sideMatch: false }, 3);
    expect(thirdAttempt.verdict).toBe("NEEDS_REVIEW");
  });

  it("flags soft threshold violations", () => {
    const result = deriveQaVerdict(
      {
        ...perfect,
        perspectiveScore: 91,
        criticalIdentityScore: 91.9,
        secondaryIdentityScore: 85,
        confidence: 87,
      },
      1,
    );
    expect(result.verdict).toBe("REPAIR");
    expect(result.hardFailed).toBe(false);
    expect(result.failedChecks).toEqual([
      "PERSPECTIVE_SCORE_BELOW_MIN",
      "CRITICAL_IDENTITY_BELOW_MIN",
      "SECONDARY_IDENTITY_BELOW_MIN",
      "CONFIDENCE_BELOW_MIN",
    ]);
  });

  it("rejects invalid attempt numbers", () => {
    expect(() => deriveQaVerdict(perfect, 0)).toThrow();
    expect(() => deriveQaVerdict(perfect, 1.5)).toThrow();
  });
});

describe("QaResultSchema", () => {
  const validResult = {
    verdict: "PASS",
    perspective: {
      detectedPerspectiveId: "EXT_FRONT",
      detectedAzimuthDeg: 2,
      requestedPerspectiveId: "EXT_FRONT",
      sideMatch: true,
      mirrorDetected: false,
      score: 97,
    },
    identity: {
      overallScore: 96,
      criticalScore: 95,
      secondaryScore: 92,
      hardFailures: [],
    },
    findings: [
      {
        feature: "wheels",
        severity: "minor",
        issue: "slight reflection difference on the rear rim",
        evidenceReferenceAssetId: "asset-2",
      },
    ],
    confidence: 93,
    attemptNumber: 1,
  };

  it("parses a valid QA result", () => {
    expect(QaResultSchema.safeParse(validResult).success).toBe(true);
  });

  it("rejects unknown fields and invalid values", () => {
    expect(
      QaResultSchema.safeParse({ ...validResult, extra: 1 }).success,
    ).toBe(false);
    expect(
      QaResultSchema.safeParse({ ...validResult, verdict: "MAYBE" }).success,
    ).toBe(false);
    expect(
      QaResultSchema.safeParse({ ...validResult, attemptNumber: 0 }).success,
    ).toBe(false);
    expect(
      QaResultSchema.safeParse({ ...validResult, confidence: 101 }).success,
    ).toBe(false);
  });
});

describe("side check is perspective dependent, not global", () => {
  it("hard-fails a wrong side only for side-sensitive perspectives", () => {
    const sideSpec = getPerspectiveSpec("EXT_SIDE_RIGHT");
    const sideResult = evaluateQaGate({
      perspectiveSpec: sideSpec,
      measurements: { ...perfect, sideMatch: false },
      attemptNumber: 1,
    });
    expect(sideResult.verdict).toBe("REPAIR");
    expect(sideResult.hardFailed).toBe(true);
    expect(sideResult.sideEvaluated).toBe(true);
  });

  it.each(["EXT_FRONT", "EXT_REAR", "INT_DASH_CENTER", "DET_GRILLE"] as const)(
    "treats sideMatch as N/A for %s",
    (perspectiveId) => {
      const spec = getPerspectiveSpec(perspectiveId);
      const result = evaluateQaGate({
        perspectiveSpec: spec,
        measurements: { ...perfect, sideMatch: null },
        attemptNumber: 1,
      });
      expect(result.sideEvaluated).toBe(false);
      expect(result.verdict).toBe("PASS");
      const wrongSide = evaluateQaGate({
        perspectiveSpec: spec,
        measurements: { ...perfect, sideMatch: false },
        attemptNumber: 1,
      });
      expect(wrongSide.verdict).toBe("PASS");
    },
  );

  it("fails closed when a side-sensitive perspective has no side measurement", () => {
    const result = evaluateQaGate({
      perspectiveSpec: getPerspectiveSpec("EXT_SIDE_LEFT"),
      measurements: { ...perfect, sideMatch: null },
      attemptNumber: 1,
    });
    expect(result.verdict).not.toBe("PASS");
    expect(result.failedChecks).toContain("SIDE_NOT_EVALUATED");
  });
});

describe("model-supplied verdicts are never trusted", () => {
  const passing = {
    verdict: "PASS",
    perspective: {
      requestedPerspectiveId: "EXT_SIDE_RIGHT",
      sideMatch: true,
      mirrorDetected: false,
      score: 97,
    },
    identity: {
      overallScore: 96,
      criticalScore: 95,
      secondaryScore: 92,
      hardFailures: [],
    },
    findings: [],
    confidence: 93,
    attemptNumber: 1,
  };

  it("accepts a genuinely passing result", () => {
    expect(QaResultSchema.safeParse(passing).success).toBe(true);
  });

  it("rejects PASS with mirrorDetected=true", () => {
    const result = QaResultSchema.safeParse({
      ...passing,
      perspective: { ...passing.perspective, mirrorDetected: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects PASS with a wrong required side", () => {
    const result = QaResultSchema.safeParse({
      ...passing,
      perspective: { ...passing.perspective, sideMatch: false },
    });
    expect(result.success).toBe(false);
  });

  it("rejects PASS with hard failures", () => {
    const result = QaResultSchema.safeParse({
      ...passing,
      identity: { ...passing.identity, hardFailures: ["MIRRORED_OUTPUT"] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects PASS with scores below threshold", () => {
    const result = QaResultSchema.safeParse({ ...passing, confidence: 50 });
    expect(result.success).toBe(false);
  });

  it("normalizes a claimed PASS into the derived verdict", () => {
    const { result, derivation } = normalizeQaResult({
      ...passing,
      perspective: { ...passing.perspective, mirrorDetected: true },
    });
    expect(result.verdict).toBe("REPAIR");
    expect(derivation.failedChecks).toContain("MIRROR_DETECTED");

    const escalated = normalizeQaResult({
      ...passing,
      attemptNumber: 2,
      perspective: { ...passing.perspective, sideMatch: false },
    });
    expect(escalated.result.verdict).toBe("NEEDS_REVIEW");
  });
});
