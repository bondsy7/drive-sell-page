import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { Loader2, Check, AlertCircle, Zap, ArrowRight, ChevronDown, ChevronUp, Image, Images, RotateCcw, Eye, EyeOff } from 'lucide-react';
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
import { buildMasterPrompt, type RemasterConfig, fetchManufacturerLogos } from '@/lib/remaster-prompt';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';

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
}

type JobStatus = 'pending' | 'running' | 'done' | 'error';

interface JobState {
  status: JobStatus;
  results: string[];
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface JobDurationEntry {
  key: string;
  label: string;
  duration_ms: number;
  images: number;
  status: string;
}

const FRONT_REFERENCE_PATTERNS = /(master|front|34_front|3\/4 vorne|3\/4 front|headlight|scheinwerfer|grille|kühlergrill|kuehlergrill|emblem)/i;
const REAR_REFERENCE_PATTERNS = /(rear|heck|34_rear|3\/4 hinten|3\/4 heck|taillight|rücklicht|ruecklicht|kofferraum|boot|trunk)/i;
const SIDE_REFERENCE_PATTERNS = /(side|seite|profile)/i;
const FRONT_INTERIOR_PATTERNS = /(dashboard|armaturenbrett|fahrer|driver|center console|mittelkonsole|cabin|kabine|mbux|screen|display|steering|lenkrad|cluster)/i;
const REAR_INTERIOR_PATTERNS = /(rear seats|rear seat|rücksitz|ruecksitz|rücksitzbank|ruecksitzbank)/i;

function inferPrimaryReferenceIndex(job: PipelineJob | undefined, promptText: string, availableCount: number): number {
  if (availableCount <= 1) return 0;

  const signature = `${job?.key || ''} ${job?.label || ''} ${job?.labelDe || ''} ${promptText}`;

  if (REAR_INTERIOR_PATTERNS.test(signature) && availableCount >= 5) return 4;
  if (FRONT_INTERIOR_PATTERNS.test(signature) && availableCount >= 4) return 3;
  if (REAR_REFERENCE_PATTERNS.test(signature) && availableCount >= 3) return 2;
  if (SIDE_REFERENCE_PATTERNS.test(signature) && availableCount >= 2) return 1;
  if (FRONT_REFERENCE_PATTERNS.test(signature)) return 0;

  return 0;
}

function buildTaskOutputLock(job: PipelineJob | undefined): string {
  const jobName = job?.labelDe || job?.label || 'angeforderte Pipeline-Ansicht';

  return `TASK OUTPUT LOCK (ABSOLUTE PRIORITY):
- Generate ONLY the requested pipeline step: "${jobName}".
- Follow the requested perspective exactly. Never replace it with a visually similar but different angle.
- Rear means rear. Front means front. Side means true side profile. 3/4 left/right means exactly that left/right side.
- Interior means interior only. Detail means detail only. Do NOT switch between exterior, interior, and detail shots.
- Do NOT add, remove, redesign, simplify, restyle, or reinterpret any logo, badge, emblem, lettering, wall logo, or brand mark.
- If a logo asset is provided, treat it as IMMUTABLE SOURCE MATERIAL: preserve exact silhouette, border/frame, symbol, text, proportions, placement logic, and colors.
- Do NOT invent any missing view information. Use the matching reference image and detail photos to reproduce exactly what was requested.`;
}

/* ─── Constants ─── */
const CONCURRENCY = 4; // parallel image generation slots
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
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, getCost } = useCredits();

  // Fetch prompt overrides from admin_settings
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

  // Detect brand for CI filtering
  const detectedBrand = useMemo(
    () => detectBrandFromDescription(vehicleDescription, vehicleBrand),
    [vehicleDescription, vehicleBrand],
  );

  const availableJobs = useMemo(() =>
    applyPromptOverrides(PIPELINE_JOBS, promptOverrides).filter(j => {
      if (j.category !== 'ci') return true;
      return j.brand === detectedBrand;
    }),
    [detectedBrand, promptOverrides],
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  // Timing state
  const [pipelineStartTime, setPipelineStartTime] = useState<number | null>(null);
  const [pipelineEndTime, setPipelineEndTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live timer
  useEffect(() => {
    if (running && pipelineStartTime) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - pipelineStartTime);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, pipelineStartTime]);

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    if (min === 0) return `${sec}s`;
    return `${min}m ${sec % 60}s`;
  };

  const totalDurationMs = pipelineEndTime && pipelineStartTime ? pipelineEndTime - pipelineStartTime : elapsedMs;

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
  const generateOneImage = useCallback(async (prompt: string, job?: PipelineJob): Promise<{ base64: string | null; error?: string }> => {
    const referenceImages = originalImages && originalImages.length > 0 ? originalImages : inputImages;
    const primaryReferenceIndex = inferPrimaryReferenceIndex(job, prompt, referenceImages.length);
    const primaryReference = referenceImages[primaryReferenceIndex] || referenceImages[0];
    const supportingReferences = referenceImages
      .filter((_, index) => index !== primaryReferenceIndex)
      .concat(additionalImages || []);
    const baseContext = buildMasterPrompt(remasterConfig, vehicleDescription);
    const taskLock = buildTaskOutputLock(job);
    const fullPrompt = `${baseContext}\n\n${taskLock}\n\n--- PERSPECTIVE INSTRUCTION ---\n${prompt}`;

    const { data, error } = await invokeRemasterVehicleImage({
      imageBase64: primaryReference,
      additionalImages: supportingReferences.length > 0 ? supportingReferences : undefined,
      vehicleDescription,
      modelTier,
      dynamicPrompt: fullPrompt,
      customShowroomBase64: remasterConfig.customShowroomBase64 || null,
      customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
      dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
      dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
      manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? resolvedManufacturerLogoUrl : null,
      manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
    });

    if (error || !data?.imageBase64) {
      return { base64: null, error: data?.error || error?.message || 'Generierung fehlgeschlagen' };
    }
    return { base64: data.imageBase64 };
  }, [inputImages, originalImages, additionalImages, vehicleDescription, remasterConfig, modelTier, resolvedManufacturerLogoUrl]);

  /* ─── Retry a single failed job ─── */
  const retryJob = useCallback(async (jobKey: string) => {
    const job = availableJobs.find(j => j.key === jobKey);
    if (!job) return;

    setRegeneratingIds(prev => new Set(prev).add(jobKey));
    setJobs(prev => ({ ...prev, [jobKey]: { status: 'running', results: [] } }));

    const prompts = [job.prompt, ...(job.extraPrompts || [])];
    const jobResults: string[] = [];
    let jobError: string | undefined;

    for (let p = 0; p < prompts.length; p++) {
      try {
        const result = await generateOneImage(prompts[p], job);
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
    setRegeneratingIds(prev => { const next = new Set(prev); next.delete(jobKey); return next; });
  }, [availableJobs, generateOneImage, user, savedProjectId, vin]);

  /* ─── Pipeline with parallel execution ─── */
  const runPipeline = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    if (selectedJobs.length === 0) { toast.error('Bitte wähle mindestens einen Job aus.'); return; }

    const startTs = Date.now();
    setPipelineStartTime(startTs);
    setPipelineEndTime(null);
    setElapsedMs(0);
    setRunning(true);
    const allResults: { key: string; base64: string; label: string; subIndex: number }[] = [];

    // Per-job timing
    const jobTimings: Record<string, { start: number; end?: number }> = {};

    // Initialize job states
    const initStates: Record<string, JobState> = {};
    selectedJobs.forEach(j => { initStates[j.key] = { status: 'pending', results: [], startTime: undefined, endTime: undefined }; });
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

        // Mark job as running if first prompt, track start time
        if (task.promptIndex === 0) {
          jobTimings[task.job.key] = { start: Date.now() };
          setJobs(prev => ({ ...prev, [task.job.key]: { ...prev[task.job.key], status: 'running', startTime: Date.now() } }));
        }

        try {
          const result = await generateOneImage(task.prompt, task.job);
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
          if (jobTimings[task.job.key]) jobTimings[task.job.key].end = Date.now();
          const endTime = Date.now();
          setJobs(prev => {
            const state = prev[task.job.key];
            return {
              ...prev,
              [task.job.key]: {
                ...state,
                status: state.results.length > 0 ? 'done' : 'error',
                error: state.results.length === 0 ? (state.error || 'Alle Bilder fehlgeschlagen') : state.error,
                endTime,
              },
            };
          });
        }
      }
    };

    // Launch CONCURRENCY workers
    const workers = Array.from({ length: Math.min(CONCURRENCY, taskQueue.length) }, () => runTask());
    await Promise.all(workers);

    const endTs = Date.now();
    setPipelineEndTime(endTs);
    setElapsedMs(endTs - startTs);

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

    // Save timing log
    try {
      const jobDurations: JobDurationEntry[] = selectedJobs.map(j => {
        const timing = jobTimings[j.key];
        const dur = timing?.end && timing?.start ? timing.end - timing.start : 0;
        const completed = allResults.filter(r => r.key === j.key).length;
        return {
          key: j.key,
          label: j.labelDe,
          duration_ms: dur,
          images: completed,
          status: completed > 0 ? 'done' : 'error',
        };
      });

      const failedCount = selectedJobs.reduce((s, j) => {
        const prompts = [j.prompt, ...(j.extraPrompts || [])];
        const completed = allResults.filter(r => r.key === j.key).length;
        return s + (prompts.length - completed);
      }, 0);

      await supabase.from('pipeline_timing_logs' as any).insert({
        user_id: user.id,
        project_id: savedProjectId || null,
        model_tier: modelTier,
        total_jobs: selectedJobs.length,
        total_images: totalImages,
        completed_images: allResults.length,
        failed_images: failedCount,
        total_duration_ms: endTs - startTs,
        job_durations: jobDurations,
        vehicle_description: vehicleDescription?.slice(0, 200) || null,
        detected_brand: detectedBrand || null,
      } as any);
    } catch (e) {
      console.error('Failed to save timing log:', e);
    }

    setRunning(false);
    setFinished(true);
  }, [inputImages, originalImages, vehicleDescription, remasterConfig, modelTier, user, savedProjectId, selectedJobs, generateOneImage, vin, totalImages, detectedBrand]);

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
    const results: { key: string; jobKey: string; promptIndex: number; label: string; base64: string }[] = [];
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

  // Regenerate a single pipeline result image
  const retrySinglePipelineImage = useCallback(async (resultId: string) => {
    const resultImg = allResultImages.find(r => r.key === resultId);
    if (!resultImg) return;
    const job = availableJobs.find(j => j.key === resultImg.jobKey);
    if (!job) return;

    setRegeneratingIds(prev => new Set(prev).add(resultId));
    const prompts = [job.prompt, ...(job.extraPrompts || [])];
    const prompt = prompts[resultImg.promptIndex] || prompts[0];

    try {
      const result = await generateOneImage(prompt, job);
      if (result.base64) {
        setJobs(prev => {
          const state = prev[resultImg.jobKey];
          const newResults = [...(state?.results || [])];
          newResults[resultImg.promptIndex] = result.base64!;
          return { ...prev, [resultImg.jobKey]: { ...state, results: newResults } };
        });
        toast.success('Bild erfolgreich neu generiert.');

        // Save to gallery
        if (user) {
          try {
            const folderName = getGalleryFolderName(vin);
            const storagePath = savedProjectId ? savedProjectId : `gallery/${folderName}`;
            const url = await uploadImageToStorage(result.base64, user.id, `${storagePath}/${resultImg.jobKey}_regen_${resultImg.promptIndex}.png`);
            if (url) {
              await supabase.from('project_images').insert({
                project_id: savedProjectId || null, user_id: user.id, image_url: url,
                image_base64: '', perspective: `Pipeline: ${resultImg.label} (Regen)`, sort_order: 999,
                gallery_folder: folderName,
              } as any);
            }
          } catch (e) { console.error('Regen save error:', e); }
        }
      } else {
        toast.error(result.error || 'Generierung fehlgeschlagen');
      }
    } catch {
      toast.error('Netzwerkfehler bei Regenerierung');
    }
    setRegeneratingIds(prev => { const next = new Set(prev); next.delete(resultId); return next; });
  }, [allResultImages, availableJobs, generateOneImage, user, savedProjectId, vin]);

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
