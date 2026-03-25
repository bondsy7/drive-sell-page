import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DealerBank {
  id: string;
  bank_type: 'leasing' | 'financing';
  bank_name: string;
  legal_text: string;
}

export function useDealerBanks() {
  const { user } = useAuth();
  const [banks, setBanks] = useState<DealerBank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('dealer_banks')
      .select('id, bank_type, bank_name, legal_text')
      .eq('user_id', user.id)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setBanks(data as any as DealerBank[]);
        setLoading(false);
      });
  }, [user]);

  return { banks, loading };
}
