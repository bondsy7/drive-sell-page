import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { VehicleClassV2 } from "../domain/vehicle-classes";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type { ColorFamily } from "./color-families";
import type { SourceFramingInput } from "./output-format-policy";
import {
  canBecomePrimary,
  computeCompletenessWarnings,
  computeCoverage,
  evaluateIngestion,
} from "./ingestion";
import {
  ReferenceAssetRecordSchema,
  VehicleMasterRecordSchema,
  type AssetHistoryEntry,
  type CompletenessWarning,
  type PerspectiveCoverage,
  type ReferenceAssetRecord,
  type VehicleMasterRecord,
} from "./vehicle-master";

/**
 * Reference V2 — Phase 1: Local ingestion/review store.
 *
 * Bewusst frontend-/local-state-basiert: kein DB-Schema, kein Backend-Call.
 * Jede Mutation ist versioniert und protokolliert (Asset-Historie), damit
 * geschuetzte Assets nachvollziehbar bleiben.
 */

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function historyEntry(
  version: number,
  action: string,
  detail?: string,
): AssetHistoryEntry {
  return {
    version,
    atIso: new Date().toISOString(),
    action,
    ...(detail ? { detail } : {}),
  };
}

export interface CreateMasterInput {
  readonly label: string;
  readonly vehicleClass: VehicleClassV2;
  readonly colorFamily: ColorFamily | null;
}

export interface IngestAssetInput {
  readonly vehicleMasterId: string;
  readonly requestedPerspectiveId: PerspectiveId;
  readonly fileName: string;
  readonly previewUrl: string;
  readonly intake: VisionIntakeResult;
  readonly framing: SourceFramingInput;
  readonly fileAvailable: boolean;
}

export class ProtectedAssetError extends Error {
  constructor(assetId: string) {
    super(`Asset ${assetId} ist geschützt und kann nicht verändert werden.`);
    this.name = "ProtectedAssetError";
  }
}

interface ReferenceStoreValue {
  readonly masters: readonly VehicleMasterRecord[];
  readonly activeMasterId: string | null;
  readonly activeMaster: VehicleMasterRecord | null;
  readonly coverage: readonly PerspectiveCoverage[];
  readonly warnings: readonly CompletenessWarning[];
  setActiveMasterId(id: string | null): void;
  createMaster(input: CreateMasterInput): VehicleMasterRecord;
  setColorFamily(masterId: string, colorFamily: ColorFamily): void;
  ingestAsset(input: IngestAssetInput): ReferenceAssetRecord;
  promoteToPrimary(masterId: string, assetId: string): void;
  toggleProtection(masterId: string, assetId: string): void;
  removeAsset(masterId: string, assetId: string): void;
}

const ReferenceStoreContext = createContext<ReferenceStoreValue | null>(null);

export function ReferenceStoreProvider({ children }: { children: ReactNode }) {
  const [masters, setMasters] = useState<VehicleMasterRecord[]>([]);
  const [activeMasterId, setActiveMasterId] = useState<string | null>(null);

  const mutateMaster = useCallback(
    (
      masterId: string,
      action: string,
      fn: (master: VehicleMasterRecord) => VehicleMasterRecord,
    ) => {
      setMasters((prev) =>
        prev.map((m) => {
          if (m.id !== masterId) return m;
          const next = fn(m);
          const version = m.version + 1;
          return VehicleMasterRecordSchema.parse({
            ...next,
            version,
            history: [...m.history, historyEntry(version, action)],
          });
        }),
      );
    },
    [],
  );

  const createMaster = useCallback((input: CreateMasterInput) => {
    const nowIso = new Date().toISOString();
    const record = VehicleMasterRecordSchema.parse({
      id: uid("vm"),
      label: input.label,
      vehicleClass: input.vehicleClass,
      colorFamily: input.colorFamily,
      identityClusterId: uid("idc"),
      createdAtIso: nowIso,
      version: 1,
      history: [historyEntry(1, "master_created")],
      assets: [],
    } satisfies VehicleMasterRecord);
    setMasters((prev) => [...prev, record]);
    setActiveMasterId(record.id);
    return record;
  }, []);

  const setColorFamily = useCallback(
    (masterId: string, colorFamily: ColorFamily) => {
      mutateMaster(masterId, `color_family:${colorFamily}`, (m) => ({
        ...m,
        colorFamily,
      }));
    },
    [mutateMaster],
  );

  const ingestAsset = useCallback(
    (input: IngestAssetInput) => {
      const master = masters.find((m) => m.id === input.vehicleMasterId);
      if (!master) throw new Error(`Unbekannter Vehicle Master ${input.vehicleMasterId}`);

      const evaluation = evaluateIngestion({
        vehicleClass: master.vehicleClass,
        identityClusterId: master.identityClusterId,
        requestedPerspectiveId: input.requestedPerspectiveId,
        intake: input.intake,
        framing: input.framing,
        fileAvailable: input.fileAvailable,
      });

      const asset = ReferenceAssetRecordSchema.parse({
        id: uid("ref"),
        vehicleMasterId: master.id,
        requestedPerspectiveId: input.requestedPerspectiveId,
        fileName: input.fileName,
        previewUrl: input.previewUrl,
        createdAtIso: new Date().toISOString(),
        intake: input.intake,
        scores: evaluation.scores,
        weightedScore: evaluation.weightedScore,
        hardFailures: [...evaluation.hardFailures],
        blockers: [...evaluation.blockers],
        warnings: [...evaluation.warnings],
        role: evaluation.role,
        protection: "unprotected",
        outputReadyFormats: [...evaluation.outputReadyFormats],
        version: 1,
        history: [
          historyEntry(1, `ingested:${evaluation.role}`, input.fileName),
        ],
      } satisfies ReferenceAssetRecord);

      mutateMaster(master.id, `asset_ingested:${asset.id}`, (m) => ({
        ...m,
        assets: [...m.assets, asset],
      }));
      return asset;
    },
    [masters, mutateMaster],
  );

  const promoteToPrimary = useCallback(
    (masterId: string, assetId: string) => {
      mutateMaster(masterId, `primary_set:${assetId}`, (m) => {
        const target = m.assets.find((a) => a.id === assetId);
        if (!target) return m;
        if (!canBecomePrimary(target)) {
          throw new Error(
            "Nur blockerfreie, exakt passende Referenzen dürfen Primärreferenz werden.",
          );
        }
        return {
          ...m,
          assets: m.assets.map((a) => {
            if (a.requestedPerspectiveId !== target.requestedPerspectiveId) return a;
            if (a.id === assetId) {
              return {
                ...a,
                role: "primary" as const,
                version: a.version + 1,
                history: [
                  ...a.history,
                  historyEntry(a.version + 1, "promoted_to_primary"),
                ],
              };
            }
            if (a.role === "primary") {
              if (a.protection === "protected") throw new ProtectedAssetError(a.id);
              return {
                ...a,
                role: "primary_candidate" as const,
                version: a.version + 1,
                history: [
                  ...a.history,
                  historyEntry(a.version + 1, "demoted_from_primary"),
                ],
              };
            }
            return a;
          }),
        };
      });
    },
    [mutateMaster],
  );

  const toggleProtection = useCallback(
    (masterId: string, assetId: string) => {
      mutateMaster(masterId, `protection_toggled:${assetId}`, (m) => ({
        ...m,
        assets: m.assets.map((a) =>
          a.id === assetId
            ? {
                ...a,
                protection:
                  a.protection === "protected"
                    ? ("unprotected" as const)
                    : ("protected" as const),
                version: a.version + 1,
                history: [
                  ...a.history,
                  historyEntry(
                    a.version + 1,
                    a.protection === "protected" ? "unprotected" : "protected",
                  ),
                ],
              }
            : a,
        ),
      }));
    },
    [mutateMaster],
  );

  const removeAsset = useCallback(
    (masterId: string, assetId: string) => {
      mutateMaster(masterId, `asset_removed:${assetId}`, (m) => {
        const target = m.assets.find((a) => a.id === assetId);
        if (target?.protection === "protected") {
          throw new ProtectedAssetError(assetId);
        }
        return { ...m, assets: m.assets.filter((a) => a.id !== assetId) };
      });
    },
    [mutateMaster],
  );

  const activeMaster = useMemo(
    () => masters.find((m) => m.id === activeMasterId) ?? null,
    [masters, activeMasterId],
  );

  const coverage = useMemo(
    () => (activeMaster ? computeCoverage(activeMaster) : []),
    [activeMaster],
  );

  const warnings = useMemo(
    () => (activeMaster ? computeCompletenessWarnings(activeMaster) : []),
    [activeMaster],
  );

  const value: ReferenceStoreValue = {
    masters,
    activeMasterId,
    activeMaster,
    coverage,
    warnings,
    setActiveMasterId,
    createMaster,
    setColorFamily,
    ingestAsset,
    promoteToPrimary,
    toggleProtection,
    removeAsset,
  };

  return (
    <ReferenceStoreContext.Provider value={value}>
      {children}
    </ReferenceStoreContext.Provider>
  );
}

export function useReferenceStore(): ReferenceStoreValue {
  const ctx = useContext(ReferenceStoreContext);
  if (!ctx) {
    throw new Error("useReferenceStore must be used within ReferenceStoreProvider");
  }
  return ctx;
}
