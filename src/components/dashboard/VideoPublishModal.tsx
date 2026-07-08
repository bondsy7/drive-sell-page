import { useEffect, useState } from 'react';
import { X, Instagram, Facebook, Loader2, CheckCircle2, AlertCircle, Sparkles, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { VideoFile } from './types';

interface Props {
  video: VideoFile;
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

export default function VideoPublishModal({
  video, vehicleId, vehicleTitle, vehiclePrice, dealerName, onClose,
}: Props) {
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState<Record<Platform, boolean>>({
    instagram: true,
    facebook: false,
  });
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PlatformResult[] | null>(null);
  const [status, setStatus] = useState<{ instagram: boolean; facebook: boolean } | null>(null);
  const [tone, setTone] = useState<'seriös' | 'verkaufsstark' | 'kurz' | 'locker' | 'premium'>('verkaufsstark');
  const [format, setFormat] = useState<'reel' | 'video'>('reel');
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('social-publish', { body: { action: 'status' } });
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

  useEffect(() => {
    const title = vehicleTitle?.trim();
    const price = vehiclePrice?.trim();
    const dealer = dealerName?.trim();
    const parts: string[] = [];
    if (title) parts.push(`Jetzt in Bewegung: ${title}.`);
    else parts.push('Unser neues Fahrzeug im Video.');
    if (price) parts.push(`Preis: ${price}.`);
    if (dealer) parts.push(`Direkt bei ${dealer} anfragen.`);
    setCaption(`${parts.join(' ')}\n\n#Autohaus #Fahrzeugvideo #Gebrauchtwagen`);
  }, [vehicleTitle, vehiclePrice, dealerName]);

  const selectedPlatforms = (Object.keys(platforms) as Platform[]).filter((p) => platforms[p]);

  const generateCaption = async () => {
    const targetPlatform: Platform = selectedPlatforms[0] ?? 'instagram';
    setGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-social-caption', {
        body: {
          platform: targetPlatform,
          format,
          tone,
          imageUrl: video.url, // caption fn will fetch a poster frame if needed; ok to pass video URL
          bannerName: video.name,
          vehicleId: vehicleId ?? null,
          mediaKind: 'video',
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
    if (!video.fullPath) {
      toast.error('Video-Pfad fehlt.');
      return;
    }
    setPublishing(true);
    setResults(null);

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
        media_type: 'video',
        media_path: video.fullPath,
        media_name: video.name,
        media_url: video.url,
        caption,
        platforms: selectedPlatforms,
        scheduled_at: when.toISOString(),
      });
      setPublishing(false);
      if (insertErr) {
        toast.error(`Planung fehlgeschlagen: ${insertErr.message}`);
        return;
      }
      toast.success(`Video geplant für ${when.toLocaleString('de-DE')}`);
      onClose();
      return;
    }

    try {

      const { data, error } = await supabase.functions.invoke('social-publish', {
        body: {
          mediaPath: video.fullPath,
          mediaName: video.name,
          mediaUrl: video.url,
          mediaType: 'video',
          caption,
          platforms: selectedPlatforms,
          vehicleId: vehicleId ?? null,
        },
      });
      if (error) {
        const detail = error instanceof FunctionsHttpError ? await error.context.text().catch(() => '') : error.message;
        try {
          const parsed = JSON.parse(detail);
          if (Array.isArray(parsed?.results)) { setResults(parsed.results); return; }
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
      <div className="bg-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-foreground">Video auf Social Media posten</h2>
          <button onClick={onClose} aria-label="Schließen"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl overflow-hidden border border-border bg-muted">
            <video src={video.url} controls className="w-full max-h-64 bg-muted" />
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
                    <span className="font-medium flex-1">Instagram Reel</span>
                    {status?.instagram === true && <span className="text-xs text-green-600 font-medium">Verbunden</span>}
                    {status?.instagram === false && <span className="text-xs text-muted-foreground">Nicht konfiguriert</span>}
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border border-border ${status?.facebook === false ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}>
                    <Checkbox
                      checked={platforms.facebook}
                      disabled={status?.facebook === false}
                      onCheckedChange={(v) => setPlatforms((p) => ({ ...p, facebook: !!v }))}
                    />
                    <Facebook className="w-5 h-5 text-blue-600" />
                    <span className="font-medium flex-1">Facebook Page Video</span>
                    {status?.facebook === true && <span className="text-xs text-green-600 font-medium">Verbunden</span>}
                    {status?.facebook === false && <span className="text-xs text-muted-foreground">Nicht konfiguriert</span>}
                  </label>
                </div>
                {status && !status.instagram && !status.facebook && (
                  <p className="text-xs text-destructive mt-2">
                    Keine Social-Media-Zugangsdaten hinterlegt. Bitte im{' '}
                    <a href="/profile" className="underline font-medium">Profil</a>{' '}
                    unter „Posting-Verbindung" konfigurieren.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  Instagram-Videos werden als Reel veröffentlicht (max. 90 Sek. empfohlen, MP4/H.264).
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-medium">KI-Posting-Assistent (Video)</Label>
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
                        <SelectItem value="reel">Reel (Hook-fokus)</SelectItem>
                        <SelectItem value="video">Video (informativ)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={generateCaption} disabled={generatingCaption}>
                  {generatingCaption
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Text wird erstellt...</>
                    : <><Sparkles className="w-4 h-4 mr-2" /> Text automatisch erstellen</>}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Optimiert für bewegte Inhalte: starker Hook in Zeile 1, kurze Sätze, klarer CTA.
                </p>
              </div>

              <div>
                <Label htmlFor="video-caption" className="mb-2 block">Caption &amp; Hashtags</Label>
                <Textarea
                  id="video-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={8}
                  placeholder="Text und #Hashtags..."
                />
                <p className="text-xs text-muted-foreground mt-1">{caption.length} Zeichen</p>
              </div>

              <div className="rounded-xl border border-border p-3 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={scheduleEnabled} onCheckedChange={(v) => setScheduleEnabled(!!v)} />
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
                      Video wird automatisch zum gewählten Zeitpunkt veröffentlicht.
                    </p>
                  </div>
                )}
              </div>

            </>
          )}

          {done && results && (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.platform} className={`flex items-start gap-3 p-3 rounded-lg border ${r.status === 'success' ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/40 bg-destructive/5'}`}>
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
