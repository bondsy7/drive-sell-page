import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Instagram, Facebook, Twitter, CheckCircle2, AlertCircle, Loader2, Link2, Link2Off, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Status {
  instagram_configured: boolean;
  facebook_configured: boolean;
  x_configured: boolean;
  ig_user_id: string | null;
  fb_page_id: string | null;
  x_screen_name: string | null;
}

export default function SocialCredentialsSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'instagram' | 'facebook' | 'x' | null>(null);

  // form fields — tokens are write-only, never prefilled
  const [igUserId, setIgUserId] = useState('');
  const [igToken, setIgToken] = useState('');
  const [fbPageId, setFbPageId] = useState('');
  const [fbToken, setFbToken] = useState('');
  const [xApiKey, setXApiKey] = useState('');
  const [xApiSecret, setXApiSecret] = useState('');
  const [xAccessToken, setXAccessToken] = useState('');
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_social_credentials_status');
    if (!error && data && data[0]) {
      const s = data[0] as Status;
      setStatus(s);
      setIgUserId(s.ig_user_id ?? '');
      setFbPageId(s.fb_page_id ?? '');
    } else {
      setStatus({ instagram_configured: false, facebook_configured: false, x_configured: false, ig_user_id: null, fb_page_id: null, x_screen_name: null });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('set_social_credentials', {
      _ig_user_id: igUserId || null,
      _ig_access_token: igToken || null,
      _fb_page_id: fbPageId || null,
      _fb_page_token: fbToken || null,
      _x_api_key: xApiKey || null,
      _x_api_secret: xApiSecret || null,
      _x_access_token: xAccessToken || null,
      _x_access_token_secret: xAccessTokenSecret || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    // Clear token fields from memory immediately
    setIgToken('');
    setFbToken('');
    setXApiKey('');
    setXApiSecret('');
    setXAccessToken('');
    setXAccessTokenSecret('');
    toast.success('Zugangsdaten sicher gespeichert');
    await load();
  };

  const test = async (platform: 'instagram' | 'facebook' | 'x') => {
    setTesting(platform);
    try {
      const { data, error } = await supabase.functions.invoke('social-publish', {
        body: { action: 'test', platform },
      });
      if (error) throw error;
      const label = platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : 'X.com';
      if (data?.ok) toast.success(`${label} erfolgreich verbunden${data.name ? ' – ' + data.name : ''}`);
      else toast.error(data?.error || 'Verbindung fehlgeschlagen');
    } catch (e) {
      toast.error('Test fehlgeschlagen: ' + (e as Error).message);
    } finally {
      setTesting(null);
    }
  };

  const disconnect = async (platform: 'instagram' | 'facebook' | 'x') => {
    const { error } = await supabase.rpc('clear_social_credentials', { _platform: platform });
    if (error) { toast.error(error.message); return; }
    if (platform === 'instagram') { setIgUserId(''); setIgToken(''); }
    else if (platform === 'facebook') { setFbPageId(''); setFbToken(''); }
    else { setXApiKey(''); setXApiSecret(''); setXAccessToken(''); setXAccessTokenSecret(''); }
    toast.success('Verbindung getrennt');
    await load();
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lädt...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Diese Zugangsdaten werden nur für dein Konto verwendet und verschlüsselt gespeichert.
          Tokens werden nach dem Speichern niemals wieder angezeigt oder an den Browser ausgeliefert.
        </p>
      </div>

      {/* Instagram */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Instagram className="w-5 h-5 text-pink-600" />
          <h3 className="font-medium flex-1">Instagram Business</h3>
          {status?.instagram_configured ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verbunden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" /> Nicht verbunden
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Instagram Business Account ID</Label>
            <Input value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="z. B. 17841477944343968" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>Instagram Access Token</Label>
            <Input type="password" value={igToken} onChange={(e) => setIgToken(e.target.value)} placeholder={status?.instagram_configured ? 'Gespeichert – nur ändern durch Eingabe' : 'IGQVJ...'} autoComplete="off" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => test('instagram')} disabled={!status?.instagram_configured || testing === 'instagram'}>
            {testing === 'instagram' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
            Verbindung prüfen
          </Button>
          {status?.instagram_configured && (
            <Button size="sm" variant="ghost" onClick={() => disconnect('instagram')}>
              <Link2Off className="w-3.5 h-3.5 mr-1.5" /> Trennen
            </Button>
          )}
        </div>
      </div>

      {/* Facebook */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Facebook className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium flex-1">Facebook Page</h3>
          {status?.facebook_configured ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verbunden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" /> Nicht verbunden
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Facebook Page ID</Label>
            <Input value={fbPageId} onChange={(e) => setFbPageId(e.target.value)} placeholder="z. B. 939562169231924" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook Page Access Token</Label>
            <Input type="password" value={fbToken} onChange={(e) => setFbToken(e.target.value)} placeholder={status?.facebook_configured ? 'Gespeichert – nur ändern durch Eingabe' : 'EAAG...'} autoComplete="off" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => test('facebook')} disabled={!status?.facebook_configured || testing === 'facebook'}>
            {testing === 'facebook' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
            Verbindung prüfen
          </Button>
          {status?.facebook_configured && (
            <Button size="sm" variant="ghost" onClick={() => disconnect('facebook')}>
              <Link2Off className="w-3.5 h-3.5 mr-1.5" /> Trennen
            </Button>
          )}
        </div>
      </div>

      {/* X.com — per-user OAuth 1.0a credentials */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Twitter className="w-5 h-5 text-sky-500" />
          <h3 className="font-medium flex-1">X.com (Twitter)</h3>
          {status?.x_configured ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verbunden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" /> Nicht verbunden
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Erstelle im X Developer Portal eine App mit „Read and Write"-Berechtigung und trage hier deine OAuth 1.0a Zugangsdaten ein. Der Bearer Token wird für Posts nicht benötigt.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Consumer Key (API Key)</Label>
            <Input type="password" value={xApiKey} onChange={(e) => setXApiKey(e.target.value)} placeholder={status?.x_configured ? 'Gespeichert – nur ändern durch Eingabe' : 'z. B. xvz1evFS4wEEPTGEFPHBog'} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Consumer Secret (API Key Secret)</Label>
            <Input type="password" value={xApiSecret} onChange={(e) => setXApiSecret(e.target.value)} placeholder={status?.x_configured ? 'Gespeichert – nur ändern durch Eingabe' : '50-stelliges Secret'} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Access Token</Label>
            <Input type="password" value={xAccessToken} onChange={(e) => setXAccessToken(e.target.value)} placeholder={status?.x_configured ? 'Gespeichert – nur ändern durch Eingabe' : 'enthält meist einen Bindestrich'} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Access Token Secret</Label>
            <Input type="password" value={xAccessTokenSecret} onChange={(e) => setXAccessTokenSecret(e.target.value)} placeholder={status?.x_configured ? 'Gespeichert – nur ändern durch Eingabe' : '45-stelliges Secret'} autoComplete="off" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => test('x')} disabled={!status?.x_configured || testing === 'x'}>
            {testing === 'x' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
            Verbindung prüfen
          </Button>
          {status?.x_configured && (
            <Button size="sm" variant="ghost" onClick={() => disconnect('x')}>
              <Link2Off className="w-3.5 h-3.5 mr-1.5" /> Trennen
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Zugangsdaten speichern
        </Button>
      </div>
    </div>
  );
}
