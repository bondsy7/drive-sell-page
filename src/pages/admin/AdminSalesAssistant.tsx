import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface AdminSetting {
  key: string;
  value: any;
}

export default function AdminSalesAssistant() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const KEYS = [
    'sales_assistant_system_prompt',
    'sales_assistant_default_objections',
    'sales_assistant_default_ctas',
    'sales_assistant_channel_rules',
  ];

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('admin_settings').select('key, value').in('key', KEYS);
    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => { map[row.key] = row.value; });
    setSettings(map);
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSetting = async (key: string, value: any) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('admin_settings').upsert(
        { key, value, updated_at: new Date().toISOString() } as any,
        { onConflict: 'key' }
      );
      if (error) throw error;
      toast.success(`${key} gespeichert.`);
    } catch (e: any) {
      toast.error(e.message || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const updateSettingValue = (key: string, jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      setSettings(prev => ({ ...prev, [key]: parsed }));
    } catch {
      // allow intermediate invalid JSON while typing
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Assistant – Admin</h1>
          <p className="text-sm text-muted-foreground">Globale Defaults und System-Prompts für den KI Verkaufsassistenten verwalten.</p>
        </div>
        <Button size="sm" variant="outline" onClick={loadSettings}>
          <RefreshCw className="w-4 h-4 mr-1" /> Neu laden
        </Button>
      </div>

      <Tabs defaultValue="prompt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="objections">Einwände</TabsTrigger>
          <TabsTrigger value="ctas">CTAs</TabsTrigger>
          <TabsTrigger value="channels">Kanal-Regeln</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt">
          <SettingEditor
            label="Globaler System Prompt"
            description="Dieser Prompt wird als Basis für jede Sales-Generierung verwendet."
            settingKey="sales_assistant_system_prompt"
            value={settings['sales_assistant_system_prompt']}
            onSave={(v) => saveSetting('sales_assistant_system_prompt', v)}
            onChange={(v) => updateSettingValue('sales_assistant_system_prompt', v)}
            saving={saving}
          />
        </TabsContent>

        <TabsContent value="objections">
          <SettingEditor
            label="Standard-Einwandbehandlung"
            description="JSON-Array mit objection/response/bridge Paaren, die als Fallback genutzt werden."
            settingKey="sales_assistant_default_objections"
            value={settings['sales_assistant_default_objections']}
            onSave={(v) => saveSetting('sales_assistant_default_objections', v)}
            onChange={(v) => updateSettingValue('sales_assistant_default_objections', v)}
            saving={saving}
          />
        </TabsContent>

        <TabsContent value="ctas">
          <SettingEditor
            label="Standard-CTAs"
            description="JSON mit CTA-Vorschlägen, die in die Generierung einfließen."
            settingKey="sales_assistant_default_ctas"
            value={settings['sales_assistant_default_ctas']}
            onSave={(v) => saveSetting('sales_assistant_default_ctas', v)}
            onChange={(v) => updateSettingValue('sales_assistant_default_ctas', v)}
            saving={saving}
          />
        </TabsContent>

        <TabsContent value="channels">
          <SettingEditor
            label="Kanal-Regeln"
            description="JSON mit kanalspezifischen Anweisungen (E-Mail, WhatsApp, Telefon)."
            settingKey="sales_assistant_channel_rules"
            value={settings['sales_assistant_channel_rules']}
            onSave={(v) => saveSetting('sales_assistant_channel_rules', v)}
            onChange={(v) => updateSettingValue('sales_assistant_channel_rules', v)}
            saving={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingEditor({ label, description, settingKey, value, onSave, onChange, saving }: {
  label: string; description: string; settingKey: string;
  value: any; onSave: (v: any) => void; onChange: (v: string) => void; saving: boolean;
}) {
  const jsonStr = JSON.stringify(value || {}, null, 2);
  const [text, setText] = useState(jsonStr);

  useEffect(() => { setText(JSON.stringify(value || {}, null, 2)); }, [value]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text);
      onSave(parsed);
    } catch {
      toast.error('Ungültiges JSON.');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-foreground text-sm">{label}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Textarea
        value={text}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
        className="min-h-[300px] font-mono text-xs"
      />
      <Button size="sm" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-1" /> Speichern
      </Button>
    </div>
  );
}
