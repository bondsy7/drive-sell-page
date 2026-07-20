import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const MODULE_KEYS = [
  'photos',
  'photos-preset',
  'photos-multi',
  'photos-spin360',
  'studio',
  'pdf-landing',
  'manual-landing',
  'banner',
  'canvas-banner-studio',
  'video',
  'music-studio',
  'damage-repair',
  'damage-analysis',
  'sales-assistant',
  'remaster-cleanup',
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  'photos': 'Fotos & Remastering',
  'photos-preset': 'Bildergenerator',
  'photos-multi': 'Mehrfach-Perspektiven',
  'photos-spin360': '360° Spin',
  'studio': 'One-Shot Studio',
  'pdf-landing': 'PDF → Angebotsseite',
  'manual-landing': 'Landing Page manuell',
  'banner': 'Banner Generator',
  'canvas-banner-studio': 'Banner Studio',
  'video': 'Video Erstellung',
  'music-studio': 'Musik Studio',
  'damage-repair': 'Schadensreparatur',
  'damage-analysis': 'Schadensanalyse',
  'sales-assistant': 'KI Verkaufsassistent',
  'remaster-cleanup': 'Spezifische Bereinigung (Remaster)',
};

/** Sub-modules grouped under a parent module */
export const MODULE_CHILDREN: Partial<Record<ModuleKey, ModuleKey[]>> = {
  'photos': ['photos-preset', 'photos-multi', 'photos-spin360'],
};

/**
 * Modules that are DISABLED by default and require explicit opt-in per user.
 * All other modules default to enabled.
 */
export const MODULE_DEFAULT_DISABLED: Set<ModuleKey> = new Set<ModuleKey>([
  'remaster-cleanup',
]);

/**
 * Returns a set of disabled module keys for the current user.
 * Modules in MODULE_DEFAULT_DISABLED are disabled unless a row with enabled=true exists.
 */
export function useModuleAccess() {
  const { user } = useAuth();
  const [disabledModules, setDisabledModules] = useState<Set<ModuleKey>>(
    () => new Set(MODULE_DEFAULT_DISABLED)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from('user_module_access')
      .select('module_key, enabled')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const disabled = new Set<ModuleKey>(MODULE_DEFAULT_DISABLED);
        for (const row of data || []) {
          const key = row.module_key as ModuleKey;
          if (row.enabled) disabled.delete(key);
          else disabled.add(key);
        }
        setDisabledModules(disabled);
        setLoading(false);
      });
  }, [user]);

  return { disabledModules, loading };
}
