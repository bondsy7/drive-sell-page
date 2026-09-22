// Paketumfang: welche Module und Credit-Tätigkeiten ein Tarif freischaltet.
// Fotoservice-Pakete (foto*) enthalten ausschließlich Fahrzeugbilder und
// deren Perspektiven. Alles Weitere (Social, Banner, Video, Landingpages,
// Musik, Verkaufsassistent) ist nur in den All-Incl-Paketen enthalten.
import type { ModuleKey } from '@/hooks/useModuleAccess';

/** Module, die im Fotoservice-Paket nutzbar sind. */
export const FOTO_PLAN_MODULES: ModuleKey[] = [
  'photos',
  'photos-preset',
  'photos-multi',
  'background-swap',
  'reference-v2',
  'remaster-cleanup',
];

/** Credit-Tätigkeiten, die im Fotoservice-Paket erlaubt sind. */
export const FOTO_PLAN_ACTIONS = [
  'image_generate',
  'image_remaster',
  'image_analysis',
  'vin_ocr',
  'pdf_analysis',
  'credit_refund',
];

export function isFotoPlan(planSlug: string | null | undefined): boolean {
  return !!planSlug && planSlug.startsWith('foto');
}

/**
 * Liefert die im Tarif gesperrten Module. Leeres Array = keine Tarifsperre.
 */
export function planBlockedModules(
  planSlug: string | null | undefined,
  allModules: readonly ModuleKey[],
): ModuleKey[] {
  if (!isFotoPlan(planSlug)) return [];
  const allowed = new Set<ModuleKey>(FOTO_PLAN_MODULES);
  return allModules.filter((m) => !allowed.has(m));
}
