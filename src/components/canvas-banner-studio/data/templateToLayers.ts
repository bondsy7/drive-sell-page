import type { BannerLayer } from "../state/types";
import type { LayerSpec, TemplateSpec, LayerAnchor } from "./templateSchema";

/** Wandelt einen Anchor + relative Koordinaten in absolute x/y im Format. */
const resolveAnchor = (
  spec: LayerSpec,
  fmt: TemplateSpec["format"],
  safe: TemplateSpec["safeArea"],
): { x: number; y: number } => {
  const anchor: LayerAnchor = spec.anchor ?? "absolute";
  const w = spec.width ?? 0;
  const h = spec.height ?? 0;
  switch (anchor) {
    case "top-left":
      return { x: safe.left + spec.x, y: safe.top + spec.y };
    case "top-right":
      return { x: fmt.width - safe.right - w - spec.x, y: safe.top + spec.y };
    case "bottom-left":
      return { x: safe.left + spec.x, y: fmt.height - safe.bottom - h - spec.y };
    case "bottom-right":
      return {
        x: fmt.width - safe.right - w - spec.x,
        y: fmt.height - safe.bottom - h - spec.y,
      };
    case "center":
      return {
        x: Math.round(fmt.width / 2 - w / 2) + spec.x,
        y: Math.round(fmt.height / 2 - h / 2) + spec.y,
      };
    case "absolute":
    default:
      return { x: spec.x, y: spec.y };
  }
};

const specToLayer = (spec: LayerSpec, parent: TemplateSpec): BannerLayer => {
  const { x, y } = resolveAnchor(spec, parent.format, parent.safeArea);
  return {
    id: spec.id,
    type: spec.type,
    field: spec.field,
    x,
    y,
    width: spec.width,
    height: spec.height,
    fontSize: spec.fontSize,
    fontWeight: spec.fontWeight,
    color: spec.color,
    align: spec.align,
    visible: spec.visible ?? true,
    draggable: spec.draggable ?? (spec.type !== "image" && spec.type !== "overlay"),
    autoShrink: spec.autoShrink,
    maxLines: spec.maxLines,
    minFontSize: spec.minFontSize,
    opacity: spec.opacity,
    backgroundColor: spec.backgroundColor,
    borderRadius: spec.borderRadius,
    content: spec.content,
    imageUrl: spec.imageUrl,
  };
};

/** Mergt CI-Layer-Overrides nach ID auf den Basis-Spec. */
export const applyLayerOverrides = (
  base: TemplateSpec,
  overrides?: Partial<LayerSpec>[] | null,
): TemplateSpec => {
  if (!overrides?.length) return base;
  const map = new Map<string, Partial<LayerSpec>>();
  for (const o of overrides) {
    if (o?.id) map.set(o.id, o);
  }
  return {
    ...base,
    layers: base.layers.map((l) => {
      const o = map.get(l.id);
      return o ? { ...l, ...o, id: l.id } : l;
    }),
  };
};

export const specToBannerLayers = (
  spec: TemplateSpec,
  ciOverrides?: Partial<LayerSpec>[] | null,
): BannerLayer[] => {
  const merged = applyLayerOverrides(spec, ciOverrides);
  return merged.layers.map((l) => specToLayer(l, merged));
};
