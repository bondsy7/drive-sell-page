import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, RefreshCw, Unlink, ExternalLink } from 'lucide-react';

const PROVIDERS = [
  { id: 'google_calendar', name: 'Google Calendar', icon: '📅', description: 'Synchronisiere mit Google Calendar für automatische Terminsynchronisation.' },
  { id: 'outlook', name: 'Microsoft Outlook', icon: '📧', description: 'Verbinde mit Outlook 365 für Termin-Sync und E-Mail-Integration.' },
  { id: 'apple_ical', name: 'Apple iCloud Kalender', icon: '🍎', description: 'Verbinde mit Apple iCloud für CalDAV-basierte Synchronisation.' },
];

interface CalendarConfig {
  id?: string;
  provider: string;
  is_active: boolean;
  sync_direction: string;
  last_synced_at: string | null;
}

export default function SalesCalendarSettings() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<CalendarConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConfigs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('calendar_sync_configs' as any).select('*').eq('user_id', user.id);
    setConfigs((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const getConfig = (provider: string) => configs.find(c => c.provider === provider);

  const connectProvider = async (providerId: string) => {
    // For now, show info that external OAuth will be available soon
    toast.info('Kalender-Verbindung wird bald verfügbar sein. Die interne Kalenderverwaltung steht bereits zur Verfügung.', { duration: 5000 });
    // Create placeholder config
    if (!user) return;
    const existing = getConfig(providerId);
    if (!existing) {
      await supabase.from('calendar_sync_configs' as any).insert({
        user_id: user.id, provider: providerId, is_active: false, sync_direction: 'both',
      } as any);
      loadConfigs();
    }
  };

  const toggleActive = async (config: CalendarConfig) => {
    if (!config.id) return;
    await supabase.from('calendar_sync_configs' as any).update({ is_active: !config.is_active, updated_at: new Date().toISOString() } as any).eq('id', config.id);
    toast.success(config.is_active ? 'Synchronisation deaktiviert' : 'Synchronisation aktiviert');
    loadConfigs();
  };

  const disconnectProvider = async (config: CalendarConfig) => {
    if (!config.id) return;
    await supabase.from('calendar_sync_configs' as any).delete().eq('id', config.id);
    toast.success('Kalender getrennt');
    loadConfigs();
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Laden...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Kalender-Integrationen</h3>
        <p className="text-sm text-muted-foreground">Verbinde externe Kalender, um Probefahrt-Termine automatisch zu synchronisieren.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map(p => {
          const config = getConfig(p.id);
          return (
            <Card key={p.id} className={config?.is_active ? 'border-accent' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.icon}</span>
                    <CardTitle className="text-sm">{p.name}</CardTitle>
                  </div>
                  {config?.is_active && <Badge variant="default" className="text-xs">Aktiv</Badge>}
                </div>
                <CardDescription className="text-xs">{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {config ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Synchronisation</Label>
                      <Switch checked={config.is_active} onCheckedChange={() => toggleActive(config)} />
                    </div>
                    {config.last_synced_at && (
                      <p className="text-xs text-muted-foreground">
                        Zuletzt: {new Date(config.last_synced_at).toLocaleString('de-DE')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => toast.info('Sync wird ausgelöst...')}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Sync
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => disconnectProvider(config)}>
                        <Unlink className="w-3 h-3 mr-1" /> Trennen
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => connectProvider(p.id)}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Verbinden
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tipp:</strong> Die interne Kalenderverwaltung mit Probefahrt-Buchungen funktioniert unabhängig von externen Kalendern. 
            Externe Kalender-Integrationen synchronisieren Termine automatisch in beide Richtungen, sobald sie verbunden sind.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
