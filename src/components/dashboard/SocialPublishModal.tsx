import { useEffect, useState } from 'react';
import { X, Instagram, Facebook, Loader2, CheckCircle2, AlertCircle, Sparkles, Clock, Twitter } from 'lucide-react';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type Platform = 'instagram' | 'facebook' | 'x';

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
    x: false,
  });
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PlatformResult[] | null>(null);
  const [status, setStatus] = useState<{ instagram: boolean; facebook: boolean; x: boolean } | null>(null);
  const [tone, setTone] = useState<'seriös' | 'verkaufsstark' | 'kurz' | 'locker' | 'premium'>('verkaufsstark');
  const [format, setFormat] = useState<'image' | 'carousel'>('image');
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  // Instagram supports aspect ratios between 4:5 (0.8) and 1.91:1 (1.91).
  // Common web/story sizes like 300x600 (0.5) or 1080x1920 (0.5625) are rejected.
  const ratio = dimensions ? dimensions.w / dimensions.h : null;
  const IG_MIN = 0.8;   // 4:5 portrait
  const IG_MAX = 1.91;  // 1.91:1 landscape
  const instagramCompatible = ratio === null ? true : ratio >= IG_MIN && ratio <= IG_MAX;
  // Facebook accepts almost anything but very extreme; keep a soft range.
  const FB_MIN = 0.4;
  const FB_MAX = 2.5;
  const facebookCompatible = ratio === null ? true : ratio >= FB_MIN && ratio <= FB_MAX;

  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });


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
          x: !!data.x?.configured,
        });
        setPlatforms((p) => ({
          instagram: !!data.instagram?.configured && p.instagram,
          facebook: !!data.facebook?.configured && p.facebook,
          x: !!data.x?.configured && p.x,
        }));
      } catch {
        setStatus({ instagram: false, facebook: false, x: false });
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

  const generateCaption = async () => {
    // Prefer a selected platform, else instagram as default target
    const targetPlatform: Platform = selectedPlatforms[0] ?? 'instagram';
    setGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-social-caption', {
        body: {
          platform: targetPlatform,
          format,
          tone,
          imageUrl: banner.url,
          bannerName: banner.name,
          vehicleId: vehicleId ?? null,
        },
      });
      if (error) {
        const detail = error instanceof FunctionsHttpError ? await error.context.text().catch(() => '') : error.message;
        toast.error(`Textgenerierung fehlgeschlagen: ${detail || 'Unbekannter Fehler'}`);
        return;
      }
      if (data?.caption) {
        setCaption(data.caption);
        toast.success('Text erstellt – bitte prüfen und anpassen.');
      } else {
        toast.error('Kein Text erhalten.');
      }
    } catch (e) {
      toast.error(`Fehler: ${(e as Error).message}`);
    } finally {
      setGeneratingCaption(false);
    }
  };


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

    // ── Scheduled: insert into queue instead of publishing now ─
    if (scheduleEnabled) {
      const when = new Date(scheduledAt);
      if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
        toast.error('Bitte einen zukünftigen Zeitpunkt wählen.');
        setPublishing(false);
        return;
      }
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) {
        toast.error('Nicht angemeldet.');
        setPublishing(false);
        return;
      }
      const { error: insertErr } = await supabase.from('scheduled_social_posts').insert({
        user_id: uid,
        vehicle_id: vehicleId ?? null,
        media_type: 'image',
        media_path: banner.fullPath,
        media_name: banner.name,
        media_url: banner.url,
        caption,
        platforms: selectedPlatforms,
        scheduled_at: when.toISOString(),
      });
      setPublishing(false);
      if (insertErr) {
        toast.error(`Planung fehlgeschlagen: ${insertErr.message}`);
        return;
      }
      toast.success(`Post geplant für ${when.toLocaleString('de-DE')}`);
      onClose();
      return;
    }

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
            <img
              src={banner.url}
              alt={banner.name}
              className="w-full max-h-64 object-contain bg-muted"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                }
              }}
            />
          </div>

          {dimensions && (!instagramCompatible || !facebookCompatible) && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">
                Seitenverhältnis {dimensions.w}×{dimensions.h} ({ratio!.toFixed(2)}:1)
              </p>
              {!instagramCompatible && (
                <p>
                  Instagram akzeptiert nur Seitenverhältnisse zwischen 4:5 (0,80) und 1,91:1.
                  Dieses Banner passt nicht und wurde deaktiviert. Nutze z. B. 1080×1080 (Quadrat),
                  1080×1350 (Portrait 4:5) oder 1080×566 (Landscape 1,91:1).
                </p>
              )}
              {!facebookCompatible && (
                <p>Facebook akzeptiert dieses extrem schmale/hohe Format nicht.</p>
              )}
            </div>
          )}

          {!done && (
            <>
              <div>
                <Label className="mb-2 block">Plattformen</Label>
                <div className="flex flex-col gap-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border border-border ${status?.instagram === false || !instagramCompatible ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}>
                    <Checkbox
                      checked={platforms.instagram && instagramCompatible}
                      disabled={status?.instagram === false || !instagramCompatible}
                      onCheckedChange={(v) => setPlatforms((p) => ({ ...p, instagram: !!v }))}
                    />
                    <Instagram className="w-5 h-5 text-pink-600" />
                    <span className="font-medium flex-1">Instagram</span>
                    {!instagramCompatible && (
                      <span className="text-xs text-amber-600 font-medium">Format nicht unterstützt</span>
                    )}
                    {instagramCompatible && status?.instagram === true && (
                      <span className="text-xs text-green-600 font-medium">Verbunden</span>
                    )}
                    {instagramCompatible && status?.instagram === false && (
                      <span className="text-xs text-muted-foreground">Nicht konfiguriert</span>
                    )}
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border border-border ${status?.facebook === false || !facebookCompatible ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}>
                    <Checkbox
                      checked={platforms.facebook && facebookCompatible}
                      disabled={status?.facebook === false || !facebookCompatible}
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
                  <label className={`flex items-center gap-3 p-3 rounded-lg border border-border ${status?.x === false ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}>
                    <Checkbox
                      checked={platforms.x}
                      disabled={status?.x === false}
                      onCheckedChange={(v) => setPlatforms((p) => ({ ...p, x: !!v }))}
                    />
                    <Twitter className="w-5 h-5 text-sky-500" />
                    <span className="font-medium flex-1">X.com</span>
                    {status?.x === true && (
                      <span className="text-xs text-green-600 font-medium">Verbunden</span>
                    )}
                    {status?.x === false && (
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

              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-medium">KI-Posting-Assistent</Label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Stil</Label>
                    <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seriös">Seriös</SelectItem>
                        <SelectItem value="verkaufsstark">Verkaufsstark</SelectItem>
                        <SelectItem value="kurz">Kurz & direkt</SelectItem>
                        <SelectItem value="locker">Locker</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Format</Label>
                    <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Bildbeitrag</SelectItem>
                        <SelectItem value="carousel">Carousel</SelectItem>
                      </SelectContent>

                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={generateCaption}
                  disabled={generatingCaption}
                >
                  {generatingCaption
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Text wird erstellt...</>
                    : <><Sparkles className="w-4 h-4 mr-2" /> Text automatisch erstellen</>}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Nutzt Fahrzeugdaten, Profil und Bild. Angepasst an {selectedPlatforms[0] === 'facebook' ? 'Facebook' : 'Instagram'}.
                </p>
              </div>

              <div>
                <Label htmlFor="caption" className="mb-2 block">Caption &amp; Hashtags</Label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={8}
                  placeholder="Text und #Hashtags... (oder oben automatisch erstellen lassen)"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{caption.length} Zeichen</p>
                  {platforms.x && (
                    <p className={`text-xs font-medium ${caption.length > 280 ? 'text-destructive' : caption.length > 240 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      X.com: {caption.length}/280
                      {caption.length > 280 && ' – wird beim Posten gekürzt'}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border p-3 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={scheduleEnabled}
                    onCheckedChange={(v) => setScheduleEnabled(!!v)}
                  />
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">Später veröffentlichen</span>
                </label>
                {scheduleEnabled && (
                  <div>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="h-9"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Der Post wird automatisch zum gewählten Zeitpunkt veröffentlicht (Zeitzone deines Geräts).
                    </p>
                  </div>
                )}
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
                {publishing
                  ? (scheduleEnabled ? 'Plane...' : 'Veröffentliche...')
                  : (scheduleEnabled ? 'Post planen' : 'Jetzt veröffentlichen')}
              </Button>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
