import { isAllowedReferenceV2Mime } from "./provider-adapter";

/**
 * Reference V2 — Datei-Normalisierung vor Upload/Analyse.
 *
 * Der Provider (Gemini File API) akzeptiert nur JPEG/PNG/WebP. Andere vom
 * Browser dekodierbare Bildformate (z. B. AVIF) werden hier verlustarm in
 * PNG umgewandelt, BEVOR sie gehasht, hochgeladen und analysiert werden.
 * Nicht dekodierbare Dateien werden fail-closed abgelehnt — kein stiller
 * Fallback, kein Raten von MIME-Types.
 */

export class ReferenceFileNormalizationError extends Error {
  readonly code = "FILE_NORMALIZATION_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "ReferenceFileNormalizationError";
  }
}

function toPngFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return `${base || "referenz"}.png`;
}

/**
 * Gibt die Datei unveraendert zurueck, wenn ihr MIME-Type direkt zulaessig
 * ist. Sonst: Browser-Dekodierung + PNG-Re-Encode. Wirft
 * `ReferenceFileNormalizationError`, wenn die Datei kein dekodierbares
 * Bild ist.
 */
export async function normalizeReferenceFile(file: File): Promise<File> {
  if (isAllowedReferenceV2Mime(file.type)) return file;
  if (!file.type.startsWith("image/")) {
    throw new ReferenceFileNormalizationError(
      `Nicht unterstuetzter Dateityp "${file.type || "unbekannt"}" — erlaubt sind JPEG, PNG, WebP und AVIF.`,
    );
  }

  if (typeof createImageBitmap !== "function") {
    throw new ReferenceFileNormalizationError(
      `Format "${file.type}" wird von diesem Browser nicht unterstuetzt.`,
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ReferenceFileNormalizationError(
      `"${file.name}" (${file.type}) konnte nicht dekodiert werden.`,
    );
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new ReferenceFileNormalizationError(
        "Canvas-Kontext nicht verfuegbar.",
      );
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) {
      throw new ReferenceFileNormalizationError(
        `"${file.name}" konnte nicht in PNG umgewandelt werden.`,
      );
    }
    return new File([blob], toPngFileName(file.name), {
      type: "image/png",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
