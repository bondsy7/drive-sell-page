import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
  CurrentFramingEvidenceError,
  evaluateCurrentFramingEvidence,
  parseCurrentFramingAssessment,
  parseCurrentFramingEvidence,
  type CurrentFramingEvidence,
} from "../phase2/framing-evidence";
import { evaluateOutputFormatReadiness } from "../phase1/output-format-policy";
import { SemanticFirewallError } from "../phase1-5/analyzer-contract";

function evidence(
  overrides: Partial<CurrentFramingEvidence> = {},
): CurrentFramingEvidence {
  return {
    schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
    assetId: "asset-1",
    sourceAspectRatio: 1,
    fullVehicleVisible: true,
    cropped: false,
    paddingPct: 39,
    ...overrides,
  };
}

const TARGET = "EXT_34_FRONT_LEFT" as const;

// A. schema ---------------------------------------------------------------

describe("Phase 2.4A evidence schema", () => {
  it("accepts valid evidence", () => {
    expect(parseCurrentFramingEvidence(evidence())).toEqual(evidence());
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects sourceAspectRatio %s",
    (ratio) => {
      expect(() =>
        parseCurrentFramingEvidence(evidence({ sourceAspectRatio: ratio })),
      ).toThrow(CurrentFramingEvidenceError);
    },
  );

  it("rejects negative padding", () => {
    expect(() =>
      parseCurrentFramingEvidence(evidence({ paddingPct: -0.1 })),
    ).toThrow(CurrentFramingEvidenceError);
  });

  it("rejects unknown keys", () => {
    expect(() =>
      parseCurrentFramingEvidence({ ...evidence(), extra: true }),
    ).toThrow(CurrentFramingEvidenceError);
  });

  it("allows contradictory fullVehicleVisible + cropped as raw evidence", () => {
    const raw = evidence({ fullVehicleVisible: true, cropped: true });
    expect(parseCurrentFramingEvidence(raw)).toEqual(raw);
  });
});

// B. evaluation -----------------------------------------------------------

describe("Phase 2.4A evaluation", () => {
  it("mirrors the frozen policy for the requested formats only", () => {
    const ev = evidence();
    const result = evaluateCurrentFramingEvidence({
      evidence: ev,
      targetPerspectiveId: TARGET,
      requestedFormats: ["4:5"],
    });
    const frozen = evaluateOutputFormatReadiness(TARGET, {
      sourceAspectRatio: ev.sourceAspectRatio,
      fullVehicleVisible: true,
      paddingPct: ev.paddingPct,
    }).find((r) => r.format === "4:5");
    expect(result.readiness).toHaveLength(1);
    expect(result.readiness[0].ready).toBe(frozen?.ready);
    expect(result.readiness[0].reason).toBe(frozen?.reason);
    expect(result.referenceGeometryPerspectiveId).toBe(TARGET);
  });

  it("returns empty readiness and allReady=true for no requested formats", () => {
    const result = evaluateCurrentFramingEvidence({
      evidence: evidence(),
      targetPerspectiveId: TARGET,
      requestedFormats: [],
    });
    expect(result.readiness).toEqual([]);
    expect(result.allRequestedFormatsReady).toBe(true);
  });

  it("is deterministic and does not mutate the input", () => {
    const input = {
      evidence: evidence(),
      targetPerspectiveId: TARGET,
      requestedFormats: ["4:5", "1.91:1"],
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    const a = evaluateCurrentFramingEvidence(input);
    const b = evaluateCurrentFramingEvidence(input);
    expect(a).toEqual(b);
    expect(input).toEqual(snapshot);
  });

  it("rejects duplicated requested formats", () => {
    expect(() =>
      evaluateCurrentFramingEvidence({
        evidence: evidence(),
        targetPerspectiveId: TARGET,
        requestedFormats: ["4:5", "4:5"],
      }),
    ).toThrow(CurrentFramingEvidenceError);
  });
});

// C. crop fail-closed -----------------------------------------------------

describe("Phase 2.4A crop fail-closed", () => {
  it("is ready with sufficient padding and cropped=false", () => {
    const result = evaluateCurrentFramingEvidence({
      evidence: evidence({ cropped: false }),
      targetPerspectiveId: TARGET,
      requestedFormats: ["4:5", "1.91:1"],
    });
    expect(result.allRequestedFormatsReady).toBe(true);
  });

  it("fails closed when cropped=true despite fullVehicleVisible=true", () => {
    const result = evaluateCurrentFramingEvidence({
      evidence: evidence({ cropped: true }),
      targetPerspectiveId: TARGET,
      requestedFormats: ["4:5", "1.91:1"],
    });
    expect(result.allRequestedFormatsReady).toBe(false);
    expect(result.readiness.every((r) => r.ready === false)).toBe(true);
    expect(result.evidence.fullVehicleVisible).toBe(true);
    expect(result.evidence.cropped).toBe(true);
  });
});

// D. hero -----------------------------------------------------------------

describe("Phase 2.4A hero geometry", () => {
  it("resolves hero output keys to the base geometry", () => {
    const ev = evidence();
    const result = evaluateCurrentFramingEvidence({
      evidence: ev,
      targetPerspectiveId: "HERO_FRONT_LEFT",
      requestedFormats: ["4:5", "1.91:1"],
    });
    expect(result.targetPerspectiveId).toBe("HERO_FRONT_LEFT");
    expect(result.referenceGeometryPerspectiveId).toBe("EXT_34_FRONT_LEFT");

    const frozen = evaluateOutputFormatReadiness("EXT_34_FRONT_LEFT", {
      sourceAspectRatio: ev.sourceAspectRatio,
      fullVehicleVisible: true,
      paddingPct: ev.paddingPct,
    });
    expect(result.readiness.map((r) => ({ ...r }))).toEqual(
      ["4:5", "1.91:1"].map((f) => {
        const hit = frozen.find((r) => r.format === f)!;
        return hit.reason === undefined
          ? { format: hit.format, ready: hit.ready }
          : { format: hit.format, ready: hit.ready, reason: hit.reason };
      }),
    );
  });
});

// E. order / subset -------------------------------------------------------

describe("Phase 2.4A order and subset", () => {
  it("preserves requested input order", () => {
    const result = evaluateCurrentFramingEvidence({
      evidence: evidence(),
      targetPerspectiveId: TARGET,
      requestedFormats: ["1.91:1", "4:5"],
    });
    expect(result.readiness.map((r) => r.format)).toEqual(["1.91:1", "4:5"]);
  });

  it("never adds implicit formats", () => {
    const result = evaluateCurrentFramingEvidence({
      evidence: evidence(),
      targetPerspectiveId: TARGET,
      requestedFormats: ["4:5"],
    });
    expect(result.readiness.map((r) => r.format)).toEqual(["4:5"]);
  });
});

// F. result contract hardening -------------------------------------------

describe("Phase 2.4A result contract hardening", () => {
  const base = () =>
    JSON.parse(
      JSON.stringify(
        evaluateCurrentFramingEvidence({
          evidence: evidence(),
          targetPerspectiveId: TARGET,
          requestedFormats: ["4:5", "1.91:1"],
        }),
      ),
    );

  it("rejects assetId inconsistent with evidence", () => {
    const r = base();
    r.assetId = "other-asset";
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects a wrong referenceGeometryPerspectiveId", () => {
    const r = base();
    r.referenceGeometryPerspectiveId = "EXT_34_FRONT_RIGHT";
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects reordered readiness", () => {
    const r = base();
    r.readiness = [r.readiness[1], r.readiness[0]];
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects missing readiness entries", () => {
    const r = base();
    r.readiness = [r.readiness[0]];
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects extra readiness entries", () => {
    const r = base();
    r.readiness = [...r.readiness, { format: "4:5", ready: true }];
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects a tampered ready flag", () => {
    const r = base();
    r.readiness[0].ready = !r.readiness[0].ready;
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects a tampered reason string", () => {
    const r = JSON.parse(
      JSON.stringify(
        evaluateCurrentFramingEvidence({
          evidence: evidence({ cropped: true }),
          targetPerspectiveId: TARGET,
          requestedFormats: ["4:5"],
        }),
      ),
    );
    r.readiness[0].reason = "alles bestens";
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects contradictory allRequestedFormatsReady", () => {
    const r = base();
    r.allRequestedFormatsReady = !r.allRequestedFormatsReady;
    expect(() => parseCurrentFramingAssessment(r)).toThrow(
      CurrentFramingEvidenceError,
    );
  });
});

// G. source purity --------------------------------------------------------

describe("Phase 2.4A source purity", () => {
  const source = readFileSync(
    path.join(
      process.cwd(),
      "src/features/reference-v2/phase2/framing-evidence.ts",
    ),
    "utf8",
  );
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("reuses the frozen output-format policy", () => {
    expect(code).toContain("evaluateOutputFormatReadiness");
  });

  it.each([
    "OUTPUT_FORMAT_RATIOS",
    "paddingMinPct",
    "4 / 5",
    "1.91",
    "ReferenceAssetRecord",
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

// H. semantic firewall ----------------------------------------------------

describe("Phase 2.4A semantic firewall", () => {
  it("rejects semantic business keys in raw input", () => {
    expect(() =>
      evaluateCurrentFramingEvidence({
        evidence: evidence(),
        targetPerspectiveId: TARGET,
        requestedFormats: ["4:5"],
        model: "some-model",
      }),
    ).toThrow(SemanticFirewallError);
  });

  it("rejects semantic content injected into a string field", () => {
    expect(() =>
      evaluateCurrentFramingEvidence({
        evidence: evidence({ assetId: "asset-vin-lookup" }),
        targetPerspectiveId: TARGET,
        requestedFormats: ["4:5"],
      }),
    ).toThrow(SemanticFirewallError);
  });
});
