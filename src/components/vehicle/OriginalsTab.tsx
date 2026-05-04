import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FolderOpen, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';

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

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['originals', user?.id, vehicleId],
    enabled: !!user && !!vehicleId,
    queryFn: async (): Promise<OriginalFile[]> => {
      const prefix = `${user!.id}/${vehicleId}`;
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-16 px-4 border-2 border-dashed border-border rounded-lg">
        <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-foreground mb-1">Keine Originale</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Lade hier die Roh-Fotos vom Fahrzeug-Eingang hoch. Sie bleiben als Referenz für
          spätere Generierungen erhalten.
        </p>
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Upload className="w-3 h-3" />
          Upload-Funktion folgt
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {files.map(f => (
        <Card key={f.name} className="overflow-hidden">
          <div className="aspect-square bg-muted">
            {f.url && <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />}
          </div>
          <div className="p-2">
            <p className="text-xs text-foreground truncate">{f.name}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
