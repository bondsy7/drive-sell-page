import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Eye, EyeOff, Save, ShieldCheck, AlertTriangle } from 'lucide-react';

interface SecretRow {
  id: string;
  key: string;
  value: string;
  label: string | null;
  updated_at: string;
}

export default function AdminSecrets() {
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => { loadSecrets(); }, []);

  const loadSecrets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_secrets' as any)
      .select('*')
      .order('key');
    if (error) {
      toast.error('Fehler beim Laden der Secrets');
      setLoading(false);
      return;
    }
    const rows = (data as any[] || []) as SecretRow[];
    setSecrets(rows);
    const vals: Record<string, string> = {};
    rows.forEach(s => { vals[s.key] = s.value; });
    setEditValues(vals);
    setLoading(false);
  };

  const saveSecret = async (key: string) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    const newValue = editValues[key] ?? '';
    const { error } = await supabase
      .from('admin_secrets' as any)
      .update({ value: newValue, updated_at: new Date().toISOString() } as any)
      .eq('key', key);
    if (error) {
      toast.error(`Fehler beim Speichern von "${key}"`);
    } else {
      toast.success(`"${key}" gespeichert`);
      loadSecrets();
    }
    setSaving(prev => ({ ...prev, [key]: false }));
  };

  const maskValue = (val: string) => {
    if (!val) return '';
    if (val.length <= 8) return '••••••••';
    return val.slice(0, 4) + '••••••••' + val.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">API-Keys & Secrets</h1>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Ihre API-Schlüssel sicher. Änderungen werden sofort wirksam.
          </p>
        </div>
      </div>

      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Sicherheitshinweis</p>
          <p className="text-muted-foreground">
            Diese Schlüssel werden verschlüsselt in der Datenbank gespeichert und sind nur für Administratoren sichtbar.
            Edge Functions lesen diese Werte automatisch. Ändern Sie Keys nur, wenn nötig.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {secrets.map(s => {
          const isVisible = visible[s.key] || false;
          const currentVal = editValues[s.key] ?? '';
          const hasChanged = currentVal !== s.value;
          const isSaving = saving[s.key] || false;

          return (
            <div key={s.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-display font-semibold text-foreground text-sm">{s.label || s.key}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{s.key}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.value ? '✓ Gesetzt' : '✗ Leer'}
                  {s.updated_at && ` · ${new Date(s.updated_at).toLocaleString('de-DE')}`}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={isVisible ? 'text' : 'password'}
                    value={isVisible ? currentVal : (hasChanged ? currentVal : maskValue(s.value))}
                    onChange={e => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                    onFocus={() => {
                      if (!isVisible && !hasChanged) {
                        setEditValues(prev => ({ ...prev, [s.key]: s.value }));
                      }
                    }}
                    placeholder="Wert eingeben..."
                    className="font-mono text-sm pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setVisible(prev => ({ ...prev, [s.key]: !isVisible }))}
                  >
                    {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <Button
                  size="sm"
                  disabled={!hasChanged || isSaving}
                  onClick={() => saveSecret(s.key)}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
