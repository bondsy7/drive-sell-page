// Exact configured tier, otherwise the same fallback in browser and server.
export const REMASTER_DEFAULTS: Record<string, number> = {
  schnell: 2, qualitaet: 3, premium: 5, turbo: 4, ultra: 7,
  neu: 8, flare: 8, sunburst: 8, nb21: 3,
};
export function resolveRemasterCost(costs: Record<string, Record<string, number>>, modelTier: string): number {
  const tier = ({ standard: 'qualitaet', pro: 'premium' } as Record<string, string>)[modelTier] || modelTier;
  const configured = costs.image_remaster?.[tier];
  return typeof configured === 'number' ? configured : REMASTER_DEFAULTS[tier] ?? 2;
}