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

import {
  chooseGenerationBasis,
  isBatchTerminal,
  type CaptureItem,
} from "../phase4/capture-state";

const item = (id: string, perspectiveId?: string, status = "analyzed"): CaptureItem =>
  ({
    id,
    fileName: `${id}.jpg`,
    previewUrl: `blob:${id}`,
    status,
    ...(perspectiveId ? { perspectiveId } : {}),
  }) as CaptureItem;

const deps = {
  azimuthOf: (id: string) =>
    ({
      EXT_FRONT: 0,
      EXT_34_FRONT_RIGHT: 45,
      EXT_SIDE_RIGHT: 90,
      EXT_SIDE_LEFT: 270,
    })[id] ?? null,
} as never;

describe("chooseGenerationBasis", () => {
  it("nutzt die gleiche Fahrzeugseite als Ersatz statt zu spiegeln", () => {
    const items = [item("a", "EXT_34_FRONT_RIGHT")];
    const basis = chooseGenerationBasis("EXT_SIDE_RIGHT" as never, items, [], deps);
    expect(basis.kind).toBe("substitute");
    expect(basis.primaryItemId).toBe("a");
    expect(basis.sourcePerspectiveId).toBe("EXT_34_FRONT_RIGHT");
  });

  it("erlaubt Generierung auch ohne Analyse (geschätzt)", () => {
    const items = [item("x", undefined, "unavailable")];
    const basis = chooseGenerationBasis("EXT_FRONT" as never, items, [], deps);
    expect(basis.kind).toBe("estimated");
    expect(basis.requiresAcknowledgement).toBe(true);
  });

  it("bevorzugt die manuelle Zuordnung", () => {
    const items = [item("a", "EXT_FRONT"), item("b", undefined, "unavailable")];
    const basis = chooseGenerationBasis(
      "EXT_FRONT" as never,
      items,
      [{ perspectiveId: "EXT_FRONT", itemId: "b", role: "primary" } as never],
      deps,
    );
    expect(basis.primaryItemId).toBe("b");
    expect(basis.kind).toBe("direct");
  });
});

describe("isBatchTerminal", () => {
  it("wertet Warnung und Fehler als abgeschlossen", () => {
    const items = [item("a", "EXT_FRONT", "warning"), item("b", undefined, "unavailable")];
    expect(isBatchTerminal(items, ["a", "b"])).toBe(true);
  });

  it("wartet auf laufende Analysen", () => {
    const items = [item("a", undefined, "analyzing")];
    expect(isBatchTerminal(items, ["a"])).toBe(false);
  });
});
