import { useEffect, useState } from 'react';
import { X, Instagram, Facebook, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { BannerFile } from './types';

interface Props {
  banner: BannerFile;
  vehicleId?: string;
  vehicleTitle?: string;
  vehiclePrice?: string;
  dealerName?: string;
  onClose: () => void;
}

type Platform = 'instagram' | 'facebook';

interface PlatformResult {
  platform: Platform;
  status: 'success' | 'failed';
  postId?: string;
  error?: string;
}

export default function SocialPublishModal({
  banner, vehicleId, vehicleTitle, vehiclePrice, dealerName, onClose,
}: Props) {
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState<Record<Platform, boolean>>({
    instagram: true,
    facebook: false,
  });
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PlatformResult[] | null>(null);
  const [status, setStatus] = useState<{ instagram: boolean; facebook: boolean } | null>(null);

  // Load platform configuration status (no tokens exposed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('social-publish', {
          body: { action: 'status' },
        });
        if (cancelled || !data) return;
        setStatus({
          instagram: !!data.instagram?.configured,
          facebook: !!data.facebook?.configured,
        });
        setPlatforms((p) => ({
          instagram: !!data.instagram?.configured && p.instagram,
          facebook: !!data.facebook?.configured && p.facebook,
        }));
      } catch {
        setStatus({ instagram: false, facebook: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Prefill caption from vehicle data
  useEffect(() => {
    const title = vehicleTitle?.trim();
    const price = vehiclePrice?.trim();
    const dealer = dealerName?.trim();
    const parts: string[] = [];
    if (title) parts.push(`Jetzt entdecken: ${title}.`);
    else parts.push('Jetzt entdecken – unser neues Angebot.');
    if (price) parts.push(`Preis: ${price}.`);
    if (dealer) parts.push(`Direkt bei ${dealer} anfragen.`);
    else parts.push('Mehr Informationen direkt bei uns anfragen.');
    const hashtags = '#Autohaus #Gebrauchtwagen #Fahrzeugangebot';
    setCaption(`${parts.join(' ')}\n\n${hashtags}`);
  }, [vehicleTitle, vehiclePrice, dealerName]);

  const selectedPlatforms = (Object.keys(platforms) as Platform[]).filter((p) => platforms[p]);

  const publish = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error('Bitte mindestens eine Plattform auswählen.');
      return;
    }
    if (!caption.trim()) {
      toast.error('Bitte eine Caption eingeben.');
      return;
    }
    setPublishing(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('social-publish', {
        body: {
          bannerPath: banner.fullPath,
          bannerName: banner.name,
          imageUrl: banner.url,
          caption,
          platforms: selectedPlatforms,
          vehicleId: vehicleId ?? null,
        },
      });
      if (error) {
        const detail = error instanceof FunctionsHttpError
          ? await error.context.text().catch(() => '')
          : error.message;
        // Try to parse body for platform results
        try {
          const parsed = JSON.parse(detail);
          if (Array.isArray(parsed?.results)) {
            setResults(parsed.results);
            return;
          }
        } catch { /* fallthrough */ }
        toast.error(`Veröffentlichung fehlgeschlagen: ${detail || 'Unbekannter Fehler'}`);
        return;
      }
      setResults(data?.results ?? []);
      const anySuccess = (data?.results ?? []).some((r: PlatformResult) => r.status === 'success');
      if (anySuccess) toast.success('Veröffentlichung erfolgreich');
    } catch (e) {
      toast.error(`Fehler: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  };

  const done = results !== null && !publishing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-foreground">Auf Social Media posten</h2>
          <button onClick={onClose} aria-label="Schließen"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl overflow-hidden border border-border bg-muted">
            <img src={banner.url} alt={banner.name} className="w-full max-h-64 object-contain bg-muted" />
          </div>

          {!done && (
            <>
              <div>
                <Label className="mb-2 block">Plattformen</Label>
                <div className="flex flex-col gap-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border border-border ${status?.instagram === false ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}>
                    <Checkbox
                      checked={platforms.instagram}
                      disabled={status?.instagram === false}
                      onCheckedChange={(v) => setPlatforms((p) => ({ ...p, instagram: !!v }))}
                    />
                    <Instagram className="w-5 h-5 text-pink-600" />
                    <span className="font-medium flex-1">Instagram</span>
                    {status?.instagram === true && (
                      <span className="text-xs text-green-600 font-medium">Verbunden</span>
                    )}
                    {status?.instagram === false && (
                      <span className="text-xs text-muted-foreground">Nicht konfiguriert</span>
                    )}
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border border-border ${status?.facebook === false ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}>
                    <Checkbox
                      checked={platforms.facebook}
                      disabled={status?.facebook === false}
                      onCheckedChange={(v) => setPlatforms((p) => ({ ...p, facebook: !!v }))}
                    />
                    <Facebook className="w-5 h-5 text-blue-600" />
                    <span className="font-medium flex-1">Facebook Page</span>
                    {status?.facebook === true && (
                      <span className="text-xs text-green-600 font-medium">Verbunden</span>
                    )}
                    {status?.facebook === false && (
                      <span className="text-xs text-muted-foreground">Nicht konfiguriert</span>
                    )}
                  </label>
                </div>
                {status && !status.instagram && !status.facebook && (
                  <p className="text-xs text-destructive mt-2">
                    Keine Social-Media-Zugangsdaten hinterlegt. Bitte im{' '}
                    <a href="/profile" className="underline font-medium">Profil</a>{' '}
                    unter „Posting-Verbindung" konfigurieren.
                  </p>
                )}
                {status?.facebook === false && (status?.instagram === true) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Facebook wird verfügbar, sobald Page ID und Page Access Token im Profil hinterlegt sind.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="caption" className="mb-2 block">Caption &amp; Hashtags</Label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={7}
                  placeholder="Text und #Hashtags..."
                />
                <p className="text-xs text-muted-foreground mt-1">{caption.length} Zeichen</p>
              </div>
            </>
          )}

          {done && results && (
            <div className="space-y-2">
              {results.map((r) => (
                <div
                  key={r.platform}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    r.status === 'success'
                      ? 'border-green-500/40 bg-green-500/5'
                      : 'border-destructive/40 bg-destructive/5'
                  }`}
                >
                  {r.status === 'success'
                    ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    : <AlertCircle className="w-5 h-5 text-destructive shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium capitalize">{r.platform}</p>
                    {r.status === 'success'
                      ? <p className="text-xs text-muted-foreground break-all">Post ID: {r.postId}</p>
                      : <p className="text-xs text-destructive break-words">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
          {done ? (
            <Button onClick={onClose}>Schließen</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={publishing}>Abbrechen</Button>
              <Button onClick={publish} disabled={publishing}>
                {publishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {publishing ? 'Veröffentliche...' : 'Jetzt veröffentlichen'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
