import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy, RefreshCw } from 'lucide-react';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#%+?';

function randomPassword(length = 16) {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => CHARS[n % CHARS.length]).join('');
}

interface Props {
  userId: string;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SetPasswordDialog({ userId, userEmail, open, onOpenChange }: Props) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (password.length < 10) { toast.error('Mindestens 10 Zeichen'); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-set-password', { body: { userId, password } });
    setSaving(false);
    if (error || data?.error) { toast.error('Fehler: ' + (data?.error || error?.message)); return; }
    toast.success(`Neues Passwort für ${userEmail} ist aktiv`);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`E-Mail: ${userEmail}\nPasswort: ${password}`);
    toast.success('Zugangsdaten kopiert');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setPassword(''); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Passwort setzen</DialogTitle>
          <DialogDescription>{userEmail} – Credits und Daten bleiben unverändert.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mind. 10 Zeichen" className="font-mono" />
          <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())} title="Zufallspasswort">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={copy} disabled={!password}>
            <Copy className="w-4 h-4 mr-1" /> Kopieren
          </Button>
          <Button type="button" onClick={save} disabled={saving || password.length < 10}>
            {saving ? 'Speichere…' : 'Passwort setzen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
