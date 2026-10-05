import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, PlugZap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuto3Config } from '@/hooks/useAuto3Config';

export default function Auto3ConnectionCard() {
  const { config, loading } = useAuto3Config();
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ tenantUrl: string; total: number; verifiedAt: string } | null>(null);

  useEffect(() => {
    if (!config) return;
    setUrl(config.tenantUrl);
    if (config.tenantUrl && config.verifiedAt) {
      setResult({ tenantUrl: config.tenantUrl, total: config.vehicleCount ?? 0, verifiedAt: config.verifiedAt });
    }
  }, [config]);

  const verify = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke('auto3-inventory', {
      body: { action: 'verify_connection', tenantUrl: url.trim() },
    });
    setChecking(false);
    if (error || data?.error) {
      setResult(null);
      toast.error(data?.error || 'Die Auto3-Verbindung konnte nicht hergestellt werden.');
      return;
    }
    setUrl(data.tenantUrl);
    setResult({ tenantUrl: data.tenantUrl, total: data.total, verifiedAt: data.verifiedAt });
    toast.success('Auto3 ist verbunden.');
  };

  const connected = !!result && result.tenantUrl === url.trim().replace(/\/$/, '');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Händlerzugang</h3>
          <p className="mt-1 text-xs text-muted-foreground">Gib die Händler-URL ein, die deinen Fahrzeugbestand in Auto3 kennzeichnet.</p>
        </div>
        {connected && <Badge className="gap-1.5"><CheckCircle2 className="size-3.5" />Verbunden</Badge>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="auto3-tenant-url">Händler-/Mandanten-URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="auto3-tenant-url" type="url" inputMode="url" value={url} disabled={loading || checking}
            onChange={(event) => { setUrl(event.target.value); if (result && event.target.value !== result.tenantUrl) setResult(null); }}
            placeholder="https://ihr-autohaus.indicar.de" />
          <Button type="button" onClick={verify} disabled={checking || !url.trim()} className="shrink-0 gap-2">
            {checking ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
            {connected ? 'Erneut prüfen' : 'Verbindung prüfen'}
          </Button>
        </div>
      </div>

      {connected && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center">
          <CheckCircle2 className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{result.tenantUrl}</p>
            <p className="text-xs text-muted-foreground">Geprüft · {result.total} Fahrzeuge gefunden</p>
          </div>
          <Button asChild type="button" size="sm" variant="outline">
            <a href="/generator/auto3">Bestand öffnen <ExternalLink className="ml-1.5 size-3.5" /></a>
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Die URL wird serverseitig geprüft. Fahrzeugdaten und vollständige VINs bleiben geschützt.</p>
    </div>
  );
}