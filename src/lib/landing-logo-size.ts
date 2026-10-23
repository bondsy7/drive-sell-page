export type LandingLogoId = 'header.brand' | 'header.dealer' | 'contact.dealer';
export type LandingLogoSizes = Partial<Record<LandingLogoId, number>>;

const defaults: Record<LandingLogoId, number> = {
  'header.brand': 30,
  'header.dealer': 34,
  'contact.dealer': 56,
};
export function resolveLandingLogoHeight(sizes: LandingLogoSizes | undefined, id: LandingLogoId): number {
  const value = sizes?.[id];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(160, Math.max(16, Math.round(value))) : defaults[id];
}

export const LANDING_LOGO_CSS = `
.lp-logo{display:inline-flex;flex-direction:column;align-items:center;max-width:100%;min-width:0;vertical-align:middle}
.lp-logo-image{display:block;max-width:100%;width:auto;object-fit:contain}
.lp-header-logos{display:flex;flex-wrap:wrap;align-items:center;gap:14px;min-width:0;max-width:100%;flex:1}
.lp-contact-logo{margin-bottom:20px}
`;