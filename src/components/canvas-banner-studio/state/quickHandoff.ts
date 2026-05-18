/**
 * Handoff bridge: Quick-Modus → Pro-Editor.
 *
 * Quick-Mode rendert Banner im Hintergrund und legt das Ergebnis (Compositions,
 * Texte, Format-Auswahl) hier ab. Wenn der Pro-Editor mountet, lädt er den
 * Snapshot einmalig in den Store, sodass der User Texte/Positionen anpassen
 * und über den normalen Export-Flow abschließen kann.
 */
import type { BannerComposition, BannerTextFields, CiState } from "./types";

export interface QuickHandoffPayload {
  selectedFormatIds: string[];
  activeFormatId: string;
  textFields: BannerTextFields;
  compositions: Record<string, BannerComposition>;
  ci?: Partial<CiState>;
}

const KEY = "cbs:quick-handoff";

export function writeQuickHandoff(payload: QuickHandoffPayload) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("quick handoff write failed", e);
  }
}

export function readAndClearQuickHandoff(): QuickHandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as QuickHandoffPayload;
  } catch (e) {
    console.warn("quick handoff read failed", e);
    return null;
  }
}
