import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Building2, MapPin, Phone, Globe, Facebook, Instagram, Youtube, FileText, Landmark, Upload, X, Image, Zap, History, TrendingDown, TrendingUp, Lock, KeyRound, Chrome } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { toast } from 'sonner';

interface ProfileData {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  postal_code: string;
  city: string;
  tax_id: string;
  logo_url: string;
  custom_showroom_url: string;
  facebook_url: string;
  instagram_url: string;
  x_url: string;
  tiktok_url: string;
  youtube_url: string;
  whatsapp_number: string;
  leasing_bank: string;
  leasing_legal_text: string;
  financing_bank: string;
  financing_legal_text: string;
  default_legal_text: string;
}

const emptyProfile: ProfileData = {
  company_name: '', contact_name: '', phone: '', email: '', website: '',
  address: '', postal_code: '', city: '', tax_id: '', logo_url: '', custom_showroom_url: '',
  facebook_url: '', instagram_url: '', x_url: '', tiktok_url: '', youtube_url: '', whatsapp_number: '',
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

const ACTION_LABELS: Record<string, string> = {
  pdf_analysis: 'PDF-Analyse',
  image_generate: 'Bildgenerierung',
  image_remaster: 'Bild-Remastering',
  vin_ocr: 'VIN-Erkennung',
  credit_purchase: 'Credit-Kauf',
  subscription_reset: 'Abo-Gutschrift',
  admin_adjustment: 'Admin-Anpassung',
  landing_page_export: 'Seiten-Export',
};

interface CreditTransaction {
  id: string;
  amount: number;
  action_type: string;
  model_used: string | null;
  description: string | null;
  created_at: string;
}

const Profile = () => {
  const { user } = useAuth();
  const { balance, lifetimeUsed, loading: creditsLoading } = useCredits();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Determine login method
  const loginProvider = user?.app_metadata?.provider || 'email';
  const isGoogleLogin = loginProvider === 'google';

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) { toast.error('Passwort muss mindestens 6 Zeichen lang sein'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwörter stimmen nicht überein'); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success('Passwort erfolgreich geändert!');
    setNewPassword('');
    setConfirmPassword('');
  };

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setProfile({
          company_name: data.company_name || '',
          contact_name: data.contact_name || '',
          phone: data.phone || '',
          email: data.email || '',
          website: (data as any).website || '',
          address: data.address || '',
          postal_code: data.postal_code || '',
          city: data.city || '',
          tax_id: data.tax_id || '',
          logo_url: data.logo_url || '',
          custom_showroom_url: (data as any).custom_showroom_url || '',
          facebook_url: data.facebook_url || '',
          instagram_url: data.instagram_url || '',
          x_url: data.x_url || '',
          tiktok_url: data.tiktok_url || '',
          youtube_url: data.youtube_url || '',
          whatsapp_number: (data as any).whatsapp_number || '',
          leasing_bank: data.leasing_bank || '',
          leasing_legal_text: data.leasing_legal_text || '',
          financing_bank: data.financing_bank || '',
          financing_legal_text: data.financing_legal_text || '',
          default_legal_text: data.default_legal_text || '',
        });
      }
    });
  }, [user]);

  // Load transactions and subscribe to realtime
  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setTxLoading(true);
    const { data } = await supabase
      .from('credit_transactions' as any)
      .select('id, amount, action_type, model_used, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setTransactions((data as any) || []);
    setTxLoading(false);
  }, [user]);

  useEffect(() => {
    loadTransactions();
    if (!user) return;
    const channel = supabase
      .channel('profile-transactions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'credit_transactions',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new) {
          setTransactions(prev => [payload.new as CreditTransaction, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadTransactions]);

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
      website: profile.website || null,
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
      whatsapp_number: profile.whatsapp_number || null,
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
      <AppHeader leftActions={
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 text-xs sm:text-sm">
          <Save className="w-4 h-4" /> <span className="hidden sm:inline">{saving ? 'Speichern...' : 'Speichern'}</span><span className="sm:hidden">{saving ? '...' : 'Save'}</span>
        </Button>
      } />

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">
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
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </Label>
              <Input value={profile.whatsapp_number} onChange={e => update('whatsapp_number', e.target.value)} placeholder="+49 170 1234567" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Webseite</Label>
              <Input value={profile.website} onChange={e => update('website', e.target.value)} placeholder="https://www.autohaus-mustermann.de" />
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

        {/* Account & Sicherheit */}
        <Section icon={<KeyRound className="w-4 h-4" />} title="Konto & Sicherheit">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Anmeldemethode:</span>
              <Badge variant="outline" className="gap-1.5">
                {isGoogleLogin ? (
                  <><Chrome className="w-3.5 h-3.5" /> Google</>
                ) : (
                  <><Lock className="w-3.5 h-3.5" /> E-Mail / Passwort</>
                )}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">E-Mail:</span>
              <span className="text-sm text-foreground">{user?.email}</span>
            </div>

            {!isGoogleLogin && (
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-medium text-foreground">Passwort ändern</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Neues Passwort</Label>
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Passwort bestätigen</Label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
                <Button onClick={handlePasswordChange} disabled={changingPassword || !newPassword} size="sm" variant="outline" className="gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> {changingPassword ? 'Wird geändert...' : 'Passwort ändern'}
                </Button>
              </div>
            )}

            {isGoogleLogin && (
              <p className="text-xs text-muted-foreground">
                Du bist über Google angemeldet. Das Passwort wird über dein Google-Konto verwaltet.
              </p>
            )}
          </div>
        </Section>

        {/* Credit Overview & Transaction History */}
        <Section icon={<Zap className="w-4 h-4" />} title="Credits & Verlauf">
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{creditsLoading ? '...' : balance}</div>
              <div className="text-xs text-muted-foreground mt-1">Verfügbare Credits</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{creditsLoading ? '...' : lifetimeUsed}</div>
              <div className="text-xs text-muted-foreground mt-1">Verbrauchte Credits</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{transactions.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Transaktionen</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Transaktionsverlauf</h3>
          </div>

          {txLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Lade Verlauf...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Noch keine Transaktionen.</div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {transactions.map(tx => {
                const isPositive = tx.amount > 0;
                const date = new Date(tx.created_at);
                const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isPositive ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500'}`}>
                        {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {ACTION_LABELS[tx.action_type] || tx.action_type}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dateStr} · {timeStr}
                          {tx.model_used && tx.model_used !== 'standard' && (
                            <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">Pro</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border">
            <Link to="/pricing">
              <Button variant="outline" size="sm" className="gap-1.5 w-full">
                <Zap className="w-3.5 h-3.5" /> Credits kaufen
              </Button>
            </Link>
          </div>
        </Section>
      </main>
    </div>
  );
};

export default Profile;
