/**
 * Bundle-Templates: deterministisch erzeugt aus den Legacy-Buildern in
 * `layoutTemplates.ts` für jede Format×Template-Kombination.
 *
 * Diese Datei dient als Fallback, wenn keine DB-Variante existiert.
 * Sobald Admins Templates in der Datenbank pflegen, gewinnen DB-Einträge.
 */

import { BANNER_FORMATS } from "./formats";
import { LAYOUT_TEMPLATES } from "./layoutTemplates";
import type { TemplateSpec, LayerSpec } from "./templateSchema";
import type { BannerLayer } from "../state/types";

const safeAreaFor = (w: number, h: number) => {
  const p = Math.max(10, Math.round(Math.min(w, h) * 0.05));
  return { top: p, right: p, bottom: p, left: p };
};

const layerToSpec = (l: BannerLayer): LayerSpec => ({
  id: l.id,
  type: l.type,
  field: l.field,
  x: l.x,
  y: l.y,
  width: l.width,
  height: l.height,
  fontSize: l.fontSize,
  fontWeight: l.fontWeight,
  align: l.align,
  color: l.color,
  visible: l.visible,
  draggable: l.draggable,
  autoShrink: l.autoShrink,
  minFontSize: l.minFontSize,
  maxLines: l.maxLines,
});

const cache = new Map<string, TemplateSpec>();

const key = (formatId: string, templateId: string) => `${formatId}::${templateId}`;

const buildBundle = (formatId: string, templateId: string): TemplateSpec | null => {
  const f = BANNER_FORMATS.find((x) => x.id === formatId);
  const t = LAYOUT_TEMPLATES.find((x) => x.id === templateId);
  if (!f || !t) return null;
  const layers = t.build(f.width, f.height).map(layerToSpec);
  return {
    templateId: t.id,
    formatId: f.id,
    name: t.name,
    description: t.description,
    format: { width: f.width, height: f.height },
    safeArea: safeAreaFor(f.width, f.height),
    layers,
  };
};

export const getBundledSpec = (
  formatId: string,
  templateId: string,
): TemplateSpec | null => {
  const k = key(formatId, templateId);
  if (!cache.has(k)) {
    const spec = buildBundle(formatId, templateId);
    if (spec) cache.set(k, spec);
  }
  return cache.get(k) ?? null;
};

export const listBundledTemplates = (): TemplateSpec[] => {
  const out: TemplateSpec[] = [];
  for (const f of BANNER_FORMATS) {
    for (const t of LAYOUT_TEMPLATES) {
      const s = getBundledSpec(f.id, t.id);
      if (s) out.push(s);
    }
  }
  return out;
};
