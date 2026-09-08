import { describe, it, expect } from "vitest";
import {
  reconcileSide,
  reconcileBatchSides,
  oppositePerspectiveId,
  sideEvidence,
  type CaptureItem,
} from "@/features/reference-v2/phase4/capture-state";

const base = (over: Partial<CaptureItem>): CaptureItem => ({
  id: over.id ?? "a",
  fileName: "f.jpg",
  previewUrl: "blob:x",
  status: "analyzed",
  ...over,
});

describe("side reconciliation", () => {
  it("maps opposite perspective ids", () => {
    expect(oppositePerspectiveId("EXT_SIDE_LEFT")).toBe("EXT_SIDE_RIGHT");
    expect(oppositePerspectiveId("EXT_FRONT")).toBeNull();
  });

  it("detects side from azimuth and visibility", () => {
    expect(sideEvidence(base({ azimuthDeg: 90 }))).toBe("right");
    expect(sideEvidence(base({ azimuthDeg: -90 }))).toBe("left");
    expect(sideEvidence(base({ leftVisibility: 0.9, rightVisibility: 0.05 }))).toBe("left");
    expect(sideEvidence(base({ azimuthDeg: 0 }))).toBeNull();
  });

  it("corrects a contradicting side without mirroring", () => {
    const patch = reconcileSide(
      base({ perspectiveId: "EXT_SIDE_LEFT", azimuthDeg: 92, rightVisibility: 0.95, leftVisibility: 0.02 }),
    );
    expect(patch?.perspectiveId).toBe("EXT_SIDE_RIGHT");
    expect(patch?.sideCorrected).toBe(true);
  });

  it("flags only the weaker duplicate of an exterior view", () => {
    const out = reconcileBatchSides([
      base({ id: "1", perspectiveId: "EXT_SIDE_LEFT", confidence: 0.95, azimuthDeg: -90, leftVisibility: 0.9, rightVisibility: 0.05 }),
      base({ id: "2", perspectiveId: "EXT_SIDE_LEFT", confidence: 0.6, azimuthDeg: -88, leftVisibility: 0.88, rightVisibility: 0.04 }),
    ]);
    expect(out.find((i) => i.id === "1")?.conflict).toBe(false);
    expect(out.find((i) => i.id === "2")?.conflict).toBe(true);
  });

  it("never flags duplicate interior views", () => {
    const out = reconcileBatchSides([
      base({ id: "1", perspectiveId: "INT_DASH_CENTER", confidence: 0.9 }),
      base({ id: "2", perspectiveId: "INT_DASH_CENTER", confidence: 0.9 }),
    ]);
    expect(out.some((i) => i.conflict)).toBe(false);
  });


  it("splits a wrongly duplicated pair back to both sides", () => {
    const out = reconcileBatchSides([
      base({ id: "1", perspectiveId: "EXT_SIDE_LEFT", azimuthDeg: -90, leftVisibility: 0.9, rightVisibility: 0.05 }),
      base({ id: "2", perspectiveId: "EXT_SIDE_LEFT", azimuthDeg: 90, leftVisibility: 0.03, rightVisibility: 0.93 }),
    ]);
    expect(out.map((i) => i.perspectiveId)).toEqual(["EXT_SIDE_LEFT", "EXT_SIDE_RIGHT"]);
    expect(out.some((i) => i.conflict)).toBe(false);
  });
});
