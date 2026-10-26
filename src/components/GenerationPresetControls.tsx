import { useState } from 'react';
import { Save, Trash2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useGenerationPreferences } from '@/hooks/useGenerationPreferences';
import { restoreGenerationConfig, serializeGenerationConfig } from '@/lib/generation-preferences';
import type { RemasterConfig } from '@/lib/remaster-prompt';
import { toast } from 'sonner';

export default function GenerationPresetControls({ config, onApply, scope = 'car', selectedKeys, disabled = false }: {
  config: RemasterConfig; onApply: (config: RemasterConfig, keys?: string[]) => void;
  scope?: string; selectedKeys?: string[]; disabled?: boolean;
}) {
  const prefs = useGenerationPreferences();
  const [selected, setSelected] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const presets = (prefs.data || []).filter(p => p.preference_key.startsWith('preset:') && (!p.settings.scope || p.settings.scope === scope));
  const apply = async (key: string) => {
    const preset = presets.find(p => p.preference_key === key);
    if (!preset) return;
    setBusy(true);
    try {
      const restored = await restoreGenerationConfig(preset.settings, prefs.user?.email);
      onApply(restored, preset.settings.selectedKeys);
      await prefs.save('last:remaster', await serializeGenerationConfig(restored, prefs.user?.id || ''));
      if (preset.settings.selectedKeys) await prefs.save(`last:pipeline:${scope}`, { selectedKeys: preset.settings.selectedKeys, scope });
      setSelected(key);
      toast.success('Vorlage geladen.');
    } catch { toast.error('Vorlage konnte nicht geladen werden.'); }
    finally { setBusy(false); }
  };
  const save = async (replace = false) => {
    if (!prefs.user || !name.trim()) return;
    setBusy(true);
    try {
      const settings = await serializeGenerationConfig(config, prefs.user.id);
      const keys = selectedKeys ?? prefs.data?.find(p => p.preference_key === `last:pipeline:${scope}`)?.settings.selectedKeys;
      const key = replace && selected ? selected : `preset:${crypto.randomUUID()}`;
      await prefs.save(key, { ...settings, selectedKeys: keys, scope }, name.trim());
      setSelected(key); setOpen(false); toast.success('Vorlage gespeichert.');
    } catch { toast.error('Vorlage konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-2">
    <Select value={selected} onValueChange={apply} disabled={disabled || busy || !prefs.isSuccess}>
      <SelectTrigger className="h-9 w-52" aria-label="Einstellungsvorlage"><SelectValue placeholder="Vorlage wählen" /></SelectTrigger>
      <SelectContent>{presets.length ? presets.map(p => <SelectItem key={p.preference_key} value={p.preference_key}>{p.name}</SelectItem>) : <SelectItem value="empty" disabled>Keine Vorlagen</SelectItem>}</SelectContent>
    </Select>
    {selected && <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Vorlage erneut laden" title="Vorlage erneut laden" disabled={disabled || busy} onClick={() => apply(selected)}><RotateCcw className="h-4 w-4" /></Button>}
    <Button variant="outline" size="sm" disabled={disabled || busy || !prefs.isSuccess} onClick={() => { setName(presets.find(p => p.preference_key === selected)?.name || ''); setOpen(true); }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Als Vorlage speichern
    </Button>
    {selected && <Button variant="ghost" size="icon" className="h-9 w-9" disabled={disabled || busy} aria-label="Vorlage löschen" title="Vorlage löschen" onClick={async () => {
      if (!window.confirm('Diese Vorlage löschen? Die aktuellen Einstellungen bleiben erhalten.')) return;
      try { await prefs.remove(selected); setSelected(''); } catch { toast.error('Vorlage konnte nicht gelöscht werden.'); }
    }}><Trash2 className="h-4 w-4" /></Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Einstellungen als Vorlage speichern</DialogTitle></DialogHeader>
      <Input aria-label="Vorlagenname" placeholder="Zum Beispiel Standort Berlin oder Winteraktion" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>{selected && <Button variant="outline" disabled={busy || !name.trim()} onClick={() => save(true)}>Vorlage aktualisieren</Button>}<Button disabled={busy || !name.trim()} onClick={() => save()}>Neue Vorlage speichern</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}