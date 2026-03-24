import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';

interface Preset {
  id: string;
  name: string;
  description: string | null;
  category: string;
  prompt_secret: string;
  type: string;
  active: boolean;
  display_order: number;
  example_preview_url: string | null;
  requires_premium_model: boolean;
  premium_reason: string | null;
  is_global: boolean;
}

const EMPTY_PRESET: Omit<Preset, 'id'> = {
  name: '', description: '', category: 'Allgemein', prompt_secret: '',
  type: 'editing', active: true, display_order: 0, example_preview_url: null,
  requires_premium_model: false, premium_reason: null, is_global: true,
};

export default function AdminPresets() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPreset, setEditPreset] = useState<Partial<Preset> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { loadPresets(); }, []);

  const loadPresets = async () => {
    setLoading(true);
    const { data } = await supabase.from('presets').select('*').order('display_order').order('name');
    if (data) setPresets(data as Preset[]);
    setLoading(false);
  };

  const savePreset = async () => {
    if (!editPreset?.name) { toast.error('Name ist erforderlich'); return; }
    const isNew = !editPreset.id;
    const payload = { ...editPreset };
    delete (payload as any).id;

    if (isNew) {
      const { error } = await supabase.from('presets').insert([payload as any]);
      if (error) { toast.error(error.message); return; }
      toast.success('Preset erstellt');
    } else {
      const { error } = await supabase.from('presets').update(payload as any).eq('id', editPreset.id!);
      if (error) { toast.error(error.message); return; }
      toast.success('Preset aktualisiert');
    }
    setDialogOpen(false);
    setEditPreset(null);
    loadPresets();
  };

  const deletePreset = async (id: string) => {
    if (!confirm('Preset wirklich löschen?')) return;
    await supabase.from('presets').delete().eq('id', id);
    toast.success('Gelöscht');
    loadPresets();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('presets').update({ active }).eq('id', id);
    setPresets(prev => prev.map(p => p.id === id ? { ...p, active } : p));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Presets verwalten</h2>
          <p className="text-sm text-muted-foreground">AI-Vorlagen für den Bildergenerator</p>
        </div>
        <Button onClick={() => { setEditPreset({ ...EMPTY_PRESET }); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Neues Preset
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-muted" />)}</div>
      ) : presets.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Keine Presets vorhanden</Card>
      ) : (
        <div className="space-y-3">
          {presets.map((preset) => (
            <Card key={preset.id} className="p-4 flex items-center gap-4">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              {preset.example_preview_url && (
                <img src={preset.example_preview_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{preset.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{preset.category}</Badge>
                  {preset.requires_premium_model && <Badge className="text-[10px] bg-accent/10 text-accent">Premium</Badge>}
                  {!preset.active && <Badge variant="outline" className="text-[10px]">Inaktiv</Badge>}
                </div>
                {preset.description && <p className="text-xs text-muted-foreground line-clamp-1">{preset.description}</p>}
              </div>
              <Switch checked={preset.active} onCheckedChange={(v) => toggleActive(preset.id, v)} />
              <Button variant="ghost" size="icon" onClick={() => { setEditPreset(preset); setDialogOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deletePreset(preset.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>{editPreset?.id ? 'Preset bearbeiten' : 'Neues Preset'}</DialogTitle>
          <DialogDescription>Konfiguriere die Preset-Einstellungen</DialogDescription>
          {editPreset && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name *</Label><Input value={editPreset.name || ''} onChange={e => setEditPreset(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Kategorie</Label><Input value={editPreset.category || ''} onChange={e => setEditPreset(p => ({ ...p, category: e.target.value }))} /></div>
              </div>
              <div><Label>Beschreibung</Label><Textarea value={editPreset.description || ''} onChange={e => setEditPreset(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
              <div><Label>Prompt (Secret)</Label><Textarea value={editPreset.prompt_secret || ''} onChange={e => setEditPreset(p => ({ ...p, prompt_secret: e.target.value }))} rows={6} className="font-mono text-xs" placeholder="Verwende {platzhalter} für dynamische Felder" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Vorschaubild URL</Label><Input value={editPreset.example_preview_url || ''} onChange={e => setEditPreset(p => ({ ...p, example_preview_url: e.target.value }))} /></div>
                <div><Label>Reihenfolge</Label><Input type="number" value={editPreset.display_order || 0} onChange={e => setEditPreset(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))} /></div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><Switch checked={editPreset.active ?? true} onCheckedChange={v => setEditPreset(p => ({ ...p, active: v }))} /><Label>Aktiv</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editPreset.requires_premium_model ?? false} onCheckedChange={v => setEditPreset(p => ({ ...p, requires_premium_model: v }))} /><Label>Premium erforderlich</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editPreset.is_global ?? true} onCheckedChange={v => setEditPreset(p => ({ ...p, is_global: v }))} /><Label>Global</Label></div>
              </div>
              {editPreset.requires_premium_model && (
                <div><Label>Premium-Begründung</Label><Input value={editPreset.premium_reason || ''} onChange={e => setEditPreset(p => ({ ...p, premium_reason: e.target.value }))} /></div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={savePreset}>Speichern</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
