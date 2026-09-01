import { describe, it, expect, vi } from "vitest";
import {
  ANALYZER_SCHEMA_VERSION,
  assertNoSemanticIdentity,
  evaluateAutomaticGate,
  normalizeToVisionIntake,
  parseAnalyzerResponse,
  SemanticFirewallError,
} from "@/features/reference-v2/phase1-5/analyzer-contract";
import {
  assertNoInlineImageData,
  toAnchorFileReferences,
} from "@/features/reference-v2/phase1-5/provider-adapter";
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

// ---------------------------------------------------------------------------
// Phase 1.5 audit hardening
// ---------------------------------------------------------------------------

describe("Phase 1.5 hardening", () => {
  it("never sends the expected vehicle class or a perspective list to the provider", async () => {
    const analyze = vi.fn(async () => ({ response: parseAnalyzerResponse(goodResponse) }));
    await analyzeSingleFile(makeFile(), baseCtx as any, baseDeps(analyze) as any);
    const payload = (analyze.mock.calls as any[])[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["anchorFiles", "file"]);
    expect(JSON.stringify(payload)).not.toContain("car");
  });

  it("rejects a perspective that is not allowed for this vehicle master", async () => {
    const analyze = vi.fn(async () => ({
      response: parseAnalyzerResponse({
        ...goodResponse,
        canonicalPerspectiveId: "INT_DASH_CENTER",
      }),
    }));
    const out = await analyzeSingleFile(makeFile(), baseCtx as any, baseDeps(analyze) as any);
    expect(out.ok).toBe(false);
    expect(out.gateCodes).toContain("PERSPECTIVE_UNDETERMINED");
  });

  it("uses the first accepted file of a batch as identity anchor for the next files", async () => {
    let call = 0;
    const analyze = vi.fn(async () => {
      call += 1;
      return {
        response: parseAnalyzerResponse({
          ...goodResponse,
          ...(call === 1 ? {} : { sameVehicleConfidence: 0.95 }),
        }),
      };
    });
    const upload = vi.fn(async () => ({
      fileId: `files/f${call}`,
      providerId: "gemini-file-api",
      mimeType: "image/jpeg",
    }));
    const outcomes = await analyzeFileBatch(
      [makeFile("a.jpg"), makeFile("b.jpg")],
      baseCtx as any,
      baseDeps(analyze, upload) as any,
    );
    expect(outcomes.every((o) => o.ok)).toBe(true);
    const calls = analyze.mock.calls as any[];
    expect(calls[0][0].anchorFiles).toHaveLength(0);
    expect(calls[1][0].anchorFiles).toHaveLength(1);
  });

  it("blocks explicit identity vocabulary lexically", () => {
    expect(() =>
      assertNoSemanticIdentity({ note: "looks like a facelift generation" }),
    ).toThrow(SemanticFirewallError);
    expect(() =>
      assertNoSemanticIdentity({ note: "Modellreihe unklar" }),
    ).toThrow(SemanticFirewallError);
    expect(() =>
      assertNoSemanticIdentity({ note: "wide two-box body, round lamps" }),
    ).not.toThrow();
  });

  it("keeps provider lifecycle metadata on the analysis record", async () => {
    const analyze = vi.fn(async () => ({ response: parseAnalyzerResponse(goodResponse) }));
    const upload = vi.fn(async () => ({
      fileId: "files/abc",
      providerId: "gemini-file-api",
      mimeType: "image/png",
      sizeBytes: 4242,
      state: "ACTIVE",
      expiresAtIso: "2030-01-01T00:00:00Z",
    }));
    const out = await analyzeSingleFile(makeFile(), baseCtx as any, baseDeps(analyze, upload) as any);
    const rec = ReferenceAnalysisRecordSchema.parse(out.analysis);
    expect(rec.mimeType).toBe("image/png");
    expect(rec.sizeBytes).toBe(4242);
    expect(rec.fileExpiresAtIso).toBe("2030-01-01T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// Typed test helpers (no `any`) for the final Phase 1.5 correction tests
// ---------------------------------------------------------------------------

type BatchCtx = Parameters<typeof analyzeFileBatch>[1];
type BatchDeps = Parameters<typeof analyzeFileBatch>[2];
const asCtx = (c: unknown) => c as BatchCtx;
const asDeps = (d: unknown) => d as BatchDeps;
const anchorArgs = (mock: { calls: unknown[][] }) =>
  mock.calls.map((c) => (c[0] as { anchorFiles: unknown[] }).anchorFiles);

// ---------------------------------------------------------------------------
// FINAL Phase 1.5 correction: anchors only after Phase-1 governance accepts
// ---------------------------------------------------------------------------


describe("in-batch identity anchor requires Phase-1 governance", () => {
  it("A) grants NO anchor when Phase-1 rejects the first file (glare/crop)", async () => {
    let call = 0;
    const analyze = vi.fn(async () => {
      call += 1;
      return {
        response: parseAnalyzerResponse({
          ...goodResponse,
          ...(call === 1
            ? {
                // passes the automatic vision gate, but Phase-1 governance
                // rejects it (heavy glare + cropped vehicle)
                quality: {
                  sharpness: 0.9,
                  occlusion: 0.05,
                  glare: 0.95,
                  resolutionAdequacy: 0.95,
                },
                framing: {
                  fullVehicleVisible: false,
                  cropped: true,
                  visibleWheelPositions: [],
                  estimatedPaddingPct: 2,
                },
              }
            : {}),
        }),
      };
    });
    const upload = vi.fn(async () => ({
      fileId: `files/f${call}`,
      providerId: "gemini-file-api",
      mimeType: "image/jpeg",
    }));
    const outcomes = await analyzeFileBatch(
      [makeFile("a.jpg"), makeFile("b.jpg")],
      asCtx(baseCtx),
      asDeps(baseDeps(analyze, upload)),
    );
    expect(outcomes[0].ok).toBe(true);
    expect(outcomes[0].governance?.role).toBe("rejected");
    expect(outcomes[0].anchorEligible).toBe(false);
    expect(anchorArgs(analyze.mock)[1]).toHaveLength(0);
  });

  it("B) grants exactly one anchor when Vision AND Phase-1 accept the file", async () => {
    let call = 0;
    const analyze = vi.fn(async () => {
      call += 1;
      return {
        response: parseAnalyzerResponse({
          ...goodResponse,
          ...(call === 1 ? {} : { sameVehicleConfidence: 0.95 }),
        }),
      };
    });
    const upload = vi.fn(async () => ({
      fileId: `files/f${call}`,
      providerId: "gemini-file-api",
      mimeType: "image/jpeg",
    }));
    const outcomes = await analyzeFileBatch(
      [makeFile("a.jpg"), makeFile("b.jpg")],
      asCtx(baseCtx),
      asDeps(baseDeps(analyze, upload)),
    );
    expect(outcomes[0].anchorEligible).toBe(true);
    expect(outcomes[0].governance?.role).not.toBe("rejected");
    expect(anchorArgs(analyze.mock)[1]).toHaveLength(1);
  });

  it("C) keeps an existing analyzed seed anchor usable", async () => {
    const analyze = vi.fn(async () => ({
      response: parseAnalyzerResponse({
        ...goodResponse,
        sameVehicleConfidence: 0.96,
      }),
    }));
    const seed = {
      fileId: "files/seed",
      providerId: "gemini-file-api",
      mimeType: "image/png",
    };
    const outcomes = await analyzeFileBatch(
      [makeFile("a.jpg")],
      asCtx({ ...baseCtx, anchorFiles: [seed] }),
      asDeps(baseDeps(analyze)),
    );
    expect(outcomes[0].ok).toBe(true);
    expect(anchorArgs(analyze.mock)[0]).toEqual([seed]);
  });
});

describe("persisted anchors never guess a MIME type", () => {
  it("skips analysis records without a known MIME and preserves png/webp", () => {
    const anchors = toAnchorFileReferences([
      { fileId: "files/a", providerId: "gemini-file-api" },
      { fileId: "files/b", providerId: "gemini-file-api", mimeType: "image/png" },
      { fileId: "files/c", providerId: "gemini-file-api", mimeType: "image/webp" },
      { fileId: "files/d", providerId: "gemini-file-api", mimeType: "image/gif" },
    ]);
    expect(anchors.map((a) => a.fileId)).toEqual(["files/b", "files/c"]);
    expect(anchors.map((a) => a.mimeType)).toEqual(["image/png", "image/webp"]);
    expect(JSON.stringify(anchors)).not.toContain("image/jpeg");
  });
});

// ---------------------------------------------------------------------------
// Client/server response-shape consistency (fail closed, no optimistic defaults)
// ---------------------------------------------------------------------------

const validResponse = (patch: Record<string, unknown> = {}) => ({
  ...goodResponse,
  ...patch,
});

describe("analyzer response cross-field consistency", () => {
  it("rejects vehicleDetected=true without a vehicleClass", () => {
    expect(() =>
      parseAnalyzerResponse(validResponse({ vehicleClass: null })),
    ).toThrow(/vehicleClass/);
  });

  it("rejects a canonical perspective without azimuth or elevation", () => {
    expect(() => parseAnalyzerResponse(validResponse({ azimuthDeg: null }))).toThrow(
      /azimuthDeg/,
    );
    expect(() =>
      parseAnalyzerResponse(validResponse({ elevationProfile: null })),
    ).toThrow(/elevationProfile/);
  });

  it("rejects a perspective when no vehicle was detected", () => {
    expect(() =>
      parseAnalyzerResponse(validResponse({ vehicleDetected: false })),
    ).toThrow(/canonicalPerspectiveId|vehicleClass/);
  });

  it("preserves the visibility.surfaces map exactly and rejects unknown keys", () => {
    const ok = parseAnalyzerResponse(
      validResponse({
        visibility: {
          front: 0.9,
          rear: 0.1,
          leftSide: 0.6,
          rightSide: 0.1,
          roof: 0.3,
          surfaces: { headlight_left: 0.87 },
        },
      }),
    );
    expect(ok.visibility.surfaces).toEqual({ headlight_left: 0.87 });

    expect(() =>
      parseAnalyzerResponse(
        validResponse({
          visibility: {
            front: 0.9,
            rear: 0.1,
            leftSide: 0.6,
            rightSide: 0.1,
            roof: 0.3,
            surfaces: { not_a_surface: 0.5 },
          },
        }),
      ),
    ).toThrow();
  });
});
