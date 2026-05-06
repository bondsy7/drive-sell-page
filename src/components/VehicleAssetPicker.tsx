import React, { useMemo, useState, useEffect } from 'react';
import { Check, X, ImageIcon, Layers, RotateCw, LayoutGrid, Video, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useVehicleAssets, type AssetKind, type VehicleAsset } from '@/hooks/useVehicleAssets';

interface Props {
  open: boolean;
  vehicleId: string | null | undefined;
  /** Restrict pickable kinds (e.g. video generator allows banner+gallery only). */
  allowedKinds?: AssetKind[];
  /** Allow multi-select. Default: true. */
  multi?: boolean;
  /** Title for dialog (context-dependent). */
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (assets: VehicleAsset[]) => void;
}

const KIND_META: Record<AssetKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  original: { label: 'Originale', icon: ImageIcon },
  gallery:  { label: 'Galerie',   icon: Layers },
  spin360:  { label: '360°',      icon: RotateCw },
  banner:   { label: 'Banner',    icon: LayoutGrid },
  video:    { label: 'Videos',    icon: Video },
};

const ALL_KINDS: AssetKind[] = ['original', 'gallery', 'spin360', 'banner', 'video'];

const VehicleAssetPicker: React.FC<Props> = ({
  open, vehicleId, allowedKinds, multi = true, title, description, onCancel, onConfirm,
}) => {
  const { data: bundle, isLoading } = useVehicleAssets(vehicleId);

  const kinds = useMemo(
    () => ALL_KINDS.filter(k => !allowedKinds || allowedKinds.includes(k)),
    [allowedKinds],
  );

  const counts = useMemo(() => {
    const c: Record<AssetKind, number> = { original: 0, gallery: 0, spin360: 0, banner: 0, video: 0 };
    if (bundle) {
      c.original = bundle.original.length;
      c.gallery = bundle.gallery.length;
      c.spin360 = bundle.spin360.length;
      c.banner = bundle.banner.length;
      c.video = bundle.video.length;
    }
    return c;
  }, [bundle]);

  const firstNonEmpty = useMemo(
    () => kinds.find(k => counts[k] > 0) || kinds[0],
    [kinds, counts],
  );

  const [tab, setTab] = useState<AssetKind>(firstNonEmpty);
  const [selected, setSelected] = useState<Map<string, VehicleAsset>>(new Map());

  useEffect(() => { if (open) { setTab(firstNonEmpty); setSelected(new Map()); } }, [open, firstNonEmpty]);

  const toggle = (a: VehicleAsset) => {
    setSelected(prev => {
      const n = new Map(prev);
      if (n.has(a.id)) n.delete(a.id);
      else {
        if (!multi) n.clear();
        n.set(a.id, a);
      }
      return n;
    });
  };

  const list = (k: AssetKind): VehicleAsset[] => {
    if (!bundle) return [];
    return k === 'original' ? bundle.original
         : k === 'gallery' ? bundle.gallery
         : k === 'spin360' ? bundle.spin360
         : k === 'banner' ? bundle.banner
         : bundle.video;
  };

  const renderGrid = (assets: VehicleAsset[]) => {
    // Group by .group when present (gallery folders, spin jobs)
    const groups = assets.reduce<Record<string, VehicleAsset[]>>((acc, a) => {
      const g = a.group || '';
      (acc[g] ||= []).push(a);
      return acc;
    }, {});
    const groupKeys = Object.keys(groups);

    return (
      <div className="space-y-5">
        {groupKeys.map(g => (
          <div key={g || 'default'}>
            {g && <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{g}</h4>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {groups[g].map(a => {
                const isSel = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all bg-muted ${
                      isSel ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {a.kind === 'video' ? (
                      <video src={a.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={a.url} alt={a.label || ''} className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {isSel && (
                      <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {a.label && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <p className="text-[10px] text-white truncate">{a.label}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || 'Vorhandene Assets verwenden'}</DialogTitle>
          <DialogDescription>
            {description || 'Wähle Bilder, Banner oder Videos aus diesem Fahrzeug, die als Grundlage dienen sollen.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Assets …
          </div>
        ) : bundle && bundle.total === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            Für dieses Fahrzeug sind noch keine Assets vorhanden.
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as AssetKind)}>
            <TabsList className="flex flex-wrap h-auto">
              {kinds.map(k => {
                const Meta = KIND_META[k];
                const Icon = Meta.icon;
                return (
                  <TabsTrigger key={k} value={k} disabled={counts[k] === 0} className="gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {Meta.label}
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">{counts[k]}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {kinds.map(k => (
              <TabsContent key={k} value={k} className="mt-4">
                {counts[k] === 0
                  ? <p className="text-sm text-muted-foreground py-6 text-center">Keine Einträge.</p>
                  : renderGrid(list(k))}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter className="gap-2 mt-4">
          <p className="text-sm text-muted-foreground mr-auto">{selected.size} ausgewählt</p>
          <Button variant="ghost" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" /> Abbrechen
          </Button>
          <Button onClick={() => onConfirm(Array.from(selected.values()))} disabled={selected.size === 0}>
            <Check className="w-4 h-4 mr-1" />
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleAssetPicker;
