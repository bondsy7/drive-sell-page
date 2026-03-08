import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface PromptSettings {
  [key: string]: string;
}

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<PromptSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPrompts(); }, []);

  const loadPrompts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_settings' as any)
      .select('value')
      .eq('key', 'ai_prompts')
      .single();
    if (data) setPrompts((data as any).value || {});
    setLoading(false);
  };

  const savePrompts = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('admin_settings' as any)
      .update({ value: prompts, updated_at: new Date().toISOString() } as any)
      .eq('key', 'ai_prompts');
    if (error) toast.error('Fehler: ' + error.message);
    else toast.success('Prompts gespeichert');
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  const LABELS: Record<string, string> = {
    pdf_analysis: 'PDF-Analyse',
    image_generate: 'Bildgenerierung',
    image_remaster: 'Bild-Remastering',
    vin_ocr: 'VIN-OCR',
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Prompt-Verwaltung</h1>
        <Button onClick={savePrompts} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" /> {saving ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Hier kannst du die System-Prompts für jede KI-Aktion anpassen. "default" verwendet den eingebauten Standard-Prompt.
      </p>

      <div className="space-y-6">
        {Object.entries(prompts).map(([key, value]) => (
          <div key={key} className="bg-card rounded-xl border border-border p-5">
            <label className="block font-display font-semibold text-foreground text-sm mb-2">
              {LABELS[key] || key}
            </label>
            <textarea
              value={value}
              onChange={e => setPrompts(p => ({ ...p, [key]: e.target.value }))}
              className="w-full min-h-[120px] p-3 rounded-lg border border-border bg-background text-foreground text-sm resize-y font-mono"
              placeholder="default"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
