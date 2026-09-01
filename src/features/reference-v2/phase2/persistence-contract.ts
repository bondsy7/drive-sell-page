import { z } from "zod";
import { VehicleClassV2Schema } from "../domain/vehicle-classes";
import { PerspectiveIdSchema } from "../domain/perspectives/types";
import {
  MatchComponentScoresSchema,
  ReferenceHardFailCodeSchema,
} from "../domain/readiness";
import { VisionIntakeResultSchema } from "../domain/vision-intake";
import { ColorFamilySchema } from "../phase1/color-families";
import {
  AssetHistoryEntrySchema,
  AssetProtectionStateSchema,
  IngestionBlockerCodeSchema,
  ReferenceRoleSchema,
} from "../phase1/vehicle-master";
import { ReferenceAnalysisRecordSchema } from "../phase1-5/analysis-record";
import { REFERENCE_V2_ALLOWED_IMAGE_MIME } from "../phase1-5/provider-adapter";
import { FORBIDDEN_SEMANTIC_KEYS } from "../phase1-5/analyzer-contract";
import { CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION } from "./framing-evidence";

/**
 * Reference V2 — Phase 2.6A: Vehicle-anchored persistence contract.
 *
 * Reiner TypeScript-/Zod-Vertrag fuer die DURABLE Persistenzgrenze. Keine
 * Laufzeit-Hydration, keine Writes, kein I/O, kein Provider-Aufruf.
 *
 * INVARIANTEN
 * - `vehicleId` ist AUSSCHLIESSLICH die stabile Business-Assoziation
 *   (`public.vehicles.id`). Sie ist niemals visuelle Identitaets-Evidenz und
 *   darf niemals in Analyzer-/Generierungs-Payloads gelangen.
 * - Persistierte Records enthalten nur interne IDs, visuelle Domaenendaten und
 *   dauerhafte Datei-Deskriptoren. KEINE VIN, Marke, Modell, Variante, Trim,
 *   Baujahr, Fahrzeugtitel, keine Business-Metadaten, kein Base64/Blob/Data-URL
 *   und kein generierter Prompt-Text.
 * - `previewUrl` ist transienter UI-State und wird NICHT persistiert.
 * - Historische Phase-1-`outputReadyFormats` sind KEINE Autoritaet und sind in
 *   diesem Vertrag bewusst nicht enthalten.
 */

export const REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION = 1;

/** Einziger erlaubter durabler Bucket (bereits existierender privater Bucket). */
export const REFERENCE_V2_STORAGE_BUCKET = "originals" as const;

/** Erlaubte Datei-Endungen des durablen Original-Pfads. */
export const REFERENCE_V2_ALLOWED_STORAGE_EXTENSIONS = [
  "jpg",
  "png",
  "webp",
] as const;
export type ReferenceV2StorageExtension =
  (typeof REFERENCE_V2_ALLOWED_STORAGE_EXTENSIONS)[number];

export class ReferenceV2PersistenceError extends Error {
  readonly issues: readonly string[];
  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.name = "ReferenceV2PersistenceError";
    this.issues = issues;
  }
}

// --------------------------------------------------------------------------
// Semantic / transport firewall (persistence specific)
// --------------------------------------------------------------------------

/**
 * Inline-Transport von Bilddaten ist in durablen Records verboten. Nur
 * Datei-Deskriptoren (Bucket + Pfad + sha256) sind zulaessig.
 */
const FORBIDDEN_TRANSPORT_PATTERNS: readonly RegExp[] = [
  /^\s*data:/i,
  /^\s*blob:/i,
  /;base64,/i,
  /\bbase64\b/i,
  /[A-Za-z0-9+/]{200,}={0,2}/,
];

/**
 * Semantische Identitaets-Muster. Die Baujahr-Heuristik der Analyzer-Firewall
 * wird hier bewusst NICHT uebernommen, weil durable Records ISO-Zeitstempel
 * enthalten (`2026-...`), die keine Fahrzeugidentitaet stiften.
 */
const FORBIDDEN_SEMANTIC_VALUE_PATTERNS: readonly RegExp[] = [
  /\b[A-HJ-NPR-Z0-9]{17}\b/, // VIN
  /\b(brand|make|manufacturer|marque|model|models|modelname|model\s?year|trim|trim\s?level|facelift|nameplate|vin)\b/i,
  /\b(marke|hersteller|modell|modellname|modelljahr|modellreihe|baujahr|ausstattungslinie|typbezeichnung|fahrgestellnummer)\b/i,
];

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

function walkPersistedPayload(
  value: unknown,
  path: string,
  violations: string[],
  depth = 0,
): void {
  if (depth > 12) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) =>
      walkPersistedPayload(v, `${path}[${i}]`, violations, depth + 1),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nk = normalizeKey(k);
      if ((FORBIDDEN_SEMANTIC_KEYS as readonly string[]).includes(nk)) {
        violations.push(`forbidden key "${path ? `${path}.` : ""}${k}"`);
      }
      walkPersistedPayload(v, path ? `${path}.${k}` : k, violations, depth + 1);
    }
    return;
  }
  if (typeof value === "string") {
    for (const re of FORBIDDEN_SEMANTIC_VALUE_PATTERNS) {
      if (re.test(value)) {
        violations.push(`forbidden semantic content at "${path || "<root>"}"`);
        break;
      }
    }
    for (const re of FORBIDDEN_TRANSPORT_PATTERNS) {
      if (re.test(value)) {
        violations.push(`forbidden inline transport at "${path || "<root>"}"`);
        break;
      }
    }
  }
}

/**
 * Fail-closed Guard fuer durable Payloads: wirft, sobald irgendwo im Objekt
 * ein verbotener Identitaets-Schluessel/-Inhalt oder Inline-Bildtransport
 * auftaucht. Neutrale Schluessel wie `vehicleId`, `vehicleClass` oder
 * `vehicleMasterKey` bleiben ausdruecklich erlaubt.
 */
export function assertPersistableReferenceV2Payload(
  value: unknown,
  label = "persisted payload",
): void {
  const violations: string[] = [];
  walkPersistedPayload(value, "", violations);
  if (violations.length > 0) {
    throw new ReferenceV2PersistenceError(
      `Reference V2 persistence firewall violation: ${violations.join("; ")}`,
      violations,
    );
  }
}

function guardRefinement(ctx: z.RefinementCtx, value: unknown): void {
  const violations: string[] = [];
  walkPersistedPayload(value, "", violations);
  for (const v of violations) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: v });
  }
}

// --------------------------------------------------------------------------
// Shared primitives
// --------------------------------------------------------------------------

const UuidSchema = z.string().uuid();
const NonEmptySchema = z.string().min(1);
const IsoDateTimeSchema = z.string().datetime({ offset: true });
const MimeTypeSchema = z.enum(
  REFERENCE_V2_ALLOWED_IMAGE_MIME as unknown as [string, ...string[]],
);
const StoragePathSchema = NonEmptySchema.refine(
  (p) =>
    !p.includes("://") &&
    !/^\s*(data|blob):/i.test(p) &&
    !p.startsWith("/") &&
    !p.includes(".."),
  { message: "storagePath must be a relative path without protocol/data/blob" },
);
const Sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "sha256 must be lowercase 64-hex");

// --------------------------------------------------------------------------
// Workspace
// --------------------------------------------------------------------------

export const ReferenceV2WorkspacePersistenceSchema = z
  .object({
    schemaVersion: z.literal(REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION),
    workspaceId: UuidSchema,
    /** Owner. In der DB abgeleitet; hier nur fuer Row-Hydration. */
    userId: UuidSchema,
    /** Stabile Business-Assoziation (`public.vehicles.id`) — nie visuelle Evidenz. */
    vehicleId: UuidSchema,
    /** `VehicleMasterRecord.id` — interner Schluessel, niemals eine VIN. */
    masterKey: NonEmptySchema,
    /** Interner Admin-Label. Nie Prompt-Input. */
    label: NonEmptySchema,
    vehicleClass: VehicleClassV2Schema,
    colorFamily: ColorFamilySchema.nullable(),
    identityClusterId: NonEmptySchema,
    masterVersion: z.number().int().min(1),
    masterHistory: z.array(AssetHistoryEntrySchema).nonempty(),
    createdAtIso: IsoDateTimeSchema,
    updatedAtIso: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => guardRefinement(ctx, value));
export type ReferenceV2WorkspacePersistence = z.infer<
  typeof ReferenceV2WorkspacePersistenceSchema
>;

// --------------------------------------------------------------------------
// Asset
// --------------------------------------------------------------------------

export const ReferenceV2AssetPersistenceSchema = z
  .object({
    schemaVersion: z.literal(REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION),
    rowId: UuidSchema,
    workspaceId: UuidSchema,
    userId: UuidSchema,
    /** Stabiler `ref_*`-Schluessel des Reference-Store-Assets. */
    assetKey: NonEmptySchema,
    /** Nur Dokumentation/Historie — NIEMALS visuelle Autoritaet. */
    requestedPerspectiveId: PerspectiveIdSchema,
    /** Einzige Perspektiven-Autoritaet: muss `intake.pose.canonicalPerspectiveId` sein. */
    canonicalPerspectiveId: PerspectiveIdSchema,
    /** Nur Anzeige. */
    fileName: NonEmptySchema,
    storageBucket: z.literal(REFERENCE_V2_STORAGE_BUCKET),
    storagePath: StoragePathSchema,
    mimeType: MimeTypeSchema,
    sizeBytes: z.number().int().positive().optional(),
    sha256: Sha256Schema,
    createdAtIso: IsoDateTimeSchema,
    updatedAtIso: IsoDateTimeSchema,
    intake: VisionIntakeResultSchema,
    /** Provider-Lifecycle-Nachweis (kann ablaufen). */
    analysis: ReferenceAnalysisRecordSchema.optional(),
    scores: MatchComponentScoresSchema,
    weightedScore: z.number().min(0).max(100),
    hardFailures: z.array(ReferenceHardFailCodeSchema),
    blockers: z.array(IngestionBlockerCodeSchema),
    warnings: z.array(NonEmptySchema),
    role: ReferenceRoleSchema,
    protection: AssetProtectionStateSchema,
    assetVersion: z.number().int().min(1),
    history: z.array(AssetHistoryEntrySchema).nonempty(),
  })
  .strict()
  .superRefine((asset, ctx) => {
    const canonicalFromIntake = asset.intake.pose.canonicalPerspectiveId;
    if (!canonicalFromIntake) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intake", "pose", "canonicalPerspectiveId"],
        message:
          "intake.pose.canonicalPerspectiveId is required for persisted assets",
      });
    } else if (canonicalFromIntake !== asset.canonicalPerspectiveId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["canonicalPerspectiveId"],
        message:
          "canonicalPerspectiveId must equal intake.pose.canonicalPerspectiveId",
      });
    }

    const blocked = asset.blockers.length > 0 || asset.hardFailures.length > 0;
    if (blocked && asset.role !== "rejected") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["role"],
        message: "assets with blockers must be rejected (fail-closed)",
      });
    }

    guardRefinement(ctx, asset);
  });
export type ReferenceV2AssetPersistence = z.infer<
  typeof ReferenceV2AssetPersistenceSchema
>;

// --------------------------------------------------------------------------
// Framing evidence
// --------------------------------------------------------------------------

export const ReferenceV2FramingEvidencePersistenceSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION),
    workspaceId: UuidSchema,
    userId: UuidSchema,
    assetKey: NonEmptySchema,
    sourceAspectRatio: z.number().finite().positive(),
    fullVehicleVisible: z.boolean(),
    cropped: z.boolean(),
    paddingPct: z.number().finite().min(0).max(100),
    updatedAtIso: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => guardRefinement(ctx, value));
export type ReferenceV2FramingEvidencePersistence = z.infer<
  typeof ReferenceV2FramingEvidencePersistenceSchema
>;

// --------------------------------------------------------------------------
// Strict parse helpers
// --------------------------------------------------------------------------

function strictParse<T>(
  schema: z.ZodType<T>,
  input: unknown,
  label: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join(".") || "<root>"}: ${i.message}`,
    );
    throw new ReferenceV2PersistenceError(
      `${label} is not persistable: ${issues.join("; ")}`,
      issues,
    );
  }
  return result.data;
}

export function parseReferenceV2WorkspacePersistence(
  input: unknown,
): ReferenceV2WorkspacePersistence {
  return strictParse(
    ReferenceV2WorkspacePersistenceSchema,
    input,
    "Reference V2 workspace",
  );
}

export function parseReferenceV2AssetPersistence(
  input: unknown,
): ReferenceV2AssetPersistence {
  return strictParse(
    ReferenceV2AssetPersistenceSchema,
    input,
    "Reference V2 asset",
  );
}

export function parseReferenceV2FramingEvidencePersistence(
  input: unknown,
): ReferenceV2FramingEvidencePersistence {
  return strictParse(
    ReferenceV2FramingEvidencePersistenceSchema,
    input,
    "Reference V2 framing evidence",
  );
}

// --------------------------------------------------------------------------
// Durable storage path
// --------------------------------------------------------------------------

export interface ReferenceV2OriginalStoragePathInput {
  readonly userId: string;
  readonly vehicleId: string;
  readonly workspaceId: string;
  readonly assetKey: string;
  readonly extension: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Deterministischer, owner-praefixierter Pfad im bestehenden privaten Bucket
 * `originals` (erstes Segment = userId, passend zur bestehenden Owner-RLS).
 * Rein: keine Zeitstempel, kein Zufall.
 */
export function buildReferenceV2OriginalStoragePath(
  input: ReferenceV2OriginalStoragePathInput,
): string {
  const { userId, vehicleId, workspaceId, assetKey } = input;

  for (const [name, value] of [
    ["userId", userId],
    ["vehicleId", vehicleId],
    ["workspaceId", workspaceId],
  ] as const) {
    if (!UuidSchema.safeParse(value).success) {
      throw new ReferenceV2PersistenceError(`${name} must be a valid UUID`, [
        name,
      ]);
    }
  }

  if (
    typeof assetKey !== "string" ||
    assetKey.length === 0 ||
    assetKey.includes("/") ||
    assetKey.includes("\\") ||
    assetKey.includes("..") ||
    CONTROL_CHARS.test(assetKey) ||
    assetKey.trim() !== assetKey
  ) {
    throw new ReferenceV2PersistenceError(
      "assetKey must be a non-empty path-safe segment",
      ["assetKey"],
    );
  }

  const extension =
    typeof input.extension === "string" ? input.extension.toLowerCase() : "";
  if (
    !(REFERENCE_V2_ALLOWED_STORAGE_EXTENSIONS as readonly string[]).includes(
      extension,
    )
  ) {
    throw new ReferenceV2PersistenceError(
      `extension must be one of ${REFERENCE_V2_ALLOWED_STORAGE_EXTENSIONS.join(", ")}`,
      ["extension"],
    );
  }

  return `${userId}/${vehicleId}/reference-v2/${workspaceId}/${assetKey}/original.${extension}`;
}
