import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MODULE_KEYS, MODULE_LABELS, MODULE_CHILDREN, type ModuleKey } from '@/hooks/useModuleAccess';

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
    MODULE_KEYS.forEach(k => init[k] = true);
    return init;
  });
  const [saving, setSaving] = useState(false);

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
    } else {
      toast.success('Module gespeichert');
      onOpenChange(false);
    }
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
      <DialogContent className="max-w-md">
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
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
