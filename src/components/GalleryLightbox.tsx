import { resolveStoredNb21Version } from '@/lib/nb21-version-dispatch';
import { invokeNb21V3 } from '@/lib/nb21-v3-invoke';
import { v3ResultMetadata, resolveV3Evidence, type V3RetryReason } from '@/prompts/nb21/v3';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { originalSlotFromFilename, type V2Reference } from '@/prompts/nb21/v2';
import { invokeNb21V2, v2ConfigSources } from '@/lib/nb21-v2-invoke';
import type { RegenerationContext } from '@/lib/regeneration-context';
import { resolveRegenerationSeed, buildMandatoryCorrection } from '@/lib/regeneration-seed';
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, RotateCcw, Loader2, Trash2, ImageIcon, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import AiDisclosureBadge from '@/components/AiDisclosureBadge';
import { withAiDisclosureAlt } from '@/lib/ai-disclosure';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import { useDeleteGalleryImage } from '@/hooks/useDashboardData';
import { ALL_PIPELINE_JOBS, injectLogoPlaceholder } from '@/lib/pipeline-jobs';
import { buildMasterPrompt, fetchPromptOverrides } from '@/lib/remaster-prompt';
import { buildNb21PipelinePrompt, buildNb21RemasterPrompt, NB21_TIER } from '@/prompts/nb21';
import { ensureCachedBase64 } from '@/lib/image-base64-cache';
import { readRegenerationContext, restoreRemasterConfig, showroomUrlForScene, pickSeriesEnvironmentImage } from '@/lib/regeneration-context';
import { downloadMediaFile } from '@/lib/download-file';

interface LightboxImage {
  id: string;
  src: string;
  perspective?: string | null;
  project_id?: string;
}

interface GalleryLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onAssigned?: () => void;
  onRegenerated?: () => void;
  onDeleted?: () => void;
  vehicleId?: string;
}

const GalleryLightbox: React.FC<GalleryLightboxProps> = ({ images, initialIndex, open, onClose, onRegenerated, onDeleted, vehicleId }) => {
  const { user } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerTab, setPickerTab] = useState<'originals' | 'gallery'>('originals');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [retryReason, setRetryReason] = useState<V3RetryReason | undefined>();
  const [isV3Result, setIsV3Result] = useState(false);

  const deleteImage = useDeleteGalleryImage();

  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  const goPrev = () => setIndex(i => (i <= 0 ? images.length - 1 : i - 1));
  const goNext = () => setIndex(i => (i >= images.length - 1 ? 0 : i + 1));
  const swipeHandlers = useSwipeNavigation({
    enabled: open && images.length > 1,
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, images.length, onClose]);

  useEffect(() => {
    const id = images[index]?.id;
    if (!open || !id) return;
    let active = true;
    setRetryReason(undefined);
    supabase.from('project_images').select('generation_context').eq('id', id).maybeSingle().then(({data}) => {
      if (active) setIsV3Result((data?.generation_context as unknown as RegenerationContext | null)?.promptVersion === 'nb21-v3');
    });
    return () => { active = false; };
  }, [open, index, images]);

  // Load originals for this vehicle
  const prefix = user && vehicleId ? `${user.id}/${vehicleId}` : '';
  const { data: originals = [], isLoading: loadingOriginals } = useQuery({
    queryKey: ['originals-picker', user?.id, vehicleId],
    enabled: !!user && !!vehicleId && open,
    queryFn: async () => {
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
            return { name: f.name, url: signed?.signedUrl || '', assetId: fullPath };
          }),
      );
    },
  });

  const current = images[index];
  if (!open || !current) return null;

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadMediaFile(current.src, current.perspective || 'fahrzeugbild');
    } catch {
      toast.error('Das Bild konnte nicht heruntergeladen werden. Bitte erneut versuchen.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = () => {
    deleteImage.mutate(current.id, {
      onSuccess: () => {
        toast.success('Bild gelöscht');
        setConfirmDelete(false);
        if (images.length <= 1) onClose();
        else if (index >= images.length - 1) setIndex(0);
        onDeleted?.();
      },
      onError: () => {
        toast.error('Fehler beim Löschen');
        setConfirmDelete(false);
      },
    });
  };

  // Find matching pipeline job prompt based on perspective label
  // current.perspective looks like "Pipeline: Felge" or "Pipeline: Rücklicht (Regen)"
  const pipelineJob = (() => {
    const persp = current?.perspective || '';
    const match = persp.match(/Pipeline:\s*([^()]+?)(?:\s*\(.*\))?$/i);
    const label = match?.[1]?.trim();
    if (!label) return null;
    return ALL_PIPELINE_JOBS.find(j => j.labelDe.toLowerCase() === label.toLowerCase()) || null;
  })();

  const fetchAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const runRegenerate = async (referenceUrl: string | null) => {
    // REGEL: Das bereits generierte (ggf. fehlerhafte) KI-Bild ist NIE die Basis.
    // Basis = gewählte Referenz, sonst passendes Originalfoto der Fahrzeugakte.
    const seedUrl = resolveRegenerationSeed({
      selectedReferenceUrl: referenceUrl,
      currentGeneratedUrl: current.src,
      originals,
      jobKey: pipelineJob?.key,
      perspective: current.perspective || '',
    });
    setPickerOpen(false);
    setRegenerating(true);
    try {


      // Serien-Look wiederherstellen: Showroom, Look, Logo-/Kennzeichenregeln und Fahrzeugklasse
      // exakt wie beim ursprünglichen Lauf (Fallback: Händler-Showroom aus dem Profil).
      const [{ data: vRow }, { data: pRow }, overrides, { data: resultRow }] = await Promise.all([
        vehicleId
          ? supabase.from('vehicles').select('vehicle_data').eq('id', vehicleId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        user
          ? supabase.from('profiles').select('custom_showroom_url').eq('id', user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        fetchPromptOverrides().catch(() => ({} as Record<string, string>)),
        supabase.from('project_images').select('generation_context').eq('id', current.id).maybeSingle(),
      ]);
      const resultContext = resultRow?.generation_context as unknown as RegenerationContext | null;
      const vehicleContext = readRegenerationContext((vRow as any)?.vehicle_data);
      // A later V2 run must never upgrade an older result with no per-result version.
      if (!resultContext && (vehicleContext?.promptVersion === 'nb21-v2' || vehicleContext?.promptVersion === 'nb21-v3')) throw new Error('Für dieses ältere Bild fehlt die ursprüngliche Laufversion. Es wird nicht auf V2 umgestellt.');
      const ctx = resultContext ?? vehicleContext;
      const nb21Version = resolveStoredNb21Version(ctx);
      const evidenceVersion = nb21Version === 'nb21-v2' || nb21Version === 'nb21-v3';
      if (!evidenceVersion && !seedUrl) throw new Error('Für dieses Fahrzeug ist kein Originalfoto vorhanden. Bitte ein Referenzbild auswählen.');
      // V2 never calls the positional legacy seed resolver's output a vehicle truth.
      const mainBase64 = evidenceVersion ? (referenceUrl ? await fetchAsBase64(referenceUrl) : '') : await fetchAsBase64(seedUrl ?? '');
      const profileShowroomUrl: string | null = (pRow as any)?.custom_showroom_url || null;
      // Profil-Showroom NUR, wenn er beim ursprünglichen Lauf ausgewählt war (scene=custom-showroom).
      // Ohne gespeicherte Einstellungen: Umgebung aus einem anderen Bild derselben Serie übernehmen.
      const seriesEnvUrl = ctx ? null : pickSeriesEnvironmentImage(images, current.id);
      const config = restoreRemasterConfig(ctx, seriesEnvUrl);
      const showroomUrl = ctx ? showroomUrlForScene(config.scene, profileShowroomUrl) : seriesEnvUrl;
      const customShowroomBase64 = showroomUrl ? await ensureCachedBase64(showroomUrl).catch(() => null) : null;
      const isInterior = pipelineJob?.category === 'interior';
      const interiorSlotKey = isInterior
        ? (/(rear seat|rücksitz|ruecksitz)/i.test(`${pipelineJob?.key} ${pipelineJob?.label} ${pipelineJob?.labelDe}`) ? 'interior-rear' : 'interior-front')
        : undefined;
      const vehicleDescription = ctx?.vehicleDescription || current.perspective || '';
      const baseContext = evidenceVersion ? '' : buildMasterPrompt(
        { ...config, customShowroomBase64 },
        vehicleDescription,
        interiorSlotKey,
        overrides,
        ctx?.classContext ?? null,
      );
      const hasLogo = !!(config.showManufacturerLogo || config.showDealerLogo);

      const correction = buildMandatoryCorrection(extraPrompt);
      const sourceRule = `<SOURCE_RULE>\nThe provided main image is a REAL reference photo of this exact vehicle. Generate the requested view fresh from it. Reproduce only what this photo and the vehicle's real evidence show. Scene, showroom, lighting and look follow the context above exactly, so this image matches the rest of the series.\n</SOURCE_RULE>`;

      const perspectiveInstruction = pipelineJob
        ? injectLogoPlaceholder(pipelineJob.prompt, hasLogo)
        : `Remaster the provided real vehicle photo${current.perspective ? ` as: ${current.perspective}` : ''}.`;
      const dynamicPrompt = `${correction}${baseContext}\n\n--- PERSPECTIVE INSTRUCTION ---\n${perspectiveInstruction}\n\n${sourceRule}`;

      // Nano Banana 2.1: Läufe mit gespeicherter Version nb21-v1 werden wieder über
      // den 2.1-Pfad gebaut. Alte Läufe ohne Version bleiben auf ihrem 2.0-Pfad.
      let nb21Prompt: string | null = null;
      if (nb21Version === 'nb21-v1') {
        const nb21Refs = {
          primaryRole: current.perspective || pipelineJob?.labelDe || 'overall vehicle photo',
          hasEnvironmentReference: !!customShowroomBase64,
          hasManufacturerLogo: !!config.showManufacturerLogo,
          hasDealerLogo: !!config.showDealerLogo,
        };
        const nb21Correction = extraPrompt.trim() || undefined;
        nb21Prompt = pipelineJob
          ? buildNb21PipelinePrompt({ job: pipelineJob, config: { ...config, customShowroomBase64 }, vehicleDescription, classContext: ctx?.classContext ?? null, references: nb21Refs, correction: nb21Correction, regenerationFromOriginal: true })
          : buildNb21RemasterPrompt({ config: { ...config, customShowroomBase64 }, slotKey: interiorSlotKey ?? 'as-photographed', vehicleDescription, classContext: ctx?.classContext ?? null, references: nb21Refs, correction: nb21Correction });
      }

      let v2Sources: V2Reference[] = [];
      if (evidenceVersion) {
        v2Sources = await Promise.all(originals.filter(o => originalSlotFromFilename(o.name) || ctx?.referenceSources?.some(s => s.assetId === o.assetId)).map(async o => {
          const saved = ctx?.referenceSources?.find(s => s.assetId === o.assetId);
          return { sourceId: o.assetId, assetId: o.assetId, sourceRole: saved?.sourceRole ?? originalSlotFromFilename(o.name) ?? 'unassigned-detail', sourceType: saved?.sourceType ?? 'original' as const, image: await fetchAsBase64(o.url) };
        }));
        // Selecting a generated gallery frame does NOT relabel it as an original.
        if (referenceUrl && !originals.some(o => o.url === referenceUrl)) v2Sources.push({ sourceId: `gallery:${images.find(i => i.src === referenceUrl)?.id ?? 'selected'}`, sourceRole: 'environment', sourceType: 'generated context', image: mainBase64 });
        v2Sources.push(...v2ConfigSources({ ...config, customShowroomBase64 }).filter(s => !v2Sources.some(existing => existing.sourceRole === s.sourceRole && existing.sourceType === s.sourceType)));
      }
      if (nb21Version === 'nb21-v3' && !ctx?.lightingProfile) throw new Error('V3: Ursprüngliches Serien-Lichtprofil fehlt; keine automatische Migration.');
      const v3Args = nb21Version === 'nb21-v3' && ctx?.lightingProfile ? {
        sources: v2Sources, jobKey: ctx.jobKey ?? pipelineJob?.key ?? ctx.sourceSlot ?? 'as-photographed', category: pipelineJob?.category,
        editSlot: ctx.jobKey || pipelineJob ? undefined : ctx.sourceSlot,
        config: { ...config, customShowroomBase64 }, correction: extraPrompt.trim(), lightingProfile: ctx.lightingProfile,
        retryReason, payload: { classContext: ctx.classContext },
      } : null;
      const { data, error } = v3Args ? await invokeNb21V3(v3Args) : nb21Version === 'nb21-v2' ? await invokeNb21V2({
        sources: v2Sources, jobKey: ctx?.jobKey ?? pipelineJob?.key ?? ctx?.sourceSlot ?? 'as-photographed', category: pipelineJob?.category,
        editSlot: ctx?.jobKey || pipelineJob ? undefined : ctx?.sourceSlot ?? undefined,
        config: { ...config, customShowroomBase64 }, correction: extraPrompt.trim(), payload: { classContext: ctx?.classContext },
      }) : await invokeRemasterVehicleImage({
        classContext: ctx?.classContext ?? null,
        imageBase64: mainBase64,
        vehicleDescription,
        modelTier: nb21Version ? NB21_TIER : (ctx?.modelTier || 'standard'),
        dynamicPrompt: nb21Prompt ?? dynamicPrompt,
        ...(nb21Version ? { promptVersion: nb21Version } : {}),
        customShowroomBase64,
        customPlateImageBase64: null,
        dealerLogoUrl: config.showDealerLogo ? (config.dealerLogoUrl ?? null) : null,
        manufacturerLogoUrl: config.showManufacturerLogo ? (config.manufacturerLogoUrl ?? null) : null,
      } as any);

      if (error || !data?.imageBase64) {
        toast.error(data?.error || error?.message || 'Fehler beim Regenerieren');
      } else {
        const { error: updateError } = await supabase
          .from('project_images')
          .update({ image_url: data.imageBase64, image_base64: '', ...(v3Args ? { generation_context: { ...ctx, v3Metadata: v3ResultMetadata(resolveV3Evidence(v3Args).manifest), lightingProfile: v3Args.lightingProfile } } : {}) } as any)
          .eq('id', current.id);

        if (updateError) toast.error('Bild generiert, aber Speichern fehlgeschlagen');
        else {
          toast.success('Bild erfolgreich neu generiert');
          setExtraPrompt('');
          setSelectedRef(null);
          onRegenerated?.();
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler beim Regenerieren');
    }
    setRegenerating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <span className="text-sm text-background/70">{index + 1} / {images.length}</span>
          <Button variant="secondary" size="sm" onClick={download} disabled={downloading} className="gap-1.5">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Wird geladen…' : 'Download'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={regenerating}
            className="gap-1.5"
          >
            {regenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generiere…</>
            ) : (
              <><RotateCcw className="w-4 h-4" /> Neu generieren</>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" /> Löschen
          </Button>
          <button onClick={onClose} className="text-background hover:text-background/80 transition-colors ml-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 transition-colors"
            >
              <ChevronLeft className="w-8 h-8 text-background" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 transition-colors"
            >
              <ChevronRight className="w-8 h-8 text-background" />
            </button>
          </>
        )}

        <div className="relative">
          <img
            src={current.src}
            alt={withAiDisclosureAlt(current.perspective || 'Fahrzeugbild')}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            {...swipeHandlers}
          />
          <AiDisclosureBadge context="banner" overlay className="right-4 top-4" />

          {regenerating && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="text-sm font-medium text-foreground">Wird neu generiert…</span>
              </div>
            </div>
          )}
        </div>

        {current.perspective && (
          <p className="text-sm text-background/70 mt-3">{current.perspective}</p>
        )}

        {images.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto max-w-[90vw] pb-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  i === index ? 'border-accent scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Picker dialog: pipeline prompt + reference + extra prompt */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Bild verbessern</DialogTitle>
            <DialogDescription>
              {pipelineJob ? (
                <>Pipeline-Prompt: <span className="font-medium">{pipelineJob.labelDe}</span> wird automatisch verwendet. Optional: Referenzbild und Hinweise auswählen.</>
              ) : (
                <>Wähle optional ein Referenzbild und beschreibe, was verbessert werden soll.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Verbesserungs-Hinweise (optional)</label>
            <Textarea
              value={extraPrompt}
              onChange={e => setExtraPrompt(e.target.value)}
              placeholder={pipelineJob ? `z.B. „Lenkrad-Logo korrekt darstellen, Knöpfe schärfer"` : `z.B. „mehr Kontrast, Spiegelungen entfernen"`}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Das Bild wird neu aus dem Originalfoto erzeugt – nie aus dem fehlerhaften Ergebnis. Ihre Hinweise haben höchste Priorität.
            </p>
          </div>

          {isV3Result && <Select value={retryReason ?? 'none'} onValueChange={v => setRetryReason(v === 'none' ? undefined : v as V3RetryReason)}>
            <SelectTrigger aria-label="V3 Korrekturgrund"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Korrekturgrund ausgewählt</SelectItem>
              <SelectItem value="wrong_physical_side">Falsche Fahrzeugseite</SelectItem>
              <SelectItem value="wrong_view_quadrant">Falsche 3/4-Perspektive</SelectItem>
              <SelectItem value="unsupported_visible_surface">Nicht belegte Fläche</SelectItem>
              <SelectItem value="lighting_inconsistent">Abweichende Belichtung</SelectItem>
              <SelectItem value="identity_drift">Abweichende Fahrzeugdetails</SelectItem>
            </SelectContent>
          </Select>}
          <Tabs value={pickerTab} onValueChange={(v) => { setPickerTab(v as any); setSelectedRef(null); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="originals">Originale</TabsTrigger>
              <TabsTrigger value="gallery">Galerie</TabsTrigger>
            </TabsList>

            <TabsContent value="originals" className="mt-3">
              {!vehicleId ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Kein Fahrzeug-Kontext verfügbar.</div>
              ) : loadingOriginals ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
              ) : originals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Originalbilder vorhanden.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
                  {originals.map(o => (
                    <button
                      key={o.name}
                      onClick={() => setSelectedRef(o.url)}
                      className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${selectedRef === o.url ? 'border-accent ring-2 ring-accent/40' : 'border-transparent hover:border-accent/60'}`}
                    >
                      <img src={o.url} alt={o.name} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="gallery" className="mt-3">
              {images.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Keine Galeriebilder vorhanden.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
                  {images.filter(i => i.id !== current.id).map(img => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedRef(img.src)}
                      className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${selectedRef === img.src ? 'border-accent ring-2 ring-accent/40' : 'border-transparent hover:border-accent/60'}`}
                    >
                      <img src={img.src} alt={img.perspective || ''} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Abbrechen</Button>
            <Button onClick={() => runRegenerate(selectedRef)} className="gap-1.5">
              <Wand2 className="w-4 h-4" />
              {selectedRef ? 'Mit gewählter Referenz neu generieren' : 'Aus Originalfoto neu generieren'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent onClick={e => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieses Bild wird unwiderruflich gelöscht. Möchtest du fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GalleryLightbox;
