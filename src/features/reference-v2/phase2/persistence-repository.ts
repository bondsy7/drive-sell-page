import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
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
 * Reference V2 — Phase 2.6B (hardened): typed persistence repository,
 * generated-schema-bound row mappers and a narrow semantic port.
 *
 * Isolierte Persistenzgrenze fuer AUSSCHLIESSLICH die drei Reference-V2-
 * Tabellen. Keine Storage-Objekte, keine Signed URLs, keine Provider-Aufrufe,
 * keine Generierung, keine Store-/UI-Hydration.
 *
 * INVARIANTEN
 * - Schema-Bindung: Spaltenlisten, Insert- und Update-Payloads sind an die
 *   generierten Supabase-Typen gebunden. Schema-Drift bricht die Compile-Zeit,
 *   nicht erst die Laufzeit.
 * - Jede DB-Zeile ist untrusted input: erst Own-Property-Guard gegen die
 *   erwarteten Spalten, dann striktes Parsen durch den durablen Vertrag
 *   (`persistence-contract.ts`). Keine Defaults, die fehlerhafte oder
 *   fehlende DB-Daten verdecken.
 * - Owner (`user_id`) ist AUSSCHLIESSLICH DB-Autoritaet: BEFORE-Trigger
 *   leiten ihn aus dem verankerten Datensatz ab und ueberschreiben jeden
 *   mitgeschickten Wert. Der in Insert-Payloads enthaltene `user_id` ist ein
 *   reiner Transport-Platzhalter, weil die generierten Insert-Typen die Spalte
 *   verlangen; er ist NIEMALS Owner-Autoritaet.
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
// Generated schema binding (single source of column truth)
// --------------------------------------------------------------------------

type PublicTables = Database["public"]["Tables"];
type PublicTableName = keyof PublicTables;

export const REFERENCE_V2_TABLES = {
  workspaces: "reference_v2_workspaces",
  assets: "reference_v2_assets",
  framingEvidence: "reference_v2_framing_evidence",
} as const satisfies Record<string, PublicTableName>;

export type ReferenceV2TableName =
  (typeof REFERENCE_V2_TABLES)[keyof typeof REFERENCE_V2_TABLES];

export type ReferenceV2WorkspaceRow =
  PublicTables["reference_v2_workspaces"]["Row"];
export type ReferenceV2WorkspaceInsert =
  PublicTables["reference_v2_workspaces"]["Insert"];
export type ReferenceV2WorkspaceUpdate =
  PublicTables["reference_v2_workspaces"]["Update"];

export type ReferenceV2AssetRow = PublicTables["reference_v2_assets"]["Row"];
export type ReferenceV2AssetInsert =
  PublicTables["reference_v2_assets"]["Insert"];
export type ReferenceV2AssetUpdate =
  PublicTables["reference_v2_assets"]["Update"];

export type ReferenceV2FramingRow =
  PublicTables["reference_v2_framing_evidence"]["Row"];
export type ReferenceV2FramingInsert =
  PublicTables["reference_v2_framing_evidence"]["Insert"];

/** Spaltenlisten sind an die generierten Row-Typen gebunden. */
const WORKSPACE_ROW_COLUMNS = [
  "id",
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
  "created_at",
  "updated_at",
] as const satisfies readonly (keyof ReferenceV2WorkspaceRow)[];

const ASSET_ROW_COLUMNS = [
  "id",
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
  "created_at",
  "updated_at",
] as const satisfies readonly (keyof ReferenceV2AssetRow)[];

const FRAMING_ROW_COLUMNS = [
  "workspace_id",
  "asset_key",
  "user_id",
  "schema_version",
  "source_aspect_ratio",
  "full_vehicle_visible",
  "cropped",
  "padding_pct",
  "updated_at",
] as const satisfies readonly (keyof ReferenceV2FramingRow)[];

/**
 * Compile-Zeit-Vollstaendigkeit: eine neue Spalte im generierten Schema muss
 * hier bewusst nachgezogen werden, sonst schlaegt der Typecheck fehl.
 */
type ColumnsExhaustive<
  TRow,
  TColumns extends readonly (keyof TRow)[],
> = Exclude<keyof TRow, TColumns[number]> extends never ? true : never;

const _workspaceColumnsExhaustive: ColumnsExhaustive<
  ReferenceV2WorkspaceRow,
  typeof WORKSPACE_ROW_COLUMNS
> = true;
const _assetColumnsExhaustive: ColumnsExhaustive<
  ReferenceV2AssetRow,
  typeof ASSET_ROW_COLUMNS
> = true;
const _framingColumnsExhaustive: ColumnsExhaustive<
  ReferenceV2FramingRow,
  typeof FRAMING_ROW_COLUMNS
> = true;
void _workspaceColumnsExhaustive;
void _assetColumnsExhaustive;
void _framingColumnsExhaustive;

/**
 * Lokalisierte JSON-Spaltengrenze: die vertraglich geparsten Werte sind per
 * Schema JSON-serialisierbar, der generierte `Json`-Typ kann diese Strukturen
 * aber nicht strukturell ausdruecken. Ausschliesslich hier erlaubt.
 */
function toJsonColumn(value: unknown): Json {
  return value as Json;
}

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
// Narrow semantic port (no query-builder mimicry)
// --------------------------------------------------------------------------

export interface ReferenceV2DbError {
  readonly code?: string | null;
  readonly message: string;
  readonly details?: string | null;
}

export interface ReferenceV2PortResult<T> {
  readonly data: T;
  readonly error: ReferenceV2DbError | null;
}

/** Nur mutable Spalten; Anker und durable Datei-Identitaet fehlen bewusst. */
export type ReferenceV2WorkspaceUpdatePatch = Required<
  Pick<
    ReferenceV2WorkspaceUpdate,
    | "label"
    | "vehicle_class"
    | "color_family"
    | "identity_cluster_id"
    | "master_version"
    | "master_history"
    | "schema_version"
  >
>;

export type ReferenceV2AssetUpdatePatch = Required<
  Pick<
    ReferenceV2AssetUpdate,
    | "requested_perspective_id"
    | "canonical_perspective_id"
    | "file_name"
    | "intake"
    | "analysis"
    | "scores"
    | "weighted_score"
    | "hard_failures"
    | "blockers"
    | "warnings"
    | "role"
    | "protection"
    | "asset_version"
    | "history"
    | "schema_version"
  >
>;

export interface ReferenceV2WorkspaceUpdateKeys {
  readonly workspaceId: string;
  readonly vehicleId: string;
}

export interface ReferenceV2AssetUpdateKeys {
  readonly rowId: string;
  readonly workspaceId: string;
  readonly assetKey: string;
}

/**
 * Semantischer Port: typisierte Zeilen statt nachgebautem Query-Builder.
 * Rueckgabe-Zeilen bleiben zur Laufzeit untrusted und werden gemappt.
 */
export interface ReferenceV2SemanticPort {
  findWorkspaceByVehicleId(
    vehicleId: string,
  ): Promise<ReferenceV2PortResult<ReferenceV2WorkspaceRow | null>>;
  listAssets(
    workspaceId: string,
  ): Promise<ReferenceV2PortResult<ReferenceV2AssetRow[] | null>>;
  listFraming(
    workspaceId: string,
  ): Promise<ReferenceV2PortResult<ReferenceV2FramingRow[] | null>>;
  insertWorkspace(
    values: ReferenceV2WorkspaceInsert,
  ): Promise<ReferenceV2PortResult<ReferenceV2WorkspaceRow | null>>;
  updateWorkspace(
    patch: ReferenceV2WorkspaceUpdatePatch,
    keys: ReferenceV2WorkspaceUpdateKeys,
  ): Promise<ReferenceV2PortResult<ReferenceV2WorkspaceRow | null>>;
  insertAsset(
    values: ReferenceV2AssetInsert,
  ): Promise<ReferenceV2PortResult<ReferenceV2AssetRow | null>>;
  updateAsset(
    patch: ReferenceV2AssetUpdatePatch,
    keys: ReferenceV2AssetUpdateKeys,
  ): Promise<ReferenceV2PortResult<ReferenceV2AssetRow | null>>;
  deleteAsset(
    workspaceId: string,
    assetKey: string,
  ): Promise<ReferenceV2PortResult<null>>;
  upsertFraming(
    values: ReferenceV2FramingInsert,
  ): Promise<ReferenceV2PortResult<ReferenceV2FramingRow | null>>;
}

// --------------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Struktureller Platzhalter fuer DB-autoritative Felder vor dem Insert. */
const PLACEHOLDER_UUID = "00000000-0000-4000-8000-000000000000";
const PLACEHOLDER_ISO = "1970-01-01T00:00:00.000Z";

function assertUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new ReferenceV2RepositoryError(`${field} must be a valid UUID`);
  }
  return value;
}

/**
 * Pfad-sicheres, durables Schluesselsegment — identische Semantik wie der
 * Storage-Pfad-Helfer des Vertrags (kein neues Vokabular).
 */
function assertSafeKeySegment(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("..") ||
    CONTROL_CHARS.test(value)
  ) {
    throw new ReferenceV2RepositoryError(
      `${field} must be a non-empty path-safe segment`,
    );
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

/**
 * Own-Property-Guard: eine fehlende Spalte ist eine defekte Projektion und
 * darf NIEMALS wie ein legitimes SQL NULL aussehen. Explizites `null` bleibt
 * fuer nullable Spalten gueltig; `undefined` ist immer malformed.
 */
function requireRowColumns<TRow>(
  input: unknown,
  columns: readonly (keyof TRow)[],
  label: string,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ReferenceV2RepositoryError(`${label} must be a database row`);
  }
  const row = input as Record<string, unknown>;
  for (const column of columns) {
    const key = String(column);
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      throw new ReferenceV2RepositoryError(
        `${label}: missing database column "${key}" (fail-closed)`,
      );
    }
    if (row[key] === undefined) {
      throw new ReferenceV2RepositoryError(
        `${label}: database column "${key}" is undefined (fail-closed)`,
      );
    }
  }
  return row;
}

// --------------------------------------------------------------------------
// Error translation
// --------------------------------------------------------------------------

const UNIQUE_VIOLATION = "23505";
const RAISED_EXCEPTION = "P0001";
/** PostgREST: "JSON object requested, multiple (or no) rows returned". */
const NO_SINGLE_ROW = "PGRST116";

function translateDbError(
  error: ReferenceV2DbError,
  context: string,
  options: { readonly zeroRowsIsNotFound?: boolean } = {},
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
  // Nur im UPDATE-Kontext ist PGRST116 eine Null-Treffer-Aussage; RLS- oder
  // DB-Fehler werden NIEMALS zu NotFound umgedeutet.
  if (options.zeroRowsIsNotFound && code === NO_SINGLE_ROW) {
    return new ReferenceV2RepositoryNotFoundError(
      `${context}: no matching row`,
      code,
    );
  }
  return new ReferenceV2RepositoryError(`${context}: ${message}`, code);
}

function unwrap<T>(
  result: ReferenceV2PortResult<T>,
  context: string,
  options: { readonly zeroRowsIsNotFound?: boolean } = {},
): T {
  if (result.error) throw translateDbError(result.error, context, options);
  return result.data;
}

// --------------------------------------------------------------------------
// Pure row mappers (generated DB row -> durable contract)
// --------------------------------------------------------------------------

export function mapWorkspaceRowToPersistence(
  input: ReferenceV2WorkspaceRow | unknown,
): ReferenceV2WorkspacePersistence {
  const row = requireRowColumns<ReferenceV2WorkspaceRow>(
    input,
    WORKSPACE_ROW_COLUMNS,
    "workspace row",
  );
  return parseReferenceV2WorkspacePersistence({
    schemaVersion: row.schema_version,
    workspaceId: row.id,
    userId: row.user_id,
    vehicleId: row.vehicle_id,
    masterKey: row.master_key,
    label: row.label,
    vehicleClass: row.vehicle_class,
    colorFamily: row.color_family,
    identityClusterId: row.identity_cluster_id,
    masterVersion: row.master_version,
    masterHistory: row.master_history,
    createdAtIso: toIso(row.created_at, "workspace.created_at"),
    updatedAtIso: toIso(row.updated_at, "workspace.updated_at"),
  });
}

export function mapAssetRowToPersistence(
  input: ReferenceV2AssetRow | unknown,
): ReferenceV2AssetPersistence {
  const row = requireRowColumns<ReferenceV2AssetRow>(
    input,
    ASSET_ROW_COLUMNS,
    "asset row",
  );
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
  // SQL NULL bleibt gueltig und bedeutet "nicht gesetzt"; ein FEHLENDER
  // Schluessel wurde bereits oben fail-closed abgewiesen.
  if (row.size_bytes !== null) {
    candidate.sizeBytes = toNumber(row.size_bytes, "asset.size_bytes");
  }
  if (row.analysis !== null) {
    candidate.analysis = row.analysis;
  }
  return parseReferenceV2AssetPersistence(candidate);
}

export function mapFramingRowToPersistence(
  input: ReferenceV2FramingRow | unknown,
): ReferenceV2FramingEvidencePersistence {
  const row = requireRowColumns<ReferenceV2FramingRow>(
    input,
    FRAMING_ROW_COLUMNS,
    "framing row",
  );
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
// Pure reverse serializers (durable contract -> generated Insert payloads)
// --------------------------------------------------------------------------

/** DB setzt `created_at`/`updated_at`; sie sind nie Teil des Payloads. */
export type ReferenceV2WorkspaceInsertPayload = Omit<
  ReferenceV2WorkspaceInsert,
  "created_at" | "updated_at"
>;

export type ReferenceV2AssetInsertPayload = Omit<
  ReferenceV2AssetInsert,
  "created_at" | "updated_at"
>;

/**
 * `user_id` ist hier ausschliesslich ein Transport-Platzhalter fuer die
 * generierten Insert-Typen. Der BEFORE-Trigger der DB ueberschreibt ihn aus
 * dem verankerten Fahrzeug bzw. Workspace.
 */
export function workspacePersistenceToDbRow(
  input: ReferenceV2WorkspaceCreateInput,
  transportUserId: string = PLACEHOLDER_UUID,
): ReferenceV2WorkspaceInsertPayload {
  const validated = validateWorkspaceCreateInput(input);
  const row: ReferenceV2WorkspaceInsertPayload = {
    user_id: assertUuid(transportUserId, "transportUserId"),
    vehicle_id: validated.vehicleId,
    master_key: validated.masterKey,
    label: validated.label,
    vehicle_class: validated.vehicleClass,
    color_family: validated.colorFamily,
    identity_cluster_id: validated.identityClusterId,
    master_version: validated.masterVersion,
    master_history: toJsonColumn(validated.masterHistory),
    schema_version: validated.schemaVersion,
  };
  if (input.workspaceId) row.id = assertUuid(input.workspaceId, "workspaceId");
  return row;
}

/** Siehe `workspacePersistenceToDbRow`: `user_id` ist Transport, nie Autoritaet. */
export function assetPersistenceToDbRow(
  input: ReferenceV2AssetCreateInput,
  transportUserId: string = PLACEHOLDER_UUID,
): ReferenceV2AssetInsertPayload {
  const validated = validateAssetCreateInput(input);
  const row: ReferenceV2AssetInsertPayload = {
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
    intake: toJsonColumn(validated.intake),
    analysis: validated.analysis === undefined
      ? null
      : toJsonColumn(validated.analysis),
    scores: toJsonColumn(validated.scores),
    weighted_score: validated.weightedScore,
    hard_failures: [...validated.hardFailures],
    blockers: [...validated.blockers],
    warnings: [...validated.warnings],
    role: validated.role,
    protection: validated.protection,
    asset_version: validated.assetVersion,
    history: toJsonColumn(validated.history),
    schema_version: validated.schemaVersion,
  };
  if (input.rowId) row.id = assertUuid(input.rowId, "rowId");
  return row;
}

/** Siehe oben: `user_id` ist Transport-Platzhalter, DB leitet den Owner ab. */
export function framingPersistenceToDbRow(
  evidence: ReferenceV2FramingEvidencePersistence,
  transportUserId: string = PLACEHOLDER_UUID,
): ReferenceV2FramingInsert {
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

function workspaceUpdatePatch(
  validated: ReferenceV2WorkspacePersistence,
): ReferenceV2WorkspaceUpdatePatch {
  return {
    label: validated.label,
    vehicle_class: validated.vehicleClass,
    color_family: validated.colorFamily,
    identity_cluster_id: validated.identityClusterId,
    master_version: validated.masterVersion,
    master_history: toJsonColumn(validated.masterHistory),
    schema_version: validated.schemaVersion,
  };
}

function assetUpdatePatch(
  validated: ReferenceV2AssetPersistence,
): ReferenceV2AssetUpdatePatch {
  return {
    requested_perspective_id: validated.requestedPerspectiveId,
    canonical_perspective_id: validated.canonicalPerspectiveId,
    file_name: validated.fileName,
    intake: toJsonColumn(validated.intake),
    analysis: validated.analysis === undefined
      ? null
      : toJsonColumn(validated.analysis),
    scores: toJsonColumn(validated.scores),
    weighted_score: validated.weightedScore,
    hard_failures: [...validated.hardFailures],
    blockers: [...validated.blockers],
    warnings: [...validated.warnings],
    role: validated.role,
    protection: validated.protection,
    asset_version: validated.assetVersion,
    history: toJsonColumn(validated.history),
    schema_version: validated.schemaVersion,
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
// Production port (real typed client, no escape casts)
// --------------------------------------------------------------------------

const ALL_COLUMNS = "*";

/**
 * Adapter auf den BESTEHENDEN App-Client (kein zweiter Client). UPDATEs nutzen
 * `maybeSingle()`, damit null Treffer kein PostgREST-Fehler sind und explizit
 * als NotFound gemeldet werden koennen.
 */
export function createReferenceV2SupabasePort(
  client: typeof supabase = supabase,
): ReferenceV2SemanticPort {
  return {
    async findWorkspaceByVehicleId(vehicleId) {
      return await client
        .from(REFERENCE_V2_TABLES.workspaces)
        .select(ALL_COLUMNS)
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
    },
    async listAssets(workspaceId) {
      return await client
        .from(REFERENCE_V2_TABLES.assets)
        .select(ALL_COLUMNS)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true })
        .order("asset_key", { ascending: true });
    },
    async listFraming(workspaceId) {
      return await client
        .from(REFERENCE_V2_TABLES.framingEvidence)
        .select(ALL_COLUMNS)
        .eq("workspace_id", workspaceId)
        .order("asset_key", { ascending: true });
    },
    async insertWorkspace(values) {
      return await client
        .from(REFERENCE_V2_TABLES.workspaces)
        .insert(values)
        .select(ALL_COLUMNS)
        .single();
    },
    async updateWorkspace(patch, keys) {
      return await client
        .from(REFERENCE_V2_TABLES.workspaces)
        .update(patch)
        .eq("id", keys.workspaceId)
        .eq("vehicle_id", keys.vehicleId)
        .select(ALL_COLUMNS)
        .maybeSingle();
    },
    async insertAsset(values) {
      return await client
        .from(REFERENCE_V2_TABLES.assets)
        .insert(values)
        .select(ALL_COLUMNS)
        .single();
    },
    async updateAsset(patch, keys) {
      return await client
        .from(REFERENCE_V2_TABLES.assets)
        .update(patch)
        .eq("id", keys.rowId)
        .eq("workspace_id", keys.workspaceId)
        .eq("asset_key", keys.assetKey)
        .select(ALL_COLUMNS)
        .maybeSingle();
    },
    async deleteAsset(workspaceId, assetKey) {
      const { error } = await client
        .from(REFERENCE_V2_TABLES.assets)
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("asset_key", assetKey);
      return { data: null, error };
    },
    async upsertFraming(values) {
      return await client
        .from(REFERENCE_V2_TABLES.framingEvidence)
        .upsert(values, { onConflict: "workspace_id,asset_key" })
        .select(ALL_COLUMNS)
        .single();
    },
  };
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

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
  port: ReferenceV2SemanticPort,
): ReferenceV2PersistenceRepository {
  async function loadBundleByVehicleId(
    vehicleId: string,
  ): Promise<ReferenceV2PersistenceBundle | null> {
    assertUuid(vehicleId, "vehicleId");

    const workspaceRow = unwrap(
      await port.findWorkspaceByVehicleId(vehicleId),
      "load workspace",
    );
    if (!workspaceRow) return null;

    const workspace = mapWorkspaceRowToPersistence(workspaceRow);

    const [assetResult, framingResult] = await Promise.all([
      port.listAssets(workspace.workspaceId),
      port.listFraming(workspace.workspaceId),
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
    const values = workspacePersistenceToDbRow(input);
    const inserted = unwrap(
      await port.insertWorkspace(values),
      "create workspace",
    );
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
    const updated = unwrap(
      await port.updateWorkspace(workspaceUpdatePatch(validated), {
        workspaceId: validated.workspaceId,
        vehicleId: validated.vehicleId,
      }),
      "update workspace",
      { zeroRowsIsNotFound: true },
    );
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
    const values = assetPersistenceToDbRow(input);
    const inserted = unwrap(await port.insertAsset(values), "create asset");
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
    const updated = unwrap(
      await port.updateAsset(assetUpdatePatch(validated), {
        rowId: validated.rowId,
        workspaceId: validated.workspaceId,
        assetKey: validated.assetKey,
      }),
      "update asset",
      { zeroRowsIsNotFound: true },
    );
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
    assertSafeKeySegment(assetKey, "assetKey");
    unwrap(await port.deleteAsset(workspaceId, assetKey), "delete asset");
  }

  async function upsertFramingEvidence(
    evidence: ReferenceV2FramingEvidencePersistence,
  ): Promise<ReferenceV2FramingEvidencePersistence> {
    const values = framingPersistenceToDbRow(evidence);
    const upserted = unwrap(
      await port.upsertFraming(values),
      "upsert framing evidence",
    );
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
// Default repository (production port over the existing app client)
// --------------------------------------------------------------------------

let defaultRepository: ReferenceV2PersistenceRepository | null = null;

export function getDefaultReferenceV2PersistenceRepository(): ReferenceV2PersistenceRepository {
  if (!defaultRepository) {
    defaultRepository = createReferenceV2PersistenceRepository(
      createReferenceV2SupabasePort(),
    );
  }
  return defaultRepository;
}

export async function loadReferenceV2BundleByVehicleId(
  vehicleId: string,
): Promise<ReferenceV2PersistenceBundle | null> {
  return getDefaultReferenceV2PersistenceRepository().loadBundleByVehicleId(
    vehicleId,
  );
}

export async function createReferenceV2Workspace(
  input: ReferenceV2WorkspaceCreateInput,
): Promise<ReferenceV2WorkspacePersistence> {
  return getDefaultReferenceV2PersistenceRepository().createWorkspace(input);
}

export async function updateReferenceV2Workspace(
  workspace: ReferenceV2WorkspacePersistence,
): Promise<ReferenceV2WorkspacePersistence> {
  return getDefaultReferenceV2PersistenceRepository().updateWorkspace(
    workspace,
  );
}

export async function createReferenceV2Asset(
  input: ReferenceV2AssetCreateInput,
): Promise<ReferenceV2AssetPersistence> {
  return getDefaultReferenceV2PersistenceRepository().createAsset(input);
}

export async function updateReferenceV2Asset(
  asset: ReferenceV2AssetPersistence,
): Promise<ReferenceV2AssetPersistence> {
  return getDefaultReferenceV2PersistenceRepository().updateAsset(asset);
}

export async function deleteReferenceV2Asset(
  workspaceId: string,
  assetKey: string,
): Promise<void> {
  return getDefaultReferenceV2PersistenceRepository().deleteAsset(
    workspaceId,
    assetKey,
  );
}

export async function upsertReferenceV2FramingEvidence(
  evidence: ReferenceV2FramingEvidencePersistence,
): Promise<ReferenceV2FramingEvidencePersistence> {
  return getDefaultReferenceV2PersistenceRepository().upsertFramingEvidence(
    evidence,
  );
}

export { ReferenceV2PersistenceError };
