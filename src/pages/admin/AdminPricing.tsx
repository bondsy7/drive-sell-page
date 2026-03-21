import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, RotateCcw, Zap, Sparkles, Crown, Rocket, Diamond } from 'lucide-react';

const MODEL_TIERS = [
  { id: 'schnell', label: 'Schnell', icon: Zap },
  { id: 'qualitaet', label: 'Qualität', icon: Sparkles },
  { id: 'premium', label: 'Premium', icon: Crown },
  { id: 'turbo', label: 'Turbo', icon: Rocket },
  { id: 'ultra', label: 'Ultra', icon: Diamond },
] as const;

type TierCosts = Record<string, number>;
interface CreditCosts { [action: string]: TierCosts }

const ALL_ACTIONS: { key: string; label: string; category: string; defaults: Record<string, number> }[] = [
  { key: 'pdf_analysis', label: 'PDF-Analyse', category: 'PDF & Analyse', defaults: { schnell: 2, qualitaet: 3, premium: 5, turbo: 4, ultra: 7 } },
  { key: 'vin_ocr', label: 'VIN-OCR (Kennzeichen)', category: 'PDF & Analyse', defaults: { schnell: 1, qualitaet: 1, premium: 2, turbo: 1, ultra: 2 } },
  { key: 'image_generate', label: 'Bildgenerierung (pro Bild)', category: 'Bildgenerierung', defaults: { schnell: 3, qualitaet: 5, premium: 8, turbo: 6, ultra: 10 } },
  { key: 'image_remaster', label: 'Bild-Remastering', category: 'Bildgenerierung', defaults: { schnell: 2, qualitaet: 3, premium: 5, turbo: 4, ultra: 7 } },
  { key: 'banner_generate', label: 'Banner-Generierung', category: 'Bildgenerierung', defaults: { schnell: 3, qualitaet: 5, premium: 8, turbo: 6, ultra: 10 } },
  { key: 'video_generate', label: 'Video-Generierung', category: 'Video', defaults: { schnell: 7, qualitaet: 10, premium: 15, turbo: 10, ultra: 20 } },
  { key: 'spin360_analysis', label: '360° Spin – Analyse', category: '360° Spin', defaults: { schnell: 1, qualitaet: 1, premium: 2, turbo: 1, ultra: 2 } },
  { key: 'spin360_normalize', label: '360° Spin – Normalisierung', category: '360° Spin', defaults: { schnell: 3, qualitaet: 4, premium: 6, turbo: 5, ultra: 8 } },
  { key: 'spin360_generate', label: '360° Spin – Frame-Generierung', category: '360° Spin', defaults: { schnell: 10, qualitaet: 15, premium: 20, turbo: 15, ultra: 25 } },
  { key: 'spin360_export', label: '360° Spin – Export', category: '360° Spin', defaults: { schnell: 1, qualitaet: 2, premium: 3, turbo: 2, ultra: 4 } },
  { key: 'landing_page_export', label: 'Landing Page Export', category: 'Landing Pages', defaults: { schnell: 2, qualitaet: 3, premium: 5, turbo: 3, ultra: 5 } },
  { key: 'sales_response', label: 'Sales-Antwort generieren', category: 'Sales & CRM', defaults: { schnell: 1, qualitaet: 1, premium: 2, turbo: 1, ultra: 2 } },
  { key: 'auto_process_lead', label: 'Lead Auto-Verarbeitung', category: 'Sales & CRM', defaults: { schnell: 1, qualitaet: 1, premium: 2, turbo: 1, ultra: 2 } },
];

const CATEGORIES = [...new Set(ALL_ACTIONS.map(a => a.category))];

export default function AdminPricing() {
  const [costs, setCosts] = useState<CreditCosts>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCosts(); }, []);

  const loadCosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_settings' as any)
      .select('value')
      .eq('key', 'credit_costs')
      .single();

    const saved: CreditCosts = (data as any)?.value || {};
    const merged: CreditCosts = {};
    for (const action of ALL_ACTIONS) {
      merged[action.key] = {};
      for (const tier of MODEL_TIERS) {
        merged[action.key][tier.id] = saved[action.key]?.[tier.id] ?? action.defaults[tier.id] ?? 1;
      }
    }
    setCosts(merged);
    setLoading(false);
  };

  const saveCosts = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('admin_settings' as any)
      .update({ value: costs, updated_at: new Date().toISOString() } as any)
      .eq('key', 'credit_costs');
    if (error) {
      const { error: insertErr } = await supabase
        .from('admin_settings' as any)
        .insert({ key: 'credit_costs', value: costs } as any);
      if (insertErr) { toast.error('Fehler: ' + insertErr.message); setSaving(false); return; }
    }
    toast.success('Credit-Preise gespeichert');
    setSaving(false);
  };

  const updateCost = (action: string, tier: string, value: number) => {
    setCosts(prev => ({
      ...prev,
      [action]: { ...prev[action], [tier]: value },
    }));
  };

  const resetToDefaults = () => {
    const defaults: CreditCosts = {};
    for (const a of ALL_ACTIONS) {
      defaults[a.key] = { ...a.defaults };
    }
    setCosts(defaults);
    toast.info('Auf Standardwerte zurückgesetzt (noch nicht gespeichert)');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-foreground">Credit-Preise</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults} className="gap-1.5">
            <RotateCcw className="w-4 h-4" /> Defaults
          </Button>
          <Button onClick={saveCosts} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" /> {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Legt fest, wie viele Credits pro Aktion und Modell-Stufe abgezogen werden. Die Stufen entsprechen den KI-Modellen, die der Nutzer bei der Ausführung wählt.
      </p>

      {CATEGORIES.map(cat => (
        <div key={cat} className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">{cat}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-muted-foreground">Aktion</th>
                  {MODEL_TIERS.map(t => {
                    const Icon = t.icon;
                    return (
                      <th key={t.id} className="text-center p-3 font-medium text-muted-foreground w-24">
                        <div className="flex items-center justify-center gap-1">
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-xs">{t.label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ALL_ACTIONS.filter(a => a.category === cat).map(action => (
                  <tr key={action.key} className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground">{action.label}</td>
                    {MODEL_TIERS.map(t => (
                      <td key={t.id} className="p-3">
                        <Input
                          type="number"
                          min={0}
                          value={costs[action.key]?.[t.id] ?? 0}
                          onChange={e => updateCost(action.key, t.id, parseInt(e.target.value) || 0)}
                          className="w-16 mx-auto text-center h-8 text-xs"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
