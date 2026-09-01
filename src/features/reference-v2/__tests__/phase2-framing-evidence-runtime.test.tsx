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
