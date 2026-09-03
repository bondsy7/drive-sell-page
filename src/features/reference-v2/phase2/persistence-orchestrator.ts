import { supabase } from "@/integrations/supabase/client";
import type { PerspectiveId } from "../domain/perspectives/types";
import {
  ReferenceAssetRecordSchema,
  VehicleMasterRecordSchema,
  type ReferenceAssetRecord,
  type VehicleMasterRecord,
} from "../phase1/vehicle-master";
import {
  evaluateOutputFormatReadiness,
  type OutputFormat,
  type SourceFramingInput,
} from "../phase1/output-format-policy";
import {
  REFERENCE_V2_STORAGE_BUCKET,
  type ReferenceV2AssetPersistence,
  type ReferenceV2FramingEvidencePersistence,
  type ReferenceV2WorkspacePersistence,
} from "./persistence-contract";
import {
  getDefaultReferenceV2PersistenceRepository,
  type ReferenceV2AssetCreateInput,
  type ReferenceV2PersistenceBundle,
  type ReferenceV2PersistenceRepository,
  type ReferenceV2WorkspaceCreateInput,
} from "./persistence-repository";
import {
  storeReferenceV2Original,
  type ReferenceV2DurableOriginalDescriptor,
  type ReferenceV2StoreOriginalInput,
} from "./original-storage";

/**
 * Reference V2 — Phase 2.6D: Durable orchestration.
 *
 * Verbindet den eingefrorenen Storage-Service (2.6C) mit dem typisierten
 * Repository (2.6B) und dem lokalen Phase-1-Store. Diese Datei enthaelt
 * KEINE eigene Governance, KEINE eigenen Schemata und KEINE Business-
 * Metadaten. `vehicleId` ist ausschliesslich Business-Anker und niemals
 * visuelle Evidenz.
 */

export class ReferenceV2OrchestratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceV2OrchestratorError";
  }
}

// --------------------------------------------------------------------------
// Pure mappers
// --------------------------------------------------------------------------

export function toWorkspaceCreateInput(
  vehicleId: string,
  master: VehicleMasterRecord,
): ReferenceV2WorkspaceCreateInput {
  return {
    vehicleId,
    masterKey: master.id,
    label: master.label,
    vehicleClass: master.vehicleClass,
    colorFamily: master.colorFamily,
    identityClusterId: master.identityClusterId,
    masterVersion: master.version,
    masterHistory: master.history as ReferenceV2WorkspaceCreateInput["masterHistory"],
  };
}

export function toAssetCreateInput(input: {
  readonly workspaceId: string;
  readonly asset: ReferenceAssetRecord;
  readonly descriptor: ReferenceV2DurableOriginalDescriptor;
}): ReferenceV2AssetCreateInput {
  const { workspaceId, asset, descriptor } = input;
  const canonical = asset.intake.pose.canonicalPerspectiveId;
  if (!canonical) {
    throw new ReferenceV2OrchestratorError(
      "Asset ohne kanonische Perspektive kann nicht persistiert werden.",
    );
  }
  return {
    workspaceId,
    assetKey: asset.id,
    requestedPerspectiveId: asset.requestedPerspectiveId,
    canonicalPerspectiveId: canonical,
    fileName: asset.fileName,
    storageBucket: REFERENCE_V2_STORAGE_BUCKET,
    storagePath: descriptor.storagePath,
    mimeType: descriptor.mimeType,
    sizeBytes: descriptor.sizeBytes,
    sha256: descriptor.sha256,
    intake: asset.intake,
    ...(asset.analysis ? { analysis: asset.analysis } : {}),
    scores: asset.scores,
    weightedScore: asset.weightedScore,
    hardFailures: asset.hardFailures,
    blockers: asset.blockers,
    warnings: asset.warnings,
    role: asset.role,
    protection: asset.protection,
    assetVersion: asset.version,
    history: asset.history,
  } as ReferenceV2AssetCreateInput;
}

function outputFormatsFromFraming(
  perspectiveId: PerspectiveId,
  framing: SourceFramingInput | undefined,
): readonly OutputFormat[] {
  if (!framing) return [];
  return evaluateOutputFormatReadiness(perspectiveId, framing)
    .filter((r) => r.ready)
    .map((r) => r.format);
}

/**
 * Rekonstruiert den lokalen Phase-1-Record aus der durablen Persistenz.
 * `previewUrl` ist transient und wird vom Aufrufer geliefert (Signed URL).
 * Fehlt sie, bleibt das Asset ohne Vorschau und wird uebersprungen.
 */
export function hydrateMasterFromBundle(
  bundle: ReferenceV2PersistenceBundle,
  previewUrlByAssetKey: Readonly<Record<string, string>>,
): VehicleMasterRecord {
  const framingByKey = new Map<string, ReferenceV2FramingEvidencePersistence>();
  for (const f of bundle.framingEvidence) framingByKey.set(f.assetKey, f);

  const assets: ReferenceAssetRecord[] = [];
  for (const a of bundle.assets) {
    const previewUrl = previewUrlByAssetKey[a.assetKey];
    if (!previewUrl) continue;
    const framing = framingByKey.get(a.assetKey);
    assets.push(
      ReferenceAssetRecordSchema.parse({
        id: a.assetKey,
        vehicleMasterId: bundle.workspace.masterKey,
        requestedPerspectiveId: a.requestedPerspectiveId,
        fileName: a.fileName,
        previewUrl,
        createdAtIso: a.createdAtIso,
        intake: a.intake,
        ...(a.analysis ? { analysis: a.analysis } : {}),
        scores: a.scores,
        weightedScore: a.weightedScore,
        hardFailures: [...a.hardFailures],
        blockers: [...a.blockers],
        warnings: [...a.warnings],
        role: a.role,
        protection: a.protection,
        outputReadyFormats: [
          ...outputFormatsFromFraming(
            a.canonicalPerspectiveId,
            framing
              ? {
                  sourceAspectRatio: framing.sourceAspectRatio,
                  fullVehicleVisible: framing.fullVehicleVisible,
                  paddingPct: framing.paddingPct,
                }
              : undefined,
          ),
        ],
        version: a.assetVersion,
        history: a.history,
      }),
    );
  }

  return VehicleMasterRecordSchema.parse({
    id: bundle.workspace.masterKey,
    label: bundle.workspace.label,
    vehicleClass: bundle.workspace.vehicleClass,
    colorFamily: bundle.workspace.colorFamily,
    identityClusterId: bundle.workspace.identityClusterId,
    createdAtIso: bundle.workspace.createdAtIso,
    version: bundle.workspace.masterVersion,
    history: bundle.workspace.masterHistory,
    assets,
  });
}

// --------------------------------------------------------------------------
// Orchestrator
// --------------------------------------------------------------------------

export interface ReferenceV2OrchestratorDeps {
  readonly repository: ReferenceV2PersistenceRepository;
  readonly storeOriginal: (
    input: ReferenceV2StoreOriginalInput,
  ) => Promise<ReferenceV2DurableOriginalDescriptor>;
  readonly getAuthenticatedUserId: () => Promise<string | null>;
  readonly createSignedUrl: (
    storagePath: string,
    expiresInSeconds: number,
  ) => Promise<string | null>;
}

export interface PersistAssetInput {
  readonly vehicleId: string;
  readonly workspaceId: string;
  readonly asset: ReferenceAssetRecord;
  readonly file: File;
  readonly framing?: SourceFramingInput;
}

export interface HydratedReferenceV2Master {
  readonly workspace: ReferenceV2WorkspacePersistence;
  readonly master: VehicleMasterRecord;
}

export interface ReferenceV2PersistenceOrchestrator {
  loadMaster(vehicleId: string): Promise<HydratedReferenceV2Master | null>;
  ensureWorkspace(
    vehicleId: string,
    master: VehicleMasterRecord,
  ): Promise<ReferenceV2WorkspacePersistence>;
  persistAsset(input: PersistAssetInput): Promise<ReferenceV2AssetPersistence>;
  deleteAsset(workspaceId: string, assetKey: string): Promise<void>;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function createReferenceV2PersistenceOrchestrator(
  deps: ReferenceV2OrchestratorDeps,
): ReferenceV2PersistenceOrchestrator {
  async function requireUserId(): Promise<string> {
    const userId = await deps.getAuthenticatedUserId();
    if (!userId) {
      throw new ReferenceV2OrchestratorError(
        "Keine authentifizierte Sitzung — Referenzen können nicht gespeichert werden.",
      );
    }
    return userId;
  }

  return {
    async loadMaster(vehicleId) {
      const bundle = await deps.repository.loadBundleByVehicleId(vehicleId);
      if (!bundle) return null;

      const previewUrlByAssetKey: Record<string, string> = {};
      await Promise.all(
        bundle.assets.map(async (a) => {
          try {
            const url = await deps.createSignedUrl(
              a.storagePath,
              SIGNED_URL_TTL_SECONDS,
            );
            if (url) previewUrlByAssetKey[a.assetKey] = url;
          } catch {
            /* fail-closed: Asset ohne Vorschau wird ausgelassen */
          }
        }),
      );

      return {
        workspace: bundle.workspace,
        master: hydrateMasterFromBundle(bundle, previewUrlByAssetKey),
      };
    },

    async ensureWorkspace(vehicleId, master) {
      const existing = await deps.repository.loadBundleByVehicleId(vehicleId);
      if (existing) return existing.workspace;
      return deps.repository.createWorkspace(
        toWorkspaceCreateInput(vehicleId, master),
      );
    },

    async persistAsset({ vehicleId, workspaceId, asset, file, framing }) {
      const userId = await requireUserId();

      const descriptor = await deps.storeOriginal({
        file,
        userId,
        vehicleId,
        workspaceId,
        assetKey: asset.id,
      });

      const persisted = await deps.repository.createAsset(
        toAssetCreateInput({ workspaceId, asset, descriptor }),
      );

      if (framing) {
        await deps.repository.upsertFramingEvidence({
          schemaVersion: 1,
          workspaceId,
          userId: persisted.userId,
          assetKey: asset.id,
          sourceAspectRatio: framing.sourceAspectRatio,
          fullVehicleVisible: framing.fullVehicleVisible,
          cropped: !framing.fullVehicleVisible,
          paddingPct: framing.paddingPct,
          updatedAtIso: new Date().toISOString(),
        } as ReferenceV2FramingEvidencePersistence);
      }

      return persisted;
    },

    async deleteAsset(workspaceId, assetKey) {
      await deps.repository.deleteAsset(workspaceId, assetKey);
    },
  };
}

// --------------------------------------------------------------------------
// Production wiring
// --------------------------------------------------------------------------

export function createDefaultReferenceV2Orchestrator(): ReferenceV2PersistenceOrchestrator {
  return createReferenceV2PersistenceOrchestrator({
    repository: getDefaultReferenceV2PersistenceRepository(),
    storeOriginal: storeReferenceV2Original,
    async getAuthenticatedUserId() {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data?.user?.id ?? null;
    },
    async createSignedUrl(storagePath, expiresInSeconds) {
      const { data, error } = await supabase.storage
        .from(REFERENCE_V2_STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}
