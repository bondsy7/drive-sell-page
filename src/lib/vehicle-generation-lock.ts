/**
 * Prevents image models from replacing a photographed vehicle with a remembered
 * catalogue generation/facelift. Text metadata may help identify the subject,
 * but the pixels in the supplied vehicle references remain authoritative.
 */
export function buildVehicleGenerationLock(vehicleDescription?: string): string {
  const metadata = vehicleDescription?.trim();

  return `<MODEL_GENERATION_LOCK>
CRITICAL — PHOTOGRAPHED VEHICLE GENERATION / FACELIFT IS IMMUTABLE:
1. The attached VEHICLE BLUEPRINT and vehicle reference photos are the ONLY visual source for model generation, facelift, body shell, front fascia and rear fascia.
2. Vehicle metadata${metadata ? ` ("${metadata}")` : ''} is IDENTIFICATION CONTEXT ONLY. Never use the model name, model year, trim name, VIN data, training memory, catalogue imagery or a common/default version of this model to redesign visible geometry.
3. Preserve the exact photographed generation even when it is newer, recently launched, rare, unfamiliar, or differs from the version remembered by the model.
4. FRONT IDENTITY — copy from the reference exactly: hood leading edge, badge/wordmark position, grille or closed-panel shape, grille texture, headlight outer contour, complete DRL/LED signature, bumper openings, lower intake, sensors and trim boundaries.
5. REAR IDENTITY — copy from the reference exactly: tailgate shape, wordmark/badge position, taillight outline and light signature, bumper, diffuser, reflectors, sensors and trim boundaries.
6. SIDE / BODY IDENTITY — preserve the exact roofline, glasshouse, pillars, doors, handles, wheel arches, shoulder lines, rocker panels and vehicle proportions.
7. FORBIDDEN: substituting a pre-facelift, previous generation, older grille, older headlights, older bumper, older badge placement, or another trim because it is more familiar.
8. If text and pixels appear to conflict, the PIXELS WIN. If a detail is visible in any vehicle reference, copy it rather than infer it.
9. Before output, compare the rendered front/rear lamps, grille or closed panel, hood, bumper and silhouette to the references. If they indicate a different generation or facelift, correct them before returning the image.
</MODEL_GENERATION_LOCK>`;
}