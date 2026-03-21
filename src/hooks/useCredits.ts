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
  [action: string]: { [tier: string]: number };
}

interface DeductResult {
  success: boolean;
  balance: number;
  error?: string;
}

export function useCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [costs, setCosts] = useState<CreditCosts>({});
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('credit_balances')
      .select('balance, lifetime_used')
      .eq('user_id', user.id)
      .single();
    if (data) setBalance({ balance: data.balance, lifetime_used: data.lifetime_used });
  }, [user]);

  const fetchCosts = useCallback(async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'credit_costs')
      .single();
    if (data) setCosts((data.value as CreditCosts) || {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchBalance(), fetchCosts()]).finally(() => setLoading(false));

    const channel = supabase
      .channel('credit-balance')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'credit_balances',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newRow = payload.new as CreditBalance | undefined;
        if (newRow) {
          setBalance({ balance: newRow.balance, lifetime_used: newRow.lifetime_used });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchBalance, fetchCosts]);

  const deductCredits = useCallback(async (
    actionType: string, modelTier: string = 'schnell', description?: string
  ): Promise<{ success: boolean; balance: number; error?: string }> => {
    if (!user) return { success: false, balance: 0, error: 'Not authenticated' };
    const cost = costs[actionType]?.[modelTier] ?? costs[actionType]?.['schnell'] ?? 1;
    
    const { data, error } = await supabase.rpc('deduct_credits', {
      _user_id: user.id,
      _amount: cost,
      _action_type: actionType as Parameters<typeof supabase.rpc<'deduct_credits'>>[1]['_action_type'],
      _model: modelTier,
      _description: description || `${actionType} (${modelTier})`,
    });

    if (error) return { success: false, balance: balance?.balance || 0, error: error.message };
    const result = data as unknown as DeductResult;
    if (result?.success) {
      setBalance(prev => prev ? { ...prev, balance: result.balance } : null);
    }
    return { success: result?.success || false, balance: result?.balance || 0, error: result?.error };
  }, [user, costs, balance]);

  const getCost = useCallback((actionType: string, modelTier: string = 'schnell'): number => {
    return costs[actionType]?.[modelTier] ?? costs[actionType]?.['schnell'] ?? 0;
  }, [costs]);

  const fetchTransactions = useCallback(async (limit = 50): Promise<CreditTransaction[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from('credit_transactions')
      .select('id, amount, action_type, model_used, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as CreditTransaction[];
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
