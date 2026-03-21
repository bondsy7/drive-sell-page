import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Save, RefreshCw, MessageSquare, Bot, BarChart3, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface SalesStats {
  totalConversations: number;
  activeConversations: number;
  closedConversations: number;
  totalMessages: number;
  aiMessages: number;
  responseRate: number;
  autopilotUsers: number;
  approvalUsers: number;
  offUsers: number;
  totalProfiles: number;
  avgMessagesPerConvo: number;
  pendingTasks: number;
}

export default function AdminSalesAssistant() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

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

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [convos, messages, profiles, tasks] = await Promise.all([
        supabase.from('sales_assistant_conversations').select('id, status', { count: 'exact' }),
        supabase.from('sales_assistant_messages').select('id, role', { count: 'exact' }),
        supabase.from('sales_assistant_profiles' as any).select('id, autopilot_mode'),
        supabase.from('sales_assistant_tasks').select('id, status'),
      ]);

      const convoData = convos.data || [];
      const msgData = messages.data || [];
      const profileData = (profiles.data as any[]) || [];
      const taskData = tasks.data || [];

      const totalConversations = convoData.length;
      const activeConversations = convoData.filter((c: any) => c.status === 'open').length;
      const closedConversations = convoData.filter((c: any) => c.status === 'closed').length;
      const totalMessages = msgData.length;
      const aiMessages = msgData.filter((m: any) => m.role === 'assistant').length;
      const responseRate = totalMessages > 0 ? Math.round((aiMessages / totalMessages) * 100) : 0;
      const totalProfiles = profileData.length;
      const autopilotUsers = profileData.filter((p: any) => p.autopilot_mode === 'full_auto').length;
      const approvalUsers = profileData.filter((p: any) => p.autopilot_mode === 'approval').length;
      const offUsers = profileData.filter((p: any) => p.autopilot_mode === 'off').length;
      const avgMessagesPerConvo = totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;
      const pendingTasks = taskData.filter((t: any) => t.status === 'open').length;

      setStats({
        totalConversations, activeConversations, closedConversations,
        totalMessages, aiMessages, responseRate,
        autopilotUsers, approvalUsers, offUsers, totalProfiles,
        avgMessagesPerConvo, pendingTasks,
      });
    } catch (e) {
      console.error('Stats load error', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); loadStats(); }, [loadSettings, loadStats]);

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
          <p className="text-sm text-muted-foreground">Globale Defaults, System-Prompts und Statistiken für den KI Verkaufsassistenten.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { loadSettings(); loadStats(); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> Neu laden
        </Button>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-12 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={MessageSquare} label="Konversationen" value={stats.totalConversations} sub={`${stats.activeConversations} aktiv`} />
          <StatCard icon={BarChart3} label="Nachrichten" value={stats.totalMessages} sub={`${stats.aiMessages} KI-Antworten`} />
          <StatCard icon={Zap} label="Antwortquote" value={`${stats.responseRate}%`} sub={`Ø ${stats.avgMessagesPerConvo} / Konv.`} />
          <StatCard icon={Bot} label="Autopilot: Voll" value={stats.autopilotUsers} sub={`von ${stats.totalProfiles} Nutzern`} />
          <StatCard icon={Users} label="Autopilot: Freigabe" value={stats.approvalUsers} sub={`${stats.offUsers} deaktiviert`} />
          <StatCard icon={BarChart3} label="Offene Aufgaben" value={stats.pendingTasks} sub={`${stats.closedConversations} abgeschlossen`} />
        </div>
      )}

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

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">{label}</span>
        </div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
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
