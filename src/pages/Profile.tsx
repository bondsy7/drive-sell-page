import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

const Profile = () => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setCompanyName(data.company_name || '');
        setContactName(data.contact_name || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
      }
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      company_name: companyName,
      contact_name: contactName,
      phone,
      email,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Fehler beim Speichern'); return; }
    toast.success('Profil gespeichert!');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Car className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-sm">Firmenprofil</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Firmenname</Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Autohaus Mustermann GmbH" />
          </div>
          <div className="space-y-1.5">
            <Label>Ansprechpartner</Label>
            <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Max Mustermann" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 123 456789" />
          </div>
          <div className="space-y-1.5">
            <Label>E-Mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@autohaus.de" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Profil speichern'}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
