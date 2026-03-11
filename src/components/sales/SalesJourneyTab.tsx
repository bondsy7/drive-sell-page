import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Save, X, Globe, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSalesAssistant } from '@/hooks/useSalesAssistant';
import { JOURNEY_STAGE_LABELS, type JourneyStage, type CustomerJourneyTemplate } from '@/types/sales-assistant';

export default function SalesJourneyTab() {
  const { journeyTemplates, journeyLoading, saveJourneyTemplate, deleteJourneyTemplate } = useSalesAssistant();
  const [editing, setEditing] = useState<Partial<CustomerJourneyTemplate> | null>(null);

  const handleSave = async () => {
    if (!editing?.name || !editing?.journey_stage) {
      toast.error('Name und Phase sind Pflichtfelder.');
      return;
    }
    try {
      await saveJourneyTemplate(editing);
      setEditing(null);
      toast.success('Journey-Vorlage gespeichert.');
    } catch { toast.error('Fehler beim Speichern.'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Vorlage wirklich löschen?')) return;
    await deleteJourneyTemplate(id);
    toast.success('Vorlage gelöscht.');
  };

  if (journeyLoading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Customer Journey Vorlagen</h3>
        <Button size="sm" onClick={() => setEditing({ journey_stage: 'new_lead' as JourneyStage, is_global: false, is_active: true, sort_order: journeyTemplates.length })}>
          <Plus className="w-4 h-4 mr-1" /> Neue Vorlage
        </Button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="rounded-xl border border-accent/30 bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="z.B. Neuer Lead – Standardreaktion" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Journey Phase</label>
              <Select value={editing.journey_stage || 'new_lead'} onValueChange={(v) => setEditing({ ...editing, journey_stage: v as JourneyStage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(JOURNEY_STAGE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Beschreibung</label>
            <Textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Was passiert in dieser Phase?" className="min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Empfohlenes Ziel</label>
              <Input value={editing.recommended_goal || ''} onChange={(e) => setEditing({ ...editing, recommended_goal: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Empfohlener CTA</label>
              <Input value={editing.recommended_cta || ''} onChange={(e) => setEditing({ ...editing, recommended_cta: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Typische Einwände (kommagetrennt)</label>
            <Input value={editing.recommended_objections?.join(', ') || ''} onChange={(e) => setEditing({ ...editing, recommended_objections: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kaufsignale (kommagetrennt)</label>
            <Input value={editing.buyer_intent_signals?.join(', ') || ''} onChange={(e) => setEditing({ ...editing, buyer_intent_signals: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prompt-Block (optional)</label>
            <Textarea value={editing.default_prompt_block || ''} onChange={(e) => setEditing({ ...editing, default_prompt_block: e.target.value })} placeholder="Zusätzliche Anweisungen für den KI-Assistenten in dieser Phase" className="min-h-[60px]" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Speichern</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="w-4 h-4 mr-1" /> Abbrechen</Button>
          </div>
        </div>
      )}

      {/* List */}
      {journeyTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Noch keine Journey-Vorlagen vorhanden. Globale Vorlagen werden nach der ersten Migration geladen.
        </div>
      ) : (
        <div className="space-y-2">
          {journeyTemplates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{t.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                      {JOURNEY_STAGE_LABELS[t.journey_stage as JourneyStage] || t.journey_stage}
                    </span>
                    {t.is_global && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent flex items-center gap-0.5">
                        <Globe className="w-3 h-3" /> Global
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  {t.recommended_goal && <p className="text-xs mt-1"><strong>Ziel:</strong> {t.recommended_goal}</p>}
                  {t.recommended_cta && <p className="text-xs"><strong>CTA:</strong> {t.recommended_cta}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  {!t.is_global && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
