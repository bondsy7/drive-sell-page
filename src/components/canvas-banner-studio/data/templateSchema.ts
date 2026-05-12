import type {
  BannerLayer,
  BannerTextFieldKey,
  ImageFitMode,
  OverlayDirection,
  TextAlign,
} from "../state/types";

/** Optionaler Anker für die Interpretation von x/y. Default: "absolute". */
export type LayerAnchor =
  | "absolute"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

/**
 * Deklarative Beschreibung einer einzelnen Ebene innerhalb eines Format×Template.
 * Maße sind absolute Pixel im Koordinatensystem des Formats (z.B. 0..width / 0..height).
 */
export type LayerSpec = {
  id: string;
  type: "image" | "overlay" | "text" | "legal" | "logo";
  field?: BannerTextFieldKey;
  x: number;
  y: number;
  width?: number;
  height?: number;
  anchor?: LayerAnchor;
  fontSize?: number;
  fontWeight?: number;
  align?: TextAlign;
  color?: string;
  visible?: boolean;
  draggable?: boolean;
  autoShrink?: boolean;
  minFontSize?: number;
  maxLines?: number;
  // overlay-only
  direction?: OverlayDirection;
  strength?: number;
  // image-only
  fit?: ImageFitMode;
};

/** Template-Spec für genau ein Format. */
export type TemplateSpec = {
  templateId: string;
  formatId: string;
  name: string;
  description?: string;
  format: { width: number; height: number };
  safeArea: { top: number; right: number; bottom: number; left: number };
  defaults?: { fontDisplay?: string; fontBody?: string };
  layers: LayerSpec[];
};

/** Quelle eines geladenen Templates (Debug/UI). */
export type TemplateSource = "bundle" | "global" | "brand" | "user";

export type LoadedTemplate = {
  spec: TemplateSpec;
  source: TemplateSource;
  /** DB-ID falls aus DB geladen */
  id?: string;
};

/** Re-Export Helfer für Konvertierung */
export type { BannerLayer };
