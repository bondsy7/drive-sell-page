import { describe, expect, it } from "vitest";
import {
  applyManualAssignment,
  removeManualAssignment,
  resolvePerspective,
  summarizeCapture,
  resolveAll,
  type CaptureItem,
} from "../phase4/capture-state";
import {
  friendlyIntakeError,
  isTransientIntakeError,
  runWithConcurrency,
} from "../phase1-5/concurrent-intake";

const item = (over: Partial<CaptureItem> & { id: string }): CaptureItem => ({
  fileName: `${over.id}.jpg`,
  previewUrl: `blob:${over.id}`,
  status: "analyzed",
  ...over,
});

describe("Phase 4 — advisory capture state", () => {
  it("keeps failed analyses usable and marks them as missing evidence", () => {
    const items = [item({ id: "a", status: "unavailable" })];
    const res = resolvePerspective("EXT_FRONT", items, []);
    expect(res.status).toBe("MISSING");
    expect(items).toHaveLength(1);
  });

  it("prefers a manual assignment over automatic detection", () => {
    const items = [
      item({ id: "auto", perspectiveId: "EXT_FRONT", confidence: 0.95 }),
      item({ id: "manual", status: "unavailable" }),
    ];
    const assignments = applyManualAssignment([], {
      perspectiveId: "EXT_FRONT",
      itemId: "manual",
      role: "primary",
    });
    const res = resolvePerspective("EXT_FRONT", items, assignments);
    expect(res.primaryItemId).toBe("manual");
    expect(res.primaryIsManual).toBe(true);
  });

  it("warns instead of blocking when confidence is low", () => {
    const items = [item({ id: "a", perspectiveId: "EXT_REAR", confidence: 0.3 })];
    const res = resolvePerspective("EXT_REAR", items, []);
    expect(res.status).toBe("WARNING");
    expect(res.primaryItemId).toBe("a");
  });

  it("never mirrors to the opposite side", () => {
    const items = [item({ id: "a", perspectiveId: "EXT_SIDE_LEFT", confidence: 0.99 })];
    expect(resolvePerspective("EXT_SIDE_RIGHT", items, []).primaryItemId).toBeUndefined();
  });

  it("removes an assignment again", () => {
    const withAssignment = applyManualAssignment([], {
      perspectiveId: "EXT_FRONT",
      itemId: "x",
      role: "primary",
    });
    expect(removeManualAssignment(withAssignment, "EXT_FRONT", "x")).toHaveLength(0);
  });

  it("summarizes counts and coverage", () => {
    const items = [
      item({ id: "a", perspectiveId: "EXT_FRONT", confidence: 0.95 }),
      item({ id: "b", status: "analyzing" }),
      item({ id: "c", status: "unavailable" }),
    ];
    const resolutions = resolveAll(["EXT_FRONT", "EXT_REAR"], items, []);
    const summary = summarizeCapture(items, resolutions);
    expect(summary.total).toBe(3);
    expect(summary.running).toBe(1);
    expect(summary.unavailable).toBe(1);
    expect(summary.coveredPerspectives).toBe(1);
  });
});

describe("Phase 4 — bounded concurrency and error text", () => {
  it("never exceeds the configured worker limit", async () => {
    let active = 0;
    let peak = 0;
    await runWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("translates transport errors into readable German", () => {
    expect(friendlyIntakeError("Failed to send a request to the Edge Function")).toMatch(
      /Verbindungsproblem/,
    );
    expect(isTransientIntakeError("timeout")).toBe(true);
    expect(isTransientIntakeError("SEMANTIC_FIREWALL: ...")).toBe(false);
  });
});
