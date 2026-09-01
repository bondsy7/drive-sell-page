import { supabase } from "@/integrations/supabase/client";
import type { VehicleClassV2 } from "../domain/vehicle-classes";
import type { PerspectiveId } from "../domain/perspectives/types";
import {
  assertNoSemanticIdentity,
  parseAnalyzerResponse,
  type AnalyzerVisionResponse,
} from "./analyzer-contract";

/**
 * Reference V2 — Phase 1.5: Provider adapter boundary.
 *
 * The reference image defines WHAT the vehicle is. Metadata only describes
 * what we know ABOUT it. Metadata must never override visible vehicle identity.
 *
 * Diese Grenze ist strikt von den bestehenden Remaster-Providern getrennt.
 * Bilder werden AUSSCHLIESSLICH als Provider-Dateireferenz (`fileId`)
 * uebergeben — niemals als Base64 im Request-Body. Kann der Provider keine
 * echte Dateireferenz liefern, wird fail-closed mit
 * `FILE_REFERENCE_UNSUPPORTED` abgebrochen (kein stiller Base64-Fallback).
 */

export const REFERENCE_V2_PROVIDER_ID = "gemini-file-api" as const;

export interface ReferenceV2FileReference {
  readonly fileId: string;
  readonly providerId: string;
  readonly mimeType: string;
  readonly expiresAtIso?: string;
}

export interface AnalyzeRequest {
  readonly file: ReferenceV2FileReference;
  readonly vehicleClass: VehicleClassV2;
  readonly allowedPerspectiveIds: readonly PerspectiveId[];
  /** Wenige, bereits akzeptierte Anker desselben Vehicle Masters. */
  readonly anchorFiles: readonly ReferenceV2FileReference[];
}

export interface AnalyzeResult {
  readonly response: AnalyzerVisionResponse;
  readonly correlationId?: string;
}

export class FileReferenceUnsupportedError extends Error {
  readonly code = "FILE_REFERENCE_UNSUPPORTED";
  constructor(message: string) {
    super(message);
    this.name = "FileReferenceUnsupportedError";
  }
}

export class AnalyzerUnavailableError extends Error {
  readonly code = "ANALYSIS_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "AnalyzerUnavailableError";
  }
}

const BASE64ISH = /^data:|^[A-Za-z0-9+/=\s]{512,}$/;

/** Verhindert strukturell, dass Bilddaten inline mitgeschickt werden. */
export function assertNoInlineImageData(payload: unknown, label = "request"): void {
  const seen: string[] = [];
  const walk = (v: unknown, depth = 0): void => {
    if (depth > 10) return;
    if (typeof v === "string") {
      if (BASE64ISH.test(v)) seen.push(label);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (/base64|imagedata|inlinedata|bytes/i.test(k)) seen.push(`${label}.${k}`);
        walk(val, depth + 1);
      }
    }
  };
  walk(payload);
  if (seen.length > 0) {
    throw new FileReferenceUnsupportedError(
      `Inline image data is forbidden in Reference V2 analyzer requests (${seen.join(", ")})`,
    );
  }
}

/** Port-Interface — erlaubt Tests ohne Netzwerk. */
export interface ReferenceV2AnalyzerPort {
  uploadFile(file: File): Promise<ReferenceV2FileReference>;
  analyze(request: AnalyzeRequest): Promise<AnalyzeResult>;
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new AnalyzerUnavailableError("Keine gültige Sitzung für Reference V2.");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Produktions-Adapter: Upload als Rohbytes, Analyse nur per Dateireferenz. */
export const supabaseAnalyzerPort: ReferenceV2AnalyzerPort = {
  async uploadFile(file: File): Promise<ReferenceV2FileReference> {
    const headers = await authHeaders();
    const { data, error } = await supabase.functions.invoke(
      "reference-v2-upload-file",
      {
        body: file,
        headers: {
          ...headers,
          "content-type": file.type || "image/jpeg",
          "x-reference-v2-filename": encodeURIComponent(file.name),
        },
      },
    );
    if (error) throw new AnalyzerUnavailableError(error.message);
    const fileId = (data as { fileId?: string } | null)?.fileId;
    if (!fileId) {
      throw new FileReferenceUnsupportedError(
        "Provider lieferte keine Dateireferenz — Base64-Fallback ist nicht erlaubt.",
      );
    }
    return {
      fileId,
      providerId: (data as { providerId?: string }).providerId ?? REFERENCE_V2_PROVIDER_ID,
      mimeType: (data as { mimeType?: string }).mimeType ?? file.type,
      expiresAtIso: (data as { expiresAtIso?: string }).expiresAtIso,
    };
  },

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResult> {
    const body = {
      schemaVersion: "reference-v2-vision-1",
      fileId: request.file.fileId,
      mimeType: request.file.mimeType,
      providerId: request.file.providerId,
      vehicleClass: request.vehicleClass,
      allowedPerspectiveIds: [...request.allowedPerspectiveIds],
      anchorFileIds: request.anchorFiles.map((a) => a.fileId),
    };
    // Fail-closed: weder Bilddaten noch Business-Metadaten verlassen die App.
    assertNoInlineImageData(body, "analyze request");
    assertNoSemanticIdentity(body, "analyze request");

    const headers = await authHeaders();
    const { data, error } = await supabase.functions.invoke(
      "reference-v2-analyze-image",
      { body, headers },
    );
    if (error) throw new AnalyzerUnavailableError(error.message);
    const payload = data as { analysis?: unknown; correlationId?: string } | null;
    if (!payload?.analysis) {
      throw new AnalyzerUnavailableError("Analyzer lieferte kein Ergebnis.");
    }
    return {
      response: parseAnalyzerResponse(payload.analysis),
      ...(payload.correlationId ? { correlationId: payload.correlationId } : {}),
    };
  },
};
