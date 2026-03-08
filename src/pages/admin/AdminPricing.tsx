import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface CreditCosts {
  [action: string]: { standard: number; pro: number };
}

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
    if (data) setCosts((data as any).value || {});
    setLoading(false);
  };

  const saveCosts = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('admin_settings' as any)
      .update({ value: costs, updated_at: new Date().toISOString() } as any)
      .eq('key', 'credit_costs');
    if (error) toast.error('Fehler: ' + error.message);
    else toast.success('Preise gespeichert');
    setSaving(false);
  };

  const updateCost = (action: string, tier: 'standard' | 'pro', value: number) => {
    setCosts(prev => ({
      ...prev,
      [action]: { ...prev[action], [tier]: value },
    }));
  };

  const LABELS: Record<string, string> = {
    pdf_analysis: 'PDF-Analyse',
    image_generate: 'Bildgenerierung',
    image_remaster: 'Bild-Remastering',
    vin_ocr: 'VIN-OCR',
    landing_page_export: 'Landing Page Export',
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Credit-Preise</h1>
        <Button onClick={saveCosts} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" /> {saving ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Aktion</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Standard (Credits)</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Pro (Credits)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(costs).map(([action, tiers]) => (
              <tr key={action} className="border-b border-border last:border-0">
                <td className="p-3 text-foreground font-medium">{LABELS[action] || action}</td>
                <td className="p-3">
                  <Input
                    type="number"
                    min={0}
                    value={tiers.standard}
                    onChange={e => updateCost(action, 'standard', parseInt(e.target.value) || 0)}
                    className="w-20 mx-auto text-center h-8"
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    min={0}
                    value={tiers.pro}
                    onChange={e => updateCost(action, 'pro', parseInt(e.target.value) || 0)}
                    className="w-20 mx-auto text-center h-8"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
