import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { QrCode, Copy, RefreshCw, ArrowLeft } from 'lucide-react';

const AdminQrLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailParam = searchParams.get('email') || '';
  
  const [email, setEmail] = useState(emailParam);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState(window.location.origin + '/generator');

  const generateLink = async () => {
    if (!email) {
      toast.error('Bitte E-Mail eingeben');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-magic-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email, redirectTo }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMagicLink(data.link);
      toast.success('Magic Link generiert!');
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Generieren');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (magicLink) {
      navigator.clipboard.writeText(magicLink);
      toast.success('Link kopiert!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">QR-Code Login</h1>
          <p className="text-muted-foreground text-sm">
            Generiere einen QR-Code mit Magic Link für automatischen Login
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Link generieren
            </CardTitle>
            <CardDescription>
              Der QR-Code enthält einen Magic Link, der 24 Stunden gültig ist.
              Beim Scannen wird der Benutzer automatisch eingeloggt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>E-Mail des Benutzers</Label>
              <Input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weiterleitung nach Login</Label>
              <Input
                value={redirectTo}
                onChange={e => setRedirectTo(e.target.value)}
                placeholder={window.location.origin}
              />
            </div>
            <Button onClick={generateLink} disabled={loading} className="w-full">
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              {magicLink ? 'Neu generieren' : 'QR-Code generieren'}
            </Button>
          </CardContent>
        </Card>

        {magicLink && (
          <Card>
            <CardHeader>
              <CardTitle>QR-Code für {email}</CardTitle>
              <CardDescription>Scanne diesen Code zum automatischen Login (24h gültig)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={magicLink}
                  size={256}
                  level="M"
                  includeMargin
                />
              </div>
              <Button variant="outline" onClick={copyLink} className="w-full">
                <Copy className="w-4 h-4 mr-2" /> Link kopieren
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminQrLogin;
