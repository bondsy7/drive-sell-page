import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Sparkles, Loader2, Check, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { compressToWebP, uploadImageToStorage } from '@/lib/storage-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
  vehicleId?: string | null;
  existingUrls: string[];
  onAdded: (urls: string[]) => void;
}

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** Weitere Bilder zu einer generierten PDF-Angebotsseite hinzufügen. */
const OfferImageAddDialog: React.FC<Props> = ({ open, onOpenChange, projectId, userId, vehicleId, existingUrls, onAdded }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !vehicleId) return;
    setPicked([]);
    supabase.from('project_images').select('image_url, created_at')
      .eq('vehicle_id', vehicleId).not('image_url', 'is', null)
      .order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => {
        const urls = Array.from(new Set((data || []).map((r: any) => r.image_url as string).filter(Boolean)));
        setGalleryUrls(urls.filter((u) => !existingUrls.includes(u)));
      });
  }, [open, vehicleId, existingUrls]);

  const persist = async (urls: string[]) => {
    const base = existingUrls.length;
    const rows = urls.map((url, i) => ({
      project_id: projectId, user_id: userId, vehicle_id: null,
      image_url: url, image_base64: '', perspective: `Bild ${base + i + 1}`, sort_order: base + i,
    }));
    const { error } = await supabase.from('project_images').insert(rows as any);
    if (error) throw error;
    onAdded(urls);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const [i, file] of Array.from(files).entries()) {
        if (!file.type.startsWith('image/')) continue;
        const webp = await compressToWebP(await readFile(file), 0.85, 2000);
        const url = await uploadImageToStorage(webp, userId, `${projectId}/extra-${Date.now()}-${i}.webp`);
        if (url) urls.push(url);
      }
      if (!urls.length) throw new Error('Upload fehlgeschlagen');
      await persist(urls);
      toast.success(`${urls.length} Bild${urls.length > 1 ? 'er' : ''} hinzugefügt`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Bilder konnten nicht hinzugefügt werden');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addPicked = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await persist(picked);
      toast.success(`${picked.length} Bild${picked.length > 1 ? 'er' : ''} hinzugefügt`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Bilder konnten nicht hinzugefügt werden');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ImagePlus className="w-5 h-5" /> Weitere Bilder hinzufügen</DialogTitle>
          <DialogDescription>Die Bilder erscheinen als Miniaturen unter dem Hauptbild – im Editor, in der Vorschau und auf der fertigen Seite.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
            className="flex flex-col items-start gap-1 rounded-xl border-2 border-dashed border-border p-4 text-left hover:bg-muted transition-colors disabled:opacity-50">
            <Upload className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Eigene Bilder hochladen</span>
            <span className="text-xs text-muted-foreground">Kostenlos · mehrere Dateien möglich</span>
          </button>
          <Link to={vehicleId ? `/generator/fotos?vehicle=${vehicleId}` : '/generator/fotos'} target="_blank" rel="noopener"
            className="flex flex-col items-start gap-1 rounded-xl border-2 border-dashed border-border p-4 text-left hover:bg-muted transition-colors">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Weitere KI-Bilder generieren</span>
            <span className="text-xs text-muted-foreground">Kostet Credits · öffnet den Foto-Generator in einem neuen Tab. Fertige Bilder danach unten übernehmen.</span>
          </Link>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

        {vehicleId && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Aus der Fahrzeug-Galerie übernehmen</div>
            {galleryUrls.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine weiteren Bilder zu diesem Fahrzeug gefunden.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {galleryUrls.map((u) => {
                  const on = picked.includes(u);
                  return (
                    <button key={u} type="button" onClick={() => setPicked((p) => on ? p.filter((x) => x !== u) : [...p, u])}
                      className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 ${on ? 'border-primary' : 'border-transparent'}`}>
                      <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {on && <span className="absolute top-1 right-1 rounded-full bg-primary text-primary-foreground p-0.5"><Check className="w-3 h-3" /></span>}
                    </button>
                  );
                })}
              </div>
            )}
            <Button onClick={addPicked} disabled={busy || !picked.length} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `${picked.length || ''} Bild${picked.length === 1 ? '' : 'er'} übernehmen`}
            </Button>
          </div>
        )}
        {busy && !vehicleId && <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}
      </DialogContent>
    </Dialog>
  );
};

export default OfferImageAddDialog;
