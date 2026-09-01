import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEffect, type ReactNode } from "react";
import {
  ReferenceStoreProvider,
  useReferenceStore,
} from "../phase1/reference-store";
import {
  CurrentFramingEvidenceRuntimeProvider,
  useCurrentFramingEvidenceRuntime,
  type CurrentFramingEvidenceRuntimeValue,
} from "../phase2/framing-evidence-runtime";
import { OutputPlannerPanel } from "../phase2/OutputPlannerPanel";
import { listMasterPerspectivesForClass } from "../phase1/perspective-master";
import type { VehicleMasterRecord } from "../phase1/vehicle-master";

/**
 * Reference V2 — Phase 2.5: Output Planner UI + Preflight.
 * Keine Planner-Mocks: es laeuft immer der eingefrorene Adapter.
 */

const PANEL_PATH = "src/features/reference-v2/phase2/OutputPlannerPanel.tsx";
const ADMIN_PATH = "src/features/reference-v2/phase1/AdminReferenceView.tsx";

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface Harness {
  runtime: CurrentFramingEvidenceRuntimeValue;
  master: VehicleMasterRecord | null;
}

function renderPanel() {
  const harness: Harness = { master: null } as Harness;

  function Inner() {
    const store = useReferenceStore();
    const runtime = useCurrentFramingEvidenceRuntime();
    harness.runtime = runtime;
    harness.master = store.activeMaster;

    useEffect(() => {
      if (store.masters.length === 0) {
        store.createMaster({
          label: "Referenz A",
          vehicleClass: "car",
          colorFamily: "grey",
        });
      }
    }, [store]);

    if (!store.activeMaster) return null;
    return <OutputPlannerPanel vehicleMaster={store.activeMaster} />;
  }

  const tree: ReactNode = (
    <ReferenceStoreProvider>
      <CurrentFramingEvidenceRuntimeProvider>
        <Inner />
      </CurrentFramingEvidenceRuntimeProvider>
    </ReferenceStoreProvider>
  );
  const utils = render(tree);
  return { harness, ...utils };
}

const CAR_PERSPECTIVES = listMasterPerspectivesForClass("car");
const CAR_STANDARD_EXTERIOR = CAR_PERSPECTIVES.filter(
  (p) => p.category === "standard_exterior",
);
const CAR_HERO = CAR_PERSPECTIVES.filter((p) => p.category === "hero");
const CAR_INTERIOR = CAR_PERSPECTIVES.filter((p) => p.category === "interior");

function chip(labelDe: string, id: string) {
  return screen.getByRole("button", { name: `${labelDe} · ${id}` });
}

describe("Phase 2.5 — OutputPlannerPanel", () => {
  it("selects all standard exterior targets of the master class by default", () => {
    renderPanel();
    expect(CAR_STANDARD_EXTERIOR.length).toBeGreaterThan(0);
    for (const entry of CAR_STANDARD_EXTERIOR) {
      expect(chip(entry.labelDe, entry.id)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    for (const entry of [...CAR_HERO, ...CAR_INTERIOR]) {
      expect(chip(entry.labelDe, entry.id)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("selects both output formats by default", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "4:5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "1.91:1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders frozen planner BLOCKED items and consistent summary counts for an empty master", () => {
    renderPanel();
    // one state badge per planned item (summary badge carries its own count text)
    expect(screen.getAllByText("BLOCKED").length).toBe(
      CAR_STANDARD_EXTERIOR.length,
    );
    expect(
      screen.getByText(`BLOCKED ${CAR_STANDARD_EXTERIOR.length}`),
    ).toBeInTheDocument();
    expect(screen.getByText("READY 0")).toBeInTheDocument();
    expect(screen.queryByText("Preflight bestanden")).not.toBeInTheDocument();
    for (const entry of CAR_STANDARD_EXTERIOR) {
      expect(
        screen.getByText(new RegExp(`${entry.id} · v\\d+`)),
      ).toBeInTheDocument();
    }
  });

  it("follows target selection when the user deselects and reselects", () => {
    renderPanel();
    const first = CAR_STANDARD_EXTERIOR[0]!;
    act(() => {
      fireEvent.click(chip(first.labelDe, first.id));
    });
    expect(chip(first.labelDe, first.id)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByText(`BLOCKED ${CAR_STANDARD_EXTERIOR.length - 1}`),
    ).toBeInTheDocument();
    act(() => {
      fireEvent.click(chip(first.labelDe, first.id));
    });
    expect(
      screen.getByText(`BLOCKED ${CAR_STANDARD_EXTERIOR.length}`),
    ).toBeInTheDocument();
  });

  it("shows a neutral message and no READY claim without any target", () => {
    renderPanel();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Alle abwählen" }));
    });
    expect(
      screen.getByText(/Keine Zielperspektive ausgewählt/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Preflight bestanden")).not.toBeInTheDocument();
    expect(screen.queryByText(/^READY \d+$/)).not.toBeInTheDocument();
  });

  it("blocks locally when no output format is selected", () => {
    renderPanel();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "4:5" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "1.91:1" }));
    });
    expect(
      screen.getByText(/mindestens ein Ausgabeformat/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Preflight bestanden")).not.toBeInTheDocument();
    expect(screen.queryByText(/^READY \d+$/)).not.toBeInTheDocument();
  });

  it("fails closed with a planner error card on stale/foreign framing evidence", () => {
    const { harness } = renderPanel();
    act(() => {
      harness.runtime.recordCurrentFramingEvidence(
        harness.master!.id,
        "ref_ghost",
        {
          sourceAspectRatio: 1.5,
          fullVehicleVisible: true,
          cropped: false,
          paddingPct: 30,
        },
      );
    });
    expect(screen.getByText(/Preflight fehlgeschlagen/)).toBeInTheDocument();
    expect(screen.queryByText("Preflight bestanden")).not.toBeInTheDocument();
    expect(screen.queryByText(/^READY \d+$/)).not.toBeInTheDocument();
  });

  it("renders reason texts that come from the frozen planner messageDe", () => {
    renderPanel();
    // frozen planner emits this German reason for masters without references
    expect(
      screen.getAllByText(/Keine qualifizierte exakte Primary-Referenz/i).length,
    ).toBeGreaterThan(0);
  });

  it("offers no generation action", () => {
    renderPanel();
    for (const button of screen.getAllByRole("button")) {
      expect(button.textContent ?? "").not.toMatch(/generier/i);
    }
    const source = stripComments(readFileSync(PANEL_PATH, "utf8"));
    expect(source).not.toMatch(/onGenerate|startGeneration|generateImage/);
  });

  it("source guard: panel uses only the frozen adapter and runtime", () => {
    const source = stripComments(readFileSync(PANEL_PATH, "utf8"));
    expect(source).toContain("buildReferencePlannerFromCurrentFramingSidecar");
    expect(source).toContain("useCurrentFramingEvidenceRuntime");
    for (const forbidden of [
      "outputReadyFormats",
      "weightedScore",
      "requestedPerspectiveId\"",
      "evaluateOutputFormatReadiness",
      "./eligibility",
      "./candidate-scoring",
      "./coverage",
      "./planner\"",
      "supabase",
      "fetch(",
      "Math.random",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/requestedPerspectiveId\b/);
  });

  it("source guard: AdminReferenceView drops legacy format authority and mounts the panel", () => {
    const source = stripComments(readFileSync(ADMIN_PATH, "utf8"));
    expect(source).not.toContain("assetIsFullyOutputReady");
    expect(source).not.toContain("4:5 + 1.91:1");
    expect(source).not.toContain("Format eingeschränkt");
    expect(source).toContain("Governance-Score");
    expect(source).toMatch(
      /disabled=\{asset\.protection === "protected"\}/,
    );
    expect(source).toMatch(
      /<OutputPlannerPanel[\s\S]*?key=\{activeMaster\.id\}[\s\S]*?vehicleMaster=\{activeMaster\}/,
    );
  });

  it("resets selections when switching master via the mount key", () => {
    const { harness } = renderPanel();
    const first = CAR_STANDARD_EXTERIOR[0]!;
    act(() => {
      fireEvent.click(chip(first.labelDe, first.id));
    });
    expect(chip(first.labelDe, first.id)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // remount with a fresh key like AdminReferenceView does per activeMaster.id
    const master = harness.master!;
    const { container } = render(
      <ReferenceStoreProvider>
        <CurrentFramingEvidenceRuntimeProvider>
          <OutputPlannerPanel key={master.id} vehicleMaster={master} />
        </CurrentFramingEvidenceRuntimeProvider>
      </ReferenceStoreProvider>,
    );
    const remounted = within(container).getByRole("button", {
      name: `${first.labelDe} · ${first.id}`,
    });
    expect(remounted).toHaveAttribute("aria-pressed", "true");
    act(() => {});
  });
});
