/** Public vehicle image tiers allow the configured one-credit price; other actions retain their floor. */
export function creditCostFloor(actionType: string, tier: string, defaultFloor: number): number {
  return (actionType === 'image_generate' || actionType === 'image_remaster')
    && (tier === 'premium' || tier === 'flare') ? 1 : defaultFloor;
}