import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BRAND_ALIAS_MAP, normalizeBrand } from '@/lib/brand-aliases';

export interface VehicleMake {
  key: string;
  models: { key: string }[];
}

export interface MakeLogo {
  name: string; // normalized brand key (lowercase, no spaces)
  url: string;
  originalName: string; // file name in storage
}

let cachedMakes: VehicleMake[] | null = null;
let cachedLogos: MakeLogo[] | null = null;

/** Invalidate logo cache so next useVehicleMakes call reloads from storage */
export function invalidateLogoCache() {
  cachedLogos = null;
}

export function useVehicleMakes() {
  const [makes, setMakes] = useState<VehicleMake[]>(cachedMakes || []);
  const [logos, setLogos] = useState<MakeLogo[]>(cachedLogos || []);
  const [loading, setLoading] = useState(!cachedMakes);

  useEffect(() => {
    if (cachedMakes && cachedLogos) {
      setMakes(cachedMakes);
      setLogos(cachedLogos);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      // Load makes/models JSON
      try {
        const res = await fetch('/data/vehicle-makes-models.json');
        const data = await res.json();
        const carClass = data.classes?.find((c: any) => c.key === 'Car');
        const allMakes: VehicleMake[] = (carClass?.makes || []).filter(
          (m: any) => m.key !== 'ANDERE'
        );
        cachedMakes = allMakes;
        setMakes(allMakes);
      } catch (e) {
        console.error('Failed to load vehicle makes:', e);
      }

      // Load logos from storage
      try {
        const [rootRes, svgRes] = await Promise.all([
          supabase.storage.from('manufacturer-logos').list('', { limit: 500, sortBy: { column: 'name', order: 'asc' } }),
          supabase.storage.from('manufacturer-logos').list('svg', { limit: 500, sortBy: { column: 'name', order: 'asc' } }),
        ]);

        const mapFiles = (files: any[] | null, folder: string): MakeLogo[] =>
          (files || [])
            .filter((f: any) => f.name && !f.name.startsWith('.') && f.id)
            .map((f: any) => {
              const path = folder ? `${folder}/${f.name}` : f.name;
              return {
                name: f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[-_\s]+/g, ''),
                url: supabase.storage.from('manufacturer-logos').getPublicUrl(path).data.publicUrl,
                originalName: f.name,
              };
            });

        const allLogos = [...mapFiles(rootRes.data, ''), ...mapFiles(svgRes.data, 'svg')];
        cachedLogos = allLogos;
        setLogos(allLogos);
      } catch (e) {
        console.error('Failed to load logos:', e);
      }

      setLoading(false);
    };

    load();
  }, []);

  const getModelsForMake = useCallback((makeKey: string): string[] => {
    const found = makes.find(m => m.key.toLowerCase() === makeKey.toLowerCase());
    return (found?.models || []).map(m => m.key).filter(k => k !== 'ANDERE');
  }, [makes]);

  // Build a reverse alias lookup: normalized alias → list of normalized canonical names
  const reverseAliasMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [canonical, aliases] of Object.entries(BRAND_ALIAS_MAP)) {
      const cNorm = normalizeBrand(canonical);
      // canonical itself maps to canonical
      if (!map[cNorm]) map[cNorm] = [];
      if (!map[cNorm].includes(cNorm)) map[cNorm].push(cNorm);
      for (const alias of aliases) {
        const aNorm = normalizeBrand(alias);
        if (!map[aNorm]) map[aNorm] = [];
        if (!map[aNorm].includes(cNorm)) map[aNorm].push(cNorm);
      }
    }
    return map;
  }, []);

  const getLogoForMake = useCallback((makeKey: string): string | null => {
    if (!makeKey) return null;
    const normalized = normalizeBrand(makeKey);
    // Try exact match
    const exact = logos.find(l => l.name === normalized);
    if (exact) return exact.url;
    // Try all aliases (both directions)
    const candidates = reverseAliasMap[normalized] || [];
    // Also add all aliases OF the canonical names
    const allVariants = new Set<string>(candidates);
    for (const c of candidates) {
      for (const [canonical, aliases] of Object.entries(BRAND_ALIAS_MAP)) {
        if (normalizeBrand(canonical) === c) {
          aliases.forEach(a => allVariants.add(normalizeBrand(a)));
        }
      }
    }
    for (const variant of allVariants) {
      const match = logos.find(l => l.name === variant);
      if (match) return match.url;
    }
    // Try partial
    const partial = logos.find(l => l.name.includes(normalized) || normalized.includes(l.name));
    return partial?.url || null;
  }, [logos, reverseAliasMap]);

  const filterMakes = useCallback((query: string): VehicleMake[] => {
    if (!query) return makes;
    const qNorm = normalizeBrand(query);
    // Get all canonical names this query could map to
    const canonicalMatches = new Set<string>();
    canonicalMatches.add(qNorm);
    // Check if query matches any alias → get canonical
    for (const [canonical, aliases] of Object.entries(BRAND_ALIAS_MAP)) {
      const cNorm = normalizeBrand(canonical);
      if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) canonicalMatches.add(cNorm);
      for (const alias of aliases) {
        const aNorm = normalizeBrand(alias);
        if (aNorm.includes(qNorm) || qNorm.includes(aNorm)) canonicalMatches.add(cNorm);
      }
    }
    return makes.filter(m => {
      const mk = normalizeBrand(m.key);
      if (mk.includes(qNorm) || qNorm.includes(mk)) return true;
      return canonicalMatches.has(mk) || [...canonicalMatches].some(c => mk.includes(c) || c.includes(mk));
    });
  }, [makes]);

  return { makes, logos, loading, getModelsForMake, getLogoForMake, filterMakes };
}
