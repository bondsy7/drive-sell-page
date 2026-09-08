import type { PerspectiveId } from "../domain/perspectives/types";

/**
 * Reference V2 — Phase 4: Advisory Capture State (PURE).
 *
 * Die Analyse ist ab hier ein BERATENDES Qualitaetssystem, kein Torwaechter:
 * - Eine fehlgeschlagene Analyse entfernt niemals ein Bild.
 * - Der Nutzer kann jederzeit weiterarbeiten und manuell zuordnen.
 * - Die strikte Governance bleibt vollstaendig erhalten, wird aber nur noch
 *   als Diagnose ausgewiesen (siehe "Technische Details").
 *
 * Dieses Modul ist bewusst frei von React und Netzwerk, damit es testbar ist.
 */

export const CAPTURE_STATUSES = [
  "queued",
  "analyzing",
  "analyzed",
  "warning",
  "unavailable",
] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export const CAPTURE_STATUS_LABELS_DE: Record<CaptureStatus, string> = {
  queued: "In Warteschlange",
  analyzing: "Analyse läuft",
  analyzed: "Analysiert",
  warning: "Warnung",
  unavailable: "Analyse nicht verfügbar",
};

export interface CaptureItem {
  readonly id: string;
  readonly fileName: string;
  readonly previewUrl: string;
  readonly status: CaptureStatus;
  /** Automatisch erkannte Perspektive (nur Hinweis, nie zwingend). */
  readonly perspectiveId?: PerspectiveId;
  readonly confidence?: number;
  /** Nutzerlesbare Meldung (Warnung oder Fehlergrund). */
  readonly message?: string;
  /** ID im strikten Reference-Store, falls die Ingestion gelungen ist. */
  readonly assetId?: string;
  /** Strikte Diagnosecodes (nur "Technische Details"). */
  readonly diagnostics?: readonly string[];
}

export type ManualRole = "primary" | "secondary";

export interface ManualAssignment {
  readonly perspectiveId: PerspectiveId;
  readonly itemId: string;
  readonly role: ManualRole;
}

export const ADVISORY_STATUSES = [
  "OPTIMAL",
  "WARNING",
  "MISSING",
  "ANALYZING",
] as const;
export type AdvisoryStatus = (typeof ADVISORY_STATUSES)[number];

export const ADVISORY_LABELS_DE: Record<AdvisoryStatus, string> = {
  OPTIMAL: "Optimale Referenz",
  WARNING: "Referenz nicht optimal",
  MISSING: "Direkte Referenz fehlt",
  ANALYZING: "Analyse läuft",
};

/** Ab dieser Konfidenz gilt eine automatische Zuordnung als belastbar. */
export const CONFIDENT_PERSPECTIVE_THRESHOLD = 0.7;

export interface PerspectiveResolution {
  readonly perspectiveId: PerspectiveId;
  readonly status: AdvisoryStatus;
  /** Bild, das fuer die Generierung als Primaerreferenz dient. */
  readonly primaryItemId?: string;
  readonly primaryIsManual: boolean;
  readonly secondaryItemIds: readonly string[];
  /** Alle Bilder, die fuer diese Perspektive in Frage kommen. */
  readonly candidateItemIds: readonly string[];
  readonly warningText?: string;
}

export const UNCERTAIN_REFERENCE_WARNING =
  "Für diese Perspektive liegt keine eindeutige Direktreferenz vor. Das Ergebnis kann stärker vom Original abweichen.";

function byId(items: readonly CaptureItem[]): Map<string, CaptureItem> {
  return new Map(items.map((i) => [i.id, i]));
}

/**
 * Ermittelt den beratenden Zustand EINER Perspektive.
 *
 * Reihenfolge: manuelle Zuordnung schlaegt immer die Automatik. Es findet
 * KEINE stille Spiegelung der Gegenseite statt — fehlt eine Seite, bleibt sie
 * fehlend, bis der Nutzer bewusst zuordnet.
 */
export function resolvePerspective(
  perspectiveId: PerspectiveId,
  items: readonly CaptureItem[],
  assignments: readonly ManualAssignment[],
): PerspectiveResolution {
  const lookup = byId(items);
  const mine = assignments.filter((a) => a.perspectiveId === perspectiveId);
  const manualPrimary = mine.find((a) => a.role === "primary");
  const manualSecondaries = mine
    .filter((a) => a.role === "secondary")
    .map((a) => a.itemId)
    .filter((id) => lookup.has(id));

  const autoMatches = items
    .filter(
      (i) =>
        i.perspectiveId === perspectiveId &&
        (i.status === "analyzed" || i.status === "warning"),
    )
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  const manuallyAssignedElsewhere = new Set(
    assignments
      .filter((a) => a.perspectiveId !== perspectiveId && a.role === "primary")
      .map((a) => a.itemId),
  );

  const candidateItemIds = [
    ...new Set([
      ...(manualPrimary ? [manualPrimary.itemId] : []),
      ...manualSecondaries,
      ...autoMatches
        .filter((i) => !manuallyAssignedElsewhere.has(i.id))
        .map((i) => i.id),
    ]),
  ].filter((id) => lookup.has(id));

  if (manualPrimary && lookup.has(manualPrimary.itemId)) {
    const item = lookup.get(manualPrimary.itemId)!;
    const analyzerAgrees =
      item.status === "analyzed" &&
      item.perspectiveId === perspectiveId &&
      (item.confidence ?? 0) >= CONFIDENT_PERSPECTIVE_THRESHOLD;
    return {
      perspectiveId,
      status: analyzerAgrees ? "OPTIMAL" : "WARNING",
      primaryItemId: item.id,
      primaryIsManual: true,
      secondaryItemIds: manualSecondaries,
      candidateItemIds,
      ...(analyzerAgrees ? {} : { warningText: UNCERTAIN_REFERENCE_WARNING }),
    };
  }

  const best = autoMatches.find((i) => !manuallyAssignedElsewhere.has(i.id));
  if (best) {
    const strong =
      best.status === "analyzed" &&
      (best.confidence ?? 0) >= CONFIDENT_PERSPECTIVE_THRESHOLD;
    return {
      perspectiveId,
      status: strong ? "OPTIMAL" : "WARNING",
      primaryItemId: best.id,
      primaryIsManual: false,
      secondaryItemIds: manualSecondaries,
      candidateItemIds,
      ...(strong ? {} : { warningText: UNCERTAIN_REFERENCE_WARNING }),
    };
  }

  const stillWorking = items.some(
    (i) => i.status === "queued" || i.status === "analyzing",
  );
  return {
    perspectiveId,
    status: stillWorking ? "ANALYZING" : "MISSING",
    primaryIsManual: false,
    secondaryItemIds: manualSecondaries,
    candidateItemIds,
    ...(stillWorking ? {} : { warningText: UNCERTAIN_REFERENCE_WARNING }),
  };
}

export function resolveAll(
  perspectiveIds: readonly PerspectiveId[],
  items: readonly CaptureItem[],
  assignments: readonly ManualAssignment[],
): readonly PerspectiveResolution[] {
  return perspectiveIds.map((id) => resolvePerspective(id, items, assignments));
}

export interface CaptureSummary {
  readonly total: number;
  readonly analyzed: number;
  readonly running: number;
  readonly warnings: number;
  readonly unavailable: number;
  readonly coveredPerspectives: number;
  readonly totalPerspectives: number;
  readonly coveragePct: number;
}

export function summarizeCapture(
  items: readonly CaptureItem[],
  resolutions: readonly PerspectiveResolution[],
): CaptureSummary {
  const count = (s: CaptureStatus) => items.filter((i) => i.status === s).length;
  const covered = resolutions.filter(
    (r) => r.status === "OPTIMAL" || r.status === "WARNING",
  ).length;
  return {
    total: items.length,
    analyzed: count("analyzed"),
    running: count("queued") + count("analyzing"),
    warnings: count("warning"),
    unavailable: count("unavailable"),
    coveredPerspectives: covered,
    totalPerspectives: resolutions.length,
    coveragePct:
      resolutions.length === 0
        ? 0
        : Math.round((covered / resolutions.length) * 100),
  };
}

/** Setzt eine manuelle Zuordnung; pro Perspektive gibt es genau eine Primaerreferenz. */
export function applyManualAssignment(
  assignments: readonly ManualAssignment[],
  next: ManualAssignment,
): readonly ManualAssignment[] {
  const cleaned = assignments.filter((a) => {
    if (a.perspectiveId !== next.perspectiveId) return true;
    if (a.itemId === next.itemId) return false;
    if (next.role === "primary" && a.role === "primary") return false;
    return true;
  });
  return [...cleaned, next];
}

export function removeManualAssignment(
  assignments: readonly ManualAssignment[],
  perspectiveId: PerspectiveId,
  itemId: string,
): readonly ManualAssignment[] {
  return assignments.filter(
    (a) => !(a.perspectiveId === perspectiveId && a.itemId === itemId),
  );
}
