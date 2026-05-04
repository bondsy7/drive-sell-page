/**
 * Pflichtangaben-Formatter nach Pkw-EnVKV (WLTP)
 *
 * Liefert die einzeilige, konsolidierte Pflichtangabe für Fahrzeuginserate
 * im exakt vorgegebenen Format:
 *
 *   Plugin-Hybrid:
 *     "Neuwagen • 535 kW (727 PS) • Hybrid (Benzin/Elektro) 17,2 kWh/100km + 4,9 l/100km (gew. komb.),
 *      10,4 l/100km (entladen, komb.) • 111 g CO₂/km (gew. komb.) •
 *      CO₂-Klasse C (gew. komb.), G (entladen, komb.)"
 *
 *   Verbrenner (Benzin/Diesel):
 *     "Neuwagen • 195 kW (265 PS) • Benzin 7,8 l/100km (komb.) •
 *      178 g CO₂/km (komb.) • CO₂-Klasse G (komb.)"
 *
 *   Elektro:
 *     "Neuwagen • 165 kW (224 PS) • Elektro 13,6 kWh/100km (komb.) •
 *      0 g CO₂/km (komb.) • CO₂-Klasse A (komb.)"
 *
 * WICHTIG:
 *  - CO₂-Klasse darf seit WLTP NUR A–G sein (kein A+, A++, A+++).
 *  - DAT-spezifische Angaben (z.B. DAT-Bewertung, DAT-Marktwert, DAT-Code)
 *    werden NIEMALS in die Pflichtangaben übernommen.
 */

export type DriveKind = 'phev' | 'electric' | 'combustion';

export interface MandatoryDisclosureInput {
  /** "Neuwagen" | "Gebrauchtwagen" | "Tageszulassung" | "Jahreswagen" | leer */
  condition?: string;
  /** Leistung kW – z.B. "535" oder "535 kW" */
  powerKw?: string | number;
  /** Leistung PS – z.B. "727" oder "727 PS" (optional, wird sonst aus kW geschätzt) */
  powerPs?: string | number;
  /** Antrieb / Kraftstoffart – z.B. "Hybrid (Benzin/Elektro)", "Benzin", "Diesel", "Elektro" */
  fuelType?: string;
  driveType?: string;
  /** Reine Verbrenner: kombinierter Verbrauch (l/100km) – z.B. "7,8 l/100km" */
  consumptionCombined?: string;
  /** PHEV: Stromverbrauch gewichtet komb. (kWh/100km) */
  consumptionElectric?: string;
  /** PHEV: Verbrauch (entladene Batterie, komb.) – l/100km */
  consumptionCombinedDischarged?: string;
  /** CO₂ kombiniert (g/km) – bei PHEV: gewichtet komb. */
  co2Emissions?: string;
  /** PHEV: CO₂ entladen (g/km) – optional */
  co2EmissionsDischarged?: string;
  /** CO₂-Klasse A–G (bei PHEV: gewichtet komb.) */
  co2Class?: string;
  /** PHEV: CO₂-Klasse entladen */
  co2ClassDischarged?: string;
  /** Bei Elektro/PHEV: Stromverbrauch wenn driveType nicht eindeutig */
  isPluginHybrid?: boolean;
}

/* ---------- Helpers ---------- */

const CLASS_RX = /^[A-G]$/;

/** Stripp '+'-Zeichen, Whitespace und validiert auf A–G. */
function cleanClass(value?: string): string | null {
  if (!value) return null;
  const v = String(value).replace(/\+/g, '').trim().toUpperCase();
  if (CLASS_RX.test(v)) return v;
  // Falls ein gesamter Token wie "Klasse C" reinkommt: extrahiere
  const m = v.match(/\b([A-G])\b/);
  return m ? m[1] : null;
}

/** Normalisiert eine Zahl mit Einheit z.B. "535", "535 kW", " 535kw ". */
function num(v: string | number | undefined): number | null {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return s ? parseFloat(s[0]) : null;
}

/** Formatiert eine Verbrauchsangabe mit Einheit, falls Einheit fehlt. */
function withUnit(value: string | undefined, unit: string): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (/[a-zA-Zµ]/.test(v)) return v; // hat schon Einheit
  return `${v} ${unit}`;
}

/** Bestimmt die Antriebsart (PHEV / Elektro / Verbrenner). */
export function detectDriveKind(input: MandatoryDisclosureInput): DriveKind {
  const ft = (input.fuelType || '').toLowerCase();
  const dt = (input.driveType || '').toLowerCase();
  const txt = `${ft} ${dt}`;

  if (
    input.isPluginHybrid ||
    txt.includes('plug') ||
    txt.includes('phev') ||
    (txt.includes('hybrid') && (input.consumptionElectric || input.consumptionCombinedDischarged))
  ) {
    return 'phev';
  }
  if (
    txt.includes('elektro') ||
    txt.includes('electric') ||
    txt === 'bev' ||
    (!input.consumptionCombined && input.consumptionElectric)
  ) {
    return 'electric';
  }
  return 'combustion';
}

/** Liefert den menschenlesbaren Antriebs-Label, z.B. "Benzin", "Diesel", "Hybrid (Benzin/Elektro)", "Elektro". */
function driveLabel(input: MandatoryDisclosureInput, kind: DriveKind): string {
  if (kind === 'electric') return 'Elektro';
  if (kind === 'phev') {
    const ft = (input.fuelType || '').toLowerCase();
    if (ft.includes('diesel')) return 'Hybrid (Diesel/Elektro)';
    return 'Hybrid (Benzin/Elektro)';
  }
  const ft = (input.fuelType || '').toLowerCase();
  if (ft.includes('diesel')) return 'Diesel';
  if (ft.includes('benzin') || ft.includes('super') || ft.includes('otto')) return 'Benzin';
  if (ft.includes('lpg') || ft.includes('autogas')) return 'LPG';
  if (ft.includes('cng') || ft.includes('erdgas')) return 'Erdgas (CNG)';
  // Fallback auf Originalwert oder generisch
  return input.fuelType || 'Verbrenner';
}

/** Leistung "535 kW (727 PS)". */
function powerLabel(input: MandatoryDisclosureInput): string | null {
  const kw = num(input.powerKw);
  let ps = num(input.powerPs);
  if (kw === null && ps === null) return null;
  if (kw !== null && ps === null) ps = Math.round(kw * 1.35962);
  if (kw === null && ps !== null) {
    const kwDerived = Math.round(ps / 1.35962);
    return `${kwDerived} kW (${ps} PS)`;
  }
  return `${kw} kW (${ps} PS)`;
}

/* ---------- Filter: DAT-Daten ausschließen ---------- */

const DAT_KEYWORDS = [
  'dat-',
  'dat ',
  'datgroup',
  'dat group',
  'dat-bewertung',
  'dat-marktwert',
  'dat-prognose',
  'dat-code',
  'dat-restwert',
  'schwacke', // verwandt, ebenfalls nicht in Pflichtangaben
];

/**
 * Prüft, ob ein Wert eine DAT-spezifische Angabe ist und in den Pflichtangaben
 * nicht erscheinen darf.
 */
export function isDatOnlyValue(value?: string | null): boolean {
  if (!value) return false;
  const v = String(value).toLowerCase();
  return DAT_KEYWORDS.some(k => v.includes(k));
}

/** Entfernt DAT-Angaben aus einem Pflichtangaben-Eingabeobjekt (defensive Kopie). */
export function stripDatValues<T extends Record<string, unknown>>(input: T): T {
  const clone: Record<string, unknown> = { ...input };
  for (const [key, val] of Object.entries(clone)) {
    if (typeof val === 'string' && isDatOnlyValue(val)) {
      clone[key] = '';
    }
  }
  return clone as T;
}

/* ---------- Hauptformatter ---------- */

/**
 * Liefert die fertige, einzeilige Pflichtangabe (mit "•"-Trennung) für ein Fahrzeug.
 * Gibt einen leeren String zurück, wenn keinerlei verwertbare Daten vorhanden sind.
 */
export function formatMandatoryDisclosure(rawInput: MandatoryDisclosureInput): string {
  // 1. DAT-Daten entfernen
  const input = stripDatValues(rawInput);
  const kind = detectDriveKind(input);
  const segments: string[] = [];

  // Zustand
  if (input.condition) segments.push(input.condition);

  // Leistung
  const power = powerLabel(input);
  if (power) segments.push(power);

  // Antrieb + Verbrauch
  const drive = driveLabel(input, kind);

  if (kind === 'phev') {
    // "Hybrid (Benzin/Elektro) 17,2 kWh/100km + 4,9 l/100km (gew. komb.), 10,4 l/100km (entladen, komb.)"
    const parts: string[] = [drive];
    const elec = withUnit(input.consumptionElectric, 'kWh/100km');
    const combWeighted = withUnit(input.consumptionCombined, 'l/100km');
    const combDischarged = withUnit(input.consumptionCombinedDischarged, 'l/100km');

    const weightedPart = [elec, combWeighted].filter(Boolean).join(' + ');
    if (weightedPart) parts.push(`${weightedPart} (gew. komb.)`);
    if (combDischarged) {
      // Komma + Leerzeichen, aber nur wenn ein gewichteter Teil davor steht
      const sep = weightedPart ? ', ' : ' ';
      parts[parts.length - 1] = `${parts[parts.length - 1]}${sep}${combDischarged} (entladen, komb.)`;
    }
    segments.push(parts.join(' '));
  } else if (kind === 'electric') {
    // "Elektro 13,6 kWh/100km (komb.)"
    const elec = withUnit(input.consumptionElectric || input.consumptionCombined, 'kWh/100km');
    segments.push([drive, elec ? `${elec} (komb.)` : null].filter(Boolean).join(' '));
  } else {
    // "Benzin 7,8 l/100km (komb.)"
    const cons = withUnit(input.consumptionCombined, 'l/100km');
    segments.push([drive, cons ? `${cons} (komb.)` : null].filter(Boolean).join(' '));
  }

  // CO₂-Emissionen
  if (kind === 'phev') {
    const co2W = withUnit(input.co2Emissions, 'g CO₂/km');
    if (co2W) segments.push(`${co2W} (gew. komb.)`);
  } else {
    const co2 = withUnit(input.co2Emissions, 'g CO₂/km');
    if (co2) segments.push(`${co2} (komb.)`);
  }

  // CO₂-Klasse (immer A–G erzwingen)
  const cls = cleanClass(input.co2Class);
  const clsDisch = cleanClass(input.co2ClassDischarged);
  if (kind === 'phev' && cls) {
    const tail = clsDisch ? `, ${clsDisch} (entladen, komb.)` : '';
    segments.push(`CO₂-Klasse ${cls} (gew. komb.)${tail}`);
  } else if (cls) {
    segments.push(`CO₂-Klasse ${cls} (komb.)`);
  }

  return segments.filter(s => s && s.trim()).join(' • ');
}
