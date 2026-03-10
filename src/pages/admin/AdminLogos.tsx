import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Trash2, Image, Loader2 } from 'lucide-react';

interface LogoFile {
  name: string;
  url: string;
}

export default function AdminLogos() {
  const [logos, setLogos] = useState<LogoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadLogos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from('manufacturer-logos').list('', {
      limit: 500,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      toast.error('Fehler beim Laden: ' + error.message);
      setLoading(false);
      return;
    }
    const items: LogoFile[] = (data || [])
      .filter(f => f.name && !f.name.startsWith('.'))
      .map(f => ({
        name: f.name,
        url: supabase.storage.from('manufacturer-logos').getPublicUrl(f.name).data.publicUrl,
      }));
    setLogos(items);
    setLoading(false);
  }, []);

  useEffect(() => { loadLogos(); }, [loadLogos]);

  const uploadFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.name.endsWith('.svg')
    );
    if (imageFiles.length === 0) {
      toast.error('Keine Bilddateien gefunden.');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    // Upload in batches of 5
    for (let i = 0; i < imageFiles.length; i += 5) {
      const batch = imageFiles.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(file => {
          const safeName = file.name.toLowerCase().replace(/\s+/g, '-');
          return supabase.storage
            .from('manufacturer-logos')
            .upload(safeName, file, { upsert: true });
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled' && !r.value.error) successCount++;
        else errorCount++;
      });
    }

    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} Logo(s) hochgeladen`);
    if (errorCount > 0) toast.error(`${errorCount} Fehler beim Upload`);
    loadLogos();
  };

  const deleteLogo = async (name: string) => {
    const { error } = await supabase.storage.from('manufacturer-logos').remove([name]);
    if (error) toast.error('Fehler: ' + error.message);
    else {
      toast.success('Gelöscht');
      setLogos(prev => prev.filter(l => l.name !== name));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Hersteller-Logos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {logos.length} Logo(s) gespeichert. Lade SVG, PNG oder WebP Dateien hoch.
          </p>
        </div>
        <label className="cursor-pointer">
          <Button disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Logos hochladen
          </Button>
          <input
            type="file"
            accept="image/*,.svg"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
          />
        </label>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-muted-foreground/40 bg-muted/20'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-muted-foreground">Logos werden hochgeladen...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Image className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Alle Logo-Dateien hierher ziehen oder oben klicken
            </p>
            <p className="text-xs text-muted-foreground/60">
              SVG, PNG, WebP – beliebig viele gleichzeitig
            </p>
          </div>
        )}
      </div>

      {/* Logo Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : logos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Noch keine Logos vorhanden.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {logos.map(logo => (
            <div key={logo.name} className="group relative bg-card border border-border rounded-lg p-3 flex flex-col items-center gap-2">
              <img
                src={logo.url}
                alt={logo.name}
                className="w-14 h-14 object-contain"
                loading="lazy"
              />
              <span className="text-[10px] text-muted-foreground truncate w-full text-center" title={logo.name}>
                {logo.name.replace(/\.[^.]+$/, '')}
              </span>
              <button
                onClick={() => deleteLogo(logo.name)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
