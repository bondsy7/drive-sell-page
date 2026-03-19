import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, AlertCircle, Zap, ArrowRight, ChevronDown, ChevronUp, Image, Images, RotateCcw, Eye, EyeOff } from 'lucide-react';
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
} from '@/lib/pipeline-jobs';
import { buildMasterPrompt, type RemasterConfig, fetchManufacturerLogos } from '@/lib/remaster-prompt';

/* ─── Types ─── */
interface PipelineRunnerProps {
  inputImages: string[];
  originalImages?: string[];
  vehicleDescription: string;
  vehicleBrand?: string;
  remasterConfig: RemasterConfig;
  modelTier?: string;
  projectId?: string | null;
  vin?: string | null;
  onComplete: () => void;
  onBack: () => void;
}

type JobStatus = 'pending' | 'running' | 'done' | 'error';

interface JobState {
  status: JobStatus;
  results: string[];
  error?: string;
}

/* ─── Constants ─── */
const CONCURRENCY = 4; // parallel image generation slots
const CREDIT_COST_PER_IMAGE = 2;

/* ─── Component ─── */
const PipelineRunner: React.FC<PipelineRunnerProps> = ({
  inputImages,
  originalImages,
  vehicleDescription,
  vehicleBrand,
  remasterConfig,
  modelTier = 'standard',
  projectId,
  vin,
  onComplete,
  onBack,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, getCost } = useCredits();

  // Detect brand for CI filtering
  const detectedBrand = useMemo(
    () => detectBrandFromDescription(vehicleDescription, vehicleBrand),
    [vehicleDescription, vehicleBrand],
  );

  const availableJobs = useMemo(() =>
    PIPELINE_JOBS.filter(j => {
      if (j.category !== 'ci') return true;
      return j.brand === detectedBrand;
    }),
    [detectedBrand],
  );

  // Selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    new Set(availableJobs.filter(j => j.defaultSelected).map(j => j.key))
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(PIPELINE_CATEGORIES.map(c => c.key))
  );

  // Credit dialog
  const [showCreditDialog, setShowCreditDialog] = useState(false);

  // Re-sync selection on brand change
  useEffect(() => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      availableJobs.forEach(j => {
        if (j.category === 'ci' && j.defaultSelected && !next.has(j.key)) next.add(j.key);
      });
      PIPELINE_JOBS.forEach(j => {
        if (j.category === 'ci' && j.brand !== detectedBrand) next.delete(j.key);
      });
      return next;
    });
  }, [detectedBrand, availableJobs]);

  // Auto-fetch manufacturer logo based on detected brand
  const [resolvedManufacturerLogoUrl, setResolvedManufacturerLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!remasterConfig.showManufacturerLogo || !detectedBrand) {
      setResolvedManufacturerLogoUrl(null);
      return;
    }
    // If already set manually in config, use that
    if (remasterConfig.manufacturerLogoUrl) {
      setResolvedManufacturerLogoUrl(remasterConfig.manufacturerLogoUrl);
      return;
    }
    // Fetch from storage and match by brand name (with alias support)
    fetchManufacturerLogos().then(logos => {
      const brandLower = detectedBrand.toLowerCase().replace(/[-_\s]+/g, '');
      const LOGO_ALIASES: Record<string, string[]> = {
        volkswagen: ['vw'],
        vw: ['volkswagen'],
        mercedesbenz: ['mercedes', 'mb'],
        mercedes: ['mercedesbenz', 'mb'],
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
  }, [detectedBrand, remasterConfig.showManufacturerLogo, remasterConfig.manufacturerLogoUrl]);

  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(projectId || null);
  const [showPreview, setShowPreview] = useState(true);

  const selectedJobs = availableJobs.filter(j => selectedKeys.has(j.key));
  const totalImages = getTotalImageCount(selectedKeys);
  const doneImages = Object.values(jobs).reduce((s, j) => s + j.results.length, 0);
  const estimatedCost = totalImages * CREDIT_COST_PER_IMAGE;

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
    if (!user || inputImages.length === 0) return;
    const folderName = getGalleryFolderName(vin);

    // If we already have a project (from PDF flow), save images to it AND to gallery
    if (projectId) {
      setSavedProjectId(projectId);
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
    // No existing project – standalone flow: save ONLY to gallery (no project creation!)
    if (savedProjectId) return;
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
  }, [user, inputImages, vehicleDescription, savedProjectId, projectId]);

  /* ─── Generate a single image ─── */
  const generateOneImage = useCallback(async (prompt: string): Promise<{ base64: string | null; error?: string }> => {
    const referenceImages = originalImages && originalImages.length > 0 ? originalImages : inputImages;
    const baseContext = buildMasterPrompt(remasterConfig, vehicleDescription);
    const fullPrompt = `${baseContext}\n\n--- PERSPECTIVE INSTRUCTION ---\n${prompt}`;

    const { data, error } = await supabase.functions.invoke('remaster-vehicle-image', {
      body: {
        imageBase64: referenceImages[0],
        additionalImages: referenceImages.slice(1),
        vehicleDescription, modelTier,
        dynamicPrompt: fullPrompt,
        customShowroomBase64: remasterConfig.customShowroomBase64 || null,
        customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
        dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
        dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
        manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? resolvedManufacturerLogoUrl : null,
        manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
      },
    });

    if (error || !data?.imageBase64) {
      return { base64: null, error: data?.error || error?.message || 'Generierung fehlgeschlagen' };
    }
    return { base64: data.imageBase64 };
  }, [inputImages, originalImages, vehicleDescription, remasterConfig, modelTier, resolvedManufacturerLogoUrl]);

  /* ─── Retry a single failed job ─── */
  const retryJob = useCallback(async (jobKey: string) => {
    const job = availableJobs.find(j => j.key === jobKey);
    if (!job) return;

    setJobs(prev => ({ ...prev, [jobKey]: { status: 'running', results: [] } }));

    const prompts = [job.prompt, ...(job.extraPrompts || [])];
    const jobResults: string[] = [];
    let jobError: string | undefined;

    for (let p = 0; p < prompts.length; p++) {
      try {
        const result = await generateOneImage(prompts[p]);
        if (result.base64) {
          jobResults.push(result.base64);
          setJobs(prev => ({
            ...prev, [jobKey]: { status: 'running', results: [...prev[jobKey].results, result.base64!] },
          }));
        } else { jobError = result.error; }
      } catch { jobError = 'Netzwerkfehler'; }
    }

    if (jobResults.length > 0) {
      setJobs(prev => ({ ...prev, [jobKey]: { status: 'done', results: jobResults, error: jobError } }));

      // Save retried images to gallery
      if (user) {
        try {
          const folderName = getGalleryFolderName(vin);
          const storagePath = savedProjectId ? savedProjectId : `gallery/${folderName}`;
          for (let i = 0; i < jobResults.length; i++) {
            const url = await uploadImageToStorage(jobResults[i], user.id, `${storagePath}/${jobKey}_retry_${i}.png`);
            if (url) {
              await supabase.from('project_images').insert({
                project_id: savedProjectId || null, user_id: user.id, image_url: url,
                image_base64: '', perspective: `Pipeline: ${job.labelDe} (Retry)`, sort_order: 999 + i,
                gallery_folder: folderName,
              } as any);
            }
          }
        } catch (e) { console.error('Retry save error:', e); }
      }
    } else {
      setJobs(prev => ({ ...prev, [jobKey]: { status: 'error', results: [], error: jobError || 'Alle Bilder fehlgeschlagen' } }));
    }
  }, [availableJobs, generateOneImage, user, savedProjectId, vin]);

  /* ─── Pipeline with parallel execution ─── */
  const runPipeline = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    if (selectedJobs.length === 0) { toast.error('Bitte wähle mindestens einen Job aus.'); return; }

    setRunning(true);
    const allResults: { key: string; base64: string; label: string; subIndex: number }[] = [];

    // Initialize job states
    const initStates: Record<string, JobState> = {};
    selectedJobs.forEach(j => { initStates[j.key] = { status: 'pending', results: [] }; });
    setJobs(initStates);

    // Build a flat task list: [{ job, promptIndex, prompt }]
    const taskQueue: { job: PipelineJob; promptIndex: number; prompt: string }[] = [];
    for (const job of selectedJobs) {
      const prompts = [job.prompt, ...(job.extraPrompts || [])];
      prompts.forEach((prompt, idx) => taskQueue.push({ job, promptIndex: idx, prompt }));
    }

    let taskPointer = 0;

    const runTask = async () => {
      while (taskPointer < taskQueue.length) {
        const idx = taskPointer++;
        const task = taskQueue[idx];

        // Mark job as running if first prompt
        if (task.promptIndex === 0) {
          setJobs(prev => ({ ...prev, [task.job.key]: { ...prev[task.job.key], status: 'running' } }));
        }

        try {
          const result = await generateOneImage(task.prompt);
          if (result.base64) {
            const prompts = [task.job.prompt, ...(task.job.extraPrompts || [])];
            allResults.push({
              key: task.job.key, base64: result.base64,
              label: prompts.length > 1 ? `${task.job.labelDe} (${task.promptIndex + 1}/${prompts.length})` : task.job.labelDe,
              subIndex: task.promptIndex,
            });
            setJobs(prev => ({
              ...prev, [task.job.key]: { ...prev[task.job.key], status: 'running', results: [...(prev[task.job.key]?.results || []), result.base64!] },
            }));
          } else {
            setJobs(prev => ({
              ...prev, [task.job.key]: { ...prev[task.job.key], error: result.error },
            }));
          }
        } catch {
          setJobs(prev => ({
            ...prev, [task.job.key]: { ...prev[task.job.key], error: 'Netzwerkfehler' },
          }));
        }

        // Check if job is done (all prompts processed)
        const jobPrompts = [task.job.prompt, ...(task.job.extraPrompts || [])];
        const completedForJob = allResults.filter(r => r.key === task.job.key).length;
        const errorsForJob = taskQueue.filter((t, ti) => t.job.key === task.job.key && ti < taskPointer).length - completedForJob;
        if (completedForJob + errorsForJob >= jobPrompts.length) {
          setJobs(prev => {
            const state = prev[task.job.key];
            return {
              ...prev,
              [task.job.key]: {
                ...state,
                status: state.results.length > 0 ? 'done' : 'error',
                error: state.results.length === 0 ? (state.error || 'Alle Bilder fehlgeschlagen') : state.error,
              },
            };
          });
        }
      }
    };

    // Launch CONCURRENCY workers
    const workers = Array.from({ length: Math.min(CONCURRENCY, taskQueue.length) }, () => runTask());
    await Promise.all(workers);

    // Save all results to gallery
    if (allResults.length > 0 && user) {
      try {
        const folderName = getGalleryFolderName(vin);
        const storagePath = savedProjectId ? savedProjectId : `gallery/${folderName}`;

        // Only create project if we don't have one from PDF flow
        // Standalone flows: NO project creation – gallery only
        if (!savedProjectId) {
          // No project created – images go to gallery folder only
        }

        const { data: existingImages } = savedProjectId
          ? await supabase
              .from('project_images').select('sort_order').eq('project_id', savedProjectId)
              .order('sort_order', { ascending: false }).limit(1)
          : { data: null };
        const startOrder = (existingImages?.[0]?.sort_order ?? -1) + 1;

        const urls: string[] = [];
        for (let i = 0; i < allResults.length; i++) {
          const r = allResults[i];
          const url = await uploadImageToStorage(r.base64, user.id, `${storagePath}/${r.key}_${r.subIndex}.png`);
          if (url) urls.push(url);
        }

        if (urls.length > 0) {
          const imageRows = urls.map((url, i) => ({
            project_id: savedProjectId || null, user_id: user.id, image_url: url, image_base64: '',
            perspective: `Pipeline: ${allResults[i]?.label || `Bild ${i + 1}`}`, sort_order: startOrder + i,
            gallery_folder: folderName,
          }));
          await supabase.from('project_images').insert(imageRows as any);
        }

        toast.success(`${allResults.length} Pipeline-Bilder in Galerie gespeichert!`);
      } catch (e) {
        console.error('Pipeline save error:', e);
        toast.error('Bilder generiert, aber Speichern fehlgeschlagen.');
      }
    }

    setRunning(false);
    setFinished(true);
  }, [inputImages, originalImages, vehicleDescription, remasterConfig, modelTier, user, savedProjectId, selectedJobs, generateOneImage, vin]);

  /* ─── Credit pre-check before starting ─── */
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
  const allResultImages = useMemo(() => {
    const results: { key: string; label: string; base64: string }[] = [];
    for (const job of selectedJobs) {
      const state = jobs[job.key];
      if (state?.results) {
        state.results.forEach((r, i) => {
          const prompts = [job.prompt, ...(job.extraPrompts || [])];
          results.push({
            key: `${job.key}_${i}`,
            label: prompts.length > 1 ? `${job.labelDe} (${i + 1})` : job.labelDe,
            base64: r,
          });
        });
      }
    }
    return results;
  }, [jobs, selectedJobs]);

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
            <span>{running ? 'Pipeline läuft… (4 parallel)' : `${doneImages} von ${totalImages} Bilder erstellt`}</span>
            {running && <span>{doneImages}/{totalImages}</span>}
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Result Preview Grid */}
      {finished && allResultImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-foreground">
              Ergebnisse ({allResultImages.length})
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
              {allResultImages.map(img => (
                <div key={img.key} className="relative rounded-lg sm:rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
                  <img
                    src={img.base64.startsWith('data:') ? img.base64 : `data:image/png;base64,${img.base64}`}
                    alt={img.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 sm:p-2">
                    <p className="text-[9px] sm:text-[10px] text-white font-medium truncate">{img.label}</p>
                  </div>
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
          <div className="flex items-center gap-2">
            <Button
              onClick={onComplete}
              variant="outline"
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
            >
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Zur Galerie
            </Button>
            {savedProjectId && (
              <Button
                onClick={() => navigate(`/project/${savedProjectId}`)}
                className="gap-1.5 sm:gap-2 gradient-accent text-accent-foreground font-semibold text-xs sm:text-sm"
              >
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Zur Landing Page
              </Button>
            )}
          </div>
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
    </div>
  );
};

export default PipelineRunner;
