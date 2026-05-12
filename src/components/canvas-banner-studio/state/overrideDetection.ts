import type { BannerComposition, BannerLayer, BannerFormat } from "../state/types";
import { getLayoutTemplate } from "../data/layoutTemplates";

const DELTA = 1; // px tolerance

function approxEq(a?: number, b?: number) {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return Math.abs(a - b) <= DELTA;
}

/** True if the layer differs from its template default (position, size, font, color, align, weight). */
export function isLayerOverridden(
  layer: BannerLayer,
  composition: BannerComposition,
  format: BannerFormat,
): boolean {
  const tmpl = getLayoutTemplate(composition.selectedTemplateId).build(format.width, format.height);
  const def = tmpl.find((l) => l.id === layer.id);
  if (!def) return false;
  if (!approxEq(layer.x, def.x)) return true;
  if (!approxEq(layer.y, def.y)) return true;
  if (!approxEq(layer.width, def.width)) return true;
  if (!approxEq(layer.fontSize, def.fontSize)) return true;
  if ((layer.fontWeight ?? 400) !== (def.fontWeight ?? 400)) return true;
  if ((layer.align ?? "left") !== (def.align ?? "left")) return true;
  if ((layer.color ?? "") !== (def.color ?? "")) return true;
  return false;
}

/** True if any layer in the composition is overridden vs. its template default. */
export function isCompositionOverridden(
  composition: BannerComposition,
  format: BannerFormat,
): boolean {
  return composition.layers.some((l) => isLayerOverridden(l, composition, format));
}
