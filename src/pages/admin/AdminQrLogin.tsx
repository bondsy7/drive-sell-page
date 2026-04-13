import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { QrCode, Copy, RefreshCw, ArrowLeft, ExternalLink } from 'lucide-react';

const PUBLISHED_APP_URL = 'https://drive-sell-page.lovable.app';

const getDefaultRedirect = () => {
  const isPreviewHost =
    window.location.hostname.includes('lovableproject.com') ||
    window.location.hostname.includes('id-preview--');

  return `${isPreviewHost ? PUBLISHED_APP_URL : window.location.origin}/generator`;
};

const AdminQrLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState(getDefaultRedirect);

  const generateLink = async () => {
    if (!email) {
      toast.error('Bitte E-Mail eingeben');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-magic-link', {
        body: { email, redirectTo },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.link) throw new Error('Kein Login-Link erhalten');

      setMagicLink(data.link);
      toast.success('Direkter QR-Login-Link generiert');
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">QR-Code Login</h1>
          <p className="text-sm text-muted-foreground">
            Der Code öffnet direkt deine App-Route und loggt den Benutzer dort automatisch ein.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Direkten Login-Link generieren
            </CardTitle>
            <CardDescription>
              Kein externer Verify-Link mehr – der QR-Code zeigt direkt auf <span className="font-medium">/qr-login</span> deiner App.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="qr-email">E-Mail des Benutzers</Label>
              <Input
                id="qr-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qr-redirect">Ziel nach dem Login</Label>
              <Input
                id="qr-redirect"
                value={redirectTo}
                onChange={(e) => setRedirectTo(e.target.value)}
                placeholder={`${PUBLISHED_APP_URL}/generator`}
              />
            </div>

            <Button onClick={generateLink} disabled={loading} className="w-full">
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              {magicLink ? 'QR-Code neu generieren' : 'QR-Code generieren'}
            </Button>
          </CardContent>
        </Card>

        {magicLink && (
          <Card>
            <CardHeader>
              <CardTitle>QR-Code für {email}</CardTitle>
              <CardDescription>Öffnet direkt den Login in deiner App und leitet danach zu /generator weiter.</CardDescription>
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
