export type BannerFormatCategory = "social" | "display" | "website";

export type BannerFormat = {
  id: string;
  name: string;
  width: number;
  height: number;
  category: BannerFormatCategory;
};

export type BannerTextFieldKey =
  | "headline"
  | "subline"
  | "price"
  | "cta"
  | "smallInfo"
  | "legalText";

export type BannerTextFields = Record<BannerTextFieldKey, string>;

export type LayerType = "text" | "image" | "overlay" | "logo" | "legal" | "shape";

export type OverlayDirection =
  | "none"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "full-soft";

export type ImageFitMode = "cover" | "contain";

export type TextAlign = "left" | "center" | "right";

export type BannerLayer = {
  id: string;
  type: LayerType;
  field?: BannerTextFieldKey;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string; // semantic token name e.g. "foreground" | "accent" | "background"
  align?: TextAlign;
  visible: boolean;
  draggable: boolean;
  /** Auto-shrink fontSize until text fits within `width` and `maxLines`. Default true (false for legal). */
  autoShrink?: boolean;
  /** Max wrap lines tolerated before fontSize is reduced. */
  maxLines?: number;
  /** Lower bound for shrink-to-fit. */
  minFontSize?: number;
};

export type BannerComposition = {
  formatId: string;
  backgroundImageUrl?: string;
  backgroundFit: ImageFitMode;
  overlayDirection: OverlayDirection;
  overlayStrength: number; // 0..100
  selectedTemplateId: string;
  logoUrl?: string;
  layers: BannerLayer[];
  /** Global per-format scaling multiplier for fontSize and logo width (default 1). */
  scale?: number;
  /** Stack of previous background image URLs for this format (oldest → newest). Used for rollback. */
  reframeHistory?: string[];
  /** Original master/source image used as the baseline for re-reframing this format. */
  masterImageUrl?: string;
};

export type LogoMode = "original" | "monochrome-light" | "monochrome-dark" | "custom";

export type CiState = {
  /** Brand-Preset key (z.B. "bmw", "custom") */
  brandKey: string;
  fontDisplay: string;
  fontBody: string;
  /** Geladene Google-Font Specs (z.B. "Inter:wght@400;700") */
  googleFonts?: string[];
  colors: {
    primary: string;
    secondary: string;
    text: string;
    bg: string;
  };
  /** Logo-Recoloring */
  logoMode: LogoMode;
  logoCustomColor: string;
  /** Händler-Logo zusätzlich zum Hersteller-Logo nutzen */
  useDealerLogo: boolean;
  dealerLogoUrl?: string;
  /** Selbst hochgeladenes Logo (Storage URL) */
  customLogoUrl?: string;
  /** CI darf einzelne Layer-Properties (Position, Visibility, Farbe) überschreiben.
   *  Wird beim Bauen einer Default-Composition über das Template gemergt. */
  layerOverrides?: Array<{ id: string } & Record<string, unknown>>;
};

export type StudioState = {
  selectedFormatIds: string[];
  activeFormatId: string;
  textFields: BannerTextFields;
  compositions: Record<string, BannerComposition>;
  showSafeArea: boolean;
  selectedLayerId?: string;
  /** Linked vehicle for persistence + asset attribution. Null = "no vehicle". */
  vehicleId?: string | null;
  /** Persisted banner_projects row id (set after first autosave). */
  bannerProjectId?: string;
  /** Free-text title shown in dashboard. */
  projectTitle?: string;
  /** Corporate Identity Layer */
  ci?: CiState;
};
