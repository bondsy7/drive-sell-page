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

/**
 * Bevorzugte Slot-Keys je Perspektive (nur für Originale mit gespeicherter
 * Rolle im Dateinamen). Reihenfolge = Priorität; empfohlene Rundgang-Fotos
 * zuerst, wo sie die exakte Ansicht zeigen.
 */
export function slotRolesForJob(jobKey: string | null | undefined, perspective = ''): string[] {
  const key = (jobKey || '').toUpperCase();
  const p = perspective.toLowerCase();
  if (key === 'EXT_SIDE_RIGHT' || /seite(nansicht)? rechts|beifahrerseite/.test(p)) return ['side-right'];
  if (key === 'EXT_34_FRONT_RIGHT' || /3\/4 front rechts|3\/4 vorne rechts/.test(p)) return ['34front-right'];
  if (key === 'EXT_34_REAR_LEFT' || /3\/4 heck links|3\/4 hinten links/.test(p)) return ['34rear'];
  if (key === 'EXT_FRONT' || /^front(alansicht)?$|totalfront/.test(p.trim())) return ['front', '34front'];
  if (key === 'MASTER_IMAGE') return ['34front'];
  return [];
}

/** Liest Aufnahme-Index und optionalen Slot-Key aus `<ts>-<idx>[-<slot>]-original.jpg`. */
function parseOriginalName(name: string): { idx: number; role: string | null } | null {
  const m = name.match(/^\d+-(\d+)(?:-([a-z0-9-]+?))?-original\./);
  return m ? { idx: Number(m[1]), role: m[2] || null } : null;
}

export function pickOriginalSeed(
  originals: OriginalFile[],
  jobKey: string | null | undefined,
  perspective = '',
): OriginalFile | null {
  const usable = originals.filter(o => o.url);
  if (usable.length === 0) return null;
  const parsed = usable
    .map(o => ({ o, p: parseOriginalName(o.name) }))
    .filter((x): x is { o: OriginalFile; p: { idx: number; role: string | null } } => x.p !== null);
  const hasRoles = parsed.some(x => x.p.role);
  if (hasRoles) {
    // Neue Akten: ausschließlich über den Slot-Key zuordnen – nie über Indizes,
    // damit z. B. „Seite rechts" nicht versehentlich das linke Foto bekommt.
    for (const role of slotRolesForJob(jobKey, perspective)) {
      const hit = parsed.find(x => x.p.role === role);
      if (hit) return hit.o;
    }
    const legacyRole = ['34front', 'side', 'rear', 'interior-front', 'interior-rear'][slotIndexForJob(jobKey, perspective)];
    const hit = parsed.find(x => x.p.role === legacyRole);
    if (hit) return hit.o;
    const front = parsed.find(x => x.p.role === '34front');
    if (front) return front.o;
  }
  // Altakten ohne Rollen: historische Index-Zuordnung.
  const wanted = slotIndexForJob(jobKey, perspective);
  const indexed = parsed.filter(x => !x.p.role).map(x => ({ o: x.o, idx: x.p.idx }));
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
