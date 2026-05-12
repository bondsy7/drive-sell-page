import type { BannerLayer, BannerTextFieldKey } from "../state/types";

export type LayoutTemplate = {
  id: string;
  name: string;
  description: string;
  /** Returns layer overrides keyed by layer id */
  build: (width: number, height: number) => BannerLayer[];
};

const baseFontSize = (w: number, h: number, factor: number) =>
  Math.max(10, Math.round(Math.min(w, h) * factor));

/** Generate a baseline layer set used by all templates as a starting point */
const makeBaseLayers = (w: number, h: number): BannerLayer[] => [
  {
    id: "background",
    type: "image",
    x: 0,
    y: 0,
    width: w,
    height: h,
    visible: true,
    draggable: false,
  },
  {
    id: "overlay",
    type: "overlay",
    x: 0,
    y: 0,
    width: w,
    height: h,
    visible: true,
    draggable: false,
  },
  {
    id: "headline",
    type: "text",
    field: "headline",
    x: 0,
    y: 0,
    width: w,
    fontSize: baseFontSize(w, h, 0.07),
    fontWeight: 800,
    color: "background",
    align: "left",
    visible: true,
    draggable: true,
  },
  {
    id: "subline",
    type: "text",
    field: "subline",
    x: 0,
    y: 0,
    width: w,
    fontSize: baseFontSize(w, h, 0.035),
    fontWeight: 400,
    color: "background",
    align: "left",
    visible: true,
    draggable: true,
  },
  {
    id: "price",
    type: "text",
    field: "price",
    x: 0,
    y: 0,
    width: w,
    fontSize: baseFontSize(w, h, 0.06),
    fontWeight: 700,
    color: "background",
    align: "left",
    visible: true,
    draggable: true,
  },
  {
    id: "cta",
    type: "text",
    field: "cta",
    x: 0,
    y: 0,
    width: w,
    fontSize: baseFontSize(w, h, 0.035),
    fontWeight: 700,
    color: "background",
    align: "left",
    visible: true,
    draggable: true,
  },
  {
    id: "smallInfo",
    type: "text",
    field: "smallInfo",
    x: 0,
    y: 0,
    width: w,
    fontSize: baseFontSize(w, h, 0.022),
    fontWeight: 400,
    color: "background",
    align: "left",
    visible: false,
    draggable: true,
  },
  {
    id: "legal",
    type: "legal",
    field: "legalText",
    x: 0,
    y: 0,
    width: w,
    fontSize: baseFontSize(w, h, 0.018),
    fontWeight: 400,
    color: "background",
    align: "left",
    visible: true,
    draggable: true,
  },
  {
    id: "logo",
    type: "logo",
    x: 0,
    y: 0,
    width: Math.round(w * 0.18),
    height: Math.round(w * 0.18 * 0.4),
    visible: false,
    draggable: true,
  },
];

const padding = (w: number, h: number) => Math.max(8, Math.round(Math.min(w, h) * 0.04));

const place = (
  layers: BannerLayer[],
  positions: Partial<Record<string, Partial<BannerLayer>>>,
): BannerLayer[] =>
  layers.map((l) => (positions[l.id] ? { ...l, ...positions[l.id]! } : l));

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "classic-offer",
    name: "Classic Offer",
    description: "Headline oben links, Preis unten links, CTA unten rechts.",
    build: (w, h) => {
      const p = padding(w, h);
      const base = makeBaseLayers(w, h);
      return place(base, {
        headline: { x: p, y: p, width: w - 2 * p, align: "left" },
        subline: { x: p, y: p + Math.round(h * 0.1), width: w - 2 * p, align: "left" },
        price: { x: p, y: h - p - Math.round(h * 0.18), width: Math.round(w * 0.55), align: "left" },
        cta: { x: w - p - Math.round(w * 0.4), y: h - p - Math.round(h * 0.13), width: Math.round(w * 0.4), align: "right" },
        legal: { x: p, y: h - p - Math.round(h * 0.04), width: w - 2 * p, align: "left", fontSize: baseFontSize(w, h, 0.016) },
        logo: { x: w - p - Math.round(w * 0.18), y: p, visible: false },
      });
    },
  },
  {
    id: "social-strong",
    name: "Social Strong",
    description: "Headline oben, Preis groß im unteren Drittel.",
    build: (w, h) => {
      const p = padding(w, h);
      const base = makeBaseLayers(w, h);
      return place(base, {
        headline: { x: p, y: p, width: w - 2 * p, align: "center", fontSize: baseFontSize(w, h, 0.085) },
        subline: { x: p, y: p + Math.round(h * 0.12), width: w - 2 * p, align: "center" },
        price: { x: p, y: Math.round(h * 0.58), width: w - 2 * p, align: "center", fontSize: baseFontSize(w, h, 0.1) },
        cta: { x: p, y: Math.round(h * 0.78), width: w - 2 * p, align: "center" },
        legal: { x: p, y: h - p - Math.round(h * 0.05), width: w - 2 * p, align: "center" },
      });
    },
  },
  {
    id: "clean-dealer",
    name: "Clean Dealer",
    description: "Logo oben rechts, Preis unten links, CTA unten rechts.",
    build: (w, h) => {
      const p = padding(w, h);
      const base = makeBaseLayers(w, h);
      return place(base, {
        logo: { x: w - p - Math.round(w * 0.18), y: p, visible: true },
        headline: { x: p, y: p, width: Math.round(w * 0.65), align: "left" },
        subline: { x: p, y: p + Math.round(h * 0.1), width: Math.round(w * 0.65), align: "left" },
        price: { x: p, y: h - p - Math.round(h * 0.18), width: Math.round(w * 0.5), align: "left" },
        cta: { x: w - p - Math.round(w * 0.38), y: h - p - Math.round(h * 0.13), width: Math.round(w * 0.38), align: "right" },
        legal: { x: p, y: h - p - Math.round(h * 0.04), width: w - 2 * p, align: "left" },
      });
    },
  },
  {
    id: "story",
    name: "Story Format",
    description: "Headline oben, Angebot im unteren Drittel, CTA über Legal.",
    build: (w, h) => {
      const p = padding(w, h);
      const base = makeBaseLayers(w, h);
      return place(base, {
        headline: { x: p, y: Math.round(h * 0.08), width: w - 2 * p, align: "center", fontSize: baseFontSize(w, h, 0.075) },
        subline: { x: p, y: Math.round(h * 0.18), width: w - 2 * p, align: "center" },
        price: { x: p, y: Math.round(h * 0.7), width: w - 2 * p, align: "center", fontSize: baseFontSize(w, h, 0.09) },
        cta: { x: p, y: Math.round(h * 0.85), width: w - 2 * p, align: "center" },
        legal: { x: p, y: h - p - Math.round(h * 0.04), width: w - 2 * p, align: "center" },
      });
    },
  },
  {
    id: "display-compact",
    name: "Display Compact",
    description: "Sehr kurze Headline, kleiner Preis, kleines CTA.",
    build: (w, h) => {
      const p = Math.max(4, Math.round(Math.min(w, h) * 0.05));
      const base = makeBaseLayers(w, h);
      const small = baseFontSize(w, h, 0.12);
      return place(base, {
        headline: { x: p, y: p, width: w - 2 * p, fontSize: small, align: "left" },
        subline: { visible: false },
        smallInfo: { visible: false },
        price: { x: p, y: Math.round(h * 0.45), width: w - 2 * p, fontSize: baseFontSize(w, h, 0.14), align: "left" },
        cta: { x: p, y: h - p - Math.round(h * 0.25), width: w - 2 * p, align: "left", fontSize: baseFontSize(w, h, 0.1) },
        legal: { x: p, y: h - p - Math.round(h * 0.08), width: w - 2 * p, fontSize: Math.max(7, Math.round(Math.min(w, h) * 0.04)), align: "left" },
        logo: { visible: false },
      });
    },
  },
];

export const getLayoutTemplate = (id: string): LayoutTemplate =>
  LAYOUT_TEMPLATES.find((t) => t.id === id) ?? LAYOUT_TEMPLATES[0];
