import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const OPTIONS = [
  { value: 'draft', label: 'Entwurf' },
  { value: 'published', label: 'Veröffentlicht' },
  { value: 'archived', label: 'Archiviert' },
] as const;

/** Publication status read by the WordPress plugin via api-landingpages. */
export default function LandingStatusSelect({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<string>('');
  useEffect(() => {
    supabase.from('projects').select('landing_status').eq('id', projectId).maybeSingle()
      .then(({ data }) => setStatus((data as { landing_status?: string } | null)?.landing_status || 'draft'));
  }, [projectId]);
  if (!status) return null;
  return (
    <select
      aria-label="Status der Landingpage"
      title="Status für die Website-Einbindung"
      value={status}
      onChange={async e => {
        const next = e.target.value;
        const prev = status;
        setStatus(next);
        const { error } = await supabase.from('projects').update({ landing_status: next } as never).eq('id', projectId);
        if (error) { setStatus(prev); toast.error('Status konnte nicht gespeichert werden.'); }
        else toast.success(`Status: ${OPTIONS.find(o => o.value === next)?.label}`);
      }}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
