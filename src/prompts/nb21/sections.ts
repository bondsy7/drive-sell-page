/** Feste 9-Abschnitt-Struktur für Nano Banana 2.1. Reihenfolge ist verbindlich. */
export const NB21_SECTION_ORDER = [
  'MAIN TASK',
  'REFERENCE ROLES',
  'ALLOWED CHANGES',
  'VEHICLE IDENTITY LOCK',
  'PERSPECTIVE LOCK',
  'ENVIRONMENT',
  'LIGHTING / PHYSICAL INTEGRATION',
  'CAMERA / OUTPUT',
  'FINAL PRIORITY CONSTRAINT',
] as const;

export type Nb21SectionName = (typeof NB21_SECTION_ORDER)[number];
export type Nb21Sections = Record<Nb21SectionName, string[]>;

export function nb21SectionHeader(name: Nb21SectionName): string {
  const i = NB21_SECTION_ORDER.indexOf(name) + 1;
  return `### SECTION ${i}/${NB21_SECTION_ORDER.length}: ${name}`;
}

/** Rendert genau die 9 Abschnitte in fester Reihenfolge. Leere Abschnitte sind ein Fehler. */
export function renderNb21Prompt(sections: Nb21Sections): string {
  const keys = Object.keys(sections);
  if (keys.length !== NB21_SECTION_ORDER.length || NB21_SECTION_ORDER.some(k => !keys.includes(k))) {
    throw new Error('NB21: Prompt muss exakt die 9 Abschnitte enthalten.');
  }
  return NB21_SECTION_ORDER.map((name) => {
    const body = sections[name].map(s => s.trim()).filter(Boolean);
    if (body.length === 0) throw new Error(`NB21: Abschnitt "${name}" ist leer.`);
    return `${nb21SectionHeader(name)}\n${body.join('\n')}`;
  }).join('\n\n');
}
