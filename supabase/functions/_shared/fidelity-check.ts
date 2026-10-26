// Vehicle Fidelity Check (Shadow): pure prompt/decision helpers, no I/O.
export const FIDELITY_ATTRIBUTES = [
  'body_shape', 'paint_color', 'wheel_design', 'lights', 'front_rear', 'bumpers', 'mirrors',
  'window_line', 'roof', 'door_count', 'badges', 'sensors', 'interior', 'seats', 'cockpit', 'special_equipment',
] as const;
export type FidelityStatus = 'PASS' | 'UNCERTAIN' | 'FAIL';
export interface FidelityFinding {
  attribute: string; verdict: 'match' | 'mismatch' | 'unverifiable';
  confidence: number; evidence_ref?: string; issue?: string; instruction?: string;
}
export const FIDELITY_FAIL_CONFIDENCE = 0.8;
export const FIDELITY_PROMPT_VERSION = 'fidelity-v2';

/** Kritische Identitätsattribute: nur hier kann eine Abweichung zum FAIL führen. */
export const CRITICAL_FIDELITY_ATTRIBUTES: ReadonlySet<string> = new Set([
  'body_shape', 'paint_color', 'wheel_design', 'lights', 'front_rear', 'bumpers',
  'window_line', 'roof', 'door_count', 'interior', 'seats', 'cockpit',
]);
export function isCriticalAttribute(attribute: string): boolean {
  return CRITICAL_FIDELITY_ATTRIBUTES.has(attribute.trim().toLowerCase());
}

const INTERIOR_TARGET_RE = /interior|innenraum|cockpit|dashboard|sitz|seat|cabin|kabine/i;
const WHEEL_ROLE_RE = /wheel|felge|rim/i;

export function isInteriorTarget(hint: string): boolean {
  return INTERIOR_TARGET_RE.test(hint);
}

/** Der Shadow-Check gilt für jeden Generierungsweg – inklusive NB21 V2/V3. */
export function shouldRunFidelityCheck(args: { hasValidatorKey: boolean; hasMainReference: boolean }): boolean {
  return args.hasValidatorKey && args.hasMainReference;
}

export interface FidelityRefCandidate<T = unknown> { role: string; part: T }

/**
 * Wählt bis zu `maxExtras` Zusatzreferenzen aus bereits im Request vorhandenen
 * Bildern. Priorität: Felgenreferenz bei Außenzielen, Innenraumreferenz bei
 * Innenraumzielen, danach Rollen, die zum Ziel passen. Nie blind alle Bilder.
 */
export function selectFidelityReferences<T>(args: {
  targetHint: string;
  candidates: FidelityRefCandidate<T>[];
  maxExtras?: number;
}): FidelityRefCandidate<T>[] {
  const maxExtras = args.maxExtras ?? 2;
  if (maxExtras <= 0 || args.candidates.length === 0) return [];
  const interior = isInteriorTarget(args.targetHint);
  const picked: FidelityRefCandidate<T>[] = [];
  const used = new Set<FidelityRefCandidate<T>>();
  const take = (pred: (c: FidelityRefCandidate<T>) => boolean) => {
    for (const c of args.candidates) {
      if (picked.length >= maxExtras) return;
      if (used.has(c) || !pred(c)) continue;
      used.add(c);
      picked.push(c);
    }
  };
  if (interior) take((c) => INTERIOR_TARGET_RE.test(c.role));
  else take((c) => WHEEL_ROLE_RE.test(c.role));
  const tokens = args.targetHint.toLowerCase().split(/[^a-zäöü]+/).filter((t) => t.length > 3);
  take((c) => { const r = c.role.toLowerCase(); return tokens.some((t) => r.includes(t)); });
  take(() => true);
  return picked;
}

export function buildFidelityPrompt(referenceLabels: string[], allowedDeviations: string[]): string {
  return [
    'You are an independent vehicle fidelity inspector.',
    `IMAGES 1..${referenceLabels.length} are ORIGINAL reference photos (ground truth): ${referenceLabels.map((l, i) => `IMAGE ${i + 1}=${l}`).join(', ')}.`,
    `The LAST image is the GENERATED result.`,
    'Rules: The originals are the ONLY truth. Do NOT use knowledge about brand, model or typical equipment.',
    'Camera perspective may differ. A feature that is not visible in the originals, or not visible in the generated view, is "unverifiable" - never "mismatch".',
    'Report "mismatch" only for a real, clearly visible difference, and cite the reference image number in evidence_ref.',
    'Ignore background, lighting/exposure brightness, reflections and image style.',
    allowedDeviations.length ? `Intended changes, never a mismatch: ${allowedDeviations.join('; ')}.` : '',
    `Assess each attribute: ${FIDELITY_ATTRIBUTES.join(', ')}.`,
    'Safety-critical attributes (a clear, evidenced difference means the vehicle identity is wrong): body_shape, paint_color, wheel_design, lights, front_rear, bumpers, window_line, roof, door_count, interior, seats, cockpit.',
    'Minor attributes (badges, sensors, mirrors, special_equipment): still report visible differences, but they never alone make the result wrong.',
    'Answer strictly as JSON: {"findings":[{"attribute":"...","verdict":"match|mismatch|unverifiable","confidence":0..1,"evidence_ref":"IMAGE n","issue":"short","instruction":"short imperative fix"}]}',
  ].filter(Boolean).join('\n');
}

export function parseFindings(raw: unknown): FidelityFinding[] {
  const list = (raw as { findings?: unknown })?.findings;
  if (!Array.isArray(list)) return [];
  return list.filter((f) => f && typeof f.attribute === 'string' && ['match', 'mismatch', 'unverifiable'].includes(f.verdict))
    .map((f) => ({
      attribute: String(f.attribute).slice(0, 40), verdict: f.verdict,
      confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0)),
      evidence_ref: f.evidence_ref ? String(f.evidence_ref).slice(0, 40) : undefined,
      issue: f.issue ? String(f.issue).slice(0, 200) : undefined,
      instruction: f.instruction ? String(f.instruction).slice(0, 200) : undefined,
    }));
}

/**
 * Deterministic decision; the validator model never decides the status itself.
 * FAIL nur bei kritischer Abweichung mit hoher Konfidenz UND konkretem Referenzbeleg.
 * Normale Abweichungen (badges, sensors, mirrors, …) bleiben WARN-artig UNCERTAIN.
 */
export function decideFidelity(findings: FidelityFinding[]): FidelityStatus {
  const mismatches = findings.filter((f) => f.verdict === 'mismatch');
  if (mismatches.some((f) => isCriticalAttribute(f.attribute) && f.confidence >= FIDELITY_FAIL_CONFIDENCE && f.evidence_ref)) return 'FAIL';
  if (mismatches.length > 0) return 'UNCERTAIN';
  if (!findings.some((f) => f.verdict === 'match')) return 'UNCERTAIN';
  return 'PASS';
}

export function buildCorrections(findings: FidelityFinding[]) {
  return findings.filter((f) => f.verdict === 'mismatch' && isCriticalAttribute(f.attribute) && f.confidence >= FIDELITY_FAIL_CONFIDENCE)
    .map((f) => ({ attribute: f.attribute, issue: f.issue ?? 'Differs from reference', instruction: f.instruction ?? `Reproduce ${f.attribute} exactly from the source reference` }));
}

export async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
