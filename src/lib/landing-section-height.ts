/** Saved target heights are minimums: content may always grow beyond them. */
export const SECTION_EDGE_SPACE = 32;
export const SECTION_MIN_IMAGE_HEIGHT = 160;

export function normalizeSectionHeight(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(SECTION_EDGE_SPACE * 2, Math.round(value))
    : undefined;
}

export function resizeSectionHeight(start: number, delta: number, edge: 'top' | 'bottom'): number {
  return normalizeSectionHeight(start + (edge === 'top' ? -delta : delta)) ?? SECTION_EDGE_SPACE * 2;
}

export function sectionHeightVars(value: unknown): Record<string, string> {
  const height = normalizeSectionHeight(value);
  return height === undefined ? {} : { '--lp-section-height': `${height}px` };
}

export function sectionHeightAttributes(value: unknown): string {
  const height = normalizeSectionHeight(value);
  return height === undefined ? '' : ` class="lp-sized-section" style="--lp-section-height:${height}px"`;
}

/** No fixed height/overflow: long copy, stacked images and mobile reflow set the floor. */
export const LANDING_SECTION_HEIGHT_CSS = `
.lp-layout .lp-sized-section{position:relative;--lp-section-edge:${SECTION_EDGE_SPACE}px;--lp-section-image-min:${SECTION_MIN_IMAGE_HEIGHT}px}
.lp-layout .lp-sized-section > section{min-height:0 !important;overflow:visible !important;padding-block:0 !important}
.lp-layout .lp-sized-section > section > :is(.lp-section-inner,.lp-content-width,.lp-live-inner){box-sizing:border-box;min-height:var(--lp-section-height) !important;padding-block:var(--lp-section-edge) !important;display:flex;flex-direction:column;justify-content:center}
.lp-layout .lp-sized-section > section > .lp-hero-grid{display:grid;align-items:center}
.lp-layout .lp-sized-section :is(.lp-hero-text,.lp-hero-media){min-height:0 !important}
.lp-layout .lp-sized-section :is(.lp-image-frame,.lp-split-media .lp-framed,.lp-hero-media .lp-framed){max-height:max(var(--lp-section-image-min),calc(var(--lp-section-height) - 2 * var(--lp-section-edge)))}
.lp-layout .lp-sized-section .lp-hero-media:not(:has(.lp-image-frame,.lp-framed)){height:max(var(--lp-section-image-min),calc(var(--lp-section-height) - 2 * var(--lp-section-edge)));max-height:none}
.lp-layout .lp-sized-section > section > .lp-section-controls{position:absolute;inset:0 0 auto;z-index:20}
`;