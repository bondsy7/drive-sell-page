import { describe, expect, it, vi } from "vitest";
import {
  ReferenceV2OrchestratorError,
  createReferenceV2PersistenceOrchestrator,
  toAssetCreateInput,
  toWorkspaceCreateInput,
} from "../phase2/persistence-orchestrator";
import type { ReferenceAssetRecord, VehicleMasterRecord } from "../phase1/vehicle-master";

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

function master(): VehicleMasterRecord {
  return {
    id: "vm_test",
    label: "Referenzfahrzeug A",
    vehicleClass: "car",
    colorFamily: "grey",
    identityClusterId: "idc_test",
    createdAtIso: "2026-01-01T00:00:00.000Z",
    version: 1,
    history: [
      { version: 1, atIso: "2026-01-01T00:00:00.000Z", action: "master_created" },
    ],
    assets: [],
  } as VehicleMasterRecord;
}

function asset(
  overrides: Partial<ReferenceAssetRecord> = {},
): ReferenceAssetRecord {
  return {
    id: "ref_1",
    vehicleMasterId: "vm_test",
    requestedPerspectiveId: "exterior_front_34_left",
    fileName: "a.jpg",
    previewUrl: "blob:preview",
    createdAtIso: "2026-01-01T00:00:00.000Z",
    intake: {
      pose: { canonicalPerspectiveId: "exterior_front_34_left" },
    },
    scores: {},
    weightedScore: 90,
    hardFailures: [],
    blockers: [],
    warnings: [],
    role: "primary_candidate",
    protection: "unprotected",
    outputReadyFormats: [],
    version: 1,
    history: [
      { version: 1, atIso: "2026-01-01T00:00:00.000Z", action: "ingested" },
    ],
    ...overrides,
  } as unknown as ReferenceAssetRecord;
}

const descriptor = {
  storagePath: `u/${VEHICLE_ID}/reference-v2/${WORKSPACE_ID}/ref_1/original.jpg`,
  mimeType: "image/jpeg",
  sizeBytes: 1234,
  sha256: "a".repeat(64),
} as never;

describe("Phase 2.6D — persistence orchestrator", () => {
  it("maps a master to a workspace create input without business metadata", () => {
    const input = toWorkspaceCreateInput(VEHICLE_ID, master());
    expect(input.vehicleId).toBe(VEHICLE_ID);
    expect(input.masterKey).toBe("vm_test");
    expect(JSON.stringify(input)).not.toMatch(/vin|brand|model/i);
  });

  it("refuses assets without a canonical perspective (fail-closed)", () => {
    expect(() =>
      toAssetCreateInput({
        workspaceId: WORKSPACE_ID,
        asset: asset({ intake: { pose: {} } as never }),
        descriptor,
      }),
    ).toThrow(ReferenceV2OrchestratorError);
  });

  it("carries storage descriptor facts into the asset create input", () => {
    const input = toAssetCreateInput({
      workspaceId: WORKSPACE_ID,
      asset: asset(),
      descriptor,
    });
    expect(input.sha256).toBe("a".repeat(64));
    expect(input.storagePath).toContain(WORKSPACE_ID);
    expect(input.canonicalPerspectiveId).toBe("exterior_front_34_left");
  });

  it("fails closed when no authenticated user is available", async () => {
    const orchestrator = createReferenceV2PersistenceOrchestrator({
      repository: {} as never,
      storeOriginal: vi.fn(),
      getAuthenticatedUserId: async () => null,
      createSignedUrl: async () => null,
    });
    await expect(
      orchestrator.persistAsset({
        vehicleId: VEHICLE_ID,
        workspaceId: WORKSPACE_ID,
        asset: asset(),
        file: new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }),
      }),
    ).rejects.toBeInstanceOf(ReferenceV2OrchestratorError);
  });

  it("reuses an existing workspace instead of creating a duplicate", async () => {
    const createWorkspace = vi.fn();
    const orchestrator = createReferenceV2PersistenceOrchestrator({
      repository: {
        loadBundleByVehicleId: async () => ({
          workspace: { workspaceId: WORKSPACE_ID },
          assets: [],
          framingEvidence: [],
        }),
        createWorkspace,
      } as never,
      storeOriginal: vi.fn(),
      getAuthenticatedUserId: async () => "user",
      createSignedUrl: async () => null,
    });
    const ws = await orchestrator.ensureWorkspace(VEHICLE_ID, master());
    expect(ws.workspaceId).toBe(WORKSPACE_ID);
    expect(createWorkspace).not.toHaveBeenCalled();
  });
});
