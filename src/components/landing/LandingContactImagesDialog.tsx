import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Link2, Loader2, Upload, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  contactsForBrand,
  mergeBrandContacts,
  safeImageUrl,
  readBrandContacts,
  type BrandContact,
} from '@/lib/brand-contacts';

interface LandingContactImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: string;
  onApply: (contacts: BrandContact[]) => void;
}

/** Adds employee portraits to an existing landing page and keeps the profile in sync. */
export default function LandingContactImagesDialog({ open, onOpenChange, brand, onApply }: LandingContactImagesDialogProps) {
  const { user } = useAuth();
  const [allContacts, setAllContacts] = useState<BrandContact[]>([]);
  const [ciSettings, setCiSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const contacts = useMemo(() => contactsForBrand(allContacts, brand), [allContacts, brand]);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setLoadError(false);
    setLinkId(null);
    supabase.from('profiles').select('ci_settings').eq('id', user.id).maybeSingle().then(({ data, error }) => {
      const settings = (data?.ci_settings && typeof data.ci_settings === 'object' ? data.ci_settings : {}) as Record<string, unknown>;
      setCiSettings(settings);
      setAllContacts(readBrandContacts(settings));
      setLoadError(!!error);
      setLoading(false);
    });
  }, [open, user]);

  const patchImage = (id: string, imageUrl: string) => {
    setAllContacts(list => list.map(contact => contact.id === id ? { ...contact, imageUrl } : contact));
  };

  const uploadImage = async (contact: BrandContact, file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Bitte nur Bilddateien hochladen'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Maximale Dateigröße: 5 MB'); return; }
    setUploadingId(contact.id);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user.id}/contacts/${contact.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type });
    setUploadingId(null);
    if (error) { toast.error('Upload fehlgeschlagen'); return; }
    patchImage(contact.id, supabase.storage.from('logos').getPublicUrl(path).data.publicUrl);
    toast.success(`Bild für ${contact.name || 'Ansprechpartner'} hochgeladen`);
  };

  const openLink = (contact: BrandContact) => {
    setLinkId(contact.id);
    setLinkDraft(contact.imageUrl || '');
  };

  const applyLink = (id: string) => {
    const url = safeImageUrl(linkDraft);
    if (!url) { toast.error('Bitte einen gültigen Bild-Link mit https:// eingeben'); return; }
    patchImage(id, url);
    setLinkId(null);
    setLinkDraft('');
  };

  const apply = async () => {
    if (!user) return;
    setSaving(true);
    const updated = contacts.map(contact => ({ ...contact, imageUrl: safeImageUrl(contact.imageUrl) }));
    const merged = mergeBrandContacts(allContacts, updated).map(contact => ({
      id: contact.id,
      brands: contact.brands,
      brand: contact.brands.join(', ').slice(0, 255),
      name: contact.name.trim().slice(0, 100),
      email: contact.email.trim().slice(0, 255),
      phone: contact.phone.trim().slice(0, 40),
      imageUrl: safeImageUrl(contact.imageUrl),
    }));
    const { error } = await supabase.from('profiles').update({
      ci_settings: { ...ciSettings, brandContacts: merged } as any,
    }).eq('id', user.id);
    setSaving(false);
    onApply(updated);
    onOpenChange(false);
    if (error) toast.warning('Bilder auf dieser Seite übernommen; das Profil konnte nicht aktualisiert werden.');
    else toast.success('Mitarbeiterbilder auf der Seite und im Profil gespeichert');
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mitarbeiterbilder</DialogTitle>
          <DialogDescription>
            Bilder per Upload oder Link ergänzen. „Bilder übernehmen“ aktualisiert den Ansprechpartner-Block dieser Kontaktsection und das Profil für künftige Seiten.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Ansprechpartner werden geladen…</div>
        ) : loadError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Die Ansprechpartner konnten nicht geladen werden. Bitte erneut öffnen.</p>
        ) : contacts.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Für die Marke {brand} sind im Profil noch keine Ansprechpartner hinterlegt.</p>
        ) : (
          <div className="space-y-3">
            {contacts.map(contact => (
              <div key={contact.id} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center">
                    {contact.imageUrl ? <img src={contact.imageUrl} alt={contact.name || 'Ansprechpartner'} className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-muted-foreground" />}
                    {contact.imageUrl && <button type="button" aria-label={`Bild von ${contact.name} entfernen`} onClick={() => patchImage(contact.id, '')} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow-sm"><X className="h-3 w-3" /></button>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{contact.name || 'Ansprechpartner'}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email || contact.phone}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild disabled={uploadingId === contact.id}>
                      <label className="cursor-pointer gap-1.5">
                        {uploadingId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploadingId === contact.id ? 'Lädt…' : 'Hochladen'}
                        <input aria-label={`Bild für ${contact.name} hochladen`} type="file" accept="image/*" className="hidden" disabled={uploadingId === contact.id} onChange={event => { uploadImage(contact, event.target.files?.[0]); event.target.value = ''; }} />
                      </label>
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => openLink(contact)}><Link2 className="h-4 w-4" /> Bildlink</Button>
                  </div>
                </div>
                {linkId === contact.id && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input autoFocus value={linkDraft} onChange={event => setLinkDraft(event.target.value)} placeholder="https://ihre-website.de/mitarbeiter.jpg" aria-label={`Bildlink für ${contact.name}`} />
                    <Button type="button" variant="secondary" size="sm" onClick={() => applyLink(contact.id)}>Link übernehmen</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button type="button" className="gap-1.5" onClick={apply} disabled={saving || loading || loadError || !contacts.length || !!uploadingId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {saving ? 'Wird übernommen…' : 'Bilder übernehmen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
