import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface SettingRow {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_settings' as any)
      .select('*')
      .order('key');
    setSettings((data as any[]) || []);
    setLoading(false);
  };

  const updateSetting = async (key: string, value: any) => {
    const { error } = await supabase
      .from('admin_settings' as any)
      .update({ value, updated_at: new Date().toISOString() } as any)
      .eq('key', key);
    if (error) toast.error('Fehler: ' + error.message);
    else toast.success(`"${key}" gespeichert`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Einstellungen</h1>

      <p className="text-sm text-muted-foreground">
        Key-Value Einstellungen. Werte werden als JSON gespeichert.
      </p>

      <div className="space-y-4">
        {settings.map(s => (
          <div key={s.id} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-semibold text-foreground text-sm">{s.key}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(s.updated_at).toLocaleString('de-DE')}
              </span>
            </div>
            <textarea
              defaultValue={JSON.stringify(s.value, null, 2)}
              onBlur={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateSetting(s.key, parsed);
                } catch {
                  toast.error('Ungültiges JSON');
                }
              }}
              className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background text-foreground text-xs resize-y font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
