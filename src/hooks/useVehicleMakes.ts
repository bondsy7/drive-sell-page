import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const BRAND_ALIASES: Record<string, string[]> = {
    'volkswagen': ['vw'],
    'vw': ['volkswagen'],
    'mercedesbenz': ['mercedes', 'mb'],
    'mercedes': ['mercedesbenz', 'mb'],
    'bmw': ['bayerischemotorenwerke'],
  };

  const getLogoForMake = useCallback((makeKey: string): string | null => {
    if (!makeKey) return null;
    const normalized = makeKey.toLowerCase().replace(/[-_\s]+/g, '');
    // Try exact match
    const exact = logos.find(l => l.name === normalized);
    if (exact) return exact.url;
    // Try aliases
    const aliases = BRAND_ALIASES[normalized] || [];
    for (const alias of aliases) {
      const aliasMatch = logos.find(l => l.name === alias);
      if (aliasMatch) return aliasMatch.url;
    }
    // Try partial
    const partial = logos.find(l => l.name.includes(normalized) || normalized.includes(l.name));
    return partial?.url || null;
  }, [logos]);

  const filterMakes = useCallback((query: string): VehicleMake[] => {
    if (!query) return makes;
    const q = query.toLowerCase().replace(/[-_\s]+/g, '');
    const aliases = BRAND_ALIASES[q] || [];
    return makes.filter(m => {
      const mk = m.key.toLowerCase().replace(/[-_\s]+/g, '');
      return mk.includes(q) || q.includes(mk) || aliases.some(a => mk.includes(a) || a.includes(mk));
    });
  }, [makes]);

  return { makes, logos, loading, getModelsForMake, getLogoForMake, filterMakes };
}
