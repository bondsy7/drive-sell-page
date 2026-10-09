import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FolderOpen, Upload, Trash2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ImagePreviewLightbox from '@/components/ImagePreviewLightbox';

interface Props {
  vehicleId: string;
}

interface OriginalFile {
  name: string;
  url: string;
  created_at: string;
  fullPath: string;
}

export default function OriginalsTab({ vehicleId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);


  const prefix = user ? `${user.id}/${vehicleId}` : '';

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['originals', user?.id, vehicleId],
    enabled: !!user && !!vehicleId,
    queryFn: async (): Promise<OriginalFile[]> => {
      const bucket = supabase.storage.from('originals');
      const { data } = await bucket
        .list(prefix, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });

      const topLevel = (data || []).filter(f => f.name && !f.name.startsWith('.') && f.id);

      // Detailaufnahmen liegen verschachtelt unter reference-v2/<workspace>/<assetKey>/original.*
      const detailPaths: string[] = [];
      const { data: workspaces } = await bucket.list(`${prefix}/reference-v2`, { limit: 200 });
      for (const ws of (workspaces || []).filter(w => w.name && !w.id)) {
        const { data: assets } = await bucket.list(`${prefix}/reference-v2/${ws.name}`, { limit: 200 });
        for (const asset of (assets || []).filter(a => a.name && !a.id)) {
          const { data: files } = await bucket.list(`${prefix}/reference-v2/${ws.name}/${asset.name}`, { limit: 50 });
          for (const file of (files || []).filter(f => f.id && f.name.startsWith('original.'))) {
            detailPaths.push(`${prefix}/reference-v2/${ws.name}/${asset.name}/${file.name}`);
          }
        }
      }

      const allEntries = [
        ...topLevel.map(f => ({ path: `${prefix}/${f.name}`, created_at: f.created_at || '' })),
        ...detailPaths.map(p => ({ path: p, created_at: '' })),
      ];

      return await Promise.all(
        allEntries.map(async ({ path: fullPath, created_at }) => {
          const { data: signed } = await bucket.createSignedUrl(fullPath, 60 * 60);
          const isDetail = fullPath.includes('/reference-v2/');
          const assetKey = isDetail ? fullPath.split('/').slice(-2, -1)[0] : '';
          return {
            name: isDetail ? `Detail: ${assetKey}` : fullPath.split('/').pop() || fullPath,
            url: signed?.signedUrl || '',
            created_at,
            fullPath,
          };
        }),
      );
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['originals', user?.id, vehicleId] });
  const previewImages = files.filter(f => f.url).map(f => ({ id: f.name, src: f.url, label: f.name }));

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !user) return;
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const file of arr) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${prefix}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from('originals')
        .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
      if (error) fail++; else ok++;
    }
    setUploading(false);
    if (ok) toast.success(`${ok} Original(e) hochgeladen`);
    if (fail) toast.error(`${fail} Upload(s) fehlgeschlagen`);
    if (inputRef.current) inputRef.current.value = '';
    refresh();
  };

  const handleDelete = async (file: OriginalFile) => {
    if (!confirm(`"${file.name}" wirklich löschen?`)) return;
    setDeleting(file.name);
    const { error } = await supabase.storage.from('originals').remove([file.fullPath]);
    setDeleting(null);
    if (error) toast.error(`Löschen fehlgeschlagen: ${error.message}`);
    else {
      toast.success('Original gelöscht');
      refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Roh-Fotos vom Fahrzeug-Eingang. Privat – nur du siehst sie.
        </p>
        <Button onClick={() => inputRef.current?.click()} disabled={uploading} size="sm">
          {uploading
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Lade hoch…</>
            : <><Upload className="w-4 h-4 mr-1.5" /> Originale hochladen</>}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 px-4 border-2 border-dashed border-border rounded-lg">
          <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Noch keine Originale</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Lade hier die Roh-Fotos vom Fahrzeug-Eingang hoch. Sie bleiben als Referenz für
            spätere Generierungen erhalten.
          </p>
          <Button onClick={() => inputRef.current?.click()} variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-1.5" />
            Erstes Foto hochladen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map(f => (
            <Card key={f.name} className="overflow-hidden group relative">
              <Button
                variant="ghost"
                className="block h-auto w-full aspect-square rounded-none bg-muted p-0 cursor-zoom-in overflow-hidden"
                disabled={!f.url}
                aria-label={`Originalbild vergrößern: ${f.name}`}
                onClick={() => setPreviewIndex(previewImages.findIndex(image => image.id === f.name))}
              >
                {f.url && <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />}
              </Button>
              <div className="p-2">
                <p className="text-xs text-foreground truncate" title={f.name}>{f.name}</p>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1.5 right-1.5 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={deleting === f.name}
                onClick={() => handleDelete(f)}
                aria-label="Löschen"
              >
                {deleting === f.name
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </Card>
          ))}
        </div>
      )}
      {previewIndex !== null && (
        <ImagePreviewLightbox
          key={vehicleId}
          images={previewImages}
          initialIndex={previewIndex}
          open
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
