import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CreditBalance {
  balance: number;
  lifetime_used: number;
}

interface CreditTransaction {
  id: string;
  amount: number;
  action_type: string;
  model_used: string | null;
  description: string | null;
  created_at: string;
}

interface CreditCosts {
  [action: string]: { standard: number; pro: number };
}

export function useCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [costs, setCosts] = useState<CreditCosts>({});
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('credit_balances' as any)
      .select('balance, lifetime_used')
      .eq('user_id', user.id)
      .single();
    if (data) setBalance(data as any);
  }, [user]);

  const fetchCosts = useCallback(async () => {
    const { data } = await supabase
      .from('admin_settings' as any)
      .select('value')
      .eq('key', 'credit_costs')
      .single();
    if (data) setCosts((data as any).value || {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchBalance(), fetchCosts()]).finally(() => setLoading(false));

    // Realtime subscription for balance updates
    const channel = supabase
      .channel('credit-balance')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'credit_balances',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new) {
          setBalance({ balance: payload.new.balance, lifetime_used: payload.new.lifetime_used });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchBalance, fetchCosts]);

  const deductCredits = useCallback(async (
    actionType: string, modelTier: string = 'standard', description?: string
  ): Promise<{ success: boolean; balance: number; error?: string }> => {
    if (!user) return { success: false, balance: 0, error: 'Not authenticated' };
    const cost = costs[actionType]?.[modelTier as 'standard' | 'pro'] ?? 1;
    
    const { data, error } = await supabase.rpc('deduct_credits' as any, {
      _user_id: user.id,
      _amount: cost,
      _action_type: actionType,
      _model: modelTier,
      _description: description || `${actionType} (${modelTier})`,
    });

    if (error) return { success: false, balance: balance?.balance || 0, error: error.message };
    const result = data as any;
    if (result?.success) {
      setBalance(prev => prev ? { ...prev, balance: result.balance } : null);
    }
    return { success: result?.success || false, balance: result?.balance || 0, error: result?.error };
  }, [user, costs, balance]);

  const getCost = useCallback((actionType: string, modelTier: string = 'standard'): number => {
    return costs[actionType]?.[modelTier as 'standard' | 'pro'] ?? 0;
  }, [costs]);

  const fetchTransactions = useCallback(async (limit = 50): Promise<CreditTransaction[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from('credit_transactions' as any)
      .select('id, amount, action_type, model_used, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data as any) || [];
  }, [user]);

  return {
    balance: balance?.balance ?? 0,
    lifetimeUsed: balance?.lifetime_used ?? 0,
    costs,
    loading,
    deductCredits,
    getCost,
    fetchBalance,
    fetchTransactions,
  };
}
