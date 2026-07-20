import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MODULE_KEYS, MODULE_LABELS, MODULE_CHILDREN, MODULE_DEFAULT_DISABLED, type ModuleKey } from '@/hooks/useModuleAccess';

interface Props {
  userId: string;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Top-level keys (not children of another module) */
const TOP_LEVEL_KEYS = MODULE_KEYS.filter(
  k => !Object.values(MODULE_CHILDREN).some(children => children?.includes(k))
);

export default function UserModuleDialog({ userId, userEmail, open, onOpenChange }: Props) {
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>(() => {
    const init: any = {};
    MODULE_KEYS.forEach(k => init[k] = !MODULE_DEFAULT_DISABLED.has(k));
    return init;
  });
  const [saving, setSaving] = useState(false);

  // Download-limit state
  const [downloadLimitEnabled, setDownloadLimitEnabled] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState<number>(100);
  const [usedCount, setUsedCount] = useState<number>(0);
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [hasExistingLimit, setHasExistingLimit] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: any = {};
    MODULE_KEYS.forEach(k => init[k] = true);

    supabase
      .from('user_module_access')
      .select('module_key, enabled')
      .eq('user_id', userId)
      .then(({ data }) => {
        for (const row of data || []) {
          if (MODULE_KEYS.includes(row.module_key as ModuleKey)) {
            init[row.module_key as ModuleKey] = row.enabled;
          }
        }
        setModules({ ...init });
      });

    supabase
      .from('user_download_limits')
      .select('monthly_limit, used_count, period_end')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDownloadLimitEnabled(true);
          setHasExistingLimit(true);
          setMonthlyLimit(data.monthly_limit);
          setUsedCount(data.used_count);
          setPeriodEnd(data.period_end);
        } else {
          setDownloadLimitEnabled(false);
          setHasExistingLimit(false);
          setMonthlyLimit(100);
          setUsedCount(0);
          setPeriodEnd('');
        }
      });
  }, [open, userId]);

  const save = async () => {
    setSaving(true);
    const rows = MODULE_KEYS.map(key => ({
      user_id: userId,
      module_key: key,
      enabled: modules[key],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('user_module_access')
      .upsert(rows, { onConflict: 'user_id,module_key' });

    if (error) {
      toast.error('Fehler: ' + error.message);
      setSaving(false);
      return;
    }

    // Download-limit handling
    if (downloadLimitEnabled) {
      const today = new Date();
      const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        .toISOString().slice(0, 10);
      const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString().slice(0, 10);
      const { error: dlErr } = await supabase
        .from('user_download_limits')
        .upsert({
          user_id: userId,
          monthly_limit: Math.max(0, Math.floor(monthlyLimit)),
          used_count: Math.max(0, Math.floor(usedCount)),
          period_end: periodEnd || defaultEnd,
          period_start: defaultStart,
        }, { onConflict: 'user_id' });
      if (dlErr) {
        toast.error('Download-Limit Fehler: ' + dlErr.message);
        setSaving(false);
        return;
      }
    } else if (hasExistingLimit) {
      await supabase.from('user_download_limits').delete().eq('user_id', userId);
    }

    toast.success('Einstellungen gespeichert');
    onOpenChange(false);
    setSaving(false);
  };

  const renderSwitch = (key: ModuleKey, indent = false) => (
    <div key={key} className={`flex items-center justify-between py-1.5 ${indent ? 'pl-6' : ''}`}>
      <Label className={`text-sm ${indent ? 'text-muted-foreground' : 'font-medium'}`}>
        {MODULE_LABELS[key]}
      </Label>
      <Switch
        checked={modules[key]}
        onCheckedChange={v => setModules(prev => ({ ...prev, [key]: v }))}
        disabled={indent && !modules[Object.entries(MODULE_CHILDREN).find(([, children]) => children?.includes(key))?.[0] as ModuleKey]}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogTitle>Module verwalten</DialogTitle>
        <DialogDescription className="text-xs">{userEmail}</DialogDescription>
        <div className="space-y-3 mt-4">
          {TOP_LEVEL_KEYS.map(key => (
            <React.Fragment key={key}>
              {renderSwitch(key)}
              {MODULE_CHILDREN[key]?.map(child => renderSwitch(child, true))}
            </React.Fragment>
          ))}
        </div>

        {/* Download-Limit */}
        <div className="mt-6 pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Monatliches Download-Limit</Label>
            <Switch
              checked={downloadLimitEnabled}
              onCheckedChange={setDownloadLimitEnabled}
            />
          </div>
          {downloadLimitEnabled && (
            <div className="space-y-2 pl-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Limit / Monat</Label>
                  <Input
                    type="number"
                    min={0}
                    value={monthlyLimit}
                    onChange={e => setMonthlyLimit(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bereits genutzt</Label>
                  <Input
                    type="number"
                    min={0}
                    value={usedCount}
                    onChange={e => setUsedCount(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Periode endet am</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Wird automatisch auf den Folgemonat zurückgesetzt sobald das Datum überschritten ist.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
