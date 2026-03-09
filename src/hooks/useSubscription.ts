import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SubscriptionInfo {
  planSlug: string | null;
  planName: string | null;
  planId: string | null;
  status: string | null;
  billingCycle: string | null;
  periodEnd: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
}

const PLAN_COLORS: Record<string, string> = {
  free: 'text-muted-foreground',
  starter: 'text-blue-500',
  pro: 'text-accent',
  enterprise: 'text-amber-500',
};

const PLAN_BG: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  starter: 'bg-blue-500/15 text-blue-600',
  pro: 'bg-accent/15 text-accent',
  enterprise: 'bg-amber-500/15 text-amber-600',
};

const FREE_SUB: SubscriptionInfo = {
  planSlug: 'free', planName: 'Free', planId: null, status: null,
  billingCycle: null, periodEnd: null, stripeSubscriptionId: null, cancelAtPeriodEnd: false,
};

export function useSubscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubscriptionInfo>(FREE_SUB);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const { data: userSub } = await supabase
      .from('user_subscriptions' as any)
      .select('plan_id, status, billing_cycle, current_period_end, stripe_subscription_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!userSub || (userSub as any).status === 'cancelled') {
      setSub(FREE_SUB);
      setLoading(false);
      return;
    }

    const { data: plan } = await supabase
      .from('subscription_plans' as any)
      .select('name, slug')
      .eq('id', (userSub as any).plan_id)
      .single();

    setSub({
      planSlug: (plan as any)?.slug || 'free',
      planName: (plan as any)?.name || 'Free',
      planId: (userSub as any).plan_id,
      status: (userSub as any).status,
      billingCycle: (userSub as any).billing_cycle,
      periodEnd: (userSub as any).current_period_end,
      stripeSubscriptionId: (userSub as any).stripe_subscription_id || null,
      cancelAtPeriodEnd: false, // will be overridden by Stripe webhook if needed
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Listen for realtime changes to user_subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('subscription-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        // Re-fetch on any change (UPDATE, INSERT, DELETE)
        fetchSubscription();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSubscription]);

  return {
    ...sub,
    loading,
    isFreePlan: !sub.planSlug || sub.planSlug === 'free',
    isCancelled: sub.status === 'cancelled',
    isPastDue: sub.status === 'past_due',
    planColor: PLAN_COLORS[sub.planSlug || 'free'] || PLAN_COLORS.free,
    planBg: PLAN_BG[sub.planSlug || 'free'] || PLAN_BG.free,
    refresh: fetchSubscription,
  };
}
