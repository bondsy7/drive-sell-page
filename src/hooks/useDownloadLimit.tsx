import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DownloadLimitInfo {
  hasLimit: boolean;
  monthlyLimit: number;
  used: number;
  remaining: number;
  periodEnd: string | null;
}

interface DownloadLimitContextValue extends DownloadLimitInfo {
  loading: boolean;
  refresh: () => Promise<void>;
  /** Optimistically apply a consumed download to the local cache */
  applyConsumed: (info: { used: number; remaining: number; monthly_limit: number; period_end: string }) => void;
}

const defaultValue: DownloadLimitContextValue = {
  hasLimit: false,
  monthlyLimit: 0,
  used: 0,
  remaining: 0,
  periodEnd: null,
  loading: false,
  refresh: async () => {},
  applyConsumed: () => {},
};

const Ctx = createContext<DownloadLimitContextValue>(defaultValue);

export function DownloadLimitProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<DownloadLimitInfo>(defaultValue);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setInfo(defaultValue);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('user_download_limits')
      .select('monthly_limit, used_count, period_end')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) {
      setInfo({ hasLimit: false, monthlyLimit: 0, used: 0, remaining: 0, periodEnd: null });
    } else {
      setInfo({
        hasLimit: true,
        monthlyLimit: data.monthly_limit,
        used: data.used_count,
        remaining: Math.max(0, data.monthly_limit - data.used_count),
        periodEnd: data.period_end,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const applyConsumed = useCallback((d: { used: number; remaining: number; monthly_limit: number; period_end: string }) => {
    setInfo({
      hasLimit: true,
      monthlyLimit: d.monthly_limit,
      used: d.used,
      remaining: d.remaining,
      periodEnd: d.period_end,
    });
  }, []);

  const value = useMemo<DownloadLimitContextValue>(() => ({
    ...info, loading, refresh, applyConsumed,
  }), [info, loading, refresh, applyConsumed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDownloadLimit() {
  return useContext(Ctx);
}
