import { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import VehicleBrandMultiPicker from '@/components/VehicleBrandMultiPicker';
import { BrandContact, readBrandContacts } from '@/lib/brand-contacts';

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

  const patch = (id: string, key: 'name' | 'email' | 'phone', value: string) =>
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
      return { id: c.id, brands, brand: brands.join(', ').slice(0, 255), name: c.name.trim().slice(0, 100), email: c.email.trim().slice(0, 255), phone: c.phone.trim().slice(0, 40) };
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
        <div key={c.id} className="grid sm:grid-cols-[1.3fr_1.2fr_1.4fr_1.2fr_auto] gap-3 items-end rounded-lg border border-border p-3">
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
