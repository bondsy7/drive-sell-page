import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Auto3Config {
  accountEmail: string;
  channels: string[];
  defaultCaption: string;
  defaultCtaUrl: string;
}

/** Reads the current user's Auto3 configuration from profiles. */
export function useAuto3Config() {
  const { user } = useAuth();
  const [config, setConfig] = useState<Auto3Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setConfig(null); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('profiles')
      .select('auto3_account_email, auto3_channels_default, auto3_default_caption, auto3_default_cta_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const raw = (data as any) || {};
        setConfig({
          accountEmail: raw.auto3_account_email || '',
          channels: raw.auto3_channels_default || ['website', 'instagram', 'facebook'],
          defaultCaption: raw.auto3_default_caption || '',
          defaultCtaUrl: raw.auto3_default_cta_url || '',
        });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  return {
    config,
    loading,
    isConfigured: !!config?.accountEmail,
  };
}
