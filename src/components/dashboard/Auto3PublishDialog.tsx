import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import type { BannerFile } from './types';
import type { Auto3Config } from '@/hooks/useAuto3Config';

interface Props {
  banner: BannerFile;
  config: Auto3Config;
  onClose: () => void;
}

const ALL_CHANNELS: Array<{ id: string; label: string }> = [
  { id: 'website', label: 'Listing-Banner (Website)' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];

export default function Auto3PublishDialog({ banner, config, onClose }: Props) {
  const [email, setEmail] = useState(config.accountEmail);
  const [channels, setChannels] = useState<string[]>(config.channels?.length ? config.channels : ['website', 'instagram', 'facebook']);
  const [caption, setCaption] = useState(config.defaultCaption || '');
  const [ctaUrl, setCtaUrl] = useState(config.defaultCtaUrl || '');
  const [busy, setBusy] = useState(false);

  const toggleChannel = (id: string) => {
    setChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!email.trim()) { toast.error('Auto3-Login-E-Mail fehlt'); return; }
    if (channels.length === 0) { toast.error('Bitte mindestens einen Kanal wählen'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('publish-banner-to-auto3', {
        body: {
          bannerPath: banner.fullPath,
          bannerUrl: banner.url,
          caption: caption || undefined,
          channels,
          ctaUrl: ctaUrl || undefined,
          targetEmailOverride: email !== config.accountEmail ? email : undefined,
        },
      });
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === 'success') toast.success('Erfolgreich an Auto3 gesendet');
      else if (status === 'partial_success') toast.warning('Teilweise erfolgreich – prüfe die Kanäle');
      else if (status === 'duplicate') toast.info('Bereits gepostet (idempotent)');
      else toast.error('Auto3 hat Fehler zurückgegeben');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Push fehlgeschlagen: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>An Auto3 senden</DialogTitle>
          <DialogDescription>Banner an dein Auto3-Konto pushen und optional auf Social Media veröffentlichen.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border border-border bg-muted">
            <img src={banner.url} alt={banner.name} className="w-full max-h-48 object-contain" />
          </div>

          <div className="space-y-1.5">
            <Label>Auto3-Login-E-Mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Kanäle</Label>
            <div className="flex flex-wrap gap-3">
              {ALL_CHANNELS.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={channels.includes(c.id)} onChange={() => toggleChannel(c.id)} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>CTA-URL (optional)</Label>
            <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-1.5">
            <Label>Caption / Text (optional)</Label>
            <Textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Post-Text bzw. Banner-Beschreibung" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={busy} className="gap-1.5">
            <Send className="w-4 h-4" />
            {busy ? 'Sende...' : 'Jetzt an Auto3 senden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
