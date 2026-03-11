import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Save, Zap, Clock, Bell, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useSalesAssistant } from '@/hooks/useSalesAssistant';
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/types/sales-assistant';

const AUTOPILOT_MODES = [
  { value: 'off', label: 'Aus', description: 'Keine automatische Verarbeitung', icon: '⏸️' },
  { value: 'approval', label: 'Mit Freigabe', description: 'Entwürfe erstellen, Freigabe einholen', icon: '🔔' },
  { value: 'full_auto', label: 'Autopilot', description: 'Automatisch antworten (je nach Phase)', icon: '🚀' },
];

const ALL_STAGES = Object.keys(JOURNEY_STAGE_LABELS) as JourneyStage[];

export default function SalesAutopilotSettings() {
  const sa = useSalesAssistant();
  const [mode, setMode] = useState('approval');
  const [autoStages, setAutoStages] = useState<string[]>(['new_lead', 'first_contact']);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpHours, setFollowUpHours] = useState(24);
  const [dailySummary, setDailySummary] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sa.profile) {
      setMode((sa.profile as any).autopilot_mode || 'approval');
      setAutoStages((sa.profile as any).auto_reply_stages || ['new_lead', 'first_contact']);
      setFollowUpEnabled((sa.profile as any).auto_follow_up_enabled || false);
      setFollowUpHours((sa.profile as any).auto_follow_up_delay_hours || 24);
      setDailySummary((sa.profile as any).daily_summary_enabled ?? true);
      setWeeklySummary((sa.profile as any).weekly_summary_enabled ?? true);
    }
  }, [sa.profile]);

  const toggleStage = (stage: string) => {
    setAutoStages(prev => prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await sa.saveProfile({
        autopilot_mode: mode,
        auto_reply_stages: autoStages,
        auto_follow_up_enabled: followUpEnabled,
        auto_follow_up_delay_hours: followUpHours,
        daily_summary_enabled: dailySummary,
        weekly_summary_enabled: weeklySummary,
      } as any);
      toast.success('Autopilot-Einstellungen gespeichert');
    } catch (e) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" /> Autopilot-Modus
          </CardTitle>
          <CardDescription>Bestimme, wie selbstständig der Assistent bei neuen Leads agieren soll.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {AUTOPILOT_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  mode === m.value
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <span className="text-2xl">{m.icon}</span>
                <p className="font-semibold text-sm mt-2 text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Reply Stages (only for full_auto) */}
      {mode === 'full_auto' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" /> Automatische Phasen
            </CardTitle>
            <CardDescription>Wähle in welchen Journey-Phasen vollautomatisch geantwortet werden soll.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_STAGES.map(stage => (
                <label key={stage} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={autoStages.includes(stage)}
                    onCheckedChange={() => toggleStage(stage)}
                  />
                  <span className="text-xs text-foreground">{JOURNEY_STAGE_LABELS[stage]}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Follow-up Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" /> Automatische Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Follow-up automatisch erstellen</p>
              <p className="text-xs text-muted-foreground">Erstellt automatisch Follow-up-Aufgaben nach dem Erstkontakt</p>
            </div>
            <Switch checked={followUpEnabled} onCheckedChange={setFollowUpEnabled} />
          </div>
          {followUpEnabled && (
            <div className="flex items-center gap-3">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Verzögerung:</Label>
              <Input
                type="number" min={1} max={168} value={followUpHours}
                onChange={e => setFollowUpHours(parseInt(e.target.value) || 24)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">Stunden</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent" /> Benachrichtigungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Tägliche Zusammenfassung</p>
              <p className="text-xs text-muted-foreground">Übersicht über offene Aufgaben und neue Leads</p>
            </div>
            <Switch checked={dailySummary} onCheckedChange={setDailySummary} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Wöchentliche Zusammenfassung</p>
              <p className="text-xs text-muted-foreground">Performance-Übersicht und Empfehlungen</p>
            </div>
            <Switch checked={weeklySummary} onCheckedChange={setWeeklySummary} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Speichern...' : 'Einstellungen speichern'}
      </Button>
    </div>
  );
}
