import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Trash2, Image, Loader2, FileCode } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LogoFile {
  name: string;
  url: string;
  folder: string; // '' (root) or 'svg'
}

const BUCKET = 'manufacturer-logos';

export default function AdminLogos() {
  const [logos, setLogos] = useState<LogoFile[]>([]);
  const [svgs, setSvgs] = useState<LogoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [rootRes, svgRes] = await Promise.all([
      supabase.storage.from(BUCKET).list('', { limit: 500, sortBy: { column: 'name', order: 'asc' } }),
      supabase.storage.from(BUCKET).list('svg', { limit: 500, sortBy: { column: 'name', order: 'asc' } }),
    ]);

    const mapFiles = (files: any[] | null, folder: string): LogoFile[] =>
      (files || [])
        .filter((f: any) => f.name && !f.name.startsWith('.') && f.id)
        .map((f: any) => ({
          name: f.name,
          folder,
          url: supabase.storage.from(BUCKET).getPublicUrl(folder ? `${folder}/${f.name}` : f.name).data.publicUrl,
        }));

    setLogos(mapFiles(rootRes.data, ''));
    setSvgs(mapFiles(svgRes.data, 'svg'));
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const uploadFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.name.endsWith('.svg')
    );
    if (imageFiles.length === 0) {
      toast.error('Keine Bilddateien gefunden.');
      return;
    }

    // Split by type: SVGs go to svg/ folder, rest to root
    const svgFiles = imageFiles.filter(f => f.name.toLowerCase().endsWith('.svg'));
    const rasterFiles = imageFiles.filter(f => !f.name.toLowerCase().endsWith('.svg'));

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    const uploadBatch = async (batch: File[], folder: string) => {
      const results = await Promise.allSettled(
        batch.map(file => {
          const safeName = file.name.toLowerCase().replace(/\s+/g, '-');
          const path = folder ? `${folder}/${safeName}` : safeName;
          return supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled' && !r.value.error) successCount++;
        else errorCount++;
      });
    };

    // Upload in batches of 5
    for (let i = 0; i < rasterFiles.length; i += 5) {
      await uploadBatch(rasterFiles.slice(i, i + 5), '');
    }
    for (let i = 0; i < svgFiles.length; i += 5) {
      await uploadBatch(svgFiles.slice(i, i + 5), 'svg');
    }

    setUploading(false);
    const svgCount = svgFiles.length;
    const rasterCount = rasterFiles.length;
    if (successCount > 0) {
      const parts: string[] = [];
      if (rasterCount > 0) parts.push(`${Math.min(rasterCount, successCount)} Bild-Logo(s)`);
      if (svgCount > 0) parts.push(`${Math.min(svgCount, successCount)} SVG(s)`);
      toast.success(`${parts.join(' + ')} hochgeladen`);
    }
    if (errorCount > 0) toast.error(`${errorCount} Fehler beim Upload`);
    loadAll();
  };

  const deleteFile = async (folder: string, name: string) => {
    const path = folder ? `${folder}/${name}` : name;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) toast.error('Fehler: ' + error.message);
    else {
      toast.success('Gelöscht');
      if (folder === 'svg') setSvgs(prev => prev.filter(l => l.name !== name));
      else setLogos(prev => prev.filter(l => l.name !== name));
    }
  };

  const deleteAll = async () => {
    if (!confirm('Wirklich ALLE Logos löschen? Dies kann nicht rückgängig gemacht werden.')) return;
    setUploading(true);
    const allFiles = [
      ...logos.map(l => l.name),
      ...svgs.map(l => `svg/${l.name}`),
    ];
    // Delete in batches of 20
    for (let i = 0; i < allFiles.length; i += 20) {
      await supabase.storage.from(BUCKET).remove(allFiles.slice(i, i + 20));
    }
    setLogos([]);
    setSvgs([]);
    setUploading(false);
    toast.success(`${allFiles.length} Datei(en) gelöscht`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const renderGrid = (items: LogoFile[], folder: string) => {
    if (loading) return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
    if (items.length === 0) return (
      <p className="text-sm text-muted-foreground text-center py-12">Noch keine Dateien vorhanden.</p>
    );
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {items.map(logo => (
          <div key={logo.name} className="group relative bg-card border border-border rounded-lg p-3 flex flex-col items-center gap-2">
            <img src={logo.url} alt={logo.name} className="w-14 h-14 object-contain" loading="lazy" />
            <span className="text-[10px] text-muted-foreground truncate w-full text-center" title={logo.name}>
              {logo.name.replace(/\.[^.]+$/, '')}
            </span>
            <button
              onClick={() => deleteFile(folder, logo.name)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Hersteller-Logos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {logos.length} Bild-Logo(s), {svgs.length} SVG(s). SVGs werden automatisch in den SVG-Ordner sortiert.
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
          dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground/40 bg-muted/20'
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
              SVG → automatisch in SVG-Ordner · PNG/WebP → Hersteller-Logos
            </p>
          </div>
        )}
      </div>

      {/* Tabs for Logos vs SVGs */}
      <Tabs defaultValue="logos">
        <TabsList>
          <TabsTrigger value="logos" className="gap-1.5">
            <Image className="w-3.5 h-3.5" /> Bild-Logos ({logos.length})
          </TabsTrigger>
          <TabsTrigger value="svgs" className="gap-1.5">
            <FileCode className="w-3.5 h-3.5" /> SVGs ({svgs.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="logos" className="mt-4">
          {renderGrid(logos, '')}
        </TabsContent>
        <TabsContent value="svgs" className="mt-4">
          {renderGrid(svgs, 'svg')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
