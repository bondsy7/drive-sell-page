import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SemanticFirewallError } from "../phase1-5/analyzer-contract";
import {
  CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
  CurrentFramingEvidenceError,
  type CurrentFramingEvidence,
} from "../phase2/framing-evidence";
import {
  CurrentFramingEvidenceSidecarError,
  createCurrentFramingEvidenceForAsset,
  currentFramingEvidenceForPlanner,
  emptyCurrentFramingEvidenceSidecar,
  parseCurrentFramingEvidenceSidecar,
  pruneCurrentFramingEvidence,
  rebaseCurrentFramingEvidence,
  removeCurrentFramingEvidence,
  upsertCurrentFramingEvidence,
} from "../phase2/framing-evidence-sidecar";

const FACTS = {
  sourceAspectRatio: 1.5,
  fullVehicleVisible: true,
  cropped: false,
  paddingPct: 8,
};

function evidence(assetId: string, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
    assetId,
    ...FACTS,
    ...overrides,
  } as CurrentFramingEvidence;
}

// --------------------------------------------------------------------------
// A. Creation seam
// --------------------------------------------------------------------------

describe("A. createCurrentFramingEvidenceForAsset", () => {
  it("creates evidence under the persisted reference asset id", () => {
    const created = createCurrentFramingEvidenceForAsset("ref_123", FACTS);
    expect(created).toEqual({
      schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
      assetId: "ref_123",
      ...FACTS,
    });
  });

  it("preserves all four facts exactly without defaulting", () => {
    const created = createCurrentFramingEvidenceForAsset("ref_x", {
      sourceAspectRatio: 0.8,
      fullVehicleVisible: false,
      cropped: true,
      paddingPct: 0,
    });
    expect(created.sourceAspectRatio).toBe(0.8);
    expect(created.fullVehicleVisible).toBe(false);
    expect(created.cropped).toBe(true);
    expect(created.paddingPct).toBe(0);
  });

  it.each([
    ["sourceAspectRatio", { fullVehicleVisible: true, cropped: false, paddingPct: 1 }],
    ["fullVehicleVisible", { sourceAspectRatio: 1.5, cropped: false, paddingPct: 1 }],
    ["cropped", { sourceAspectRatio: 1.5, fullVehicleVisible: true, paddingPct: 1 }],
    ["paddingPct", { sourceAspectRatio: 1.5, fullVehicleVisible: true, cropped: false }],
  ])("rejects missing fact %s (no fallback)", (_name, facts) => {
    expect(() => createCurrentFramingEvidenceForAsset("ref_1", facts)).toThrow(
      CurrentFramingEvidenceSidecarError,
    );
  });

  it("rejects an unknown fact key", () => {
    expect(() =>
      createCurrentFramingEvidenceForAsset("ref_1", { ...FACTS, extra: 1 }),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it("rejects schemaVersion / assetId inside the facts payload", () => {
    expect(() =>
      createCurrentFramingEvidenceForAsset("ref_1", {
        ...FACTS,
        assetId: "ref_other",
      }),
    ).toThrow(CurrentFramingEvidenceSidecarError);
    expect(() =>
      createCurrentFramingEvidenceForAsset("ref_1", {
        ...FACTS,
        schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
      }),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid sourceAspectRatio %s",
    (ratio) => {
      expect(() =>
        createCurrentFramingEvidenceForAsset("ref_1", {
          ...FACTS,
          sourceAspectRatio: ratio,
        }),
      ).toThrow(CurrentFramingEvidenceSidecarError);
    },
  );

  it.each([-0.1, Number.NaN])("rejects invalid paddingPct %s", (padding) => {
    expect(() =>
      createCurrentFramingEvidenceForAsset("ref_1", {
        ...FACTS,
        paddingPct: padding,
      }),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it("rejects an empty asset id", () => {
    expect(() => createCurrentFramingEvidenceForAsset("", FACTS)).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects semantic identity inside the asset id via the frozen firewall", () => {
    expect(() =>
      createCurrentFramingEvidenceForAsset("WVWZZZ1KZAW123456", FACTS),
    ).toThrow(SemanticFirewallError);
  });
});

// --------------------------------------------------------------------------
// B. Rebase
// --------------------------------------------------------------------------

describe("B. rebaseCurrentFramingEvidence", () => {
  it("rebases a file-level id onto the persisted reference id", () => {
    const source = evidence("file_abc");
    const rebased = rebaseCurrentFramingEvidence(source, "ref_123");
    expect(rebased).toEqual({ ...source, assetId: "ref_123" });
  });

  it("does not mutate the source object", () => {
    const source = evidence("file_abc");
    const snapshot = { ...source };
    rebaseCurrentFramingEvidence(source, "ref_123");
    expect(source).toEqual(snapshot);
  });

  it("rejects invalid source evidence via the frozen parser", () => {
    expect(() =>
      rebaseCurrentFramingEvidence({ assetId: "file_abc" }, "ref_1"),
    ).toThrow(CurrentFramingEvidenceError);
  });

  it("rejects an empty persisted id", () => {
    expect(() => rebaseCurrentFramingEvidence(evidence("file_a"), "")).toThrow(
      CurrentFramingEvidenceError,
    );
  });

  it("rejects a semantic persisted id via the frozen firewall", () => {
    expect(() =>
      rebaseCurrentFramingEvidence(evidence("file_a"), "WVWZZZ1KZAW123456"),
    ).toThrow(SemanticFirewallError);
  });
});

// --------------------------------------------------------------------------
// C. Sidecar parser
// --------------------------------------------------------------------------

describe("C. parseCurrentFramingEvidenceSidecar", () => {
  it("accepts the empty sidecar", () => {
    expect(parseCurrentFramingEvidenceSidecar({ byAssetId: {} })).toEqual({
      byAssetId: {},
    });
    expect(emptyCurrentFramingEvidenceSidecar()).toEqual({ byAssetId: {} });
  });

  it("accepts valid keyed entries", () => {
    const raw = {
      byAssetId: { ref_1: evidence("ref_1"), ref_2: evidence("ref_2") },
    };
    expect(parseCurrentFramingEvidenceSidecar(raw)).toEqual(raw);
  });

  it("rejects an unknown top-level key", () => {
    expect(() =>
      parseCurrentFramingEvidenceSidecar({ byAssetId: {}, updatedAtIso: "x" }),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it("rejects a missing byAssetId container", () => {
    expect(() => parseCurrentFramingEvidenceSidecar({})).toThrow(
      CurrentFramingEvidenceSidecarError,
    );
  });

  it("rejects a key / value assetId mismatch", () => {
    expect(() =>
      parseCurrentFramingEvidenceSidecar({
        byAssetId: { ref_1: evidence("ref_2") },
      }),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it("rejects malformed nested evidence via frozen 2.4A validation", () => {
    expect(() =>
      parseCurrentFramingEvidenceSidecar({
        byAssetId: { ref_1: { assetId: "ref_1" } },
      }),
    ).toThrow(CurrentFramingEvidenceError);
  });

  it("rejects nested semantic identity via the frozen firewall", () => {
    expect(() =>
      parseCurrentFramingEvidenceSidecar({
        byAssetId: { ref_1: { ...evidence("ref_1"), vin: "WVWZZZ1KZAW123456" } },
      }),
    ).toThrow(SemanticFirewallError);
  });
});

// --------------------------------------------------------------------------
// D. Upsert
// --------------------------------------------------------------------------

describe("D. upsertCurrentFramingEvidence", () => {
  it("inserts into the empty sidecar", () => {
    const next = upsertCurrentFramingEvidence(
      emptyCurrentFramingEvidenceSidecar(),
      evidence("ref_1"),
    );
    expect(Object.keys(next.byAssetId)).toEqual(["ref_1"]);
  });

  it("replaces the same asset id without duplicating", () => {
    const first = upsertCurrentFramingEvidence(
      emptyCurrentFramingEvidenceSidecar(),
      evidence("ref_1"),
    );
    const second = upsertCurrentFramingEvidence(
      first,
      evidence("ref_1", { paddingPct: 20 }),
    );
    expect(Object.keys(second.byAssetId)).toEqual(["ref_1"]);
    expect(second.byAssetId.ref_1.paddingPct).toBe(20);
  });

  it("leaves other entries unchanged", () => {
    const base = parseCurrentFramingEvidenceSidecar({
      byAssetId: { ref_1: evidence("ref_1"), ref_2: evidence("ref_2") },
    });
    const next = upsertCurrentFramingEvidence(
      base,
      evidence("ref_2", { cropped: true }),
    );
    expect(next.byAssetId.ref_1).toEqual(base.byAssetId.ref_1);
    expect(Object.keys(next.byAssetId)).toEqual(["ref_1", "ref_2"]);
  });

  it("never mutates the input sidecar or evidence", () => {
    const base = parseCurrentFramingEvidenceSidecar({
      byAssetId: { ref_1: evidence("ref_1") },
    });
    const baseSnapshot = JSON.parse(JSON.stringify(base));
    const input = evidence("ref_1", { paddingPct: 30 });
    const inputSnapshot = { ...input };
    upsertCurrentFramingEvidence(base, input);
    expect(base).toEqual(baseSnapshot);
    expect(input).toEqual(inputSnapshot);
  });

  it("is deterministic for the same input", () => {
    const base = { byAssetId: { ref_1: evidence("ref_1") } };
    const a = upsertCurrentFramingEvidence(base, evidence("ref_2"));
    const b = upsertCurrentFramingEvidence(base, evidence("ref_2"));
    expect(a).toEqual(b);
  });

  it("rejects invalid evidence", () => {
    expect(() =>
      upsertCurrentFramingEvidence(emptyCurrentFramingEvidenceSidecar(), {
        assetId: "ref_1",
      }),
    ).toThrow(CurrentFramingEvidenceError);
  });
});

// --------------------------------------------------------------------------
// E. Remove
// --------------------------------------------------------------------------

describe("E. removeCurrentFramingEvidence", () => {
  const base = { byAssetId: { ref_1: evidence("ref_1"), ref_2: evidence("ref_2") } };

  it("removes the exact asset", () => {
    const next = removeCurrentFramingEvidence(base, "ref_1");
    expect(Object.keys(next.byAssetId)).toEqual(["ref_2"]);
  });

  it("is a deterministic no-op for a missing id", () => {
    const next = removeCurrentFramingEvidence(base, "ref_missing");
    expect(next).toEqual(parseCurrentFramingEvidenceSidecar(base));
  });

  it("preserves other entries and does not mutate the input", () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    const next = removeCurrentFramingEvidence(base, "ref_1");
    expect(next.byAssetId.ref_2).toEqual(base.byAssetId.ref_2);
    expect(base).toEqual(snapshot);
  });
});

// --------------------------------------------------------------------------
// F. Prune
// --------------------------------------------------------------------------

describe("F. pruneCurrentFramingEvidence", () => {
  const base = {
    byAssetId: {
      ref_1: evidence("ref_1"),
      ref_2: evidence("ref_2"),
      ref_3: evidence("ref_3"),
    },
  };

  it("removes stale ids only", () => {
    const next = pruneCurrentFramingEvidence(base, ["ref_1", "ref_3"]);
    expect(Object.keys(next.byAssetId)).toEqual(["ref_1", "ref_3"]);
  });

  it("returns an empty sidecar for an empty known set", () => {
    expect(pruneCurrentFramingEvidence(base, [])).toEqual({ byAssetId: {} });
  });

  it("rejects duplicate known ids", () => {
    expect(() => pruneCurrentFramingEvidence(base, ["ref_1", "ref_1"])).toThrow(
      CurrentFramingEvidenceSidecarError,
    );
  });

  it("rejects empty known ids", () => {
    expect(() => pruneCurrentFramingEvidence(base, ["ref_1", ""])).toThrow(
      CurrentFramingEvidenceSidecarError,
    );
  });

  it("keeps sidecar entry order for survivors, not known-id order", () => {
    const next = pruneCurrentFramingEvidence(base, ["ref_3", "ref_1"]);
    expect(Object.keys(next.byAssetId)).toEqual(["ref_1", "ref_3"]);
  });
});

// --------------------------------------------------------------------------
// G. Planner projection
// --------------------------------------------------------------------------

describe("G. currentFramingEvidenceForPlanner", () => {
  const base = {
    byAssetId: { ref_2: evidence("ref_2"), ref_1: evidence("ref_1") },
  };

  it("returns evidence in knownAssetIds order", () => {
    const out = currentFramingEvidenceForPlanner(base, ["ref_1", "ref_2"]);
    expect(out.map((e) => e.assetId)).toEqual(["ref_1", "ref_2"]);
  });

  it("omits known assets without evidence instead of synthesizing", () => {
    const out = currentFramingEvidenceForPlanner(base, [
      "ref_1",
      "ref_missing",
      "ref_2",
    ]);
    expect(out.map((e) => e.assetId)).toEqual(["ref_1", "ref_2"]);
  });

  it("fails closed on any stale sidecar id", () => {
    expect(() => currentFramingEvidenceForPlanner(base, ["ref_1"])).toThrow(
      CurrentFramingEvidenceSidecarError,
    );
  });

  it("succeeds after an explicit prune", () => {
    const pruned = pruneCurrentFramingEvidence(base, ["ref_1"]);
    const out = currentFramingEvidenceForPlanner(pruned, ["ref_1"]);
    expect(out.map((e) => e.assetId)).toEqual(["ref_1"]);
  });

  it("returns safe copies that cannot mutate the sidecar", () => {
    const sidecar = parseCurrentFramingEvidenceSidecar(base);
    const out = currentFramingEvidenceForPlanner(sidecar, ["ref_1", "ref_2"]);
    out[0].paddingPct = 999;
    expect(sidecar.byAssetId.ref_1.paddingPct).toBe(FACTS.paddingPct);
  });

  it("rejects duplicate known ids", () => {
    expect(() =>
      currentFramingEvidenceForPlanner(base, ["ref_1", "ref_2", "ref_1"]),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it("returns an empty projection for the empty sidecar", () => {
    expect(
      currentFramingEvidenceForPlanner(emptyCurrentFramingEvidenceSidecar(), [
        "ref_1",
      ]),
    ).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// I. Prototype-safe record semantics
// --------------------------------------------------------------------------

const SPECIAL_KEYS = ["toString", "constructor", "__proto__"] as const;

function rawSidecar(ids: readonly string[]) {
  return {
    byAssetId: Object.fromEntries(ids.map((id) => [id, evidence(id)])),
  };
}

describe("I. prototype-safe record semantics", () => {
  it.each(SPECIAL_KEYS)("upserts %s as an own enumerable entry", (key) => {
    const next = upsertCurrentFramingEvidence(
      emptyCurrentFramingEvidenceSidecar(),
      evidence(key),
    );
    expect(Object.prototype.hasOwnProperty.call(next.byAssetId, key)).toBe(true);
    expect(Object.keys(next.byAssetId)).toEqual([key]);
    expect(
      (Object.getOwnPropertyDescriptor(next.byAssetId, key)?.value as
        | CurrentFramingEvidence
        | undefined)?.assetId,
    ).toBe(key);
  });

  it("does not pollute prototypes when handling __proto__", () => {
    const next = upsertCurrentFramingEvidence(
      emptyCurrentFramingEvidenceSidecar(),
      evidence("__proto__"),
    );
    expect(Object.getPrototypeOf(next.byAssetId)).toBe(Object.prototype);
    expect(
      Object.getOwnPropertyDescriptor(next.byAssetId, "__proto__")?.enumerable,
    ).toBe(true);
    expect(
      (Object.prototype as unknown as Record<string, unknown>).assetId,
    ).toBeUndefined();
    expect(({} as Record<string, unknown>).sourceAspectRatio).toBeUndefined();
  });

  it.each(SPECIAL_KEYS)(
    "replaces an existing %s entry without duplication",
    (key) => {
      const first = upsertCurrentFramingEvidence(
        emptyCurrentFramingEvidenceSidecar(),
        evidence(key),
      );
      const second = upsertCurrentFramingEvidence(
        first,
        evidence(key, { paddingPct: 42 }),
      );
      expect(Object.keys(second.byAssetId)).toEqual([key]);
      expect(
        (Object.getOwnPropertyDescriptor(second.byAssetId, key)?.value as
          | CurrentFramingEvidence
          | undefined)?.paddingPct,
      ).toBe(42);
    },
  );

  it("parses a raw sidecar with an own __proto__ key without altering prototypes", () => {
    const raw = {
      byAssetId: Object.fromEntries([["__proto__", evidence("__proto__")]]),
    };
    expect(
      Object.prototype.hasOwnProperty.call(raw.byAssetId, "__proto__"),
    ).toBe(true);
    const parsed = parseCurrentFramingEvidenceSidecar(raw);
    expect(
      Object.prototype.hasOwnProperty.call(parsed.byAssetId, "__proto__"),
    ).toBe(true);
    expect(Object.getPrototypeOf(parsed.byAssetId)).toBe(Object.prototype);
    expect(Object.keys(parsed.byAssetId)).toEqual(["__proto__"]);
  });

  it("removes a special-key entry and preserves the others", () => {
    const base = rawSidecar(["ref_1", "toString", "ref_2"]);
    const next = removeCurrentFramingEvidence(base, "toString");
    expect(Object.keys(next.byAssetId)).toEqual(["ref_1", "ref_2"]);
  });

  it("prunes special-key entries by explicit known ids", () => {
    const base = rawSidecar(["toString", "ref_1", "constructor"]);
    const next = pruneCurrentFramingEvidence(base, ["toString", "ref_1"]);
    expect(Object.keys(next.byAssetId)).toEqual(["toString", "ref_1"]);
  });

  it("projects special keys in knownAssetIds order", () => {
    const base = rawSidecar(["toString", "ref_1", "__proto__"]);
    const out = currentFramingEvidenceForPlanner(base, [
      "ref_1",
      "__proto__",
      "toString",
    ]);
    expect(out.map((e) => e.assetId)).toEqual([
      "ref_1",
      "__proto__",
      "toString",
    ]);
  });

  it("never synthesizes inherited prototype members as evidence", () => {
    const base = rawSidecar(["ref_1"]);
    const out = currentFramingEvidenceForPlanner(base, [
      "ref_1",
      "toString",
      "constructor",
    ]);
    expect(out.map((e) => e.assetId)).toEqual(["ref_1"]);
  });

  it("keeps ordinary ref_* behaviour and order unchanged", () => {
    const base = rawSidecar(["ref_1", "ref_2"]);
    const next = upsertCurrentFramingEvidence(base, evidence("ref_3"));
    expect(Object.keys(next.byAssetId)).toEqual(["ref_1", "ref_2", "ref_3"]);
    expect(
      currentFramingEvidenceForPlanner(next, ["ref_3", "ref_1", "ref_2"]).map(
        (e) => e.assetId,
      ),
    ).toEqual(["ref_3", "ref_1", "ref_2"]);
  });
});

// --------------------------------------------------------------------------
// H. Source purity
// --------------------------------------------------------------------------

describe("H. Phase 2.4C source purity", () => {
  const source = readFileSync(
    path.join(
      process.cwd(),
      "src/features/reference-v2/phase2/framing-evidence-sidecar.ts",
    ),
    "utf8",
  );
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it.each([
    "CurrentFramingEvidenceSchema",
    "parseCurrentFramingEvidence",
    "CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION",
  ])("uses the frozen 2.4A export %s", (needle) => {
    expect(code).toContain(needle);
  });

  it.each([
    "ReferenceAssetRecord",
    "VehicleMasterRecord",
    "outputReadyFormats",
    "requestedPerspectiveId",
    ".scores",
    ".weightedScore",
    "evaluateOutputFormatReadiness",
    "OUTPUT_FORMAT_RATIOS",
    "4 / 5",
    "1.91",
    "analyzer",
    "provider",
    "store",
    "react",
    "React",
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
