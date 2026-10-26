import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { RemasterConfig } from '@/lib/remaster-prompt';
import { restoreGenerationConfig, serializeGenerationConfig, type GenerationSettings } from '@/lib/generation-preferences';

export interface GenerationPreference { preference_key: string; name: string | null; settings: GenerationSettings }
const queues = new Map<string, Promise<unknown>>();
export function useGenerationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ['generation-preferences', user?.id];
  const query = useQuery({
    queryKey, enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('generation_preferences').select('preference_key,name,settings').eq('user_id', user.id);
      if (error) throw error;
      return (data || []) as unknown as GenerationPreference[];
    },
  });
  const save = useCallback(async (key: string, settings: GenerationSettings, name: string | null = null) => {
    if (!user) throw new Error('Bitte anmelden.');
    const id = user.id;
    const task = (queues.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
      const { error } = await supabase.from('generation_preferences').upsert({ user_id: id, preference_key: key, name, settings: settings as never });
      if (error) throw error;
      qc.setQueryData<GenerationPreference[]>(['generation-preferences', id], old => [
        ...(old || []).filter(p => p.preference_key !== key), { preference_key: key, name, settings },
      ]);
    });
    queues.set(id, task);
    return task;
  }, [user?.id, qc]);
  const remove = async (key: string) => {
    if (!user) return;
    const { error } = await supabase.from('generation_preferences').delete().eq('user_id', user.id).eq('preference_key', key);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey });
  };
  return { ...query, user, save, remove };
}

export function useRememberRemasterConfig(config: RemasterConfig, onChange: (config: RemasterConfig) => void) {
  const prefs = useGenerationPreferences();
  const [ready, setReady] = useState(false);
  const loaded = useRef<string>();
  const last = useRef('');
  const current = useRef({ config, onChange });
  current.current = { config, onChange };
  useEffect(() => {
    if (!prefs.user || !prefs.isSuccess || loaded.current === prefs.user.id) return;
    let cancelled = false;
    const id = prefs.user.id;
    const record = prefs.data?.find(p => p.preference_key === 'last:remaster');
    (async () => {
      try {
        const restored = record ? await restoreGenerationConfig(record.settings, prefs.user?.email) : current.current.config;
        if (cancelled) return;
        loaded.current = id;
        last.current = JSON.stringify(restored);
        if (record) current.current.onChange(restored);
        setReady(true);
      } catch { toast.error('Gespeicherte Einstellungen konnten nicht geladen werden.'); }
    })();
    return () => { cancelled = true; };
  }, [prefs.user?.id, prefs.isSuccess, prefs.data]);
  useEffect(() => {
    if (!ready || loaded.current !== prefs.user?.id || !prefs.user) return;
    const signature = JSON.stringify(config);
    if (signature === last.current) return;
    last.current = signature;
    const id = prefs.user.id;
    // Queue immediately: navigation cannot discard the last interaction.
    serializeGenerationConfig(config, id).then(settings => prefs.save('last:remaster', settings))
      .catch(() => toast.error('Einstellungen konnten nicht gespeichert werden.'));
  }, [config, ready, prefs.user?.id, prefs.save]);
  return { ...prefs, ready: ready && loaded.current === prefs.user?.id };
}