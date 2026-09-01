import { supabase } from "@/integrations/supabase/client";
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
 *
 * WICHTIG (Phase-1.5-Hardening): Weder die ERWARTETE Fahrzeugklasse noch eine
 * Perspektivenliste werden an den Provider gesendet. Die Klasse muss rein
 * visuell erkannt werden; die Perspektivdefinitionen kommen serverseitig aus
 * dem generierten PerspectiveMaster v1. Der Soll-Ist-Vergleich passiert
 * ausschliesslich lokal im Gate.
 */

export const REFERENCE_V2_PROVIDER_ID = "gemini-file-api" as const;
/** Referenzbudget: hoechstens so viele Anker gehen in eine Analyse. */
export const MAX_ANCHOR_FILES = 3;
/** Einzig zulaessige Bildformate der Reference-V2-Dateireferenzen. */
export const REFERENCE_V2_ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isAllowedReferenceV2Mime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (REFERENCE_V2_ALLOWED_IMAGE_MIME as readonly string[]).includes(value)
  );
}


export interface ReferenceV2FileReference {
  readonly fileId: string;
  readonly providerId: string;
  /** Echter, vom Provider bestaetigter MIME-Type. */
  readonly mimeType: string;
  readonly sizeBytes?: number;
  readonly state?: string;
  readonly createdAtIso?: string;
  readonly updatedAtIso?: string;
  readonly expiresAtIso?: string;
}

export interface AnalyzeRequest {
  readonly file: ReferenceV2FileReference;
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
    // Fail-closed: kein MIME-Raten. Nur explizit erlaubte Bildtypen.
    if (!isAllowedReferenceV2Mime(file.type)) {
      throw new FileReferenceUnsupportedError(
        `MIME-Type "${file.type || "unbekannt"}" ist für Reference V2 nicht erlaubt.`,
      );
    }
    const headers = await authHeaders();
    const { data, error } = await supabase.functions.invoke(
      "reference-v2-upload-file",
      {
        body: file,
        headers: {
          ...headers,
          "content-type": file.type,
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
    const meta = data as Record<string, unknown>;
    // Lifecycle-Metadaten muessen provider-bestaetigt sein: kein Rueckfall auf
    // den Request-MIME, sonst waere die Referenz nicht verifiziert.
    if (!isAllowedReferenceV2Mime(meta.mimeType)) {
      throw new FileReferenceUnsupportedError(
        "Provider lieferte keinen gültigen MIME-Type für die Dateireferenz.",
      );
    }
    const mimeType = meta.mimeType as string;
    return {
      fileId,
      providerId:
        typeof meta.providerId === "string" ? meta.providerId : REFERENCE_V2_PROVIDER_ID,
      mimeType,

      ...(typeof meta.sizeBytes === "number" ? { sizeBytes: meta.sizeBytes } : {}),
      ...(typeof meta.state === "string" ? { state: meta.state } : {}),
      ...(typeof meta.createdAtIso === "string"
        ? { createdAtIso: meta.createdAtIso }
        : {}),
      ...(typeof meta.updatedAtIso === "string"
        ? { updatedAtIso: meta.updatedAtIso }
        : {}),
      ...(typeof meta.expiresAtIso === "string"
        ? { expiresAtIso: meta.expiresAtIso }
        : {}),
    };
  },

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResult> {
    // Kein erwarteter Fahrzeugtyp, keine Perspektivenliste, keine Metadaten:
    // der Provider sieht ausschliesslich Dateireferenzen.
    const body = {
      schemaVersion: "reference-v2-vision-1",
      fileId: request.file.fileId,
      mimeType: request.file.mimeType,
      providerId: request.file.providerId,
      anchors: request.anchorFiles
        .slice(0, MAX_ANCHOR_FILES)
        .map((a) => ({ fileId: a.fileId, mimeType: a.mimeType })),
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

/**
 * Baut Provider-Anker aus persistierten Analyse-Nachweisen. FAIL-CLOSED:
 * Nur Datensaetze mit Status "analyzed", Reference-V2-Provider und bekanntem,
 * erlaubtem MIME-Type duerfen Identitaet stiften (es wird niemals ein Typ
 * geraten). Der Anzeige-/Referenzstatus alter Datensaetze bleibt unberuehrt.
 */
export function toAnchorFileReferences(
  records: readonly {
    fileId?: string;
    providerId?: string;
    mimeType?: string;
    status?: string;
  }[],
  limit: number = MAX_ANCHOR_FILES,
): readonly ReferenceV2FileReference[] {
  return records
    .filter(
      (r): r is { fileId: string; providerId: string; mimeType: string; status: string } =>
        r.status === "analyzed" &&
        Boolean(r.fileId) &&
        r.providerId === REFERENCE_V2_PROVIDER_ID &&
        isAllowedReferenceV2Mime(r.mimeType),
    )
    .slice(0, limit)
    .map((r) => ({
      fileId: r.fileId,
      providerId: r.providerId,
      mimeType: r.mimeType,
    }));
}


