import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useVehicles } from '@/hooks/useVehicles';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Car, FileText, Image as ImageIcon, RotateCw, MessageSquare, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VehiclesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: vehicles = [], isLoading } = useVehicles();
  const [reclaiming, setReclaiming] = useState(false);

  const reclaimOrphans = async () => {
    if (!user) return;
    setReclaiming(true);
    try {
      // Map VIN -> vehicle.id for this user
      const map = new Map<string, string>();
      for (const v of vehicles) if (v.vin) map.set(v.vin.trim().toUpperCase(), v.id);

      const { data: orphans } = await supabase
        .from('project_images')
        .select('id, gallery_folder')
        .eq('user_id', user.id)
        .is('vehicle_id', null)
        .not('gallery_folder', 'is', null);

      let linked = 0;
      for (const row of orphans || []) {
        const key = (row.gallery_folder || '').trim().toUpperCase();
        const vid = map.get(key);
        if (!vid) continue;
        const { error } = await supabase
          .from('project_images')
          .update({ vehicle_id: vid })
          .eq('id', row.id);
        if (!error) linked++;
      }

      if (linked > 0) {
        toast.success(`${linked} Bild(er) einem Fahrzeug zugeordnet`);
        qc.invalidateQueries({ queryKey: ['vehicles'] });
      } else {
        toast.info('Keine zuordenbaren Bilder gefunden');
      }
    } catch (e) {
      toast.error(`Fehler: ${(e as Error).message}`);
    } finally {
      setReclaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Noch keine Fahrzeuge</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Sobald du ein PDF hochlädst oder eine VIN scannst, erscheint dein Fahrzeug hier mit
          allen Bildern, Landing Pages, Bannern und Anfragen an einem Ort.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={reclaimOrphans} disabled={reclaiming} variant="outline" size="sm">
          {reclaiming
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Verknüpfe…</>
            : <><Link2 className="w-4 h-4 mr-1.5" /> Verwaiste Bilder per VIN zuordnen</>}
        </Button>
      </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {vehicles.map(v => {
        const title =
          v.title ||
          [v.brand, v.model, v.year].filter(Boolean).join(' ') ||
          v.vin;
        const cover = v.cover_image_url;

        return (
          <Link key={v.id} to={`/vehicle/${v.id}`} className="block group">
            <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
              <div className="aspect-video bg-muted relative">
                {cover ? (
                  <img
                    src={cover}
                    alt={title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                )}
                {v.color && (
                  <Badge variant="secondary" className="absolute top-2 right-2">
                    {v.color}
                  </Badge>
                )}
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                    {title}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {v.vin}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  <CountBadge icon={FileText} value={v.counts.projects} label="LPs" />
                  <CountBadge icon={ImageIcon} value={v.counts.images} label="Bilder" />
                  <CountBadge icon={RotateCw} value={v.counts.spin360} label="360°" />
                  <CountBadge icon={MessageSquare} value={v.counts.leads} label="Leads" />
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
    </div>
  );
}

function CountBadge({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 py-1.5 rounded-md ${
        value > 0 ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="font-semibold leading-none">{value}</span>
      <span className="text-[10px] leading-none">{label}</span>
    </div>
  );
}
