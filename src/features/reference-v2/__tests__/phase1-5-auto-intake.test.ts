import { describe, it, expect, vi } from "vitest";
import {
  ANALYZER_SCHEMA_VERSION,
  assertNoSemanticIdentity,
  evaluateAutomaticGate,
  normalizeToVisionIntake,
  parseAnalyzerResponse,
  SemanticFirewallError,
} from "@/features/reference-v2/phase1-5/analyzer-contract";
import { assertNoInlineImageData } from "@/features/reference-v2/phase1-5/provider-adapter";
import {
  analyzeFileBatch,
  analyzeSingleFile,
} from "@/features/reference-v2/phase1-5/analysis-coordinator";
import { ReferenceAnalysisRecordSchema } from "@/features/reference-v2/phase1-5/analysis-record";

const goodResponse = {
  schemaVersion: ANALYZER_SCHEMA_VERSION,
  vehicleDetected: true,
  vehicleClass: "car",
  canonicalPerspectiveId: "EXT_34_FRONT_LEFT",
  perspectiveConfidence: 0.94,
  azimuthDeg: -45,
  pitchDeg: 1,
  elevationProfile: "standard",
  visibility: { front: 0.9, rear: 0, leftSide: 0.85, rightSide: 0, roof: 0.3 },
  framing: {
    fullVehicleVisible: true,
    cropped: false,
    visibleWheelPositions: ["front_left", "rear_left"],
    estimatedPaddingPct: 8,
  },
  quality: { sharpness: 0.9, occlusion: 0.05, glare: 0.1, resolutionAdequacy: 0.95 },
  mirroredSuspected: false,
  classificationConfidence: 0.93,
  sameVehicleConfidence: null,
  identityEvidence: { bodySilhouette: "two-box hatch silhouette" },
  issues: [],
};

function makeFile(name = "ref.jpg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

const baseCtx = {
  vehicleClass: "car" as const,
  identityClusterId: "idc-1",
  allowedPerspectiveIds: ["EXT_34_FRONT_LEFT", "EXT_FRONT"] as const,
  anchorFiles: [],
};

const baseDeps = (analyze: any, upload?: any) => ({
  port: {
    uploadFile:
      upload ??
      vi.fn(async () => ({
        fileId: "files/abc",
        providerId: "gemini-file-api",
        mimeType: "image/jpeg",
      })),
    analyze,
  },
  measureAspectRatio: async () => 1.5,
});

describe("semantic firewall", () => {
  it("rejects business metadata keys anywhere in the payload", () => {
    for (const payload of [
      { make: "X" },
      { nested: { modelYear: 2024 } },
      { list: [{ vin: "WAUZZZ" }] },
    ]) {
      expect(() => assertNoSemanticIdentity(payload)).toThrow(SemanticFirewallError);
    }
  });

  it("accepts purely visual payloads", () => {
    expect(() => assertNoSemanticIdentity(goodResponse)).not.toThrow();
  });

  it("forbids inline base64 image data in analyzer requests", () => {
    expect(() =>
      assertNoInlineImageData({ image: "data:image/jpeg;base64,AAAA" }),
    ).toThrow();
    expect(() => assertNoInlineImageData({ fileId: "files/abc" })).not.toThrow();
  });
});

describe("analyzer response validation", () => {
  it("parses a valid response", () => {
    expect(parseAnalyzerResponse(goodResponse).canonicalPerspectiveId).toBe(
      "EXT_34_FRONT_LEFT",
    );
  });

  it("rejects a wrong schema version", () => {
    expect(() =>
      parseAnalyzerResponse({ ...goodResponse, schemaVersion: "other" }),
    ).toThrow();
  });
});

describe("automatic gate (fail-closed)", () => {
  const gate = (over: Record<string, unknown>, anchors = false) =>
    evaluateAutomaticGate({
      response: parseAnalyzerResponse({ ...goodResponse, ...over }),
      expectedVehicleClass: "car",
      anchorsProvided: anchors,
    });

  it("passes a clean result", () => {
    expect(gate({})).toEqual([]);
  });

  it("blocks undetermined perspective, low confidence, mirrored and class mismatch", () => {
    expect(gate({ canonicalPerspectiveId: null })).toContain("PERSPECTIVE_UNDETERMINED");
    expect(gate({ perspectiveConfidence: 0.4 })).toContain(
      "LOW_CLASSIFICATION_CONFIDENCE",
    );
    expect(gate({ mirroredSuspected: true })).toContain("MIRRORED_SUSPECTED");
    expect(gate({ vehicleClass: "truck" })).toContain("VEHICLE_CLASS_MISMATCH");
    expect(gate({ vehicleDetected: false })).toContain("NO_VEHICLE");
  });

  it("blocks identity mismatch only when anchors were provided", () => {
    expect(gate({ sameVehicleConfidence: 0.3 }, false)).toEqual([]);
    expect(gate({ sameVehicleConfidence: 0.3 }, true).length).toBeGreaterThan(0);
  });
});

describe("normalization into the Phase 0 intake contract", () => {
  it("maps the analyzer response without leaking metadata", () => {
    const intake = normalizeToVisionIntake(parseAnalyzerResponse(goodResponse), {
      assetId: "asset-1",
      identityClusterId: "idc-1",
      anchorsProvided: false,
    });
    expect(intake.schemaVersion).toBe(1);
    expect(intake.pose.canonicalPerspectiveId).toBe("EXT_34_FRONT_LEFT");
    expect(intake.quality.occlusion).toBeLessThan(0.2);
    expect(Object.keys(intake)).not.toContain("brand");
  });
});

describe("analysis coordinator", () => {
  it("returns an analysis record and framing for an accepted file", async () => {
    const outcome = await analyzeSingleFile(
      makeFile(),
      baseCtx as any,
      baseDeps(vi.fn(async () => ({ response: parseAnalyzerResponse(goodResponse) }))) as any,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.perspectiveId).toBe("EXT_34_FRONT_LEFT");
    expect(ReferenceAnalysisRecordSchema.parse(outcome.analysis).status).toBe(
      "analyzed",
    );
    expect(outcome.framing?.sourceAspectRatio).toBe(1.5);
  });

  it("never accepts a file when the provider fails", async () => {
    const outcome = await analyzeSingleFile(
      makeFile(),
      baseCtx as any,
      baseDeps(vi.fn(async () => {
        throw new Error("provider down");
      })) as any,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.intake).toBeUndefined();
    expect(outcome.gateCodes).toContain("ANALYSIS_UNAVAILABLE");
  });

  it("isolates failures per file in a batch", async () => {
    let call = 0;
    const analyze = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new Error("boom");
      return { response: parseAnalyzerResponse(goodResponse) };
    });
    const outcomes = await analyzeFileBatch(
      [makeFile("a.jpg"), makeFile("b.jpg")],
      baseCtx as any,
      baseDeps(analyze) as any,
    );
    expect(outcomes[0].ok).toBe(false);
    expect(outcomes[1].ok).toBe(true);
  });
});
