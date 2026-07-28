/**
 * PKW-Prompt-Profil.
 *
 * Die Pkw-Prompt-Blöcke bleiben unverändert in
 * `src/lib/remaster-prompt-defaults.ts` (REMASTER_PROMPT_BLOCKS) und werden
 * über die Admin-Prompt-Verwaltung gepflegt. Diese Datei existiert als
 * expliziter Namespace-Marker der strikten Prompt-Trennung.
 *
 * REGEL: Hier darf NIEMALS eine Lkw-Regel landen, und in
 * `src/prompts/remaster/truck.ts` niemals eine Pkw-Regel.
 */

export const CAR_PROMPT_PROFILE = 'car' as const;

/**
 * Blöcke, die für BEIDE Klassen gelten (fahrzeugneutrale Anti-Halluzinations-
 * und Foto-Standards). Sie stammen aus REMASTER_PROMPT_BLOCKS und bleiben
 * für Pkw exakt wie bisher aktiv.
 */
export const SHARED_PROMPT_BLOCK_KEYS = [
  'base_instruction',
  'identity_lock',
  'mirror_system_lock',
  'side_skirt_lock',
  'vehicle_scale_lock',
  'anti_cropping',
  'scene_lighting_exterior',
  'scene_lighting_interior',
  'custom_showroom_instruction',
  'negative_constraints',
  'interior_rules',
  'license_plate_remove',
  'license_plate_blur',
] as const;
