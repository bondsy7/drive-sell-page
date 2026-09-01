import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REFERENCE_V2_TABLES,
  ReferenceV2RepositoryConflictError,
  ReferenceV2RepositoryError,
  ReferenceV2RepositoryNotFoundError,
  ReferenceV2RepositoryProtectedAssetError,
  assetPersistenceToDbRow,
  createReferenceV2PersistenceRepository,
  createReferenceV2SupabasePort,
  framingPersistenceToDbRow,
  mapAssetRowToPersistence,
  mapFramingRowToPersistence,
  mapWorkspaceRowToPersistence,
  workspacePersistenceToDbRow,
  type ReferenceV2AssetRow,
  type ReferenceV2DbError,
  type ReferenceV2FramingRow,
  type ReferenceV2SemanticPort,
  type ReferenceV2WorkspaceRow,
} from "../phase2/persistence-repository";
import { ReferenceV2PersistenceError } from "../phase2/persistence-contract";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VEHICLE_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const ROW_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ID = "55555555-5555-4555-8555-555555555555";
const DB_TS = "2026-09-01T11:00:00+00:00";
const ISO_TS = "2026-09-01T11:00:00.000Z";
const SHA = "a".repeat(64);
const ASSET_KEY = "ref_abc123";
const PERSPECTIVE = "EXT_34_FRONT_LEFT";
const STORAGE_PATH = `${USER_ID}/${VEHICLE_ID}/reference-v2/${WORKSPACE_ID}/${ASSET_KEY}/original.jpg`;

type RawRow = Record<string, unknown>;

// --------------------------------------------------------------------------
// Fixtures (DB rows)
// --------------------------------------------------------------------------

function workspaceRow(overrides: RawRow = {}): ReferenceV2WorkspaceRow {
  return {
    id: WORKSPACE_ID,
    user_id: USER_ID,
    vehicle_id: VEHICLE_ID,
    master_key: "vm_local_1",
    label: "Interner Referenzsatz A",
    vehicle_class: "car",
    color_family: "silver",
    identity_cluster_id: "cluster_a",
    master_version: 1,
    master_history: [{ version: 1, atIso: ISO_TS, action: "created" }],
    schema_version: 1,
    created_at: DB_TS,
    updated_at: DB_TS,
    ...overrides,
  } as ReferenceV2WorkspaceRow;
}

function intake(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    assetId: "provider_transient_9",
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: "cluster_a",
    sameVehicleConfidence: 0.95,
    pose: { canonicalPerspectiveId: PERSPECTIVE, azimuthDeg: 45 },
    visibility: { front: 0.9, rear: 0.1, leftSide: 0.8, rightSide: 0.1, roof: 0.3 },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: ["front_left", "front_right"],
    },
    quality: {
      sharpness: 0.9,
      occlusion: 0.05,
      glare: 0.05,
      resolutionAdequacy: 0.9,
      usableScore: 0.9,
    },
    classificationConfidence: 0.95,
    issues: [],
    ...overrides,
  };
}

function assetRow(overrides: RawRow = {}): ReferenceV2AssetRow {
  return {
    id: ROW_ID,
    workspace_id: WORKSPACE_ID,
    user_id: USER_ID,
    asset_key: ASSET_KEY,
    requested_perspective_id: PERSPECTIVE,
    canonical_perspective_id: PERSPECTIVE,
    file_name: "IMG_0001.jpg",
    storage_bucket: "originals",
    storage_path: STORAGE_PATH,
    mime_type: "image/jpeg",
    size_bytes: 2_400_000,
    sha256: SHA,
    intake: intake(),
    analysis: null,
    scores: {
      cameraAngle: 95,
      sideAndSurfaceCorrectness: 92,
      requiredSurfaceCoverage: 90,
      quality: 90,
      framing: 88,
    },
    weighted_score: "92",
    hard_failures: [],
    blockers: [],
    warnings: [],
    role: "primary",
    protection: "protected",
    asset_version: 1,
    history: [{ version: 1, atIso: ISO_TS, action: "created" }],
    schema_version: 1,
    created_at: DB_TS,
    updated_at: DB_TS,
    ...overrides,
  } as unknown as ReferenceV2AssetRow;
}

function framingRow(overrides: RawRow = {}): ReferenceV2FramingRow {
  return {
    workspace_id: WORKSPACE_ID,
    asset_key: ASSET_KEY,
    user_id: USER_ID,
    schema_version: 1,
    source_aspect_ratio: 1.5,
    full_vehicle_visible: true,
    cropped: false,
    padding_pct: 8,
    updated_at: DB_TS,
    ...overrides,
  } as ReferenceV2FramingRow;
}

/** Entfernt eine Spalte vollstaendig (kein `undefined`-Wert, kein Key). */
function withoutColumn<T extends object>(row: T, column: string): unknown {
  const clone: RawRow = { ...(row as RawRow) };
  delete clone[column];
  return clone;
}

// --------------------------------------------------------------------------
// Deterministic in-memory semantic port fake (no network, no module mock)
// --------------------------------------------------------------------------

type PortMethod = keyof ReferenceV2SemanticPort;

interface RecordedCall {
  method: PortMethod;
  values?: RawRow;
  keys?: RawRow;
  args?: RawRow;
}

type Responder = (
  call: RecordedCall,
) => { data: unknown; error: ReferenceV2DbError | null };

function createFakePort(responder: Responder) {
  const calls: RecordedCall[] = [];

  function settle(call: RecordedCall) {
    calls.push(call);
    const res = responder(call);
    return Promise.resolve(res) as never;
  }

  const port: ReferenceV2SemanticPort = {
    findWorkspaceByVehicleId: (vehicleId) =>
      settle({ method: "findWorkspaceByVehicleId", args: { vehicleId } }),
    listAssets: (workspaceId) =>
      settle({ method: "listAssets", args: { workspaceId } }),
    listFraming: (workspaceId) =>
      settle({ method: "listFraming", args: { workspaceId } }),
    insertWorkspace: (values) =>
      settle({ method: "insertWorkspace", values: values as RawRow }),
    updateWorkspace: (patch, keys) =>
      settle({
        method: "updateWorkspace",
        values: patch as RawRow,
        keys: keys as unknown as RawRow,
      }),
    insertAsset: (values) =>
      settle({ method: "insertAsset", values: values as RawRow }),
    updateAsset: (patch, keys) =>
      settle({
        method: "updateAsset",
        values: patch as RawRow,
        keys: keys as unknown as RawRow,
      }),
    deleteAsset: (workspaceId, assetKey) =>
      settle({ method: "deleteAsset", args: { workspaceId, assetKey } }),
    upsertFraming: (values) =>
      settle({ method: "upsertFraming", values: values as RawRow }),
  };

  return { port, calls };
}

function bundleResponder(options: {
  workspace?: ReferenceV2WorkspaceRow | null;
  assets?: unknown[];
  framing?: unknown[];
}): Responder {
  return (call) => {
    if (call.method === "findWorkspaceByVehicleId") {
      return { data: options.workspace ?? null, error: null };
    }
    if (call.method === "listAssets") {
      return { data: options.assets ?? [], error: null };
    }
    return { data: options.framing ?? [], error: null };
  };
}

// --------------------------------------------------------------------------
// 1-2. Pure row mappers
// --------------------------------------------------------------------------

describe("1. pure row mappers", () => {
  it("maps a workspace row to the durable contract", () => {
    const parsed = mapWorkspaceRowToPersistence(workspaceRow());
    expect(parsed).toMatchObject({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      vehicleId: VEHICLE_ID,
      masterKey: "vm_local_1",
      vehicleClass: "car",
      colorFamily: "silver",
      createdAtIso: ISO_TS,
      updatedAtIso: ISO_TS,
      schemaVersion: 1,
    });
  });

  it("maps an asset row including optional size and omitted analysis", () => {
    const parsed = mapAssetRowToPersistence(assetRow());
    expect(parsed.rowId).toBe(ROW_ID);
    expect(parsed.sizeBytes).toBe(2_400_000);
    expect(parsed.weightedScore).toBe(92);
    expect(parsed.analysis).toBeUndefined();
    expect("analysis" in parsed).toBe(false);
    expect(mapAssetRowToPersistence(assetRow({ size_bytes: null })).sizeBytes)
      .toBeUndefined();
  });

  it("maps a framing row", () => {
    const parsed = mapFramingRowToPersistence(framingRow());
    expect(parsed).toEqual({
      schemaVersion: 1,
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      assetKey: ASSET_KEY,
      sourceAspectRatio: 1.5,
      fullVehicleVisible: true,
      cropped: false,
      paddingPct: 8,
      updatedAtIso: ISO_TS,
    });
  });
});

describe("2. malformed DB rows fail closed", () => {
  it("rejects a bad sha256", () => {
    expect(() => mapAssetRowToPersistence(assetRow({ sha256: "abc" }))).toThrow(
      ReferenceV2PersistenceError,
    );
  });

  it("rejects a canonical perspective mismatch", () => {
    expect(() =>
      mapAssetRowToPersistence(
        assetRow({ canonical_perspective_id: "EXT_SIDE_RIGHT" }),
      ),
    ).toThrow(/canonicalPerspectiveId/);
  });

  it("rejects an invalid role / protection value", () => {
    expect(() => mapAssetRowToPersistence(assetRow({ role: "hero" }))).toThrow(
      ReferenceV2PersistenceError,
    );
    expect(() =>
      mapAssetRowToPersistence(assetRow({ protection: "locked" })),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("rejects blocked assets that are not rejected", () => {
    expect(() =>
      mapAssetRowToPersistence(assetRow({ blockers: ["CROP_VIOLATION"] })),
    ).toThrow(/rejected/);
  });

  it("rejects forbidden semantic content and inline transport", () => {
    expect(() =>
      mapAssetRowToPersistence(assetRow({ warnings: ["WVWZZZ1KZAW123456"] })),
    ).toThrow(ReferenceV2PersistenceError);
    expect(() =>
      mapAssetRowToPersistence(
        assetRow({ storage_path: "data:image/jpeg;base64,AAAA" }),
      ),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("rejects malformed timestamps and non-row input", () => {
    expect(() =>
      mapWorkspaceRowToPersistence(workspaceRow({ created_at: "gestern" })),
    ).toThrow(ReferenceV2RepositoryError);
    expect(() => mapFramingRowToPersistence(null)).toThrow(
      ReferenceV2RepositoryError,
    );
  });
});

// --------------------------------------------------------------------------
// 2b. GAP 3 — missing DB columns must never look like SQL NULL
// --------------------------------------------------------------------------

describe("2b. absent DB columns fail closed (missing != NULL)", () => {
  it("rejects an absent nullable workspace column but accepts explicit null", () => {
    expect(() =>
      mapWorkspaceRowToPersistence(withoutColumn(workspaceRow(), "color_family")),
    ).toThrow(/color_family/);
    expect(
      mapWorkspaceRowToPersistence(workspaceRow({ color_family: null }))
        .colorFamily,
    ).toBeNull();
  });

  it("rejects absent nullable asset columns but accepts explicit null", () => {
    for (const column of ["analysis", "size_bytes"]) {
      expect(() =>
        mapAssetRowToPersistence(withoutColumn(assetRow(), column)),
      ).toThrow(new RegExp(column));
    }
    const parsed = mapAssetRowToPersistence(
      assetRow({ analysis: null, size_bytes: null }),
    );
    expect(parsed.analysis).toBeUndefined();
    expect(parsed.sizeBytes).toBeUndefined();
  });

  it("rejects an absent required column in every table", () => {
    expect(() =>
      mapWorkspaceRowToPersistence(withoutColumn(workspaceRow(), "master_key")),
    ).toThrow(ReferenceV2RepositoryError);
    expect(() =>
      mapAssetRowToPersistence(withoutColumn(assetRow(), "sha256")),
    ).toThrow(/sha256/);
    expect(() =>
      mapFramingRowToPersistence(withoutColumn(framingRow(), "padding_pct")),
    ).toThrow(/padding_pct/);
  });

  it("rejects an explicitly undefined column value", () => {
    expect(() =>
      mapAssetRowToPersistence(assetRow({ size_bytes: undefined })),
    ).toThrow(/size_bytes/);
    expect(() =>
      mapAssetRowToPersistence(assetRow({ history: undefined })),
    ).toThrow(/history/);
  });

  it("invents no defaults for arrays, json, version or timestamps", () => {
    for (const column of [
      "warnings",
      "history",
      "intake",
      "schema_version",
      "created_at",
      "updated_at",
    ]) {
      expect(() =>
        mapAssetRowToPersistence(withoutColumn(assetRow(), column)),
      ).toThrow(ReferenceV2RepositoryError);
    }
  });
});

// --------------------------------------------------------------------------
// 3. Reverse serializers
// --------------------------------------------------------------------------

const WORKSPACE_INSERT_COLUMNS = [
  "user_id",
  "vehicle_id",
  "master_key",
  "label",
  "vehicle_class",
  "color_family",
  "identity_cluster_id",
  "master_version",
  "master_history",
  "schema_version",
];

const ASSET_INSERT_COLUMNS = [
  "workspace_id",
  "user_id",
  "asset_key",
  "requested_perspective_id",
  "canonical_perspective_id",
  "file_name",
  "storage_bucket",
  "storage_path",
  "mime_type",
  "size_bytes",
  "sha256",
  "intake",
  "analysis",
  "scores",
  "weighted_score",
  "hard_failures",
  "blockers",
  "warnings",
  "role",
  "protection",
  "asset_version",
  "history",
  "schema_version",
];

function workspaceCreateInput() {
  const parsed = mapWorkspaceRowToPersistence(workspaceRow());
  return {
    vehicleId: parsed.vehicleId,
    masterKey: parsed.masterKey,
    label: parsed.label,
    vehicleClass: parsed.vehicleClass,
    colorFamily: parsed.colorFamily,
    identityClusterId: parsed.identityClusterId,
    masterVersion: parsed.masterVersion,
    masterHistory: parsed.masterHistory,
  };
}

function assetCreateInput(overrides: Record<string, unknown> = {}) {
  const parsed = mapAssetRowToPersistence(assetRow());
  const {
    rowId: _rowId,
    userId: _userId,
    createdAtIso: _c,
    updatedAtIso: _u,
    ...rest
  } = parsed;
  return { ...rest, ...overrides } as Parameters<
    typeof assetPersistenceToDbRow
  >[0];
}

describe("3. reverse serializers contain only allowed columns", () => {
  it("serializes a workspace insert row", () => {
    const row = workspacePersistenceToDbRow(workspaceCreateInput());
    expect(Object.keys(row).sort()).toEqual([...WORKSPACE_INSERT_COLUMNS].sort());
    expect(row.id).toBeUndefined();
  });

  it("keeps an explicit deterministic workspace id when supplied", () => {
    const row = workspacePersistenceToDbRow({
      ...workspaceCreateInput(),
      workspaceId: WORKSPACE_ID,
    });
    expect(row.id).toBe(WORKSPACE_ID);
  });

  it("serializes an asset insert row without transient/UI fields", () => {
    const row = assetPersistenceToDbRow(assetCreateInput());
    expect(Object.keys(row).sort()).toEqual([...ASSET_INSERT_COLUMNS].sort());
    const serialized = JSON.stringify(row);
    expect(serialized).not.toMatch(/previewUrl|outputReadyFormats/i);
    expect(serialized).not.toMatch(/"(vin|brand|model|year|variant|title)"/i);
  });

  it("serializes framing evidence with the framing columns only", () => {
    const row = framingPersistenceToDbRow(
      mapFramingRowToPersistence(framingRow()),
    );
    expect(Object.keys(row).sort()).toEqual(
      [
        "workspace_id",
        "asset_key",
        "user_id",
        "schema_version",
        "source_aspect_ratio",
        "full_vehicle_visible",
        "cropped",
        "padding_pct",
        "updated_at",
      ].sort(),
    );
    expect(JSON.stringify(row)).not.toMatch(/outputReadyFormats/i);
  });

  it("fails closed on invalid create input before producing a row", () => {
    expect(() =>
      assetPersistenceToDbRow(assetCreateInput({ sha256: "nope" })),
    ).toThrow(ReferenceV2PersistenceError);
  });
});

// --------------------------------------------------------------------------
// 4-6. Bundle read
// --------------------------------------------------------------------------

describe("4-6. bundle read", () => {
  it("returns null and skips asset/framing queries when no workspace exists", async () => {
    const { port, calls } = createFakePort(bundleResponder({ workspace: null }));
    const repo = createReferenceV2PersistenceRepository(port);
    await expect(repo.loadBundleByVehicleId(VEHICLE_ID)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("findWorkspaceByVehicleId");
  });

  it("rejects a non-UUID vehicle id before any network call", async () => {
    const { port, calls } = createFakePort(bundleResponder({}));
    const repo = createReferenceV2PersistenceRepository(port);
    await expect(repo.loadBundleByVehicleId("nope")).rejects.toBeInstanceOf(
      ReferenceV2RepositoryError,
    );
    expect(calls).toHaveLength(0);
  });

  it("reads only the three reference_v2 anchors via read-only port methods", async () => {
    const { port, calls } = createFakePort(
      bundleResponder({
        workspace: workspaceRow(),
        assets: [assetRow()],
        framing: [framingRow()],
      }),
    );
    const repo = createReferenceV2PersistenceRepository(port);
    const bundle = await repo.loadBundleByVehicleId(VEHICLE_ID);
    expect(bundle?.assets).toHaveLength(1);
    expect(bundle?.framingEvidence).toHaveLength(1);
    expect(calls.map((c) => c.method).sort()).toEqual([
      "findWorkspaceByVehicleId",
      "listAssets",
      "listFraming",
    ]);
    expect(calls[0].args).toEqual({ vehicleId: VEHICLE_ID });
    for (const call of calls.slice(1)) {
      expect(call.args).toEqual({ workspaceId: WORKSPACE_ID });
    }
  });

  it("fails closed on cross-record workspace/user mismatch", async () => {
    const mismatched = createFakePort(
      bundleResponder({
        workspace: workspaceRow(),
        assets: [assetRow({ user_id: OTHER_ID })],
      }),
    );
    await expect(
      createReferenceV2PersistenceRepository(mismatched.port)
        .loadBundleByVehicleId(VEHICLE_ID),
    ).rejects.toThrow(/does not belong/);

    const orphanFraming = createFakePort(
      bundleResponder({
        workspace: workspaceRow(),
        assets: [assetRow()],
        framing: [framingRow({ asset_key: "ref_unknown" })],
      }),
    );
    await expect(
      createReferenceV2PersistenceRepository(orphanFraming.port)
        .loadBundleByVehicleId(VEHICLE_ID),
    ).rejects.toThrow(/unknown asset key/);
  });

  it("fails closed on duplicates instead of silently de-duplicating", async () => {
    const dupAssets = createFakePort(
      bundleResponder({
        workspace: workspaceRow(),
        assets: [assetRow(), assetRow({ id: OTHER_ID })],
      }),
    );
    await expect(
      createReferenceV2PersistenceRepository(dupAssets.port)
        .loadBundleByVehicleId(VEHICLE_ID),
    ).rejects.toThrow(/duplicate asset key/);

    const dupFraming = createFakePort(
      bundleResponder({
        workspace: workspaceRow(),
        assets: [assetRow()],
        framing: [framingRow(), framingRow()],
      }),
    );
    await expect(
      createReferenceV2PersistenceRepository(dupFraming.port)
        .loadBundleByVehicleId(VEHICLE_ID),
    ).rejects.toThrow(/duplicate framing/);
  });

  it("fails closed when a loaded row is missing a database column", async () => {
    const { port } = createFakePort(
      bundleResponder({
        workspace: workspaceRow(),
        assets: [withoutColumn(assetRow(), "analysis")],
      }),
    );
    await expect(
      createReferenceV2PersistenceRepository(port).loadBundleByVehicleId(
        VEHICLE_ID,
      ),
    ).rejects.toThrow(/analysis/);
  });
});

// --------------------------------------------------------------------------
// 7-8. Workspace writes
// --------------------------------------------------------------------------

describe("7-8. workspace writes", () => {
  it("creates via INSERT (never upsert) and parses the returned row", async () => {
    const { port, calls } = createFakePort(() => ({
      data: workspaceRow(),
      error: null,
    }));
    const repo = createReferenceV2PersistenceRepository(port);
    const created = await repo.createWorkspace(workspaceCreateInput());
    expect(created.workspaceId).toBe(WORKSPACE_ID);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("insertWorkspace");
    expect(calls[0].values?.user_id).toBeDefined();
  });

  it("translates a unique vehicle conflict into a conflict error", async () => {
    const { port } = createFakePort(() => ({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    }));
    await expect(
      createReferenceV2PersistenceRepository(port).createWorkspace(
        workspaceCreateInput(),
      ),
    ).rejects.toBeInstanceOf(ReferenceV2RepositoryConflictError);
  });

  it("updates only mutable fields and filters by id + vehicle_id", async () => {
    const { port, calls } = createFakePort(() => ({
      data: workspaceRow(),
      error: null,
    }));
    const repo = createReferenceV2PersistenceRepository(port);
    await repo.updateWorkspace(mapWorkspaceRowToPersistence(workspaceRow()));
    const call = calls[0];
    expect(call.method).toBe("updateWorkspace");
    expect(Object.keys(call.values ?? {}).sort()).toEqual(
      [
        "label",
        "vehicle_class",
        "color_family",
        "identity_cluster_id",
        "master_version",
        "master_history",
        "schema_version",
      ].sort(),
    );
    for (const forbidden of [
      "id",
      "vehicle_id",
      "master_key",
      "user_id",
      "created_at",
    ]) {
      expect(call.values).not.toHaveProperty(forbidden);
    }
    expect(call.keys).toEqual({
      workspaceId: WORKSPACE_ID,
      vehicleId: VEHICLE_ID,
    });
  });

  it("reports a zero-row update (maybeSingle -> null) as not found", async () => {
    const { port } = createFakePort(() => ({ data: null, error: null }));
    await expect(
      createReferenceV2PersistenceRepository(port).updateWorkspace(
        mapWorkspaceRowToPersistence(workspaceRow()),
      ),
    ).rejects.toBeInstanceOf(ReferenceV2RepositoryNotFoundError);
  });

  it("translates a real PGRST116 zero-row update error into not found", async () => {
    const { port } = createFakePort(() => ({
      data: null,
      error: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      },
    }));
    await expect(
      createReferenceV2PersistenceRepository(port).updateWorkspace(
        mapWorkspaceRowToPersistence(workspaceRow()),
      ),
    ).rejects.toBeInstanceOf(ReferenceV2RepositoryNotFoundError);
  });

  it("never classifies an RLS or DB failure as not found", async () => {
    const { port } = createFakePort(() => ({
      data: null,
      error: {
        code: "42501",
        message: "new row violates row-level security policy",
      },
    }));
    const error = await createReferenceV2PersistenceRepository(port)
      .updateWorkspace(mapWorkspaceRowToPersistence(workspaceRow()))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReferenceV2RepositoryError);
    expect(error).not.toBeInstanceOf(ReferenceV2RepositoryNotFoundError);
  });

  it("does not treat PGRST116 on a create as not found", async () => {
    const { port } = createFakePort(() => ({
      data: null,
      error: { code: "PGRST116", message: "no rows returned" },
    }));
    const error = await createReferenceV2PersistenceRepository(port)
      .createWorkspace(workspaceCreateInput())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReferenceV2RepositoryError);
    expect(error).not.toBeInstanceOf(ReferenceV2RepositoryNotFoundError);
  });
});

// --------------------------------------------------------------------------
// 9-11. Asset writes
// --------------------------------------------------------------------------

describe("9-11. asset writes", () => {
  it("pre-validates before any network call", async () => {
    const { port, calls } = createFakePort(() => ({
      data: assetRow(),
      error: null,
    }));
    const repo = createReferenceV2PersistenceRepository(port);
    await expect(
      repo.createAsset(assetCreateInput({ sha256: "nope" })),
    ).rejects.toBeInstanceOf(ReferenceV2PersistenceError);
    await expect(
      repo.createAsset(assetCreateInput({ canonicalPerspectiveId: "EXT_FRONT" })),
    ).rejects.toBeInstanceOf(ReferenceV2PersistenceError);
    await expect(
      repo.createAsset(assetCreateInput({ blockers: ["CROP_VIOLATION"] })),
    ).rejects.toBeInstanceOf(ReferenceV2PersistenceError);
    expect(calls).toHaveLength(0);
  });

  it("inserts a valid asset and parses the returned row", async () => {
    const { port, calls } = createFakePort(() => ({
      data: assetRow(),
      error: null,
    }));
    const created = await createReferenceV2PersistenceRepository(
      port,
    ).createAsset(assetCreateInput());
    expect(created.assetKey).toBe(ASSET_KEY);
    expect(calls[0].method).toBe("insertAsset");
    expect(calls[0].values?.storage_bucket).toBe("originals");
  });

  it("updates only mutable governance fields, never durable file identity", async () => {
    const { port, calls } = createFakePort(() => ({
      data: assetRow(),
      error: null,
    }));
    await createReferenceV2PersistenceRepository(port).updateAsset(
      mapAssetRowToPersistence(assetRow()),
    );
    const call = calls[0];
    expect(call.method).toBe("updateAsset");
    expect(Object.keys(call.values ?? {}).sort()).toEqual(
      [
        "requested_perspective_id",
        "canonical_perspective_id",
        "file_name",
        "intake",
        "analysis",
        "scores",
        "weighted_score",
        "hard_failures",
        "blockers",
        "warnings",
        "role",
        "protection",
        "asset_version",
        "history",
        "schema_version",
      ].sort(),
    );
    for (const forbidden of [
      "id",
      "workspace_id",
      "user_id",
      "storage_bucket",
      "storage_path",
      "mime_type",
      "size_bytes",
      "sha256",
      "created_at",
      "asset_key",
    ]) {
      expect(call.values).not.toHaveProperty(forbidden);
    }
    expect(call.keys).toEqual({
      rowId: ROW_ID,
      workspaceId: WORKSPACE_ID,
      assetKey: ASSET_KEY,
    });
  });

  it("reports a zero-row asset update as not found", async () => {
    const { port } = createFakePort(() => ({ data: null, error: null }));
    await expect(
      createReferenceV2PersistenceRepository(port).updateAsset(
        mapAssetRowToPersistence(assetRow()),
      ),
    ).rejects.toBeInstanceOf(ReferenceV2RepositoryNotFoundError);
  });

  it("translates the DB protected-delete guard without auto-unprotecting", async () => {
    const { port, calls } = createFakePort(() => ({
      data: null,
      error: {
        code: "P0001",
        message:
          "reference_v2_assets: protected asset ref_abc123 cannot be deleted; unlock it first",
      },
    }));
    await expect(
      createReferenceV2PersistenceRepository(port).deleteAsset(
        WORKSPACE_ID,
        ASSET_KEY,
      ),
    ).rejects.toBeInstanceOf(ReferenceV2RepositoryProtectedAssetError);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("deleteAsset");
    expect(calls.some((c) => c.method === "updateAsset")).toBe(false);
  });

  it("deletes an unprotected asset with both anchors", async () => {
    const { port, calls } = createFakePort(() => ({ data: null, error: null }));
    await createReferenceV2PersistenceRepository(port).deleteAsset(
      WORKSPACE_ID,
      ASSET_KEY,
    );
    expect(calls[0].args).toEqual({
      workspaceId: WORKSPACE_ID,
      assetKey: ASSET_KEY,
    });
  });

  it("rejects an unsafe asset key before any port call", async () => {
    const { port, calls } = createFakePort(() => ({ data: null, error: null }));
    const repo = createReferenceV2PersistenceRepository(port);
    for (const unsafe of [
      "",
      "  ",
      " ref_abc123",
      "ref/abc",
      "ref\\abc",
      "../ref_abc123",
      "ref\u0000abc",
    ]) {
      await expect(repo.deleteAsset(WORKSPACE_ID, unsafe)).rejects.toBeInstanceOf(
        ReferenceV2RepositoryError,
      );
    }
    await expect(repo.deleteAsset("not-a-uuid", ASSET_KEY)).rejects.toBeInstanceOf(
      ReferenceV2RepositoryError,
    );
    expect(calls).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// 12. Framing upsert
// --------------------------------------------------------------------------

describe("12. framing evidence upsert", () => {
  it("upserts and returns the parsed row", async () => {
    const { port, calls } = createFakePort(() => ({
      data: framingRow(),
      error: null,
    }));
    const parsed = await createReferenceV2PersistenceRepository(
      port,
    ).upsertFramingEvidence(mapFramingRowToPersistence(framingRow()));
    expect(parsed.assetKey).toBe(ASSET_KEY);
    expect(calls[0].method).toBe("upsertFraming");
    expect(calls[0].values).not.toHaveProperty("outputReadyFormats");
  });

  it("fails closed when the upsert returns no row", async () => {
    const { port } = createFakePort(() => ({ data: null, error: null }));
    await expect(
      createReferenceV2PersistenceRepository(port).upsertFramingEvidence(
        mapFramingRowToPersistence(framingRow()),
      ),
    ).rejects.toBeInstanceOf(ReferenceV2RepositoryError);
  });
});

// --------------------------------------------------------------------------
// 12b. Production port shape (no network call is performed)
// --------------------------------------------------------------------------

describe("12b. production port", () => {
  it("exposes exactly the semantic port surface over the existing client", () => {
    const port = createReferenceV2SupabasePort();
    expect(Object.keys(port).sort()).toEqual(
      [
        "findWorkspaceByVehicleId",
        "listAssets",
        "listFraming",
        "insertWorkspace",
        "updateWorkspace",
        "insertAsset",
        "updateAsset",
        "deleteAsset",
        "upsertFraming",
      ].sort(),
    );
  });

  it("keeps the three anchored table names", () => {
    expect(Object.values(REFERENCE_V2_TABLES).sort()).toEqual([
      "reference_v2_assets",
      "reference_v2_framing_evidence",
      "reference_v2_workspaces",
    ]);
  });
});

// --------------------------------------------------------------------------
// 13-15. Source guard
// --------------------------------------------------------------------------

const REPO_SRC_RAW = readFileSync(
  path.join(__dirname, "../phase2/persistence-repository.ts"),
  "utf8",
);
const REPO_SRC = REPO_SRC_RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /(^|\s)\/\/.*$/gm,
  "",
);

describe("13-15. repository source guard", () => {
  it("never touches business tables or business metadata", () => {
    expect(REPO_SRC).not.toMatch(/from\(\s*["'`]vehicles["'`]\s*\)/);
    expect(REPO_SRC).not.toMatch(/["'`]vehicles["'`]/);
    expect(REPO_SRC).not.toMatch(/\b(vin|brand|make|variant|trimLevel)\b/i);
    expect(REPO_SRC).not.toMatch(/\bmodel\b/i);
    expect(REPO_SRC).not.toMatch(/image_generation_jobs/);
  });

  it("has no storage, provider, network or generation surface", () => {
    expect(REPO_SRC).not.toMatch(/\.storage\b|createSignedUrl|getPublicUrl/);
    expect(REPO_SRC).not.toMatch(/\bfetch\(/);
    expect(REPO_SRC).not.toMatch(/remaster|one-?shot|spin360|generateImage/i);
    expect(REPO_SRC).not.toMatch(/previewUrl|outputReadyFormats/);
    expect(REPO_SRC).not.toMatch(/Math\.random/);
  });

  it("uses the strict persistence contract parsers", () => {
    expect(REPO_SRC).toMatch(/from\s+["']\.\/persistence-contract["']/);
    for (const parser of [
      "parseReferenceV2WorkspacePersistence",
      "parseReferenceV2AssetPersistence",
      "parseReferenceV2FramingEvidencePersistence",
    ]) {
      expect(REPO_SRC).toContain(parser);
    }
  });

  it("binds against the generated Supabase schema and the existing client", () => {
    expect(REPO_SRC).toMatch(
      /import\s+type\s+\{[^}]*\bDatabase\b[^}]*\}\s+from\s+["']@\/integrations\/supabase\/types["']/,
    );
    expect(REPO_SRC).toMatch(
      /import\s+\{\s*supabase\s*\}\s+from\s+["']@\/integrations\/supabase\/client["']/,
    );
    expect(REPO_SRC).toMatch(/Database\["public"\]\["Tables"\]/);
    expect(REPO_SRC).toMatch(/\["Row"\]/);
    expect(REPO_SRC).toMatch(/\["Insert"\]/);
    expect(REPO_SRC).toMatch(/\["Update"\]/);
  });

  it("has no production client escape cast and no hand-written row interfaces", () => {
    expect(REPO_SRC).not.toMatch(/as\s+unknown\s+as/);
    expect(REPO_SRC).not.toMatch(/\bas\s+any\b/);
    expect(REPO_SRC).not.toMatch(/ReferenceV2ClientPort/);
    expect(REPO_SRC).not.toMatch(
      /interface\s+ReferenceV2(Workspace|Asset|Framing)Row\b/,
    );
    expect(REPO_SRC).not.toMatch(/Record<string,\s*unknown>\s*;?\s*$/m);
  });

  it("guards row columns with own-property checks instead of nullish defaults", () => {
    expect(REPO_SRC).toContain("hasOwnProperty");
    expect(REPO_SRC).not.toMatch(/row\.\w+\s*\?\?/);
  });

  it("only reaches the three reference_v2 tables", () => {
    const tables = REPO_SRC.match(/reference_v2_\w+/g) ?? [];
    for (const t of new Set(tables)) {
      expect([
        "reference_v2_workspaces",
        "reference_v2_assets",
        "reference_v2_framing_evidence",
      ]).toContain(t);
    }
  });
});
