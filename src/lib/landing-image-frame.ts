/**
 * Per-image frame settings for generated landing pages (desktop editing only).
 * The frame defines the visible area; the image inside is panned/zoomed, never distorted.
 * Shared by the React editor and the HTML export.
 */
export interface LandingImageFrame {
  /** Frame width as % of its column (20–100). */
  widthPct: number;
  /** Width / height of the frame. */
  aspect: number;
  /** Image zoom inside the frame (1–3). */
  zoom: number;
  /** Focus point in % (0–100). */
  x: number;
  y: number;
  /** Left offset inside the column in % (0 … 100 - widthPct). */
  offsetPct: number;
}

export type LandingImageFrames = Record<string, LandingImageFrame>;

export const FRAME_SNAP_PX = 5;
export const FRAME_MIN_WIDTH_PCT = 20;
export const FRAME_MIN_HEIGHT_PX = 80;
export const FRAME_ZOOM_MIN = 1;
export const FRAME_ZOOM_MAX = 3;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export function parseAspect(a: string): number {
  const [w, h] = a.split('/').map(p => Number(p.trim()));
  return w > 0 && h > 0 ? w / h : 1;
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function normalizeImageFrame(raw: Partial<LandingImageFrame> | undefined | null, fallbackAspect: number): LandingImageFrame {
  const f: LandingImageFrame = {
    widthPct: clamp(num(raw?.widthPct, 100), FRAME_MIN_WIDTH_PCT, 100),
    aspect: clamp(num(raw?.aspect, fallbackAspect), 0.2, 6),
    zoom: clamp(num(raw?.zoom, 1), FRAME_ZOOM_MIN, FRAME_ZOOM_MAX),
    x: clamp(num(raw?.x, 50), 0, 100),
    y: clamp(num(raw?.y, 50), 0, 100),
    offsetPct: 0,
  };
  f.offsetPct = clamp(num(raw?.offsetPct, 0), 0, 100 - f.widthPct);
  return f;
}

/**
 * Snap a moving edge to the nearest candidate edge within the threshold.
 * Returns the snapped value and the guide that was hit (or null).
 */
export function snapEdge(value: number, candidates: number[], threshold = FRAME_SNAP_PX): { value: number; guide: number | null } {
  let best: number | null = null;
  let bestDist = threshold + 0.0001;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= threshold && d < bestDist) { best = c; bestDist = d; }
  }
  return best === null ? { value, guide: null } : { value: best, guide: best };
}

/** Inline style for the frame wrapper (shared semantics with HTML export). */
export function frameOuterStyle(f: LandingImageFrame): Record<string, string | number> {
  return {
    width: `${f.widthPct}%`,
    aspectRatio: `${f.aspect}`,
    marginLeft: `${f.offsetPct}%`,
  };
}

export function frameImageStyle(f: LandingImageFrame): Record<string, string | number> {
  return {
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom === 1 ? 'none' : `scale(${f.zoom})`,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

export function frameOuterCss(f: LandingImageFrame): string {
  return `width:${f.widthPct}%;aspect-ratio:${f.aspect};margin-left:${f.offsetPct}%`;
}

export function frameImageCss(f: LandingImageFrame): string {
  return `object-position:${f.x}% ${f.y}%;transform:${f.zoom === 1 ? 'none' : `scale(${f.zoom})`};transform-origin:${f.x}% ${f.y}%`;
}

/** Narrow layouts (tablet/mobile): framed images always use the full column width. */
export const LANDING_IMAGE_FRAME_CSS = `
@media(max-width:768px){.lp-framed{width:100% !important;margin-left:0 !important;margin-right:0 !important}}
@container lp (max-width:900px){.lp-framed{width:100% !important;margin-left:0 !important;margin-right:0 !important}}
`;
