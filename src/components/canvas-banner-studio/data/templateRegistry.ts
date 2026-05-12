import { supabase } from "@/integrations/supabase/client";
import { getBundledSpec, listBundledTemplates } from "./bundledTemplates";
import type { LoadedTemplate, TemplateSpec, TemplateSource } from "./templateSchema";

type CacheEntry = { value: LoadedTemplate; ts: number };
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

const cacheKey = (formatId: string, templateId: string, brandKey?: string | null) =>
  `${formatId}::${templateId}::${brandKey ?? ""}`;

export const invalidateTemplateCache = () => cache.clear();

/**
 * Lädt das Template für ein Format. Priorität:
 *   1. User-Override (eingeloggter User)
 *   2. Brand-spezifisch global (falls brandKey gesetzt)
 *   3. Globaler Default
 *   4. Bundle-Spec aus Code
 */
export const loadTemplate = async (
  formatId: string,
  templateId: string,
  brandKey?: string | null,
): Promise<LoadedTemplate> => {
  const k = cacheKey(formatId, templateId, brandKey);
  const cached = cache.get(k);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.value;

  const bundle = getBundledSpec(formatId, templateId);
  const fallback: LoadedTemplate = bundle
    ? { spec: bundle, source: "bundle" }
    : {
        spec: {
          templateId,
          formatId,
          name: templateId,
          format: { width: 1080, height: 1080 },
          safeArea: { top: 54, right: 54, bottom: 54, left: 54 },
          layers: [],
        },
        source: "bundle",
      };

  try {
    const { data: userId } = await supabase.auth.getSession().then((r) => ({
      data: r.data.session?.user?.id ?? null,
    }));

    const { data, error } = await supabase
      .from("banner_templates")
      .select("id, spec, is_global, user_id, brand_key")
      .eq("template_id", templateId)
      .eq("format_id", formatId);

    if (error) throw error;
    const rows = data ?? [];

    const pick = (
      filter: (r: (typeof rows)[number]) => boolean,
      source: TemplateSource,
    ): LoadedTemplate | null => {
      const r = rows.find(filter);
      if (!r) return null;
      return { spec: r.spec as TemplateSpec, source, id: r.id };
    };

    const resolved =
      (userId && pick((r) => r.user_id === userId, "user")) ||
      (brandKey && pick((r) => r.is_global && r.brand_key === brandKey, "brand")) ||
      pick((r) => r.is_global && !r.brand_key, "global") ||
      fallback;

    cache.set(k, { value: resolved, ts: Date.now() });
    return resolved;
  } catch {
    cache.set(k, { value: fallback, ts: Date.now() });
    return fallback;
  }
};

/** Synchroner Sofort-Fallback ohne DB. Wird beim initialen Render verwendet. */
export const loadTemplateSync = (
  formatId: string,
  templateId: string,
): LoadedTemplate => {
  const bundle = getBundledSpec(formatId, templateId);
  if (bundle) return { spec: bundle, source: "bundle" };
  return {
    spec: {
      templateId,
      formatId,
      name: templateId,
      format: { width: 1080, height: 1080 },
      safeArea: { top: 54, right: 54, bottom: 54, left: 54 },
      layers: [],
    },
    source: "bundle",
  };
};

export const listAllBundleTemplates = () => listBundledTemplates();
