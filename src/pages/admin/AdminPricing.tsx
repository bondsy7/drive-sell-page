import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, RotateCcw } from 'lucide-react';

interface TierCost { standard: number; pro: number }
interface CreditCosts { [action: string]: TierCost }

// All credit action types actually used across edge functions
const ALL_ACTIONS: { key: string; label: string; category: string; defaultStd: number; defaultPro: number }[] = [
  // PDF & Analyse
  { key: 'pdf_analysis', label: 'PDF-Analyse', category: 'PDF & Analyse', defaultStd: 2, defaultPro: 1 },
  { key: 'vin_ocr', label: 'VIN-OCR (Kennzeichen)', category: 'PDF & Analyse', defaultStd: 1, defaultPro: 1 },
  // Bildgenerierung
  { key: 'image_generate', label: 'Bildgenerierung (pro Bild)', category: 'Bildgenerierung', defaultStd: 3, defaultPro: 2 },
  { key: 'image_remaster', label: 'Bild-Remastering', category: 'Bildgenerierung', defaultStd: 2, defaultPro: 1 },
  { key: 'banner_generate', label: 'Banner-Generierung', category: 'Bildgenerierung', defaultStd: 5, defaultPro: 3 },
  // Video
  { key: 'video_generate', label: 'Video-Generierung', category: 'Video', defaultStd: 10, defaultPro: 7 },
  // 360° Spin
  { key: 'spin360_analysis', label: '360° Spin – Analyse', category: '360° Spin', defaultStd: 1, defaultPro: 1 },
  { key: 'spin360_normalize', label: '360° Spin – Normalisierung', category: '360° Spin', defaultStd: 4, defaultPro: 3 },
  { key: 'spin360_generate', label: '360° Spin – Frame-Generierung', category: '360° Spin', defaultStd: 15, defaultPro: 10 },
  { key: 'spin360_export', label: '360° Spin – Export', category: '360° Spin', defaultStd: 2, defaultPro: 1 },
  // Landing Pages
  { key: 'landing_page_export', label: 'Landing Page Export', category: 'Landing Pages', defaultStd: 3, defaultPro: 2 },
  // Sales & CRM
  { key: 'sales_response', label: 'Sales-Antwort generieren', category: 'Sales & CRM', defaultStd: 1, defaultPro: 1 },
  { key: 'auto_process_lead', label: 'Lead Auto-Verarbeitung', category: 'Sales & CRM', defaultStd: 1, defaultPro: 1 },
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
    // Merge defaults for any missing actions
    const merged: CreditCosts = {};
    for (const action of ALL_ACTIONS) {
      merged[action.key] = {
        standard: saved[action.key]?.standard ?? action.defaultStd,
        pro: saved[action.key]?.pro ?? action.defaultPro,
      };
    }
    setCosts(merged);
    setLoading(false);
  };

  const saveCosts = async () => {
    setSaving(true);
    // Upsert: try update first, insert if not exists
    const { error } = await supabase
      .from('admin_settings' as any)
      .update({ value: costs, updated_at: new Date().toISOString() } as any)
      .eq('key', 'credit_costs');
    if (error) {
      // Try insert
      const { error: insertErr } = await supabase
        .from('admin_settings' as any)
        .insert({ key: 'credit_costs', value: costs } as any);
      if (insertErr) { toast.error('Fehler: ' + insertErr.message); setSaving(false); return; }
    }
    toast.success('Credit-Preise gespeichert');
    setSaving(false);
  };

  const updateCost = (action: string, tier: 'standard' | 'pro', value: number) => {
    setCosts(prev => ({
      ...prev,
      [action]: { ...prev[action], [tier]: value },
    }));
  };

  const resetToDefaults = () => {
    const defaults: CreditCosts = {};
    for (const a of ALL_ACTIONS) {
      defaults[a.key] = { standard: a.defaultStd, pro: a.defaultPro };
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
        Legt fest, wie viele Credits pro Aktion abgezogen werden. „Standard" gilt für Starter-Nutzer, „Pro" für Pro/Enterprise-Abonnenten.
      </p>

      {CATEGORIES.map(cat => (
        <div key={cat} className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">{cat}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium text-muted-foreground">Aktion</th>
                <th className="text-center p-3 font-medium text-muted-foreground w-28">Standard</th>
                <th className="text-center p-3 font-medium text-muted-foreground w-28">Pro</th>
              </tr>
            </thead>
            <tbody>
              {ALL_ACTIONS.filter(a => a.category === cat).map(action => (
                <tr key={action.key} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground">{action.label}</td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      value={costs[action.key]?.standard ?? 0}
                      onChange={e => updateCost(action.key, 'standard', parseInt(e.target.value) || 0)}
                      className="w-20 mx-auto text-center h-8"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      value={costs[action.key]?.pro ?? 0}
                      onChange={e => updateCost(action.key, 'pro', parseInt(e.target.value) || 0)}
                      className="w-20 mx-auto text-center h-8"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
