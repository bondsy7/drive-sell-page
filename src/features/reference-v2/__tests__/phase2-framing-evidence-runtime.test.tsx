import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import {
  CurrentFramingEvidenceRuntimeProvider,
  useCurrentFramingEvidenceRuntime,
  type CurrentFramingEvidenceRuntimeValue,
} from "../phase2/framing-evidence-runtime";
import { CurrentFramingEvidenceSidecarError } from "../phase2/framing-evidence-sidecar";
import { CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION } from "../phase2/framing-evidence";
import {
  ReferenceStoreProvider,
  useReferenceStore,
} from "../phase1/reference-store";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";


/**
 * Phase 2.4D — Runtime-Traeger fuer aktuelle Framing-Evidenz.
 */

const FACTS = {
  sourceAspectRatio: 1.25,
  fullVehicleVisible: true,
  cropped: false,
  paddingPct: 38,
};

type StoreValue = ReturnType<typeof useReferenceStore>;

interface Harness {
  runtime: CurrentFramingEvidenceRuntimeValue;
  store: StoreValue;
}

function renderHarness() {
  const harness: Harness = {} as Harness;
  function Probe() {
    harness.runtime = useCurrentFramingEvidenceRuntime();
    harness.store = useReferenceStore();
    return null;
  }
  const wrapper = (children: ReactNode) => (
    <ReferenceStoreProvider>
      <CurrentFramingEvidenceRuntimeProvider>
        {children}
      </CurrentFramingEvidenceRuntimeProvider>
    </ReferenceStoreProvider>
  );
  render(wrapper(<Probe />));
  return harness;
}

describe("Phase 2.4D — CurrentFramingEvidenceRuntimeProvider", () => {
  it("starts empty per master", () => {
    const h = renderHarness();
    expect(h.runtime.getCurrentFramingEvidenceSidecar("vm_1").byAssetId).toEqual(
      {},
    );
    expect(
      h.runtime.currentFramingEvidenceForMasterPlanner("vm_1", []),
    ).toEqual([]);
  });

  it("records facts under the persisted asset id exactly", () => {
    const h = renderHarness();
    act(() => h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS));
    const sidecar = h.runtime.getCurrentFramingEvidenceSidecar("vm_1");
    expect(sidecar.byAssetId.ref_1).toEqual({
      schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
      assetId: "ref_1",
      ...FACTS,
    });
  });

  it("isolates evidence between masters", () => {
    const h = renderHarness();
    act(() => {
      h.runtime.recordCurrentFramingEvidence("vm_a", "ref_1", FACTS);
      h.runtime.recordCurrentFramingEvidence("vm_b", "ref_2", FACTS);
    });
    expect(
      Object.keys(h.runtime.getCurrentFramingEvidenceSidecar("vm_a").byAssetId),
    ).toEqual(["ref_1"]);
    expect(
      Object.keys(h.runtime.getCurrentFramingEvidenceSidecar("vm_b").byAssetId),
    ).toEqual(["ref_2"]);
  });

  it("replaces the same persisted asset without duplication", () => {
    const h = renderHarness();
    act(() => {
      h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS);
      h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", {
        ...FACTS,
        cropped: true,
      });
    });
    const sidecar = h.runtime.getCurrentFramingEvidenceSidecar("vm_1");
    expect(Object.keys(sidecar.byAssetId)).toEqual(["ref_1"]);
    expect(sidecar.byAssetId.ref_1.cropped).toBe(true);
  });

  it("returns safe copies from getter and planner projection", () => {
    const h = renderHarness();
    act(() => h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS));
    const copy = h.runtime.getCurrentFramingEvidenceSidecar("vm_1");
    copy.byAssetId.ref_1.paddingPct = 999;
    delete copy.byAssetId.ref_1;
    const projected = h.runtime.currentFramingEvidenceForMasterPlanner("vm_1", [
      "ref_1",
    ]);
    projected[0]!.paddingPct = 111;
    expect(
      h.runtime.getCurrentFramingEvidenceSidecar("vm_1").byAssetId.ref_1
        .paddingPct,
    ).toBe(38);
  });

  it("keeps missing evidence missing", () => {
    const h = renderHarness();
    act(() => h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS));
    const projected = h.runtime.currentFramingEvidenceForMasterPlanner("vm_1", [
      "ref_1",
      "ref_2",
    ]);
    expect(projected.map((e) => e.assetId)).toEqual(["ref_1"]);
  });

  it("throws fail-closed on stale evidence in the projection", () => {
    const h = renderHarness();
    act(() => h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS));
    expect(() =>
      h.runtime.currentFramingEvidenceForMasterPlanner("vm_1", ["ref_2"]),
    ).toThrow(CurrentFramingEvidenceSidecarError);
  });

  it("removes evidence explicitly", () => {
    const h = renderHarness();
    act(() => {
      h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS);
      h.runtime.removeCurrentFramingEvidenceForAsset("vm_1", "ref_1");
    });
    expect(h.runtime.getCurrentFramingEvidenceSidecar("vm_1").byAssetId).toEqual(
      {},
    );
  });

  it("prunes evidence explicitly", () => {
    const h = renderHarness();
    act(() => {
      h.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS);
      h.runtime.recordCurrentFramingEvidence("vm_1", "ref_2", FACTS);
      h.runtime.pruneCurrentFramingEvidenceForMaster("vm_1", ["ref_2"]);
    });
    expect(
      Object.keys(h.runtime.getCurrentFramingEvidenceSidecar("vm_1").byAssetId),
    ).toEqual(["ref_2"]);
  });

  it("keeps other masters intact when one master is worked on", () => {
    const h = renderHarness();
    act(() => {
      h.runtime.recordCurrentFramingEvidence("vm_a", "ref_1", FACTS);
      h.runtime.recordCurrentFramingEvidence("vm_b", "ref_2", FACTS);
      h.runtime.pruneCurrentFramingEvidenceForMaster("vm_a", []);
    });
    expect(h.runtime.getCurrentFramingEvidenceSidecar("vm_a").byAssetId).toEqual(
      {},
    );
    expect(
      Object.keys(h.runtime.getCurrentFramingEvidenceSidecar("vm_b").byAssetId),
    ).toEqual(["ref_2"]);
  });

  it("lifecycle prune drops evidence for masters that never existed in the store", () => {
    const h = renderHarness();
    let masterId = "";
    act(() => {
      masterId = h.store.createMaster({
        label: "Testfahrzeug",
        vehicleClass: "car",
        colorFamily: "grey",
      }).id;
    });
    act(() => {
      h.runtime.recordCurrentFramingEvidence(masterId, "ref_committed", FACTS);
      h.runtime.recordCurrentFramingEvidence("vm_ghost", "ref_ghost", FACTS);
    });
    act(() => {
      // Erzwingt einen weiteren Store-Commit, damit der Lifecycle-Effekt laeuft.
      h.store.setColorFamily(masterId, "blue");
    });
    expect(
      h.runtime.getCurrentFramingEvidenceSidecar("vm_ghost").byAssetId,
    ).toEqual({});
    // Der committete Master hat noch keine Assets -> Evidenz faellt fail-closed weg.
    expect(
      h.runtime.getCurrentFramingEvidenceSidecar(masterId).byAssetId,
    ).toEqual({});
  });
});

// --------------------------------------------------------------------------
// Phase 2.4D Final Hardening — Context-Reaktivitaet + echte Store-Lifecycle
// --------------------------------------------------------------------------

const P_34_FRONT_LEFT: PerspectiveId = "EXT_34_FRONT_LEFT";

function intakeFor(clusterId: string): VisionIntakeResult {
  return {
    schemaVersion: 1,
    assetId: "transient_asset",
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: clusterId,
    sameVehicleConfidence: 0.99,
    pose: {
      canonicalPerspectiveId: P_34_FRONT_LEFT,
      azimuthDeg: -45,
      elevationProfile: "eye_level",
    },
    visibility: { front: 0.95, rear: 0.2, leftSide: 0.95, rightSide: 0.2, roof: 0.6 },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: [
        "front_left",
        "front_right",
        "rear_left",
        "rear_right",
      ],
    },
    quality: {
      sharpness: 0.9,
      occlusion: 0.02,
      glare: 0.05,
      resolutionAdequacy: 0.95,
      usableScore: 0.92,
    },
    classificationConfidence: 0.95,
    issues: [],
  } as unknown as VisionIntakeResult;
}

function ingestInto(store: StoreValue, masterId: string, clusterId: string) {
  return store.ingestAsset({
    vehicleMasterId: masterId,
    requestedPerspectiveId: P_34_FRONT_LEFT,
    fileName: "ref.jpg",
    previewUrl: "blob:preview",
    intake: intakeFor(clusterId),
    framing: {
      sourceAspectRatio: 3 / 2,
      fullVehicleVisible: true,
      paddingPct: 20,
    },
    fileAvailable: true,
    isAutomatic: true,
  });
}

describe("Phase 2.4D — React context reactivity", () => {
  it("re-renders a consumer that reads evidence DURING render", async () => {
    const harness: Harness = {} as Harness;

    function Consumer() {
      // Lesen waehrend des Renderns — nur ein neuer Context-Wert kann hier
      // ein automatisches Re-Render ausloesen.
      const runtime = useCurrentFramingEvidenceRuntime();
      const ids = Object.keys(
        runtime.getCurrentFramingEvidenceSidecar("vm_1").byAssetId,
      );
      return <div data-testid="ids">{ids.length === 0 ? "none" : ids.join(",")}</div>;
    }

    function Controller() {
      harness.runtime = useCurrentFramingEvidenceRuntime();
      return null;
    }

    render(
      <ReferenceStoreProvider>
        <CurrentFramingEvidenceRuntimeProvider>
          <Controller />
          <Consumer />
        </CurrentFramingEvidenceRuntimeProvider>
      </ReferenceStoreProvider>,
    );

    expect(screen.getByTestId("ids").textContent).toBe("none");

    act(() => harness.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS));
    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("ref_1"),
    );

    act(() => harness.runtime.recordCurrentFramingEvidence("vm_1", "ref_2", FACTS));
    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("ref_1,ref_2"),
    );

    act(() => harness.runtime.pruneCurrentFramingEvidenceForMaster("vm_1", ["ref_2"]));
    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("ref_2"),
    );

    act(() => harness.runtime.removeCurrentFramingEvidenceForAsset("vm_1", "ref_2"));
    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("none"),
    );
  });

  it("binds the context value to sidecar state so reactivity cannot be weakened", async () => {
    const seen: CurrentFramingEvidenceRuntimeValue[] = [];
    function Probe() {
      seen.push(useCurrentFramingEvidenceRuntime());
      return null;
    }
    const harness: Harness = {} as Harness;
    function Controller() {
      harness.runtime = useCurrentFramingEvidenceRuntime();
      return null;
    }
    render(
      <ReferenceStoreProvider>
        <CurrentFramingEvidenceRuntimeProvider>
          <Controller />
          <Probe />
        </CurrentFramingEvidenceRuntimeProvider>
      </ReferenceStoreProvider>,
    );
    const before = seen[seen.length - 1];
    act(() => harness.runtime.recordCurrentFramingEvidence("vm_1", "ref_1", FACTS));
    await waitFor(() => expect(seen[seen.length - 1]).not.toBe(before));
  });
});

describe("Phase 2.4D — real committed store lifecycle", () => {
  it("prunes evidence when a committed unprotected asset is removed", async () => {
    const h = renderHarness();
    let masterId = "";
    let clusterId = "";
    act(() => {
      const m = h.store.createMaster({
        label: "Testfahrzeug",
        vehicleClass: "car",
        colorFamily: "grey",
      });
      masterId = m.id;
      clusterId = m.identityClusterId;
    });
    let assetId = "";
    act(() => {
      assetId = ingestInto(h.store, masterId, clusterId).id;
    });
    await waitFor(() =>
      expect(
        h.store.masters.find((m) => m.id === masterId)?.assets.map((a) => a.id),
      ).toEqual([assetId]),
    );
    act(() => h.runtime.recordCurrentFramingEvidence(masterId, assetId, FACTS));
    expect(
      Object.keys(h.runtime.getCurrentFramingEvidenceSidecar(masterId).byAssetId),
    ).toEqual([assetId]);

    act(() => h.store.removeAsset(masterId, assetId));
    await waitFor(() =>
      expect(
        h.runtime.getCurrentFramingEvidenceSidecar(masterId).byAssetId,
      ).toEqual({}),
    );
  });

  it("keeps evidence when removal of a protected asset fails", async () => {
    const h = renderHarness();
    let masterId = "";
    let clusterId = "";
    act(() => {
      const m = h.store.createMaster({
        label: "Testfahrzeug",
        vehicleClass: "car",
        colorFamily: "grey",
      });
      masterId = m.id;
      clusterId = m.identityClusterId;
    });
    let assetId = "";
    act(() => {
      assetId = ingestInto(h.store, masterId, clusterId).id;
    });
    act(() => h.runtime.recordCurrentFramingEvidence(masterId, assetId, FACTS));
    act(() => h.store.toggleProtection(masterId, assetId));
    await waitFor(() =>
      expect(
        h.store.masters
          .find((m) => m.id === masterId)
          ?.assets.find((a) => a.id === assetId)?.protection,
      ).toBe("protected"),
    );

    expect(() => {
      act(() => h.store.removeAsset(masterId, assetId));
    }).toThrow();

    // Asset bleibt committed, Evidenz darf NIE durch einen fehlgeschlagenen
    // Entfernversuch verschwinden.
    expect(
      h.store.masters.find((m) => m.id === masterId)?.assets.map((a) => a.id),
    ).toEqual([assetId]);
    expect(
      Object.keys(h.runtime.getCurrentFramingEvidenceSidecar(masterId).byAssetId),
    ).toEqual([assetId]);
  });

  it("keeps both sidecars intact when the active master switches", async () => {
    const h = renderHarness();
    let a = { id: "", cluster: "" };
    let b = { id: "", cluster: "" };
    act(() => {
      const ma = h.store.createMaster({
        label: "A",
        vehicleClass: "car",
        colorFamily: "grey",
      });
      a = { id: ma.id, cluster: ma.identityClusterId };
    });
    act(() => {
      const mb = h.store.createMaster({
        label: "B",
        vehicleClass: "car",
        colorFamily: "blue",
      });
      b = { id: mb.id, cluster: mb.identityClusterId };
    });
    let assetA = "";
    let assetB = "";
    act(() => {
      assetA = ingestInto(h.store, a.id, a.cluster).id;
    });
    act(() => {
      assetB = ingestInto(h.store, b.id, b.cluster).id;
    });
    act(() => {
      h.runtime.recordCurrentFramingEvidence(a.id, assetA, FACTS);
      h.runtime.recordCurrentFramingEvidence(b.id, assetB, FACTS);
    });

    act(() => h.store.setActiveMasterId(a.id));
    act(() => h.store.setActiveMasterId(b.id));
    act(() => h.store.setActiveMasterId(a.id));

    await waitFor(() => {
      expect(
        Object.keys(h.runtime.getCurrentFramingEvidenceSidecar(a.id).byAssetId),
      ).toEqual([assetA]);
      expect(
        Object.keys(h.runtime.getCurrentFramingEvidenceSidecar(b.id).byAssetId),
      ).toEqual([assetB]);
    });
  });
});
