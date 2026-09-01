/**
 * REFERENCE V2 — PHASE 2.6C
 * Durable Original File Storage Service.
 *
 * Nimmt eine rohe Browser-`File`, validiert sie, prueft den authentifizierten
 * Owner, berechnet SHA-256 aus den Rohbytes, baut den eingefrorenen
 * deterministischen Pfad und laedt die unveraenderte Datei in den privaten
 * Bucket `originals` (upsert:false).
 *
 * Kein DB-Write, keine URL, kein Provider-Upload, kein Loeschen, kein Rollback.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  REFERENCE_V2_ALLOWED_IMAGE_MIME,
  isAllowedReferenceV2Mime,
} from "../phase1-5/provider-adapter";
import {
  REFERENCE_V2_STORAGE_BUCKET,
  buildReferenceV2OriginalStoragePath,
} from "./persistence-contract";

// --------------------------------------------------------------------------
// Errors
// --------------------------------------------------------------------------

export class ReferenceV2OriginalStorageError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(
    message: string,
    details?: { code?: string; status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "ReferenceV2OriginalStorageError";
    this.code = details?.code;
    this.status = details?.status;
    if (details?.cause !== undefined) {
      (this as { cause?: unknown }).cause = details.cause;
    }
  }
}

export class ReferenceV2OriginalStorageConflictError extends ReferenceV2OriginalStorageError {
  constructor(
    message: string,
    details?: { code?: string; status?: number; cause?: unknown },
  ) {
    super(message, details);
    this.name = "ReferenceV2OriginalStorageConflictError";
  }
}

export class ReferenceV2OriginalStorageAuthError extends ReferenceV2OriginalStorageError {
  constructor(message: string, details?: { cause?: unknown }) {
    super(message, details);
    this.name = "ReferenceV2OriginalStorageAuthError";
  }
}

// --------------------------------------------------------------------------
// Contract
// --------------------------------------------------------------------------

export type ReferenceV2AllowedMime =
  (typeof REFERENCE_V2_ALLOWED_IMAGE_MIME)[number];

/** Exakte, deterministische MIME -> Extension Abbildung. Keine weiteren Typen. */
export const REFERENCE_V2_MIME_EXTENSION: Readonly<
  Record<ReferenceV2AllowedMime, "jpg" | "png" | "webp">
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Nur dauerhafte Datei-Identitaet. Keine URL, kein Inhalt, nichts Transientes. */
export interface ReferenceV2DurableOriginalDescriptor {
  readonly storageBucket: typeof REFERENCE_V2_STORAGE_BUCKET;
  readonly storagePath: string;
  readonly mimeType: ReferenceV2AllowedMime;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface ReferenceV2StoreOriginalInput {
  readonly file: File;
  readonly userId: string;
  readonly vehicleId: string;
  readonly workspaceId: string;
  readonly assetKey: string;
}

export interface ReferenceV2UploadOptions {
  readonly contentType: string;
  readonly upsert: false;
}

export interface ReferenceV2UploadResult {
  readonly error: unknown;
}

/** Schmaler semantischer Port — Tests injizieren ein deterministisches Fake. */
export interface ReferenceV2OriginalStoragePort {
  getAuthenticatedUserId(): Promise<string | null>;
  uploadOriginal(
    path: string,
    file: Blob,
    options: ReferenceV2UploadOptions,
  ): Promise<ReferenceV2UploadResult>;
}

// --------------------------------------------------------------------------
// SHA-256 (Web Crypto, fail-closed, kein Fallback)
// --------------------------------------------------------------------------

export async function computeReferenceV2Sha256(file: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== "function") {
    throw new ReferenceV2OriginalStorageError(
      "Web Crypto subtle digest is unavailable; refusing to store original",
      { code: "WEB_CRYPTO_UNAVAILABLE" },
    );
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch (cause) {
    throw new ReferenceV2OriginalStorageError("Failed to read raw file bytes", {
      code: "FILE_READ_FAILED",
      cause,
    });
  }

  let digest: ArrayBuffer;
  try {
    digest = await subtle.digest("SHA-256", bytes);
  } catch (cause) {
    throw new ReferenceV2OriginalStorageError("SHA-256 digest failed", {
      code: "DIGEST_FAILED",
      cause,
    });
  }

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

function assertFileLike(file: unknown): asserts file is File {
  if (
    typeof file !== "object" ||
    file === null ||
    typeof (file as Blob).arrayBuffer !== "function"
  ) {
    throw new ReferenceV2OriginalStorageError(
      "file must be a Blob/File-like object with arrayBuffer()",
      { code: "INVALID_FILE" },
    );
  }

  const size = (file as Blob).size;
  if (
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    !Number.isInteger(size) ||
    size <= 0
  ) {
    throw new ReferenceV2OriginalStorageError(
      "file size must be a positive integer byte count",
      { code: "INVALID_FILE_SIZE" },
    );
  }
}

function assertAllowedMime(value: unknown): asserts value is ReferenceV2AllowedMime {
  if (!isAllowedReferenceV2Mime(value)) {
    throw new ReferenceV2OriginalStorageError(
      `mimeType must be one of ${REFERENCE_V2_ALLOWED_IMAGE_MIME.join(", ")}`,
      { code: "UNSUPPORTED_MIME" },
    );
  }
}

// --------------------------------------------------------------------------
// Storage error classification
// --------------------------------------------------------------------------

function readErrorField(error: unknown, key: string): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  return (error as Record<string, unknown>)[key];
}

function isConflictError(error: unknown): boolean {
  const status = readErrorField(error, "status") ?? readErrorField(error, "statusCode");
  if (status === 409 || status === "409") return true;

  const code = readErrorField(error, "error");
  if (typeof code === "string" && /duplicate|conflict|already exists/i.test(code)) {
    return true;
  }

  const message = readErrorField(error, "message");
  if (
    typeof message === "string" &&
    /(duplicate|already exists|resource already exists|conflict)/i.test(message)
  ) {
    return true;
  }
  return false;
}

function toStorageError(error: unknown): ReferenceV2OriginalStorageError {
  const rawStatus =
    readErrorField(error, "status") ?? readErrorField(error, "statusCode");
  const status =
    typeof rawStatus === "number"
      ? rawStatus
      : typeof rawStatus === "string" && rawStatus.trim() !== ""
        ? Number(rawStatus)
        : undefined;
  const rawCode = readErrorField(error, "error");
  const code = typeof rawCode === "string" ? rawCode : undefined;
  const rawMessage = readErrorField(error, "message");
  const message =
    typeof rawMessage === "string" && rawMessage.length > 0
      ? rawMessage
      : "Storage upload failed";

  const details = {
    code,
    status: Number.isFinite(status) ? (status as number) : undefined,
    cause: error,
  };

  if (isConflictError(error)) {
    return new ReferenceV2OriginalStorageConflictError(
      `Durable original already exists: ${message}`,
      details,
    );
  }
  return new ReferenceV2OriginalStorageError(message, details);
}

// --------------------------------------------------------------------------
// Service
// --------------------------------------------------------------------------

export interface ReferenceV2OriginalStorageService {
  store(
    input: ReferenceV2StoreOriginalInput,
  ): Promise<ReferenceV2DurableOriginalDescriptor>;
}

export function createReferenceV2OriginalStorageService(
  port: ReferenceV2OriginalStoragePort,
): ReferenceV2OriginalStorageService {
  return {
    async store(input) {
      const { file, userId, vehicleId, workspaceId, assetKey } = input;

      assertFileLike(file);
      const mimeType = file.type;
      assertAllowedMime(mimeType);

      const extension = REFERENCE_V2_MIME_EXTENSION[mimeType];

      // Pfad ausschliesslich ueber den eingefrorenen Helper (validiert UUIDs
      // und pfadsichere assetKey-Segmente) — vor jedem Auth-/Upload-Schritt.
      const storagePath = buildReferenceV2OriginalStoragePath({
        userId,
        vehicleId,
        workspaceId,
        assetKey,
        extension,
      });

      let authUserId: string | null;
      try {
        authUserId = await port.getAuthenticatedUserId();
      } catch (cause) {
        throw new ReferenceV2OriginalStorageAuthError(
          "Failed to resolve authenticated user",
          { cause },
        );
      }
      if (!authUserId) {
        throw new ReferenceV2OriginalStorageAuthError(
          "No authenticated user; refusing to store durable original",
        );
      }
      if (authUserId !== userId) {
        throw new ReferenceV2OriginalStorageAuthError(
          "Authenticated user does not match owner userId",
        );
      }

      // Hash VOR dem Upload: ein erfolgreicher Rueckgabewert hat immer Identitaet.
      const sha256 = await computeReferenceV2Sha256(file);

      const result = await port.uploadOriginal(storagePath, file, {
        contentType: mimeType,
        upsert: false,
      });
      if (result?.error) {
        throw toStorageError(result.error);
      }

      return {
        storageBucket: REFERENCE_V2_STORAGE_BUCKET,
        storagePath,
        mimeType,
        sizeBytes: file.size,
        sha256,
      };
    },
  };
}

// --------------------------------------------------------------------------
// Production adapter
// --------------------------------------------------------------------------

export function createReferenceV2SupabaseStoragePort(): ReferenceV2OriginalStoragePort {
  return {
    async getAuthenticatedUserId() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        throw new ReferenceV2OriginalStorageAuthError(
          "auth.getUser() failed",
          { cause: error },
        );
      }
      return data?.user?.id ?? null;
    },
    async uploadOriginal(path, file, options) {
      const { error } = await supabase.storage
        .from(REFERENCE_V2_STORAGE_BUCKET)
        .upload(path, file, {
          contentType: options.contentType,
          upsert: false,
        });
      return { error: error ?? null };
    },
  };
}

export async function storeReferenceV2Original(
  input: ReferenceV2StoreOriginalInput,
): Promise<ReferenceV2DurableOriginalDescriptor> {
  return createReferenceV2OriginalStorageService(
    createReferenceV2SupabaseStoragePort(),
  ).store(input);
}
