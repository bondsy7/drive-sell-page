/**
 * Handoff bridge: Quick-Modus → Pro-Editor.
 *
 * Quick-Mode rendert Banner im Hintergrund und legt das Ergebnis (Compositions,
 * Texte, Format-Auswahl) hier ab. Wenn der Pro-Editor mountet, lädt er den
 * Snapshot einmalig in den Store, sodass der User Texte/Positionen anpassen
 * und über den normalen Export-Flow abschließen kann.
 *
 * WICHTIG: Wir löschen den Snapshot NICHT direkt beim Lesen, weil React 18
 * StrictMode den Pro-Editor in der Dev-Vorschau doppelt mountet. Beim 2. Mount
 * wäre der Store sonst frisch (Defaults), und sessionStorage leer → "DER NEUE
 * VW GOLF" und nur ein leeres Format würden erscheinen.
 *
 * Stattdessen bekommt jeder Snapshot eine `handoffId`; sobald der Pro-Editor
 * eine ID erfolgreich hydriert hat, merkt er sich diese ID in sessionStorage.
 * Folgende Reads mit derselben ID werden übersprungen (idempotent).
 */
import type { BannerComposition, BannerTextFields, CiState } from "./types";

export interface QuickHandoffPayload {
  handoffId: string;
  selectedFormatIds: string[];
  activeFormatId: string;
  textFields: BannerTextFields;
  compositions: Record<string, BannerComposition>;
  ci?: Partial<CiState>;
}

const KEY = "cbs:quick-handoff";
const CONSUMED_KEY = "cbs:quick-handoff:consumed-id";

function newId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function writeQuickHandoff(payload: Omit<QuickHandoffPayload, "handoffId">): string {
  const handoffId = newId();
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...payload, handoffId }));
    // Vorher konsumierte ID zurücksetzen, sonst würde der neue Snapshot ignoriert.
    sessionStorage.removeItem(CONSUMED_KEY);
  } catch (e) {
    console.warn("quick handoff write failed", e);
  }
  return handoffId;
}

/** Liest den Snapshot, falls vorhanden und noch nicht konsumiert. Löscht NICHT. */
export function peekQuickHandoff(): QuickHandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickHandoffPayload;
    const consumed = sessionStorage.getItem(CONSUMED_KEY);
    if (consumed && consumed === parsed.handoffId) return null;
    return parsed;
  } catch (e) {
    console.warn("quick handoff read failed", e);
    return null;
  }
}

/** Markiert eine ID als konsumiert, damit weitere Mounts den Snapshot ignorieren. */
export function markQuickHandoffConsumed(handoffId: string) {
  try {
    sessionStorage.setItem(CONSUMED_KEY, handoffId);
  } catch (e) {
    console.warn("quick handoff consume failed", e);
  }
}
