import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { Loader2, Check, AlertCircle, Zap, ArrowRight, ChevronDown, ChevronUp, Image, Images, RotateCcw, Eye, EyeOff, Sparkles, Layout, Video as VideoIcon } from 'lucide-react';
import ImagePreviewLightbox from '@/components/ImagePreviewLightbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { uploadImageToStorage, getGalleryFolderName } from '@/lib/storage-utils';
import { toast } from 'sonner';
import CreditConfirmDialog from '@/components/CreditConfirmDialog';
import {
  PIPELINE_JOBS,
  PIPELINE_CATEGORIES,
  type PipelineJob,
  detectBrandFromDescription,
  getTotalImageCount,
  applyPromptOverrides,
} from '@/lib/pipeline-jobs';
import { type RemasterConfig, fetchManufacturerLogos } from '@/lib/remaster-prompt';
import { usePipeline, type ResultImage } from '@/contexts/PipelineContext';

/* ─── Types ─── */
interface PipelineRunnerProps {
  inputImages: string[];
  originalImages?: string[];
  additionalImages?: string[];
  vehicleDescription: string;
  vehicleBrand?: string;
  remasterConfig: RemasterConfig;
  modelTier?: string;
  projectId?: string | null;
  vin?: string | null;
  onComplete: () => void;
  onBack: () => void;
  onFollowUpAction?: (action: 'banner' | 'manual-landing' | 'video') => void;
}

/* ─── Constants ─── */
const CREDIT_COST_PER_IMAGE = 2;

/* ─── Component ─── */
const PipelineRunner: React.FC<PipelineRunnerProps> = ({
  inputImages,
  originalImages,
  additionalImages,
  vehicleDescription,
  vehicleBrand,
  remasterConfig,
  modelTier = 'standard',
  projectId,
  vin,
  onComplete,
  onBack,
  onFollowUpAction,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, getCost } = useCredits();
  const pipeline = usePipeline();

  /* ─── Context-driven state ─── */
  const isContextActive = pipeline.status !== 'idle';
  const running = pipeline.isRunning;
  const finished = pipeline.isFinished;
  const jobs = pipeline.jobs;
  const savedProjectId = isContextActive ? pipeline.savedProjectId : (projectId || null);

  // Timing from context
  const elapsedMs = pipeline.elapsedMs;
  const pipelineStartTime = pipeline.startTime;
  const pipelineEndTime = pipeline.endTime;

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    if (min === 0) return `${sec}s`;
    return `${min}m ${sec % 60}s`;
  };

  const totalDurationMs = pipelineEndTime && pipelineStartTime ? pipelineEndTime - pipelineStartTime : elapsedMs;

  /* ─── Local UI state ─── */
  const [showPreview, setShowPreview] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const inputImagesSavedRef = useRef(false);

  /* ─── Prompt overrides ─── */
  const [promptOverrides, setPromptOverrides] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase
      .from('admin_settings' as any)
      .select('value')
      .eq('key', 'ai_prompts')
      .single()
      .then(({ data }) => {
        if (data) setPromptOverrides((data as any).value || {});
      });
  }, []);

  /* ─── Brand detection ─── */
  const detectedBrand = useMemo(
    () => detectBrandFromDescription(vehicleDescription, vehicleBrand),
    [vehicleDescription, vehicleBrand],
  );

  const localAvailableJobs = useMemo(() =>
    applyPromptOverrides(PIPELINE_JOBS, promptOverrides).filter(j => {
      if (j.category !== 'ci') return true;
      return j.brand === detectedBrand;
    }),
    [detectedBrand, promptOverrides],
  );

  // Use context's jobs when pipeline is active, else local
  const availableJobs = isContextActive ? (pipeline.config?.availableJobs || localAvailableJobs) : localAvailableJobs;

  /* ─── Selection state ─── */
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    new Set(localAvailableJobs.filter(j => j.defaultSelected).map(j => j.key))
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(PIPELINE_CATEGORIES.map(c => c.key))
  );

  // Sync selectedKeys when context is active
  useEffect(() => {
    if (isContextActive && pipeline.config) {
      setSelectedKeys(new Set(pipeline.config.selectedJobs.map(j => j.key)));
    }
  }, [isContextActive, pipeline.config]);

  // Re-sync selection on brand change (only when not context-active)
  useEffect(() => {
    if (isContextActive) return;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      localAvailableJobs.forEach(j => {
        if (j.category === 'ci' && j.defaultSelected && !next.has(j.key)) next.add(j.key);
      });
      PIPELINE_JOBS.forEach(j => {
        if (j.category === 'ci' && j.brand !== detectedBrand) next.delete(j.key);
      });
      return next;
    });
  }, [detectedBrand, localAvailableJobs, isContextActive]);

  /* ─── Manufacturer logo resolution ─── */
  const [resolvedManufacturerLogoUrl, setResolvedManufacturerLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (isContextActive) return;
    if (!remasterConfig.showManufacturerLogo || !detectedBrand) {
      setResolvedManufacturerLogoUrl(null);
      return;
    }
    if (remasterConfig.manufacturerLogoUrl) {
      setResolvedManufacturerLogoUrl(remasterConfig.manufacturerLogoUrl);
      return;
    }
    fetchManufacturerLogos().then(logos => {
      const brandLower = detectedBrand.toLowerCase().replace(/[-_\s]+/g, '');
      const LOGO_ALIASES: Record<string, string[]> = {
        volkswagen: ['vw'], vw: ['volkswagen'],
        mercedesbenz: ['mercedes', 'mb'], mercedes: ['mercedesbenz', 'mb'],
        bmw: ['bayerischemotorenwerke'],
      };
      const aliases = LOGO_ALIASES[brandLower] || [];
      const allKeys = [brandLower, ...aliases];
      const match = logos.find(l => {
        const ln = l.name.toLowerCase().replace(/[-_\s]+/g, '');
        return allKeys.some(k => ln === k || ln.includes(k) || k.includes(ln));
      });
      if (match) {
        console.log(`[Pipeline] Manufacturer logo found for "${detectedBrand}": ${match.name} → ${match.url}`);
        setResolvedManufacturerLogoUrl(match.url);
      } else {
        console.warn(`[Pipeline] No manufacturer logo found for brand "${detectedBrand}" in ${logos.length} logos:`, logos.map(l => l.name));
        setResolvedManufacturerLogoUrl(null);
      }
    });
  }, [detectedBrand, remasterConfig.showManufacturerLogo, remasterConfig.manufacturerLogoUrl, isContextActive]);

  /* ─── Derived values ─── */
  const localSelectedJobs = localAvailableJobs.filter(j => selectedKeys.has(j.key));
  const selectedJobs = isContextActive ? (pipeline.config?.selectedJobs || localSelectedJobs) : localSelectedJobs;
  const totalImages = isContextActive ? pipeline.totalImages : getTotalImageCount(selectedKeys);
  const doneImages = Object.values(jobs).reduce((s, j) => s + j.results.length, 0);
  const estimatedCost = isContextActive ? 0 : totalImages * CREDIT_COST_PER_IMAGE;

  /* ─── Selection helpers ─── */
  const toggleJob = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCategory = (catKey: string) => {
    const catJobs = availableJobs.filter(j => j.category === catKey);
    const allSelected = catJobs.every(j => selectedKeys.has(j.key));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      catJobs.forEach(j => { if (allSelected) next.delete(j.key); else next.add(j.key); });
      return next;
    });
  };

  const toggleCategoryExpand = (catKey: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catKey)) next.delete(catKey); else next.add(catKey);
      return next;
    });
  };

  /* ─── Save remastered input images on mount ─── */
  useEffect(() => {
    if (!user || inputImages.length === 0 || inputImagesSavedRef.current || isContextActive) return;
    inputImagesSavedRef.current = true;
    const folderName = getGalleryFolderName(vin);

    if (projectId) {
      (async () => {
        try {
          const urls: string[] = [];
          for (let i = 0; i < inputImages.length; i++) {
            const url = await uploadImageToStorage(inputImages[i], user.id, `${projectId}/remaster_${i}.png`);
            if (url) urls.push(url);
          }
          if (urls.length > 0) {
            await supabase.from('projects').update({ main_image_url: urls[0] }).eq('id', projectId);
            const perspectives = ['3/4 Front', 'Seite', 'Hinten', 'Interieur Fahrersitz', 'Interieur Rücksitz'];
            const imageRows = urls.map((url, i) => ({
              project_id: projectId, user_id: user.id, image_url: url,
              image_base64: '', perspective: perspectives[i] || `Bild ${i + 1}`, sort_order: i,
              gallery_folder: folderName,
            }));
            await supabase.from('project_images').insert(imageRows as any);
          }
        } catch (e) { console.error('Error saving remastered images:', e); }
      })();
      return;
    }
    (async () => {
      try {
        const urls: string[] = [];
        for (let i = 0; i < inputImages.length; i++) {
          const url = await uploadImageToStorage(inputImages[i], user.id, `gallery/${folderName}/remaster_${i}.png`);
          if (url) urls.push(url);
        }
        if (urls.length > 0) {
          const perspectives = ['3/4 Front', 'Seite', 'Hinten', 'Interieur Fahrersitz', 'Interieur Rücksitz'];
          const imageRows = urls.map((url, i) => ({
            project_id: null, user_id: user.id, image_url: url,
            image_base64: '', perspective: perspectives[i] || `Bild ${i + 1}`, sort_order: i,
            gallery_folder: folderName,
          }));
          await supabase.from('project_images').insert(imageRows as any);
        }
      } catch (e) { console.error('Error saving remastered images:', e); }
    })();
  }, [user, inputImages, vehicleDescription, projectId, isContextActive]);

  /* ─── Retry job (delegates to context) ─── */
  const retryJob = useCallback(async (jobKey: string) => {
    setRegeneratingIds(prev => new Set(prev).add(jobKey));
    await pipeline.retryJob(jobKey);
    setRegeneratingIds(prev => { const next = new Set(prev); next.delete(jobKey); return next; });
  }, [pipeline]);

  /* ─── Start pipeline (delegates to context) ─── */
  const runPipeline = useCallback(() => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    if (localSelectedJobs.length === 0) { toast.error('Bitte wähle mindestens einen Job aus.'); return; }

    pipeline.startPipeline({
      inputImages,
      originalImages: originalImages || [],
      additionalImages: additionalImages || [],
      vehicleDescription,
      remasterConfig,
      modelTier,
      projectId: projectId || null,
      vin: vin || null,
      selectedJobs: localSelectedJobs,
      availableJobs: localAvailableJobs,
      resolvedManufacturerLogoUrl,
      userId: user.id,
      detectedBrand: detectedBrand || null,
      totalImages: getTotalImageCount(selectedKeys),
    });
  }, [user, localSelectedJobs, localAvailableJobs, inputImages, originalImages, additionalImages, vehicleDescription, remasterConfig, modelTier, projectId, vin, resolvedManufacturerLogoUrl, detectedBrand, selectedKeys, pipeline]);

  /* ─── Credit pre-check ─── */
  const handleStartClick = () => {
    if (estimatedCost > 0) {
      setShowCreditDialog(true);
    } else {
      runPipeline();
    }
  };

  const handleCreditConfirm = () => {
    setShowCreditDialog(false);
    runPipeline();
  };

  const progressPercent = running ? (doneImages / totalImages) * 100 : finished ? 100 : 0;

  const categoriesWithJobs = PIPELINE_CATEGORIES.filter(cat =>
    availableJobs.some(j => j.category === cat.key)
  );

  // Collect all result images for the preview grid
  const allResultImages: ResultImage[] = useMemo(() => {
    const results: ResultImage[] = [];
    for (const job of selectedJobs) {
      const state = jobs[job.key];
      if (state?.results) {
        state.results.forEach((r, i) => {
          const prompts = [job.prompt, ...(job.extraPrompts || [])];
          results.push({
            key: `${job.key}_${i}`,
            jobKey: job.key,
            promptIndex: i,
            label: prompts.length > 1 ? `${job.labelDe} (${i + 1})` : job.labelDe,
            base64: r,
          });
        });
      }
    }
    return results;
  }, [jobs, selectedJobs]);

  // Regenerate a single pipeline result image (delegates to context)
  const retrySinglePipelineImage = useCallback(async (resultId: string) => {
    setRegeneratingIds(prev => new Set(prev).add(resultId));
    await pipeline.retrySingleImage(resultId, allResultImages);
    setRegeneratingIds(prev => { const next = new Set(prev); next.delete(resultId); return next; });
  }, [pipeline, allResultImages]);

  const lightboxImages = useMemo(() =>
    allResultImages.map(img => ({
      id: img.key,
      src: img.base64.startsWith('data:') ? img.base64 : `data:image/png;base64,${img.base64}`,
      label: img.label,
    })),
    [allResultImages],
  );

  const failedJobs = selectedJobs.filter(j => jobs[j.key]?.status === 'error');

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 px-1">
      {/* Header */}
      <div className="text-center px-2">
        <h2 className="font-display text-lg sm:text-xl font-bold text-foreground mb-1.5">
          Image Generation Pipeline
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Wähle die gewünschten Perspektiven und Pakete.
        </p>
        {detectedBrand && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Image className="w-3 h-3" />
              CI: {detectedBrand === 'volkswagen' ? 'Volkswagen' : detectedBrand.charAt(0).toUpperCase() + detectedBrand.slice(1)}
            </Badge>
            {remasterConfig.showManufacturerLogo && (
              <Badge variant={resolvedManufacturerLogoUrl ? "default" : "destructive"} className="gap-1.5 text-xs">
                {resolvedManufacturerLogoUrl ? (
                  <>
                    <Check className="w-3 h-3" />
                    Hersteller-Logo geladen
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    Kein Logo für {detectedBrand}
                  </>
                )}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Job Selection */}
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {categoriesWithJobs.map(cat => {
          const catJobs = availableJobs.filter(j => j.category === cat.key);
          if (catJobs.length === 0) return null;
          const selectedCount = catJobs.filter(j => selectedKeys.has(j.key)).length;
          const allSelected = selectedCount === catJobs.length;
          const someSelected = selectedCount > 0 && !allSelected;
          const isExpanded = expandedCategories.has(cat.key);
          const catImageCount = catJobs
            .filter(j => selectedKeys.has(j.key))
            .reduce((s, j) => s + (j.outputCount ?? 1), 0);

          return (
            <div key={cat.key}>
              {/* Category header */}
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/30">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={() => !running && toggleCategory(cat.key)}
                  disabled={running}
                  className="shrink-0"
                />
                <button
                  onClick={() => toggleCategoryExpand(cat.key)}
                  className="flex items-center gap-1.5 sm:gap-2 flex-1 text-left min-w-0"
                  disabled={running}
                >
                  <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{cat.labelDe}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                    ({selectedCount}/{catJobs.length})
                    {catImageCount > 0 && ` · ${catImageCount}`}
                  </span>
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />}
                </button>
              </div>

              {/* Jobs */}
              {isExpanded && catJobs.map(job => {
                const state = jobs[job.key];
                const isSelected = selectedKeys.has(job.key);
                const imgCount = job.outputCount ?? 1;

                return (
                  <div key={job.key} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 pl-8 sm:pl-10">
                    {!running && !finished ? (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleJob(job.key)}
                        className="shrink-0"
                      />
                    ) : (
                      <div className={`
                        w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all
                        ${state?.status === 'done' ? 'bg-accent/10 text-accent' :
                          state?.status === 'running' ? 'bg-primary text-primary-foreground' :
                          state?.status === 'error' ? 'bg-destructive/10 text-destructive' :
                          'bg-muted text-muted-foreground'}
                      `}>
                        {state?.status === 'done' ? <Check className="w-3 h-3" /> :
                         state?.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                         state?.status === 'error' ? <AlertCircle className="w-3 h-3" /> :
                         isSelected ? <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> : null}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <p className={`text-xs sm:text-sm font-medium truncate ${
                          state?.status === 'running' ? 'text-foreground' :
                          state?.status === 'done' ? 'text-muted-foreground' :
                          state?.status === 'error' ? 'text-destructive' :
                          isSelected ? 'text-foreground' : 'text-muted-foreground/60'
                        }`}>
                          {job.labelDe}
                        </p>
                        {imgCount > 1 && (
                          <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 gap-0.5">
                            <Images className="w-2.5 h-2.5" />
                            {imgCount}
                          </Badge>
                        )}
                      </div>
                      {state?.status === 'running' && imgCount > 1 && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Bild {(state.results?.length ?? 0) + 1} von {imgCount}
                        </p>
                      )}
                      {state?.status === 'error' && state.error && (
                        <p className="text-[10px] sm:text-xs text-destructive truncate">{state.error}</p>
                      )}
                    </div>
                    {/* Retry button for failed jobs */}
                    {state?.status === 'error' && finished && !running && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 w-7 p-0"
                        onClick={() => retryJob(job.key)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {/* Thumbnails */}
                    {state?.status === 'done' && state.results.length > 0 && (
                      <div className="hidden sm:flex gap-1 shrink-0">
                        {state.results.slice(0, 3).map((r, ri) => (
                          <img
                            key={ri}
                            src={r.startsWith('data:') ? r : `data:image/png;base64,${r}`}
                            alt={`${job.labelDe} ${ri + 1}`}
                            className="w-10 h-7 rounded object-cover border border-border"
                          />
                        ))}
                        {state.results.length > 3 && (
                          <span className="text-[10px] text-muted-foreground self-center">+{state.results.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Selection summary */}
      {!running && !finished && (
        <p className="text-[11px] sm:text-xs text-muted-foreground text-center">
          {selectedJobs.length} Jobs · {totalImages} Bilder
          {estimatedCost > 0 && ` · ca. ${estimatedCost} Credits`}
        </p>
      )}

      {/* Progress */}
      {(running || finished) && (
        <div className="space-y-1.5 sm:space-y-2 px-1">
          <div className="flex justify-between text-[11px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {running ? 'Pipeline läuft… (4 parallel)' : `${doneImages} von ${totalImages} Bilder erstellt`}
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Timer className="w-3 h-3" />
              {formatElapsed(totalDurationMs)}
              {running && <span className="text-muted-foreground/60">· {doneImages}/{totalImages}</span>}
            </span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Result Preview Grid */}
      {finished && allResultImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Ergebnisse ({allResultImages.length})
              <Badge variant="outline" className="text-[10px] font-mono gap-1">
                <Timer className="w-2.5 h-2.5" />
                {formatElapsed(totalDurationMs)}
              </Badge>
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPreview ? 'Ausblenden' : 'Anzeigen'}
            </Button>
          </div>
          {showPreview && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {allResultImages.map((img, imgIdx) => (
                <div
                  key={img.key}
                  className="relative group rounded-lg sm:rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3] cursor-pointer"
                  onClick={() => { setLightboxIndex(imgIdx); setLightboxOpen(true); }}
                >
                  <img
                    src={img.base64.startsWith('data:') ? img.base64 : `data:image/png;base64,${img.base64}`}
                    alt={img.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 sm:p-2">
                    <p className="text-[9px] sm:text-[10px] text-white font-medium truncate">{img.label}</p>
                  </div>
                  {/* Regenerate button on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); retrySinglePipelineImage(img.key); }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Neu generieren"
                  >
                    {regeneratingIds.has(img.key)
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RotateCcw className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Failed jobs retry hint */}
      {finished && failedJobs.length > 0 && (
        <p className="text-[11px] sm:text-xs text-destructive text-center">
          {failedJobs.length} Job(s) fehlgeschlagen – klicke ↺ zum Wiederholen
        </p>
      )}

      {/* Post-Pipeline Follow-Up Actions */}
      {finished && allResultImages.length > 0 && onFollowUpAction && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            Weiter mit deinen Bildern
          </h3>
          <p className="text-xs text-muted-foreground">
            Nutze deine Pipeline-Bilder direkt für weitere Aktionen – ohne erneuten Upload.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => onFollowUpAction!('banner')}
              className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-accent/50 hover:shadow-sm transition-all text-left"
            >
              <div className="w-8 h-8 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Image className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Banner</p>
                <p className="text-[10px] text-muted-foreground">Social Media & Ads</p>
              </div>
            </button>
            <button
              onClick={() => onFollowUpAction!('manual-landing')}
              className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-accent/50 hover:shadow-sm transition-all text-left"
            >
              <div className="w-8 h-8 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Layout className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Landing Page</p>
                <p className="text-[10px] text-muted-foreground">SEO-Angebotsseite</p>
              </div>
            </button>
            <button
              onClick={() => onFollowUpAction!('video')}
              className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-accent/50 hover:shadow-sm transition-all text-left"
            >
              <div className="w-8 h-8 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <VideoIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Video</p>
                <p className="text-[10px] text-muted-foreground">Showroom-Video</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 px-1">
        <Button variant="outline" size="sm" onClick={onBack} disabled={running} className="text-xs sm:text-sm">
          Zurück
        </Button>

        {!finished ? (
          <Button
            onClick={handleStartClick}
            disabled={running || selectedJobs.length === 0 || inputImages.length === 0}
            className="gap-1.5 sm:gap-2 gradient-accent text-accent-foreground font-semibold text-xs sm:text-sm"
          >
            {running ? (
              <><Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> Generiere…</>
            ) : (
              <><Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {totalImages} Bilder generieren</>
            )}
          </Button>
        ) : (
          <Button
            onClick={onComplete}
            variant="outline"
            className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
          >
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Zur Galerie
          </Button>
        )}
      </div>

      {/* Credit Confirmation Dialog */}
      <CreditConfirmDialog
        open={showCreditDialog}
        cost={estimatedCost}
        balance={balance}
        actionLabel={`${totalImages} Bilder generieren`}
        onConfirm={handleCreditConfirm}
        onCancel={() => setShowCreditDialog(false)}
      />

      {/* Lightbox */}
      <ImagePreviewLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onRegenerate={(id) => retrySinglePipelineImage(id)}
        regeneratingIds={regeneratingIds}
      />
    </div>
  );
};

export default PipelineRunner;
