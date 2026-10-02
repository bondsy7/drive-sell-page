import { useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_TARGET, formatLiveStatus, type WebsitePublication } from '@/lib/website-publishing';

/** Compact website status for Auto3 vehicles in the vehicle header. Shows no secrets. */
export default function WebsiteStatusLine({ vehicleId, onOpen }: { vehicleId: string; onOpen?: () => void }) {
  const { data: pub, isError } = useQuery({
    queryKey: ['website-publication', vehicleId, DEFAULT_TARGET],
    queryFn: async () => {
      const { data, error } = await supabase.from('website_publications').select('*')
        .eq('vehicle_id', vehicleId).eq('target', DEFAULT_TARGET).maybeSingle();
      if (error) throw error;
      return (data as unknown as WebsitePublication) || null;
    },
  });
  const text = isError ? 'Auto Schmitt · Status nicht abrufbar' : formatLiveStatus(pub);
  return (
    <button type="button" onClick={onOpen} className="mt-0.5 flex max-w-full items-center gap-1 text-left text-[11px] text-muted-foreground hover:text-foreground">
      <Globe className={`h-3 w-3 shrink-0 ${pub?.status === 'live' ? 'text-accent' : ''}`} />
      <span className="truncate">{text}{pub?.last_error ? ' · Fehler bei letzter Aktion' : ''}</span>
    </button>
  );
}
