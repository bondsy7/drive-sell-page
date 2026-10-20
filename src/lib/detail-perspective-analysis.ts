import type { AnalyzerVisionResponse } from '@/features/reference-v2/phase1-5/analyzer-contract';
import { getPerspectiveSpec } from '@/features/reference-v2/domain/perspectives/registry';

export const DETAIL_ROLE_LABELS: Record<string, string> = {
  frontpanel: 'Frontpanel / Grill', headlight: 'Scheinwerfer', taillight: 'Rücklicht',
  steering: 'Lenkrad', cluster: 'Instrumente', screen: 'Zentraldisplay',
  dashboard: 'Cockpit', controls: 'Mittelkonsole', 'rear-seats': 'Rücksitze',
  cargo: 'Kofferraum / Laderaum', wheel: 'Felge',
};

const ROLES: Record<string, string> = {
  DET_HEADLIGHT_LEFT: 'headlight', DET_HEADLIGHT_RIGHT: 'headlight',
  DET_TAILLIGHT_LEFT: 'taillight', DET_TAILLIGHT_RIGHT: 'taillight',
  DET_GRILLE: 'frontpanel', DET_STEERING_WHEEL: 'steering', DET_CLUSTER: 'cluster',
  DET_INFOTAINMENT: 'screen', DET_CENTER_CONSOLE: 'controls',
  DET_WHEEL_FRONT_LEFT: 'wheel', DET_WHEEL_FRONT_RIGHT: 'wheel',
  DET_WHEEL_REAR_LEFT: 'wheel', DET_WHEEL_REAR_RIGHT: 'wheel',
};

/** Only an actual, confidently visible canonical detail may supply an automatic role. */
export function resolveDetailPerspective(response: AnalyzerVisionResponse): { role?: string; label?: string } {
  const id = response.canonicalPerspectiveId;
  const spec = id ? getPerspectiveSpec(id) : undefined;
  const label = spec?.labelDe;
  if (!id || !spec || !response.vehicleDetected || response.mirroredSuspected ||
    response.perspectiveConfidence < 0.8 || response.classificationConfidence < 0.8) return { label };
  const role = ROLES[id];
  if (!role || spec.requiredVisibleSurfaces.some(surface => (response.visibility.surfaces[surface] ?? 0) < 0.8)) return { label };
  return { role, label };
}