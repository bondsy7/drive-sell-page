/**
 * Neu-Generierung: Auswahl des Quellbilds (Seed).
 *
 * Regel: Ein bereits generiertes KI-Bild darf NIE als Basis einer
 * Neu-Generierung dienen. Basis ist immer
 *  1. das vom Nutzer explizit gewählte Referenzbild, sonst
 *  2. das zur Perspektive passende Originalfoto der Fahrzeugakte.
 */

export interface OriginalFile {
  name: string;
  url: string;
}

/** Index in der Aufnahme-Reihenfolge (3/4 Front, Seite, Heck, Interieur vorne, Interieur hinten). */
export function slotIndexForJob(jobKey: string | null | undefined, perspective = ''): number {
  const sig = `${jobKey || ''} ${perspective}`.toUpperCase();
  if (/RUECKSITZ|RÜCKSITZ|REAR_SEAT|INT_REAR|FOND/.test(sig)) return 4;
  if (/^INT_|\bINT_|INTERIEUR|INNENRAUM|COCKPIT|LENKRAD|DASHBOARD|MITTELKONSOLE/.test(sig)) return 3;
  if (/REAR|HECK|HINTEN|RÜCKLICHT|RUECKLICHT/.test(sig)) return 2;
  if (/SIDE|SEITE/.test(sig)) return 1;
  return 0;
}

/** Liest den Aufnahme-Index aus `<ts>-<idx>-original.jpg`. */
function parseSlotIndex(name: string): number | null {
  const m = name.match(/^\d+-(\d+)-original\./);
  return m ? Number(m[1]) : null;
}

export function pickOriginalSeed(
  originals: OriginalFile[],
  jobKey: string | null | undefined,
  perspective = '',
): OriginalFile | null {
  const usable = originals.filter(o => o.url);
  if (usable.length === 0) return null;
  const wanted = slotIndexForJob(jobKey, perspective);
  const indexed = usable
    .map(o => ({ o, idx: parseSlotIndex(o.name) }))
    .filter((x): x is { o: OriginalFile; idx: number } => x.idx !== null);
  const exact = indexed.find(x => x.idx === wanted);
  if (exact) return exact.o;
  const front = indexed.find(x => x.idx === 0);
  if (front) return front.o;
  return [...usable].sort((a, b) => a.name.localeCompare(b.name))[0];
}

/** Seed bestimmen: gewählte Referenz hat Vorrang, sonst passendes Original. */
export function resolveRegenerationSeed(params: {
  selectedReferenceUrl: string | null;
  currentGeneratedUrl: string;
  originals: OriginalFile[];
  jobKey?: string | null;
  perspective?: string;
}): string | null {
  const { selectedReferenceUrl, currentGeneratedUrl, originals, jobKey, perspective } = params;
  if (selectedReferenceUrl && selectedReferenceUrl !== currentGeneratedUrl) return selectedReferenceUrl;
  const seed = pickOriginalSeed(originals, jobKey, perspective);
  if (!seed || seed.url === currentGeneratedUrl) return null;
  return seed.url;
}

export function buildMandatoryCorrection(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return `<MANDATORY_CORRECTION priority="highest">
The previous attempt was rejected by the dealer. These corrections OVERRIDE any model prior knowledge or catalogue memory and MUST be visible in the result:
${t}
</MANDATORY_CORRECTION>

`;
}
