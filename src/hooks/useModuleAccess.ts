import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const MODULE_KEYS = [
  'photos',
  'photos-preset',
  'photos-multi',
  'photos-spin360',
  'pdf-landing',
  'manual-landing',
  'banner',
  'video',
  'sales-assistant',
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  'photos': 'Fotos & Remastering',
  'photos-preset': 'Bildergenerator',
  'photos-multi': 'Mehrfach-Perspektiven',
  'photos-spin360': '360° Spin',
  'pdf-landing': 'PDF → Angebotsseite',
  'manual-landing': 'Landing Page manuell',
  'banner': 'Banner Generator',
  'video': 'Video Erstellung',
  'sales-assistant': 'KI Verkaufsassistent',
};

/** Sub-modules grouped under a parent module */
export const MODULE_CHILDREN: Partial<Record<ModuleKey, ModuleKey[]>> = {
  'photos': ['photos-preset', 'photos-multi', 'photos-spin360'],
};

/**
 * Returns a set of disabled module keys for the current user.
 * If no rows exist for a module, it's enabled by default.
 */
export function useModuleAccess() {
  const { user } = useAuth();
  const [disabledModules, setDisabledModules] = useState<Set<ModuleKey>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from('user_module_access')
      .select('module_key, enabled')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const disabled = new Set<ModuleKey>();
        for (const row of data || []) {
          if (!row.enabled) disabled.add(row.module_key as ModuleKey);
        }
        setDisabledModules(disabled);
        setLoading(false);
      });
  }, [user]);

  return { disabledModules, loading };
}
