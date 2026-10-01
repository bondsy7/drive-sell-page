import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Eye, Globe, Loader2, RotateCcw, Star, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVehicleAssets } from '@/hooks/useVehicleAssets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AUTO3_SOURCE, DEFAULT_TARGET, buildSnapshot, importExternalVehicle, isPublishableUrl, isRealVin, publicationStatusLabel,
  type CoverMode, type GalleryMode, type PublicationItem, type WebsitePublication,
} from '@/lib/website-publishing';

interface ExtVehicle {
  id: string;
  vin: string;
  source_system?: string | null;
  external_vehicle_id?: string | null;
  external_internal_number?: string | null;
  external_images?: { url: string; sortOrder: number }[] | null;
}

export default function WebsitePublishingTab({ vehicle }: { vehicle: ExtVehicle }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const target = DEFAULT_TARGET;
  const { data: assets } = useVehicleAssets(vehicle.id);

  const { data: pub, isLoading } = useQuery({
    queryKey: ['website-publication', vehicle.id, target],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('website_publications').select('*')
        .eq('vehicle_id', vehicle.id).eq('target', target).maybeSingle();
      if (error) throw error;
      return (data as unknown as WebsitePublication) || null;
    },
  });

  const [coverMode, setCoverMode] = useState<CoverMode>('auto3');
  const [galleryMode, setGalleryMode] = useState<GalleryMode>('auto3');
  const [coverId, setCoverId] = useState<string | null>(null);
  const [items, setItems] = useState<PublicationItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pub) return;
    setCoverMode(pub.cover_mode);
    setGalleryMode(pub.gallery_mode);
    setCoverId(pub.cover_asset_id);
    setItems(pub.draft_items || []);
  }, [pub]);

  const aiAssets = useMemo(
    () => (assets?.gallery || []).filter((a) => isPublishableUrl(a.url)),
    [assets],
  );
  const auto3Images = vehicle.external_images || [];
  const coverUrl = aiAssets.find((a) => a.id === coverId)?.url || items.find((i) => i.assetId === coverId)?.url || null;

  // Import form
  const [extId, setExtId] = useState(vehicle.external_vehicle_id || '');
  const [intNo, setIntNo] = useState(vehicle.external_internal_number || '');
  const [urls, setUrls] = useState(auto3Images.map((i) => i.url).join('\n'));
  const linked = !!vehicle.external_vehicle_id && vehicle.source_system === AUTO3_SOURCE;

  const saveLink = async () => {
    if (!user) return;
    try {
      await importExternalVehicle(user.id, {
        externalVehicleId: extId, vin: vehicle.vin, internalNumber: intNo,
        imageUrls: urls.split(/\s+/),
      });
      toast.success('Auto3-Zuordnung gespeichert');
      qc.invalidateQueries({ queryKey: ['vehicle', vehicle.id] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggle = (assetId: string, url: string) => {
    setItems((prev) => prev.some((p) => p.assetId === assetId)
      ? prev.filter((p) => p.assetId !== assetId).map((p, i) => ({ ...p, sortOrder: i }))
      : [...prev, { assetId, url, sortOrder: prev.length }]);
  };
  const move = (idx: number, dir: -1 | 1) => setItems((prev) => {
    const arr = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return prev;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return arr.map((p, i) => ({ ...p, sortOrder: i }));
  });

  const persist = async (opts: { publish: boolean; cover?: CoverMode; gallery?: GalleryMode; status?: 'disabled' }) => {
    if (!user || !vehicle.external_vehicle_id) { toast.error('Bitte zuerst die Auto3-ID zuordnen.'); return; }
    const cm = opts.cover ?? coverMode; const gm = opts.gallery ?? galleryMode;
    if (opts.publish && cm === 'ai' && !coverUrl) { toast.error('Bitte ein AI-Bild als Cover markieren.'); return; }
    if (opts.publish && gm !== 'auto3' && items.length === 0) { toast.error('Bitte mindestens ein Bild für die Galerie auswählen.'); return; }
    setSaving(true);
    const row: Record<string, unknown> = {
      user_id: user.id, vehicle_id: vehicle.id, target, source_system: AUTO3_SOURCE,
      external_vehicle_id: vehicle.external_vehicle_id, cover_mode: cm, gallery_mode: gm,
      cover_asset_id: coverId, draft_items: items,
    };
    if (opts.status === 'disabled') row.status = 'disabled';
    else if (opts.publish) {
      row.status = 'live';
      row.live_snapshot = buildSnapshot({ coverMode: cm, galleryMode: gm, coverUrl, items });
      row.published_at = new Date().toISOString();
    } else if (!pub) row.status = 'draft';
    const { error } = await supabase.from('website_publications').upsert([row as never], { onConflict: 'vehicle_id,target' });
    setSaving(false);
    if (error) { toast.error(`Speichern fehlgeschlagen: ${error.message}`); return; }
    if (opts.cover) setCoverMode(opts.cover);
    if (opts.gallery) setGalleryMode(opts.gallery);
    toast.success(opts.status === 'disabled' ? 'Website-Veröffentlichung deaktiviert' : opts.publish ? 'Änderungen veröffentlicht' : 'Entwurf gespeichert');
    qc.invalidateQueries({ queryKey: ['website-publication', vehicle.id, target] });
    qc.invalidateQueries({ queryKey: ['website-publications'] });
  };

  const preview = buildSnapshot({ coverMode, galleryMode, coverUrl, items });
  const previewCover = preview.coverImageUrl || auto3Images[0]?.url || null;
  const previewGallery = galleryMode === 'auto3' ? auto3Images.map((i) => i.url)
    : galleryMode === 'append' ? [...preview.images.map((i) => i.url), ...auto3Images.map((i) => i.url)]
    : preview.images.map((i) => i.url);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;
  if (!isRealVin(vehicle.vin)) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Dieses Fahrzeug hat keine gültige VIN. Ohne VIN findet keine Auto3-Zuordnung und keine Website-Veröffentlichung statt.
        Bitte zuerst unter „Daten“ die echte VIN eintragen.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="w-4 h-4 text-accent" />
          <h3 className="font-semibold">Website-Veröffentlichung · Auto Schmitt</h3>
          <Badge variant="secondary">{publicationStatusLabel(pub)}</Badge>
          <Badge variant={pub?.status === 'live' ? 'default' : 'outline'}>
            {pub?.status === 'live' ? 'Live' : pub?.status === 'disabled' ? 'Deaktiviert' : 'Entwurf'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Generierte Bilder werden nie automatisch veröffentlicht. Erst „Änderungen veröffentlichen“ macht sie auf der Website sichtbar.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div><span className="text-muted-foreground">Quelle:</span> {linked ? 'Auto3' : '—'}</div>
          <div><span className="text-muted-foreground">Auto3-ID:</span> <span className="font-mono">{vehicle.external_vehicle_id || '—'}</span></div>
          <div><span className="text-muted-foreground">VIN (intern):</span> <span className="font-mono">{vehicle.vin.startsWith('AUTO3-') ? '—' : vehicle.vin}</span></div>
        </div>
      </section>

      <details className="rounded-lg border border-border bg-card p-4 space-y-3">
        <summary className="font-medium text-sm cursor-pointer">Manuelle Auto3-Zuordnung (Fallback) – Hauptweg: Profil → Auto3 Fahrzeugbestand</summary>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Auto3-Fahrzeug-ID" value={extId} onChange={(e) => setExtId(e.target.value)} />
          <Input placeholder="Interne Nummer (optional)" value={intNo} onChange={(e) => setIntNo(e.target.value)} />
        </div>
        <Textarea rows={3} placeholder="Auto3-Originalbild-URLs (eine pro Zeile, erstes = Titelbild)" value={urls} onChange={(e) => setUrls(e.target.value)} />
        <Button size="sm" variant="outline" onClick={saveLink} disabled={!extId.trim()}>Zuordnung speichern</Button>
      </details>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div>
          <h4 className="font-medium text-sm mb-2">Cover</h4>
          <div className="flex gap-2">
            <Button size="sm" variant={coverMode === 'auto3' ? 'default' : 'outline'} onClick={() => setCoverMode('auto3')}>Auto3-Titelbild</Button>
            <Button size="sm" variant={coverMode === 'ai' ? 'default' : 'outline'} onClick={() => setCoverMode('ai')}>AI-Bild</Button>
          </div>
        </div>
        <div>
          <h4 className="font-medium text-sm mb-2">Galerie</h4>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={galleryMode === 'auto3' ? 'default' : 'outline'} onClick={() => setGalleryMode('auto3')}>Auto3 unverändert</Button>
            <Button size="sm" variant={galleryMode === 'append' ? 'default' : 'outline'} onClick={() => setGalleryMode('append')}>AI + Auto3</Button>
            <Button size="sm" variant={galleryMode === 'replace' ? 'default' : 'outline'} onClick={() => setGalleryMode('replace')}>Nur AI</Button>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-sm mb-2">Freigebbare AI-Bilder ({aiAssets.length})</h4>
          {aiAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch keine aufbereiteten Bilder mit öffentlicher Adresse vorhanden.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {aiAssets.map((a) => {
                const selected = items.some((i) => i.assetId === a.id);
                const isCover = coverId === a.id;
                return (
                  <div key={a.id} className={`relative rounded-md overflow-hidden border-2 ${selected ? 'border-accent' : 'border-transparent'}`}>
                    <button type="button" onClick={() => toggle(a.id, a.url)} className="block w-full">
                      <img src={a.url} alt={a.label || ''} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    </button>
                    <button type="button" title="Als Cover markieren" onClick={() => { setCoverId(a.id); setCoverMode('ai'); }}
                      className={`absolute top-1 right-1 rounded-full p-1 bg-card/90 ${isCover ? 'text-accent' : 'text-muted-foreground'}`}>
                      <Star className="w-3.5 h-3.5" fill={isCover ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">Klick = für Galerie auswählen · Stern = Cover. Private Originale werden nicht veröffentlicht.</p>
        </div>

        {sorted.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">Reihenfolge</h4>
            <ol className="space-y-1">
              {sorted.map((it, i) => (
                <li key={it.assetId} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-muted-foreground">{i + 1}.</span>
                  <img src={it.url} alt="" className="w-14 h-10 object-cover rounded" />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-1.5"><Eye className="w-4 h-4" /> Vorschau Website</h4>
        <div className="grid gap-3 sm:grid-cols-[2fr_3fr]">
          <div className="aspect-[4/3] bg-muted rounded-md overflow-hidden">
            {previewCover ? <img src={previewCover} alt="Cover" className="w-full h-full object-cover" /> : <div className="p-4 text-xs text-muted-foreground">Auto3-Titelbild</div>}
          </div>
          <div className="grid grid-cols-4 gap-1.5 content-start">
            {previewGallery.slice(0, 12).map((u, i) => <img key={`${u}-${i}`} src={u} alt="" className="aspect-[4/3] w-full object-cover rounded" />)}
            {previewGallery.length === 0 && <p className="col-span-4 text-xs text-muted-foreground">Galerie aus Auto3 (unverändert).</p>}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => persist({ publish: true })} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Änderungen veröffentlichen
        </Button>
        <Button variant="outline" onClick={() => persist({ publish: false })} disabled={saving}>Entwurf speichern</Button>
        <Button variant="outline" onClick={() => persist({ publish: true, cover: 'auto3', gallery: 'auto3' })} disabled={saving}>
          <RotateCcw className="w-4 h-4 mr-1.5" /> Auto3-Bilder verwenden
        </Button>
        {pub?.status === 'live' && (
          <Button variant="ghost" onClick={() => persist({ publish: false, status: 'disabled' })} disabled={saving}>
            <Power className="w-4 h-4 mr-1.5" /> Veröffentlichung deaktivieren
          </Button>
        )}
      </div>
    </div>
  );
}
