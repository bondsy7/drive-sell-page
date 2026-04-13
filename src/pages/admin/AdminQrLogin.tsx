import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { QrCode, Copy, RefreshCw, ArrowLeft, ExternalLink, Clock } from 'lucide-react';

const APP_DOMAIN = 'https://pdf.anzeige.ai';

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 Stunde' },
  { value: '24', label: '24 Stunden' },
  { value: '168', label: '7 Tage' },
  { value: '720', label: '30 Tage' },
  { value: '8760', label: '1 Jahr' },
  { value: '0', label: 'Unbegrenzt' },
];

const AdminQrLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/generator');
  const [expiresInHours, setExpiresInHours] = useState('720'); // 30 days default
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const generateLink = async () => {
    if (!email) {
      toast.error('Bitte E-Mail eingeben');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-magic-link', {
        body: {
          email,
          redirectPath,
          expiresInHours: parseInt(expiresInHours) || null,
          appDomain: APP_DOMAIN,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.link) throw new Error('Kein Login-Link erhalten');

      setMagicLink(data.link);
      setExpiresAt(data.expiresAt);
      toast.success('QR-Login-Link generiert!');
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Generieren');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!magicLink) return;
    await navigator.clipboard.writeText(magicLink);
    toast.success('Link kopiert!');
  };

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Unbegrenzt';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">QR-Code Login</h1>
          <p className="text-sm text-muted-foreground">
            Generiere einen QR-Code-Link auf <span className="font-medium">{APP_DOMAIN}</span> mit konfigurierbarer Ablaufzeit.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Login-Link konfigurieren
            </CardTitle>
            <CardDescription>
              Der Link zeigt direkt auf {APP_DOMAIN}/qr-login und loggt dort automatisch ein.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="qr-email">E-Mail des Benutzers</Label>
              <Input id="qr-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qr-redirect">Ziel nach Login</Label>
              <Input id="qr-redirect" value={redirectPath} onChange={e => setRedirectPath(e.target.value)} placeholder="/generator" />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Gültigkeit
              </Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateLink} disabled={loading} className="w-full">
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              {magicLink ? 'Neu generieren' : 'QR-Code generieren'}
            </Button>
          </CardContent>
        </Card>

        {magicLink && (
          <Card>
            <CardHeader>
              <CardTitle>QR-Code für {email}</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Gültig bis: {expiryLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <QRCodeSVG value={magicLink} size={256} level="M" includeMargin />
              </div>

              <div className="w-full rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground break-all">
                {magicLink}
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={copyLink}>
                  <Copy className="mr-2 h-4 w-4" /> Link kopieren
                </Button>
                <Button variant="outline" onClick={() => window.open(magicLink, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Link öffnen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminQrLogin;
