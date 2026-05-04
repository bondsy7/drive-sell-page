import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FolderOpen, Upload, Trash2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  vehicleId: string;
}

interface OriginalFile {
  name: string;
  url: string;
  created_at: string;
}

export default function OriginalsTab({ vehicleId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const prefix = user ? `${user.id}/${vehicleId}` : '';

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['originals', user?.id, vehicleId],
    enabled: !!user && !!vehicleId,
    queryFn: async (): Promise<OriginalFile[]> => {
      const { data } = await supabase.storage
        .from('originals')
        .list(prefix, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });
      return await Promise.all(
        (data || [])
          .filter(f => f.name && !f.name.startsWith('.'))
          .map(async f => {
            const fullPath = `${prefix}/${f.name}`;
            const { data: signed } = await supabase.storage
              .from('originals')
              .createSignedUrl(fullPath, 60 * 60);
            return {
              name: f.name,
              url: signed?.signedUrl || '',
              created_at: f.created_at || '',
            };
          }),
      );
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['originals', user?.id, vehicleId] });

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

  const handleDelete = async (name: string) => {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    setDeleting(name);
    const { error } = await supabase.storage.from('originals').remove([`${prefix}/${name}`]);
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
              <div className="aspect-square bg-muted">
                {f.url && <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="p-2">
                <p className="text-xs text-foreground truncate" title={f.name}>{f.name}</p>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1.5 right-1.5 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={deleting === f.name}
                onClick={() => handleDelete(f.name)}
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
    </div>
  );
}
