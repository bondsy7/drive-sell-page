/** Horizontal geometry for editable landing-page text blocks, shared by React and HTML. */
export interface LandingTextFrame {
  /** Width as % of the surrounding text column. */
  widthPct: number;
  /** Left offset as % of the surrounding text column. */
  offsetPct: number;
}

export const TEXT_FRAME_MIN_WIDTH_PCT = 20;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clean = (value: number) => Math.round(value * 10000) / 10000;
const num = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function normalizeTextFrame(raw?: Partial<LandingTextFrame> | null): LandingTextFrame {
  const widthPct = clamp(num(raw?.widthPct, 100), TEXT_FRAME_MIN_WIDTH_PCT, 100);
  return {
    widthPct: clean(widthPct),
    offsetPct: clean(clamp(num(raw?.offsetPct, 0), 0, 100 - widthPct)),
  };
}

/** Resize one horizontal edge by a delta expressed in parent-width percent. */
export function resizeTextFrame(start: LandingTextFrame, deltaPct: number, edge: 'left' | 'right'): LandingTextFrame {
  const base = normalizeTextFrame(start);
  if (edge === 'right') {
    return normalizeTextFrame({
      ...base,
      widthPct: clamp(base.widthPct + deltaPct, TEXT_FRAME_MIN_WIDTH_PCT, 100 - base.offsetPct),
    });
  }
  const offsetPct = clamp(
    base.offsetPct + deltaPct,
    0,
    base.offsetPct + base.widthPct - TEXT_FRAME_MIN_WIDTH_PCT,
  );
  return normalizeTextFrame({
    widthPct: base.widthPct - (offsetPct - base.offsetPct),
    offsetPct,
  });
}

export function textFrameOuterStyle(frame: LandingTextFrame): Record<string, string | number> {
  const normalized = normalizeTextFrame(frame);
  return {
    width: `${normalized.widthPct}%`,
    marginLeft: `${normalized.offsetPct}%`,
  };
}

export function textFrameOuterCss(frame: LandingTextFrame): string {
  const normalized = normalizeTextFrame(frame);
  return `width:${normalized.widthPct}%;margin-left:${normalized.offsetPct}%`;
}

/** Text remains fully readable on tablet/mobile even after desktop resizing. */
export const LANDING_TEXT_FRAME_CSS = `
.lp-text-frame{position:relative;min-width:0;box-sizing:border-box}
.lp-root .lp-text-frame-handle{position:absolute;top:0;bottom:0;width:12px;z-index:39;cursor:ew-resize;touch-action:none;background:transparent}
.lp-root .lp-text-frame-handle-left{left:-6px}
.lp-root .lp-text-frame-handle-right{right:-6px}
.lp-root .lp-text-frame:hover > .lp-text-frame-handle,.lp-root .lp-text-frame:focus-within > .lp-text-frame-handle,.lp-root .lp-text-frame-resizing > .lp-text-frame-handle{background:var(--lp-primary);opacity:.35}
.lp-root .lp-text-frame-handle:hover,.lp-root .lp-text-frame-resizing > .lp-text-frame-handle{background:var(--lp-primary);opacity:1}
@media(max-width:900px){.lp-text-framed{width:100% !important;margin-left:0 !important;margin-right:0 !important}}
@container lp (max-width:900px){.lp-text-framed{width:100% !important;margin-left:0 !important;margin-right:0 !important}}
`;
