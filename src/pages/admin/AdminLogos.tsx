import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Trash2, Image, Loader2, FileCode, Search, Check, X, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';

interface LogoFile {
  name: string;
  url: string;
  folder: string;
}

const BUCKET = 'manufacturer-logos';

export default function AdminLogos() {
  const [logos, setLogos] = useState<LogoFile[]>([]);
  const [svgs, setSvgs] = useState<LogoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [activeTab, setActiveTab] = useState('brands');
  const { makes, loading: makesLoading } = useVehicleMakes();

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

  // Match a brand key to a logo
  const getLogoForBrand = useCallback((brandKey: string): LogoFile | null => {
    const normalized = brandKey.toLowerCase().replace(/[-_\s]+/g, '');
    const allLogos = [...logos, ...svgs];
    const exact = allLogos.find(l => l.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[-_\s]+/g, '') === normalized);
    if (exact) return exact;
    const partial = allLogos.find(l => {
      const ln = l.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[-_\s]+/g, '');
      return ln.includes(normalized) || normalized.includes(ln);
    });
    return partial || null;
  }, [logos, svgs]);

  // Brands with/without logos
  const brandsWithLogos = useMemo(() => {
    const q = brandSearch.toLowerCase();
    return makes
      .filter(m => !q || m.key.toLowerCase().includes(q))
      .map(m => ({
        key: m.key,
        modelCount: m.models.filter(mod => mod.key !== 'ANDERE').length,
        logo: getLogoForBrand(m.key),
      }));
  }, [makes, brandSearch, getLogoForBrand]);

  const missingCount = useMemo(() => brandsWithLogos.filter(b => !b.logo).length, [brandsWithLogos]);
  const coveredCount = useMemo(() => brandsWithLogos.filter(b => b.logo).length, [brandsWithLogos]);

  const uploadFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.name.endsWith('.svg')
    );
    if (imageFiles.length === 0) { toast.error('Keine Bilddateien gefunden.'); return; }

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

    for (let i = 0; i < rasterFiles.length; i += 5) await uploadBatch(rasterFiles.slice(i, i + 5), '');
    for (let i = 0; i < svgFiles.length; i += 5) await uploadBatch(svgFiles.slice(i, i + 5), 'svg');

    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} Logo(s) hochgeladen`);
    if (errorCount > 0) toast.error(`${errorCount} Fehler beim Upload`);
    loadAll();
  };

  const uploadForBrand = async (brandKey: string, file: File) => {
    const isSvg = file.name.toLowerCase().endsWith('.svg');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeName = brandKey.toLowerCase().replace(/\s+/g, '-') + '.' + ext;
    const folder = isSvg ? 'svg' : '';
    const path = folder ? `${folder}/${safeName}` : safeName;

    setUploading(true);
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    setUploading(false);

    if (error) toast.error('Fehler: ' + error.message);
    else {
      toast.success(`Logo für ${brandKey} hochgeladen`);
      loadAll();
    }
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
    if (!confirm('Wirklich ALLE Logos löschen?')) return;
    setUploading(true);
    const allFiles = [...logos.map(l => l.name), ...svgs.map(l => `svg/${l.name}`)];
    for (let i = 0; i < allFiles.length; i += 20) {
      await supabase.storage.from(BUCKET).remove(allFiles.slice(i, i + 20));
    }
    setLogos([]); setSvgs([]);
    setUploading(false);
    toast.success(`${allFiles.length} Datei(en) gelöscht`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Hersteller-Logos & Marken</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {makes.length} Marken · {coveredCount} mit Logo · {missingCount} ohne Logo · {logos.length + svgs.length} Dateien gesamt
          </p>
        </div>
        <div className="flex gap-2">
          {(logos.length > 0 || svgs.length > 0) && (
            <Button variant="destructive" size="sm" disabled={uploading} onClick={deleteAll} className="gap-2">
              <Trash2 className="w-4 h-4" /> Alle löschen
            </Button>
          )}
          <label className="cursor-pointer">
            <Button disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Logos hochladen
            </Button>
            <input type="file" accept="image/*,.svg" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
            />
          </label>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground/40 bg-muted/20'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-muted-foreground">Logos werden hochgeladen...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Image className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Logo-Dateien hierher ziehen</p>
            <p className="text-xs text-muted-foreground/60">SVG → SVG-Ordner · PNG/WebP → Bild-Logos</p>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="brands" className="gap-1.5">
            Marken-Übersicht ({makes.length})
          </TabsTrigger>
          <TabsTrigger value="logos" className="gap-1.5">
            <Image className="w-3.5 h-3.5" /> Bild-Logos ({logos.length})
          </TabsTrigger>
          <TabsTrigger value="svgs" className="gap-1.5">
            <FileCode className="w-3.5 h-3.5" /> SVGs ({svgs.length})
          </TabsTrigger>
        </TabsList>

        {/* Brands Overview Tab */}
        <TabsContent value="brands" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={brandSearch}
                onChange={e => setBrandSearch(e.target.value)}
                placeholder="Marke suchen..."
                className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {brandSearch && (
                <button onClick={() => setBrandSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            {missingCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-orange-500">
                <AlertCircle className="w-3.5 h-3.5" />
                {missingCount} Marken ohne Logo
              </div>
            )}
          </div>

          {makesLoading || loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {brandsWithLogos.map(({ key, modelCount, logo }) => (
                <div key={key} className={`relative group bg-card border rounded-lg p-3 flex flex-col items-center gap-2 ${
                  logo ? 'border-border' : 'border-orange-500/30 bg-orange-500/5'
                }`}>
                  {logo ? (
                    <img src={logo.url} alt={key} className="w-10 h-10 object-contain" loading="lazy" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground">{key.charAt(0)}</span>
                    </div>
                  )}
                  <span className="text-[10px] font-medium text-foreground truncate w-full text-center" title={key}>
                    {key}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{modelCount} Modelle</span>

                  {/* Status indicator */}
                  <div className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                    logo ? 'bg-green-500/20' : 'bg-orange-500/20'
                  }`}>
                    {logo ? <Check className="w-2.5 h-2.5 text-green-600" /> : <AlertCircle className="w-2.5 h-2.5 text-orange-500" />}
                  </div>

                  {/* Upload button for missing logos */}
                  {!logo && (
                    <label className="cursor-pointer">
                      <button className="text-[9px] text-accent hover:underline" onClick={e => {
                        e.preventDefault();
                        (e.currentTarget.nextElementSibling as HTMLInputElement)?.click();
                      }}>
                        Logo hochladen
                      </button>
                      <input type="file" accept="image/*,.svg" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) uploadForBrand(key, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}

                  {/* Delete button for existing logos */}
                  {logo && (
                    <button
                      onClick={() => deleteFile(logo.folder, logo.name)}
                      className="absolute top-1 left-1 w-4 h-4 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Raw Logo Files Tabs */}
        <TabsContent value="logos" className="mt-4">
          <LogoGrid items={logos} folder="" loading={loading} onDelete={deleteFile} />
        </TabsContent>
        <TabsContent value="svgs" className="mt-4">
          <LogoGrid items={svgs} folder="svg" loading={loading} onDelete={deleteFile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogoGrid({ items, folder, loading, onDelete }: {
  items: LogoFile[]; folder: string; loading: boolean;
  onDelete: (folder: string, name: string) => void;
}) {
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
            onClick={() => onDelete(folder, logo.name)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
