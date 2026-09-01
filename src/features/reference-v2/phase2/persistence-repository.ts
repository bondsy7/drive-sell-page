import {
  REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION,
  REFERENCE_V2_STORAGE_BUCKET,
  ReferenceV2PersistenceError,
  parseReferenceV2AssetPersistence,
  parseReferenceV2FramingEvidencePersistence,
  parseReferenceV2WorkspacePersistence,
  type ReferenceV2AssetPersistence,
  type ReferenceV2FramingEvidencePersistence,
  type ReferenceV2WorkspacePersistence,
} from "./persistence-contract";
import { CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION } from "./framing-evidence";

/**
 * Reference V2 — Phase 2.6B: typed persistence repository + row mappers.
 *
 * Isolierte Persistenzgrenze fuer AUSSCHLIESSLICH die drei Reference-V2-
 * Tabellen. Keine Storage-Objekte, keine Signed URLs, keine Provider-Aufrufe,
 * keine Generierung, keine Store-/UI-Hydration.
 *
 * INVARIANTEN
 * - Jede DB-Zeile ist untrusted input und wird strikt durch den durablen
 *   Vertrag (`persistence-contract.ts`) geparst. Keine Defaults, die
 *   fehlerhafte DB-Daten verdecken.
 * - Owner (`user_id`) ist AUSSCHLIESSLICH DB-Autoritaet: BEFORE-Trigger
 *   leiten ihn aus dem verankerten Datensatz ab und ueberschreiben jeden
 *   mitgeschickten Wert. Der in Insert-Payloads enthaltene `user_id` ist ein
 *   reiner Transport-Platzhalter, weil die generierten Insert-Typen die Spalte
 *   verlangen; er ist NIEMALS Owner-Autoritaet und wird nie aus Business-Daten
 *   abgeleitet.
 * - Anker (`vehicle_id`, `workspace_id`, `asset_key`, `storage_path`) sind
 *   unveraenderlich; zusaetzlich behandelt dieses Repository die durable
 *   Datei-Identitaet (bucket/mime/size/sha) als immutable.
 * - Dieses Repository liest NIEMALS Business-Tabellen oder -Spalten. Die
 *   Fahrzeug-Assoziation ist ausschliesslich die stabile UUID.
 *
 * ARCHITEKTUR-NOTIZ (bewusst NICHT in 2.6B geloest)
 * - Das Loeschen eines verankerten Fahrzeugs kann spaeter durch geschuetzte
 *   Kind-Assets (DB-seitiger protected-delete-Guard) blockiert werden. Der
 *   Unlock-/Loesch-Workflow ist Aufgabe einer spaeteren Phase.
 */

// --------------------------------------------------------------------------
// Table names (only these three are reachable from this module)
// --------------------------------------------------------------------------

export const REFERENCE_V2_TABLES = {
  workspaces: "reference_v2_workspaces",
  assets: "reference_v2_assets",
  framingEvidence: "reference_v2_framing_evidence",
} as const;

export type ReferenceV2TableName =
  (typeof REFERENCE_V2_TABLES)[keyof typeof REFERENCE_V2_TABLES];

// --------------------------------------------------------------------------
// Errors
// --------------------------------------------------------------------------

export class ReferenceV2RepositoryError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "ReferenceV2RepositoryError";
    this.code = code;
  }
}

export class ReferenceV2RepositoryConflictError extends ReferenceV2RepositoryError {
  constructor(message: string, code: string | null = null) {
    super(message, code);
    this.name = "ReferenceV2RepositoryConflictError";
  }
}

/** Geschuetzte Assets sind DB-seitig loeschgesperrt (fail-closed). */
export class ReferenceV2RepositoryProtectedAssetError extends ReferenceV2RepositoryConflictError {
  constructor(message: string, code: string | null = null) {
    super(message, code);
    this.name = "ReferenceV2RepositoryProtectedAssetError";
  }
}

export class ReferenceV2RepositoryNotFoundError extends ReferenceV2RepositoryError {
  constructor(message: string, code: string | null = null) {
    super(message, code);
    this.name = "ReferenceV2RepositoryNotFoundError";
  }
}

// --------------------------------------------------------------------------
// Narrow client port (structural subset of the generated Supabase client)
// --------------------------------------------------------------------------

export interface ReferenceV2DbError {
  readonly code?: string | null;
  readonly message: string;
  readonly details?: string | null;
}

export interface ReferenceV2Result<T> {
  readonly data: T;
  readonly error: ReferenceV2DbError | null;
}

export type ReferenceV2Row = Record<string, unknown>;

export interface ReferenceV2SingleBuilder
  extends PromiseLike<ReferenceV2Result<ReferenceV2Row | null>> {
  single(): PromiseLike<ReferenceV2Result<ReferenceV2Row | null>>;
  maybeSingle(): PromiseLike<ReferenceV2Result<ReferenceV2Row | null>>;
}

export interface ReferenceV2SelectBuilder
  extends PromiseLike<ReferenceV2Result<ReferenceV2Row[] | null>> {
  eq(column: string, value: unknown): ReferenceV2SelectBuilder;
  order(
    column: string,
    options: { ascending: boolean },
  ): ReferenceV2SelectBuilder;
  maybeSingle(): PromiseLike<ReferenceV2Result<ReferenceV2Row | null>>;
}

export interface ReferenceV2MutationBuilder {
  eq(column: string, value: unknown): ReferenceV2MutationBuilder;
  select(columns: string): ReferenceV2SingleBuilder;
}

export interface ReferenceV2DeleteBuilder
  extends PromiseLike<ReferenceV2Result<ReferenceV2Row[] | null>> {
  eq(column: string, value: unknown): ReferenceV2DeleteBuilder;
}

export interface ReferenceV2TablePort {
  select(columns: string): ReferenceV2SelectBuilder;
  insert(values: ReferenceV2Row): ReferenceV2MutationBuilder;
  update(values: ReferenceV2Row): ReferenceV2MutationBuilder;
  upsert(
    values: ReferenceV2Row,
    options: { onConflict: string },
  ): ReferenceV2MutationBuilder;
  delete(): ReferenceV2DeleteBuilder;
}

export interface ReferenceV2ClientPort {
  from(table: ReferenceV2TableName): ReferenceV2TablePort;
}

// --------------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Struktureller Platzhalter fuer DB-autoritative Felder vor dem Insert. */
const PLACEHOLDER_UUID = "00000000-0000-4000-8000-000000000000";
const PLACEHOLDER_ISO = "1970-01-01T00:00:00.000Z";

function assertUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new ReferenceV2RepositoryError(`${field} must be a valid UUID`);
  }
  return value;
}

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ReferenceV2RepositoryError(`${field} must be a non-empty string`);
  }
  return value;
}

/** DB-Zeitstempel -> ISO. Fehlerhafte Werte scheitern fail-closed. */
function toIso(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ReferenceV2RepositoryError(`${field} must be a timestamp string`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ReferenceV2RepositoryError(`${field} is not a valid timestamp`);
  }
  return parsed.toISOString();
}

function toNumber(value: unknown, field: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new ReferenceV2RepositoryError(`${field} must be a finite number`);
  }
  return n;
}

function requireRow(value: unknown, field: string): ReferenceV2Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReferenceV2RepositoryError(`${field} must be a database row`);
  }
  return value as ReferenceV2Row;
}

// --------------------------------------------------------------------------
// Error translation
// --------------------------------------------------------------------------

const UNIQUE_VIOLATION = "23505";
const RAISED_EXCEPTION = "P0001";

function translateDbError(
  error: ReferenceV2DbError,
  context: string,
): ReferenceV2RepositoryError {
  const code = error.code ?? null;
  const message = error.message ?? "unknown database error";

  if (
    code === RAISED_EXCEPTION &&
    /protected asset|cannot be deleted/i.test(message)
  ) {
    return new ReferenceV2RepositoryProtectedAssetError(
      `${context}: protected asset cannot be deleted (unlock required)`,
      code,
    );
  }
  if (code === UNIQUE_VIOLATION) {
    return new ReferenceV2RepositoryConflictError(
      `${context}: conflicting record already exists`,
      code,
    );
  }
  return new ReferenceV2RepositoryError(`${context}: ${message}`, code);
}

function unwrap<T>(result: ReferenceV2Result<T>, context: string): T {
  if (result.error) throw translateDbError(result.error, context);
  return result.data;
}

// --------------------------------------------------------------------------
// Pure row mappers (DB row -> durable contract)
// --------------------------------------------------------------------------

export function mapWorkspaceRowToPersistence(
  input: unknown,
): ReferenceV2WorkspacePersistence {
  const row = requireRow(input, "workspace row");
  return parseReferenceV2WorkspacePersistence({
    schemaVersion: row.schema_version,
    workspaceId: row.id,
    userId: row.user_id,
    vehicleId: row.vehicle_id,
    masterKey: row.master_key,
    label: row.label,
    vehicleClass: row.vehicle_class,
    colorFamily: row.color_family ?? null,
    identityClusterId: row.identity_cluster_id,
    masterVersion: row.master_version,
    masterHistory: row.master_history,
    createdAtIso: toIso(row.created_at, "workspace.created_at"),
    updatedAtIso: toIso(row.updated_at, "workspace.updated_at"),
  });
}

export function mapAssetRowToPersistence(
  input: unknown,
): ReferenceV2AssetPersistence {
  const row = requireRow(input, "asset row");
  const candidate: Record<string, unknown> = {
    schemaVersion: row.schema_version,
    rowId: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    assetKey: row.asset_key,
    requestedPerspectiveId: row.requested_perspective_id,
    canonicalPerspectiveId: row.canonical_perspective_id,
    fileName: row.file_name,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sha256: row.sha256,
    createdAtIso: toIso(row.created_at, "asset.created_at"),
    updatedAtIso: toIso(row.updated_at, "asset.updated_at"),
    intake: row.intake,
    scores: row.scores,
    weightedScore: toNumber(row.weighted_score, "asset.weighted_score"),
    hardFailures: row.hard_failures,
    blockers: row.blockers,
    warnings: row.warnings,
    role: row.role,
    protection: row.protection,
    assetVersion: row.asset_version,
    history: row.history,
  };
  if (row.size_bytes !== null && row.size_bytes !== undefined) {
    candidate.sizeBytes = toNumber(row.size_bytes, "asset.size_bytes");
  }
  if (row.analysis !== null && row.analysis !== undefined) {
    candidate.analysis = row.analysis;
  }
  return parseReferenceV2AssetPersistence(candidate);
}

export function mapFramingRowToPersistence(
  input: unknown,
): ReferenceV2FramingEvidencePersistence {
  const row = requireRow(input, "framing row");
  return parseReferenceV2FramingEvidencePersistence({
    schemaVersion: row.schema_version,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    assetKey: row.asset_key,
    sourceAspectRatio: row.source_aspect_ratio,
    fullVehicleVisible: row.full_vehicle_visible,
    cropped: row.cropped,
    paddingPct: row.padding_pct,
    updatedAtIso: toIso(row.updated_at, "framing.updated_at"),
  });
}

// --------------------------------------------------------------------------
// Create inputs (owner + timestamps are DB authority and are NOT accepted)
// --------------------------------------------------------------------------

export interface ReferenceV2WorkspaceCreateInput {
  readonly workspaceId?: string;
  readonly vehicleId: string;
  readonly masterKey: string;
  readonly label: string;
  readonly vehicleClass: ReferenceV2WorkspacePersistence["vehicleClass"];
  readonly colorFamily: ReferenceV2WorkspacePersistence["colorFamily"];
  readonly identityClusterId: string;
  readonly masterVersion: number;
  readonly masterHistory: ReferenceV2WorkspacePersistence["masterHistory"];
}

export type ReferenceV2AssetCreateInput = Omit<
  ReferenceV2AssetPersistence,
  "rowId" | "userId" | "createdAtIso" | "updatedAtIso" | "schemaVersion"
> & {
  readonly rowId?: string;
  readonly schemaVersion?: number;
};

/**
 * Validiert einen Workspace-Create-Input vollstaendig gegen den durablen
 * Vertrag, indem DB-autoritative Felder mit strukturellen Platzhaltern
 * belegt werden. Kein konkurrierendes Vokabular.
 */
function validateWorkspaceCreateInput(
  input: ReferenceV2WorkspaceCreateInput,
): ReferenceV2WorkspacePersistence {
  return parseReferenceV2WorkspacePersistence({
    schemaVersion: REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION,
    workspaceId: input.workspaceId ?? PLACEHOLDER_UUID,
    userId: PLACEHOLDER_UUID,
    vehicleId: input.vehicleId,
    masterKey: input.masterKey,
    label: input.label,
    vehicleClass: input.vehicleClass,
    colorFamily: input.colorFamily ?? null,
    identityClusterId: input.identityClusterId,
    masterVersion: input.masterVersion,
    masterHistory: input.masterHistory,
    createdAtIso: PLACEHOLDER_ISO,
    updatedAtIso: PLACEHOLDER_ISO,
  });
}

function validateAssetCreateInput(
  input: ReferenceV2AssetCreateInput,
): ReferenceV2AssetPersistence {
  const { rowId, schemaVersion, ...rest } = input;
  return parseReferenceV2AssetPersistence({
    ...rest,
    schemaVersion: schemaVersion ?? REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION,
    rowId: rowId ?? PLACEHOLDER_UUID,
    userId: PLACEHOLDER_UUID,
    createdAtIso: PLACEHOLDER_ISO,
    updatedAtIso: PLACEHOLDER_ISO,
  });
}

// --------------------------------------------------------------------------
// Pure reverse serializers (durable contract -> DB row)
// --------------------------------------------------------------------------

/**
 * `user_id` ist hier ausschliesslich ein Transport-Platzhalter fuer die
 * generierten Insert-Typen. Der BEFORE-Trigger der DB ueberschreibt ihn aus
 * dem verankerten Fahrzeug bzw. Workspace.
 */
export function workspacePersistenceToDbRow(
  input: ReferenceV2WorkspaceCreateInput,
  transportUserId: string = PLACEHOLDER_UUID,
): ReferenceV2Row {
  const validated = validateWorkspaceCreateInput(input);
  const row: ReferenceV2Row = {
    user_id: assertUuid(transportUserId, "transportUserId"),
    vehicle_id: validated.vehicleId,
    master_key: validated.masterKey,
    label: validated.label,
    vehicle_class: validated.vehicleClass,
    color_family: validated.colorFamily,
    identity_cluster_id: validated.identityClusterId,
    master_version: validated.masterVersion,
    master_history: validated.masterHistory,
    schema_version: validated.schemaVersion,
  };
  if (input.workspaceId) row.id = assertUuid(input.workspaceId, "workspaceId");
  return row;
}

/** Siehe `workspacePersistenceToDbRow`: `user_id` ist Transport, nie Autoritaet. */
export function assetPersistenceToDbRow(
  input: ReferenceV2AssetCreateInput,
  transportUserId: string = PLACEHOLDER_UUID,
): ReferenceV2Row {
  const validated = validateAssetCreateInput(input);
  const row: ReferenceV2Row = {
    workspace_id: validated.workspaceId,
    user_id: assertUuid(transportUserId, "transportUserId"),
    asset_key: validated.assetKey,
    requested_perspective_id: validated.requestedPerspectiveId,
    canonical_perspective_id: validated.canonicalPerspectiveId,
    file_name: validated.fileName,
    storage_bucket: REFERENCE_V2_STORAGE_BUCKET,
    storage_path: validated.storagePath,
    mime_type: validated.mimeType,
    size_bytes: validated.sizeBytes ?? null,
    sha256: validated.sha256,
    intake: validated.intake,
    analysis: validated.analysis ?? null,
    scores: validated.scores,
    weighted_score: validated.weightedScore,
    hard_failures: validated.hardFailures,
    blockers: validated.blockers,
    warnings: validated.warnings,
    role: validated.role,
    protection: validated.protection,
    asset_version: validated.assetVersion,
    history: validated.history,
    schema_version: validated.schemaVersion,
  };
  if (input.rowId) row.id = assertUuid(input.rowId, "rowId");
  return row;
}

/** Siehe oben: `user_id` ist Transport-Platzhalter, DB leitet den Owner ab. */
export function framingPersistenceToDbRow(
  evidence: ReferenceV2FramingEvidencePersistence,
  transportUserId: string = PLACEHOLDER_UUID,
): ReferenceV2Row {
  const validated = parseReferenceV2FramingEvidencePersistence(evidence);
  return {
    workspace_id: validated.workspaceId,
    asset_key: validated.assetKey,
    user_id: assertUuid(transportUserId, "transportUserId"),
    schema_version: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
    source_aspect_ratio: validated.sourceAspectRatio,
    full_vehicle_visible: validated.fullVehicleVisible,
    cropped: validated.cropped,
    padding_pct: validated.paddingPct,
    updated_at: validated.updatedAtIso,
  };
}

// --------------------------------------------------------------------------
// Bundle
// --------------------------------------------------------------------------

export interface ReferenceV2PersistenceBundle {
  readonly workspace: ReferenceV2WorkspacePersistence;
  readonly assets: readonly ReferenceV2AssetPersistence[];
  readonly framingEvidence: readonly ReferenceV2FramingEvidencePersistence[];
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

const ALL_COLUMNS = "*";

export interface ReferenceV2PersistenceRepository {
  loadBundleByVehicleId(
    vehicleId: string,
  ): Promise<ReferenceV2PersistenceBundle | null>;
  createWorkspace(
    input: ReferenceV2WorkspaceCreateInput,
  ): Promise<ReferenceV2WorkspacePersistence>;
  updateWorkspace(
    workspace: ReferenceV2WorkspacePersistence,
  ): Promise<ReferenceV2WorkspacePersistence>;
  createAsset(
    input: ReferenceV2AssetCreateInput,
  ): Promise<ReferenceV2AssetPersistence>;
  updateAsset(
    asset: ReferenceV2AssetPersistence,
  ): Promise<ReferenceV2AssetPersistence>;
  deleteAsset(workspaceId: string, assetKey: string): Promise<void>;
  upsertFramingEvidence(
    evidence: ReferenceV2FramingEvidencePersistence,
  ): Promise<ReferenceV2FramingEvidencePersistence>;
}

export function createReferenceV2PersistenceRepository(
  client: ReferenceV2ClientPort,
): ReferenceV2PersistenceRepository {
  async function loadBundleByVehicleId(
    vehicleId: string,
  ): Promise<ReferenceV2PersistenceBundle | null> {
    assertUuid(vehicleId, "vehicleId");

    const workspaceResult = await client
      .from(REFERENCE_V2_TABLES.workspaces)
      .select(ALL_COLUMNS)
      .eq("vehicle_id", vehicleId)
      .maybeSingle();
    const workspaceRow = unwrap(workspaceResult, "load workspace");
    if (!workspaceRow) return null;

    const workspace = mapWorkspaceRowToPersistence(workspaceRow);

    const [assetResult, framingResult] = await Promise.all([
      client
        .from(REFERENCE_V2_TABLES.assets)
        .select(ALL_COLUMNS)
        .eq("workspace_id", workspace.workspaceId)
        .order("created_at", { ascending: true })
        .order("asset_key", { ascending: true }),
      client
        .from(REFERENCE_V2_TABLES.framingEvidence)
        .select(ALL_COLUMNS)
        .eq("workspace_id", workspace.workspaceId)
        .order("asset_key", { ascending: true }),
    ]);

    const assetRows = unwrap(assetResult, "load assets") ?? [];
    const framingRows = unwrap(framingResult, "load framing evidence") ?? [];

    const assets = assetRows.map(mapAssetRowToPersistence);
    const framingEvidence = framingRows.map(mapFramingRowToPersistence);

    const assetKeys = new Set<string>();
    for (const asset of assets) {
      if (
        asset.workspaceId !== workspace.workspaceId ||
        asset.userId !== workspace.userId
      ) {
        throw new ReferenceV2RepositoryError(
          "asset does not belong to the loaded workspace (fail-closed)",
        );
      }
      if (assetKeys.has(asset.assetKey)) {
        throw new ReferenceV2RepositoryError(
          "duplicate asset key in workspace (fail-closed)",
        );
      }
      assetKeys.add(asset.assetKey);
    }

    const framingKeys = new Set<string>();
    for (const evidence of framingEvidence) {
      if (
        evidence.workspaceId !== workspace.workspaceId ||
        evidence.userId !== workspace.userId
      ) {
        throw new ReferenceV2RepositoryError(
          "framing evidence does not belong to the loaded workspace (fail-closed)",
        );
      }
      if (framingKeys.has(evidence.assetKey)) {
        throw new ReferenceV2RepositoryError(
          "duplicate framing evidence key in workspace (fail-closed)",
        );
      }
      if (!assetKeys.has(evidence.assetKey)) {
        throw new ReferenceV2RepositoryError(
          "framing evidence references an unknown asset key (fail-closed)",
        );
      }
      framingKeys.add(evidence.assetKey);
    }

    return { workspace, assets, framingEvidence };
  }

  async function createWorkspace(
    input: ReferenceV2WorkspaceCreateInput,
  ): Promise<ReferenceV2WorkspacePersistence> {
    const row = workspacePersistenceToDbRow(input);
    const result = await client
      .from(REFERENCE_V2_TABLES.workspaces)
      .insert(row)
      .select(ALL_COLUMNS)
      .single();
    const inserted = unwrap(result, "create workspace");
    if (!inserted) {
      throw new ReferenceV2RepositoryError(
        "create workspace: database returned no row",
      );
    }
    return mapWorkspaceRowToPersistence(inserted);
  }

  async function updateWorkspace(
    workspace: ReferenceV2WorkspacePersistence,
  ): Promise<ReferenceV2WorkspacePersistence> {
    const validated = parseReferenceV2WorkspacePersistence(workspace);
    const result = await client
      .from(REFERENCE_V2_TABLES.workspaces)
      .update({
        label: validated.label,
        vehicle_class: validated.vehicleClass,
        color_family: validated.colorFamily,
        identity_cluster_id: validated.identityClusterId,
        master_version: validated.masterVersion,
        master_history: validated.masterHistory,
        schema_version: validated.schemaVersion,
      })
      .eq("id", validated.workspaceId)
      .eq("vehicle_id", validated.vehicleId)
      .select(ALL_COLUMNS)
      .single();
    const updated = unwrap(result, "update workspace");
    if (!updated) {
      throw new ReferenceV2RepositoryNotFoundError(
        "update workspace: no matching row",
      );
    }
    return mapWorkspaceRowToPersistence(updated);
  }

  async function createAsset(
    input: ReferenceV2AssetCreateInput,
  ): Promise<ReferenceV2AssetPersistence> {
    const row = assetPersistenceToDbRow(input);
    const result = await client
      .from(REFERENCE_V2_TABLES.assets)
      .insert(row)
      .select(ALL_COLUMNS)
      .single();
    const inserted = unwrap(result, "create asset");
    if (!inserted) {
      throw new ReferenceV2RepositoryError(
        "create asset: database returned no row",
      );
    }
    return mapAssetRowToPersistence(inserted);
  }

  async function updateAsset(
    asset: ReferenceV2AssetPersistence,
  ): Promise<ReferenceV2AssetPersistence> {
    const validated = parseReferenceV2AssetPersistence(asset);
    const result = await client
      .from(REFERENCE_V2_TABLES.assets)
      .update({
        requested_perspective_id: validated.requestedPerspectiveId,
        canonical_perspective_id: validated.canonicalPerspectiveId,
        file_name: validated.fileName,
        intake: validated.intake,
        analysis: validated.analysis ?? null,
        scores: validated.scores,
        weighted_score: validated.weightedScore,
        hard_failures: validated.hardFailures,
        blockers: validated.blockers,
        warnings: validated.warnings,
        role: validated.role,
        protection: validated.protection,
        asset_version: validated.assetVersion,
        history: validated.history,
        schema_version: validated.schemaVersion,
      })
      .eq("id", validated.rowId)
      .eq("workspace_id", validated.workspaceId)
      .eq("asset_key", validated.assetKey)
      .select(ALL_COLUMNS)
      .single();
    const updated = unwrap(result, "update asset");
    if (!updated) {
      throw new ReferenceV2RepositoryNotFoundError(
        "update asset: no matching row",
      );
    }
    return mapAssetRowToPersistence(updated);
  }

  async function deleteAsset(
    workspaceId: string,
    assetKey: string,
  ): Promise<void> {
    assertUuid(workspaceId, "workspaceId");
    assertNonEmpty(assetKey, "assetKey");
    const result = await client
      .from(REFERENCE_V2_TABLES.assets)
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("asset_key", assetKey);
    unwrap(result, "delete asset");
  }

  async function upsertFramingEvidence(
    evidence: ReferenceV2FramingEvidencePersistence,
  ): Promise<ReferenceV2FramingEvidencePersistence> {
    const row = framingPersistenceToDbRow(evidence);
    const result = await client
      .from(REFERENCE_V2_TABLES.framingEvidence)
      .upsert(row, { onConflict: "workspace_id,asset_key" })
      .select(ALL_COLUMNS)
      .single();
    const upserted = unwrap(result, "upsert framing evidence");
    if (!upserted) {
      throw new ReferenceV2RepositoryError(
        "upsert framing evidence: database returned no row",
      );
    }
    return mapFramingRowToPersistence(upserted);
  }

  return {
    loadBundleByVehicleId,
    createWorkspace,
    updateWorkspace,
    createAsset,
    updateAsset,
    deleteAsset,
    upsertFramingEvidence,
  };
}

// --------------------------------------------------------------------------
// Default repository (lazy — keeps pure unit tests free of client/env coupling)
// --------------------------------------------------------------------------

let defaultRepository: ReferenceV2PersistenceRepository | null = null;

/**
 * Nutzt den bestehenden App-Client (kein zweiter Client). Der Import ist
 * bewusst dynamisch, damit reine Unit-Tests den Client nicht instanziieren.
 */
export async function getDefaultReferenceV2PersistenceRepository(): Promise<ReferenceV2PersistenceRepository> {
  if (!defaultRepository) {
    const mod = await import("@/integrations/supabase/client");
    defaultRepository = createReferenceV2PersistenceRepository(
      mod.supabase as unknown as ReferenceV2ClientPort,
    );
  }
  return defaultRepository;
}

export async function loadReferenceV2BundleByVehicleId(
  vehicleId: string,
): Promise<ReferenceV2PersistenceBundle | null> {
  const repo = await getDefaultReferenceV2PersistenceRepository();
  return repo.loadBundleByVehicleId(vehicleId);
}

export async function createReferenceV2Workspace(
  input: ReferenceV2WorkspaceCreateInput,
): Promise<ReferenceV2WorkspacePersistence> {
  const repo = await getDefaultReferenceV2PersistenceRepository();
  return repo.createWorkspace(input);
}

export async function updateReferenceV2Workspace(
  workspace: ReferenceV2WorkspacePersistence,
): Promise<ReferenceV2WorkspacePersistence> {
  const repo = await getDefaultReferenceV2PersistenceRepository();
  return repo.updateWorkspace(workspace);
}

export async function createReferenceV2Asset(
  input: ReferenceV2AssetCreateInput,
): Promise<ReferenceV2AssetPersistence> {
  const repo = await getDefaultReferenceV2PersistenceRepository();
  return repo.createAsset(input);
}

export async function updateReferenceV2Asset(
  asset: ReferenceV2AssetPersistence,
): Promise<ReferenceV2AssetPersistence> {
  const repo = await getDefaultReferenceV2PersistenceRepository();
  return repo.updateAsset(asset);
}

export async function deleteReferenceV2Asset(
  workspaceId: string,
  assetKey: string,
): Promise<void> {
  const repo = await getDefaultReferenceV2PersistenceRepository();
  return repo.deleteAsset(workspaceId, assetKey);
}

export async function upsertReferenceV2FramingEvidence(
  evidence: ReferenceV2FramingEvidencePersistence,
): Promise<ReferenceV2FramingEvidencePersistence> {
  const repo = await getDefaultReferenceV2PersistenceRepository();
  return repo.upsertFramingEvidence(evidence);
}

export { ReferenceV2PersistenceError };
