import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReferenceStore } from "../phase1/reference-store";
import type { CurrentFramingEvidence } from "./framing-evidence";
import {
  createCurrentFramingEvidenceForAsset,
  currentFramingEvidenceForPlanner,
  emptyCurrentFramingEvidenceSidecar,
  parseCurrentFramingEvidenceSidecar,
  pruneCurrentFramingEvidence,
  removeCurrentFramingEvidence,
  upsertCurrentFramingEvidence,
  type CurrentFramingEvidenceSidecar,
} from "./framing-evidence-sidecar";

/**
 * Reference V2 — Phase 2.4D: Runtime-Traeger fuer aktuelle Framing-Evidenz.
 *
 * Der Runtime haelt PRO Vehicle Master genau EINEN eingefrorenen 2.4C-Sidecar.
 * Saemtliche Sidecar-Semantik (create/upsert/remove/prune/projection) stammt
 * ausschliesslich aus Phase 2.4C — hier wird nichts dupliziert. Schluessel ist
 * immer die PERSISTIERTE Referenz-Asset-ID des ReferenceStore.
 */

export interface CurrentFramingEvidenceRuntimeValue {
  recordCurrentFramingEvidence(
    vehicleMasterId: string,
    persistedAssetId: string,
    rawFacts: unknown,
  ): void;
  removeCurrentFramingEvidenceForAsset(
    vehicleMasterId: string,
    persistedAssetId: string,
  ): void;
  pruneCurrentFramingEvidenceForMaster(
    vehicleMasterId: string,
    knownAssetIds: readonly string[],
  ): void;
  currentFramingEvidenceForMasterPlanner(
    vehicleMasterId: string,
    knownAssetIds: readonly string[],
  ): CurrentFramingEvidence[];
  /** Sichere Kopie — Mutation durch Aufrufer veraendert den Runtime nie. */
  getCurrentFramingEvidenceSidecar(
    vehicleMasterId: string,
  ): CurrentFramingEvidenceSidecar;
}

const RuntimeContext = createContext<CurrentFramingEvidenceRuntimeValue | null>(
  null,
);

function cloneSidecar(
  sidecar: CurrentFramingEvidenceSidecar,
): CurrentFramingEvidenceSidecar {
  return parseCurrentFramingEvidenceSidecar({
    byAssetId: Object.fromEntries(
      Object.keys(sidecar.byAssetId).map((key) => [
        key,
        {
          ...(Object.getOwnPropertyDescriptor(sidecar.byAssetId, key)
            ?.value as CurrentFramingEvidence),
        },
      ]),
    ),
  });
}

export function CurrentFramingEvidenceRuntimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { masters } = useReferenceStore();
  const [sidecars, setSidecars] = useState<
    ReadonlyMap<string, CurrentFramingEvidenceSidecar>
  >(() => new Map());
  const sidecarsRef = useRef(sidecars);
  sidecarsRef.current = sidecars;

  const readSidecar = useCallback(
    (vehicleMasterId: string): CurrentFramingEvidenceSidecar =>
      sidecarsRef.current.get(vehicleMasterId) ??
      emptyCurrentFramingEvidenceSidecar(),
    [],
  );

  const writeSidecar = useCallback(
    (
      vehicleMasterId: string,
      next: (current: CurrentFramingEvidenceSidecar) => CurrentFramingEvidenceSidecar,
    ) => {
      const current = readSidecar(vehicleMasterId);
      const updated = next(current);
      const map = new Map(sidecarsRef.current);
      map.set(vehicleMasterId, updated);
      sidecarsRef.current = map;
      setSidecars(map);
    },
    [readSidecar],
  );

  const recordCurrentFramingEvidence = useCallback(
    (vehicleMasterId: string, persistedAssetId: string, rawFacts: unknown) => {
      const evidence = createCurrentFramingEvidenceForAsset(
        persistedAssetId,
        rawFacts,
      );
      writeSidecar(vehicleMasterId, (current) =>
        upsertCurrentFramingEvidence(current, evidence),
      );
    },
    [writeSidecar],
  );

  const removeCurrentFramingEvidenceForAsset = useCallback(
    (vehicleMasterId: string, persistedAssetId: string) => {
      writeSidecar(vehicleMasterId, (current) =>
        removeCurrentFramingEvidence(current, persistedAssetId),
      );
    },
    [writeSidecar],
  );

  const pruneCurrentFramingEvidenceForMaster = useCallback(
    (vehicleMasterId: string, knownAssetIds: readonly string[]) => {
      writeSidecar(vehicleMasterId, (current) =>
        pruneCurrentFramingEvidence(current, [...knownAssetIds]),
      );
    },
    [writeSidecar],
  );

  const currentFramingEvidenceForMasterPlanner = useCallback(
    (vehicleMasterId: string, knownAssetIds: readonly string[]) =>
      currentFramingEvidenceForPlanner(readSidecar(vehicleMasterId), [
        ...knownAssetIds,
      ]),
    [readSidecar],
  );

  const getCurrentFramingEvidenceSidecar = useCallback(
    (vehicleMasterId: string) => cloneSidecar(readSidecar(vehicleMasterId)),
    [readSidecar],
  );

  // Lifecycle: committete Master/Assets sind alleinige Wahrheit ueber
  // Existenz. Veraltete Evidenz wird ueber die eingefrorene 2.4C-Prune-
  // Semantik entfernt, Sidecars geloeschter Master verschwinden komplett.
  useEffect(() => {
    const current = sidecarsRef.current;
    if (current.size === 0) return;
    const liveIds = new Set(masters.map((m) => m.id));
    let changed = false;
    const next = new Map<string, CurrentFramingEvidenceSidecar>();
    for (const [masterId, sidecar] of current) {
      if (!liveIds.has(masterId)) {
        changed = true;
        continue;
      }
      const master = masters.find((m) => m.id === masterId);
      const pruned = pruneCurrentFramingEvidence(
        sidecar,
        (master?.assets ?? []).map((a) => a.id),
      );
      if (
        Object.keys(pruned.byAssetId).length !==
        Object.keys(sidecar.byAssetId).length
      ) {
        changed = true;
        next.set(masterId, pruned);
      } else {
        next.set(masterId, sidecar);
      }
    }
    if (changed) {
      sidecarsRef.current = next;
      setSidecars(next);
    }
  }, [masters]);

  // WICHTIG: `sidecars` gehoert in die Abhaengigkeiten, damit der Context-Wert
  // bei jeder committeten Sidecar-Aenderung eine neue Identitaet bekommt und
  // Consumer, die waehrend des Renderns lesen, zuverlaessig neu rendern.
  const value = useMemo<CurrentFramingEvidenceRuntimeValue>(
    () => ({
      recordCurrentFramingEvidence,
      removeCurrentFramingEvidenceForAsset,
      pruneCurrentFramingEvidenceForMaster,
      currentFramingEvidenceForMasterPlanner,
      getCurrentFramingEvidenceSidecar,
    }),
    [
      sidecars,
      recordCurrentFramingEvidence,
      removeCurrentFramingEvidenceForAsset,
      pruneCurrentFramingEvidenceForMaster,
      currentFramingEvidenceForMasterPlanner,
      getCurrentFramingEvidenceSidecar,
    ],
  );


  return (
    <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
  );
}

export function useCurrentFramingEvidenceRuntime(): CurrentFramingEvidenceRuntimeValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    throw new Error(
      "useCurrentFramingEvidenceRuntime must be used within CurrentFramingEvidenceRuntimeProvider",
    );
  }
  return ctx;
}
