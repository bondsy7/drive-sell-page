/**
 * Prevents image models from replacing a photographed vehicle with a remembered
 * catalogue generation/facelift. Text metadata may help identify the subject,
 * but the pixels in the supplied vehicle references remain authoritative.
 */

/** Brand tokens that reliably trigger catalogue memory in image models. */
const BRAND_TOKENS = [
  'skoda', 'škoda', 'volkswagen', 'vw', 'audi', 'seat', 'cupra', 'porsche',
  'bmw', 'mini', 'mercedes', 'mercedes-benz', 'benz', 'smart', 'opel', 'ford',
  'renault', 'dacia', 'peugeot', 'citroen', 'citroën', 'ds', 'fiat', 'alfa',
  'lancia', 'jeep', 'toyota', 'lexus', 'honda', 'mazda', 'nissan', 'mitsubishi',
  'subaru', 'suzuki', 'hyundai', 'kia', 'genesis', 'volvo', 'polestar', 'tesla',
  'jaguar', 'land', 'rover', 'bentley', 'ferrari', 'lamborghini', 'maserati',
  'aston', 'martin', 'mclaren', 'lotus', 'byd', 'mg', 'chevrolet', 'chrysler',
  'dodge', 'cadillac', 'iveco', 'man', 'scania', 'daf', 'kenworth', 'ducati',
  'yamaha', 'kawasaki', 'harley', 'davidson', 'ktm', 'triumph', 'aprilia',
];

/**
 * Removes brand and model names from vehicle metadata before it enters an
 * image prompt. Naming brand/model makes the model fall back to catalogue
 * memory and render the wrong (usually older) generation; neutral descriptors
 * such as colour, body type or model year stay intact.
 */
export function sanitizeVehicleDescriptionForPrompt(description?: string): string {
  if (!description) return '';
  const tokens = description.split(/([^\p{L}\p{N}]+)/u);
  let skipNext = 0;
  const kept: string[] = [];
  for (const token of tokens) {
    if (!/[\p{L}\p{N}]/u.test(token)) {
      if (kept.length) kept.push(token);
      continue;
    }
    const norm = token.toLowerCase();
    if (BRAND_TOKENS.includes(norm)) {
      // Drop the brand plus the following model / variant token.
      skipNext = 2;
      continue;
    }
    if (skipNext > 0) {
      skipNext -= 1;
      // Keep pure numbers (e.g. model year) and known neutral words.
      if (!/^\d{4}$/.test(norm)) continue;
    }
    kept.push(token);
  }
  return kept.join('').replace(/\s{2,}/g, ' ').replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '').trim();
}

export function buildVehicleGenerationLock(vehicleDescription?: string): string {
  const metadata = vehicleDescription?.trim();
  const neutralMetadata = sanitizeVehicleDescriptionForPrompt(metadata);
  const enyaqYearMatch = metadata?.match(/(?:modelljahr\s*)?(20\d{2})/i);
  const enyaqYear = enyaqYearMatch ? Number(enyaqYearMatch[1]) : null;
  const isCurrentEnyaq = /\b(?:skoda|škoda)\b/i.test(metadata ?? '')
    && /\benyaq\b/i.test(metadata ?? '')
    && enyaqYear !== null
    && enyaqYear >= 2025;

  const knownFaceliftGuard = isCurrentEnyaq ? `
<KNOWN_FACELIFT_FRONT_GUARD>
THIS PHOTOGRAPHED VEHICLE USES THE CURRENT FACELIFT FRONT SHOWN IN THE REFERENCES (MODEL YEAR ${enyaqYear}).
The make and model are intentionally not named because catalogue-memory retrieval is forbidden.
- Copy the exact photographed closed, broad, dark front panel between the slim upper light elements: outline, width, gloss, sensors and transitions must come only from the reference pixels.
- Preserve the photographed split-light arrangement, slim upper DRL elements, lower headlamp modules, hood edge, bumper openings and current wordmark/badge placement exactly.
- FORBIDDEN OLD FRONT: no tall radiator grille, no vertical chrome grille bars/slats, no narrow framed grille, and no alternative headlamp/grille combination.
- Treat any output containing vertical grille bars or a tall central radiator-grille shape as the WRONG VEHICLE GENERATION. Replace that entire front with the reference-matching closed panel before returning the image.
</KNOWN_FACELIFT_FRONT_GUARD>` : '';

  return `<MODEL_GENERATION_LOCK>
CRITICAL — PHOTOGRAPHED VEHICLE GENERATION / FACELIFT IS IMMUTABLE:
1. The attached VEHICLE BLUEPRINT and vehicle reference photos are the ONLY visual source for model generation, facelift, body shell, front fascia and rear fascia.
2. Brand name, model name and trim name are DELIBERATELY WITHHELD from this prompt. Never guess, name or reconstruct them.${neutralMetadata ? ` Neutral context only: "${neutralMetadata}".` : ''} Never use catalogue imagery, training memory or a common/default version of any model to redesign visible geometry.
3. Preserve the exact photographed generation even when it is newer, recently launched, rare, unfamiliar, or differs from the version remembered by the model.
4. FRONT IDENTITY — copy from the reference exactly: hood leading edge, badge/wordmark position, grille or closed-panel shape, grille texture, headlight outer contour, complete DRL/LED signature, bumper openings, lower intake, sensors and trim boundaries.
5. REAR IDENTITY — copy from the reference exactly: tailgate shape, wordmark/badge position, taillight outline and light signature, bumper, diffuser, reflectors, sensors and trim boundaries.
6. SIDE / BODY IDENTITY — preserve the exact roofline, glasshouse, pillars, doors, handles, wheel arches, shoulder lines, rocker panels and vehicle proportions.
7. FORBIDDEN: substituting a pre-facelift, previous generation, older grille, older headlights, older bumper, older badge placement, or another trim because it is more familiar.
8. If text and pixels appear to conflict, the PIXELS WIN. If a detail is visible in any vehicle reference, copy it rather than infer it.
9. INTERIOR IDENTITY — copy the steering-wheel outline, spoke count, spoke geometry, button islands, centre hub, badge position, stalks, instrument binnacle and dashboard interfaces exactly from the closest interior reference. Never substitute a remembered steering wheel or dashboard from another generation.
10. Before output, compare the rendered front/rear lamps, grille or closed panel, hood, bumper, silhouette and steering wheel to the references. If they indicate a different generation or facelift, correct them before returning the image.
</MODEL_GENERATION_LOCK>${knownFaceliftGuard}`;
}