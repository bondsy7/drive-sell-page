import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'off' | 'prepare' | 'full';
const OPTIONS: { value: Mode; label: string; hint: string; disabled?: boolean }[] = [
  { value: 'off', label: 'Aus', hint: 'Nach dem Import passiert nichts automatisch.' },
  { value: 'prepare', label: 'Nach Import vorbereiten', hint: 'Originale werden analysiert und die Auto3 Standard-Aufbereitung wird vorbereitet. Gestartet wird erst nach Ihrer Kostenbestätigung.' },
  { value: 'full', label: 'Vollautomatisch (in Vorbereitung)', hint: 'Erst verfügbar, wenn eine verbindliche Freigabe- und Budgetregel hinterlegt ist. Derzeit nicht aktivierbar.', disabled: true },
];

export function useAuto3AutopilotMode() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('off');
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('auto3_autopilot_mode').eq('id', user.id).maybeSingle()
      .then(({ data }) => setMode(((data?.auto3_autopilot_mode as Mode) || 'off')));
  }, [user]);
  return [mode, setMode] as const;
}

export default function Auto3AutopilotSetting() {
  const { user } = useAuth();
  const [mode, setMode] = useAuto3AutopilotMode();
  const save = async (m: Mode) => {
    if (!user || m === 'full') return;
    const prev = mode; setMode(m);
    const { error } = await supabase.from('profiles').update({ auto3_autopilot_mode: m }).eq('id', user.id);
    if (error) { setMode(prev); toast.error('Einstellung konnte nicht gespeichert werden.'); } else toast.success('Auto3 Auto-Pilot gespeichert.');
  };
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Auto3 Auto-Pilot</h4>
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <label key={o.value} className={`flex gap-2 rounded-md border border-border p-2 text-sm ${o.disabled ? 'opacity-60' : 'cursor-pointer'}`}>
            <input type="radio" name="auto3-autopilot" checked={mode === o.value} disabled={o.disabled} onChange={() => save(o.value)} className="mt-1" />
            <span><span className="font-medium">{o.label}</span><span className="block text-xs text-muted-foreground">{o.hint}</span></span>
          </label>
        ))}
      </div>
    </div>
  );
}
