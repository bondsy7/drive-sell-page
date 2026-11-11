import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Upload, Link2, X, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import VehicleBrandMultiPicker from '@/components/VehicleBrandMultiPicker';
import { BrandContact, readBrandContacts, safeImageUrl } from '@/lib/brand-contacts';

export default function BrandContactsSection() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<BrandContact[]>([]);
  const [ci, setCi] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('ci_settings').eq('id', user.id).maybeSingle().then(({ data }) => {
      const settings = (data?.ci_settings && typeof data.ci_settings === 'object' ? data.ci_settings : {}) as Record<string, unknown>;
      setCi(settings);
      setContacts(readBrandContacts(settings));
    });
  }, [user]);

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const uploadImage = async (id: string, file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Bitte nur Bilddateien hochladen'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Maximale Dateigröße: 5 MB'); return; }
    setUploadingId(id);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user.id}/contacts/${id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type });
    setUploadingId(null);
    if (error) { toast.error('Upload fehlgeschlagen'); return; }
    patch(id, 'imageUrl', supabase.storage.from('logos').getPublicUrl(path).data.publicUrl);
    toast.success('Bild hochgeladen – bitte speichern');
  };

  const setLink = (id: string) => {
    const v = window.prompt('Bild-Link (https://…)');
    if (v === null) return;
    const url = safeImageUrl(v);
    if (!url) { toast.error('Bitte einen gültigen Bild-Link mit https:// eingeben'); return; }
    patch(id, 'imageUrl', url);
  };

  const patch = (id: string, key: 'name' | 'email' | 'phone' | 'imageUrl', value: string) =>
    setContacts(list => list.map(c => c.id === id ? { ...c, [key]: value } : c));

  const patchBrands = (id: string, brands: string[]) =>
    setContacts(list => list.map(c => c.id === id ? { ...c, brands, brand: brands.join(', ') } : c));

  const save = async () => {
    if (!user) return;
    const bad = contacts.find(c => c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()));
    if (bad) { toast.error(`Ungültige E-Mail: ${bad.email}`); return; }
    if (contacts.some(c => !c.brands.length)) { toast.error('Bitte bei jedem Ansprechpartner mindestens eine Marke angeben.'); return; }
    setSaving(true);
    const clean = contacts.map(c => {
      const brands = c.brands.map(b => b.trim().slice(0, 60)).filter(Boolean);
      return { id: c.id, brands, brand: brands.join(', ').slice(0, 255), name: c.name.trim().slice(0, 100), email: c.email.trim().slice(0, 255), phone: c.phone.trim().slice(0, 40), imageUrl: safeImageUrl(c.imageUrl) };
    });
    const next = { ...ci, brandContacts: clean };
    const { error } = await supabase.from('profiles').update({ ci_settings: next as any }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Speichern fehlgeschlagen'); return; }
    setCi(next);
    toast.success('Ansprechpartner gespeichert');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground -mt-2">Ansprechpartner je Marke – mehrere Marken möglich. Bei generierten Landingpages werden die Ansprechpartner der gewählten Marke automatisch im Kontakt-Abschnitt angezeigt.</p>
      {contacts.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Ansprechpartner hinterlegt.</p>}
      {contacts.map(c => (
        <div key={c.id} className="grid sm:grid-cols-[auto_1.3fr_1.2fr_1.4fr_1.2fr_auto] gap-3 items-end rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <Label>Bild</Label>
            <div className="flex items-center gap-2">
              <div className="relative w-14 h-14 rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {c.imageUrl ? <img src={c.imageUrl} alt={c.name || 'Ansprechpartner'} className="w-full h-full object-cover" /> : <UserRound className="w-6 h-6 text-muted-foreground" />}
                {c.imageUrl && <button type="button" aria-label="Bild entfernen" onClick={() => patch(c.id, 'imageUrl', '')} className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5"><X className="w-3 h-3" /></button>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer text-primary hover:underline">
                  <Upload className="w-3 h-3" /> {uploadingId === c.id ? 'Lädt…' : 'Hochladen'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingId === c.id} onChange={e => { uploadImage(c.id, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <button type="button" onClick={() => setLink(c.id)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Link2 className="w-3 h-3" /> Per Link</button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Marken</Label><VehicleBrandMultiPicker brands={c.brands} onChange={b => patchBrands(c.id, b)} placeholder="Marken wählen..." /></div>
          <div className="space-y-1.5"><Label>Name</Label><Input value={c.name} onChange={e => patch(c.id, 'name', e.target.value)} placeholder="Max Mustermann" /></div>
          <div className="space-y-1.5"><Label>E-Mail</Label><Input type="email" value={c.email} onChange={e => patch(c.id, 'email', e.target.value)} placeholder="max@autohaus.de" /></div>
          <div className="space-y-1.5"><Label>Telefon</Label><Input value={c.phone} onChange={e => patch(c.id, 'phone', e.target.value)} placeholder="+49 …" /></div>
          <Button variant="ghost" size="icon" aria-label="Ansprechpartner entfernen" onClick={() => setContacts(list => list.filter(x => x.id !== c.id))}><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setContacts(list => [...list, { id: crypto.randomUUID(), brand: '', brands: list[list.length - 1]?.brands ? [...list[list.length - 1]!.brands] : [], name: '', email: '', phone: '' }])}><Plus className="w-4 h-4" /> Ansprechpartner hinzufügen</Button>
        <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}><Save className="w-4 h-4" /> Ansprechpartner speichern</Button>
      </div>
    </div>
  );
}
