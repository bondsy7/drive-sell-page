import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Car, ArrowLeft, Save, Building2, MapPin, Phone, Globe, Facebook, Instagram, Youtube, FileText, Landmark, Upload, X, Image } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  postal_code: string;
  city: string;
  tax_id: string;
  logo_url: string;
  facebook_url: string;
  instagram_url: string;
  x_url: string;
  tiktok_url: string;
  youtube_url: string;
  leasing_bank: string;
  leasing_legal_text: string;
  financing_bank: string;
  financing_legal_text: string;
  default_legal_text: string;
}

const emptyProfile: ProfileData = {
  company_name: '', contact_name: '', phone: '', email: '',
  address: '', postal_code: '', city: '', tax_id: '', logo_url: '',
  facebook_url: '', instagram_url: '', x_url: '', tiktok_url: '', youtube_url: '',
  leasing_bank: '', leasing_legal_text: '', financing_bank: '', financing_legal_text: '', default_legal_text: '',
};

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
    <div className="flex items-center gap-2.5 mb-1">
      <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">{icon}</span>
      <h2 className="font-display font-semibold text-foreground">{title}</h2>
    </div>
    {children}
  </div>
);

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setProfile({
          company_name: data.company_name || '',
          contact_name: data.contact_name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          postal_code: data.postal_code || '',
          city: data.city || '',
          tax_id: data.tax_id || '',
          logo_url: data.logo_url || '',
          facebook_url: data.facebook_url || '',
          instagram_url: data.instagram_url || '',
          x_url: data.x_url || '',
          tiktok_url: data.tiktok_url || '',
          youtube_url: data.youtube_url || '',
          leasing_bank: data.leasing_bank || '',
          leasing_legal_text: data.leasing_legal_text || '',
          financing_bank: data.financing_bank || '',
          financing_legal_text: data.financing_legal_text || '',
          default_legal_text: data.default_legal_text || '',
        });
      }
    });
  }, [user]);

  const update = (key: keyof ProfileData, val: string) => setProfile(p => ({ ...p, [key]: val }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Bitte nur Bilddateien hochladen'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Maximale Dateigröße: 5 MB'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (uploadError) { toast.error('Upload fehlgeschlagen'); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    const logoUrl = urlData.publicUrl + '?t=' + Date.now(); // cache bust
    update('logo_url', logoUrl);
    setUploading(false);
    toast.success('Logo hochgeladen!');
  };

  const removeLogo = () => update('logo_url', '');

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      company_name: profile.company_name,
      contact_name: profile.contact_name,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      postal_code: profile.postal_code,
      city: profile.city,
      tax_id: profile.tax_id,
      logo_url: profile.logo_url,
      facebook_url: profile.facebook_url || null,
      instagram_url: profile.instagram_url || null,
      x_url: profile.x_url || null,
      tiktok_url: profile.tiktok_url || null,
      youtube_url: profile.youtube_url || null,
      leasing_bank: profile.leasing_bank || null,
      leasing_legal_text: profile.leasing_legal_text || null,
      financing_bank: profile.financing_bank || null,
      financing_legal_text: profile.financing_legal_text || null,
      default_legal_text: profile.default_legal_text || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Fehler beim Speichern'); console.error(error); return; }
    toast.success('Profil gespeichert!');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
                <Car className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-bold text-foreground text-sm">Firmenprofil</span>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" /> {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Logo Upload */}
        <Section icon={<Image className="w-4 h-4" />} title="Firmenlogo">
          <div className="flex items-center gap-6">
            {profile.logo_url ? (
              <div className="relative group">
                <img src={profile.logo_url} alt="Logo" className="h-20 max-w-[200px] object-contain rounded-lg border border-border bg-muted p-2" />
                <button onClick={removeLogo} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-[200px] border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                Kein Logo
              </div>
            )}
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" /> {uploading ? 'Hochladen...' : 'Logo hochladen'}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG oder SVG · max. 5 MB</p>
            </div>
          </div>
        </Section>

        {/* Company info */}
        <Section icon={<Building2 className="w-4 h-4" />} title="Firmendaten">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Firmenname</Label>
              <Input value={profile.company_name} onChange={e => update('company_name', e.target.value)} placeholder="Autohaus Mustermann GmbH" />
            </div>
            <div className="space-y-1.5">
              <Label>Ansprechpartner</Label>
              <Input value={profile.contact_name} onChange={e => update('contact_name', e.target.value)} placeholder="Max Mustermann" />
            </div>
            <div className="space-y-1.5">
              <Label>USt-IdNr.</Label>
              <Input value={profile.tax_id} onChange={e => update('tax_id', e.target.value)} placeholder="DE123456789" />
            </div>
          </div>
        </Section>

        {/* Address */}
        <Section icon={<MapPin className="w-4 h-4" />} title="Adresse & Standort">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Straße & Hausnummer</Label>
              <Input value={profile.address} onChange={e => update('address', e.target.value)} placeholder="Musterstraße 123" />
            </div>
            <div className="space-y-1.5">
              <Label>Postleitzahl</Label>
              <Input value={profile.postal_code} onChange={e => update('postal_code', e.target.value)} placeholder="12345" />
            </div>
            <div className="space-y-1.5">
              <Label>Ort</Label>
              <Input value={profile.city} onChange={e => update('city', e.target.value)} placeholder="Musterstadt" />
            </div>
          </div>
        </Section>

        {/* Contact */}
        <Section icon={<Phone className="w-4 h-4" />} title="Kontaktdaten">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={profile.phone} onChange={e => update('phone', e.target.value)} placeholder="+49 123 456789" />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input type="email" value={profile.email} onChange={e => update('email', e.target.value)} placeholder="info@autohaus.de" />
            </div>
          </div>
        </Section>

        {/* Social media */}
        <Section icon={<Globe className="w-4 h-4" />} title="Social Media">
          <p className="text-xs text-muted-foreground -mt-2 mb-2">Gefüllte Links werden als Icons auf der Landingpage angezeigt.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Facebook className="w-3.5 h-3.5" /> Facebook</Label>
              <Input value={profile.facebook_url} onChange={e => update('facebook_url', e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
              <Input value={profile.instagram_url} onChange={e => update('instagram_url', e.target.value)} placeholder="https://instagram.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">𝕏 X (Twitter)</Label>
              <Input value={profile.x_url} onChange={e => update('x_url', e.target.value)} placeholder="https://x.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">TikTok</Label>
              <Input value={profile.tiktok_url} onChange={e => update('tiktok_url', e.target.value)} placeholder="https://tiktok.com/@..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Youtube className="w-3.5 h-3.5" /> YouTube</Label>
              <Input value={profile.youtube_url} onChange={e => update('youtube_url', e.target.value)} placeholder="https://youtube.com/..." />
            </div>
          </div>
        </Section>

        {/* Banking & Legal */}
        <Section icon={<Landmark className="w-4 h-4" />} title="Banken & Rechtstexte">
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Je nach Angebotstyp wird der passende Rechtstext angezeigt: Leasing-Text bei Leasing, Finanzierungs-Text bei Finanzierung, sonst der Standard-Text.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Leasing-Bank</Label>
              <Input value={profile.leasing_bank} onChange={e => update('leasing_bank', e.target.value)} placeholder="z.B. BMW Financial Services" />
            </div>
            <div className="space-y-1.5">
              <Label>Finanzierungs-Bank</Label>
              <Input value={profile.financing_bank} onChange={e => update('financing_bank', e.target.value)} placeholder="z.B. Santander Consumer Bank" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Leasing-Rechtstext</Label>
            <Textarea value={profile.leasing_legal_text} onChange={e => update('leasing_legal_text', e.target.value)} placeholder="Rechtstext für Leasing-Angebote..." rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Finanzierungs-Rechtstext</Label>
            <Textarea value={profile.financing_legal_text} onChange={e => update('financing_legal_text', e.target.value)} placeholder="Rechtstext für Finanzierungs-Angebote..." rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Standard-Rechtstext</Label>
            <Textarea value={profile.default_legal_text} onChange={e => update('default_legal_text', e.target.value)} placeholder="Allgemeiner Rechtstext / Haftungsausschluss..." rows={4} />
          </div>
        </Section>
      </main>
    </div>
  );
};

export default Profile;
