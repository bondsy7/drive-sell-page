import { describe, expect, it } from "vitest";
import { runBatch } from "../phase4/batch-generation";

describe("runBatch", () => {
  it("hält die Nebenläufigkeit ein", async () => {
    let active = 0;
    let peak = 0;
    await runBatch(
      ["a", "b", "c", "d", "e"],
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      },
      { concurrency: 2 },
    );
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("setzt den Stapel nach einem Fehler fort", async () => {
    const outcomes = await runBatch(
      ["a", "b", "c"],
      async (key) => {
        if (key === "b") throw new Error("kaputt");
        return key;
      },
      { concurrency: 2 },
    );
    expect(outcomes.filter((o) => o.ok).length).toBe(2);
    expect(outcomes.find((o) => o.key === "b")?.error).toBe("kaputt");
  });
});
