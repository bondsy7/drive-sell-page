import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadImageToStorage, getGalleryFolderName } from '@/lib/storage-utils';
import { toast } from 'sonner';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import { buildMasterPrompt, type RemasterConfig } from '@/lib/remaster-prompt';
import { type PipelineJob } from '@/lib/pipeline-jobs';

/* ─── Types ─── */
export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface JobState {
  status: JobStatus;
  results: string[];
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface ResultImage {
  key: string;
  jobKey: string;
  promptIndex: number;
  label: string;
  base64: string;
}

export interface PipelineConfig {
  inputImages: string[];
  originalImages: string[];
  additionalImages: string[];
  vehicleDescription: string;
  remasterConfig: RemasterConfig;
  modelTier: string;
  projectId: string | null;
  vin: string | null;
  selectedJobs: PipelineJob[];
  availableJobs: PipelineJob[];
  resolvedManufacturerLogoUrl: string | null;
  userId: string;
  detectedBrand: string | null;
  totalImages: number;
}

type PipelineStatus = 'idle' | 'running' | 'finished';

interface PipelineContextValue {
  status: PipelineStatus;
  isRunning: boolean;
  isFinished: boolean;
  jobs: Record<string, JobState>;
  startTime: number | null;
  endTime: number | null;
  elapsedMs: number;
  config: PipelineConfig | null;
  savedProjectId: string | null;
  totalImages: number;
  startPipeline: (config: PipelineConfig) => void;
  retryJob: (jobKey: string) => Promise<void>;
  retrySingleImage: (resultId: string, allResultImages: ResultImage[]) => Promise<void>;
  clearPipeline: () => void;
}

/* ─── Utility functions (extracted from PipelineRunner) ─── */
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

const CONCURRENCY = 4;

/* ─── Context ─── */
const PipelineContext = createContext<PipelineContextValue | null>(null);

export const usePipeline = (): PipelineContextValue => {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error('usePipeline must be used within PipelineProvider');
  return ctx;
};

export const PipelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<PipelineStatus>('idle');
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live timer
  useEffect(() => {
    if (status === 'running' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, startTime]);

  // Beforeunload warning
  useEffect(() => {
    if (status !== 'running') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  // Cached logo base64 – fetched ONCE before pipeline starts to ensure consistency
  const cachedManufacturerLogoBase64Ref = useRef<string | null>(null);
  const cachedDealerLogoBase64Ref = useRef<string | null>(null);

  // Helper to fetch a URL and convert to data URL (base64)
  const fetchUrlToBase64 = useCallback(async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) { console.warn('[Pipeline] Failed to fetch logo:', url, resp.status); return null; }
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) { console.warn('[Pipeline] Logo fetch error:', url, e); return null; }
  }, []);

  // Generate a single image using stored config
  const generateOneImage = useCallback(async (
    prompt: string, job: PipelineJob | undefined, cfg: PipelineConfig
  ): Promise<{ base64: string | null; error?: string }> => {
    const referenceImages = cfg.originalImages.length > 0 ? cfg.originalImages : cfg.inputImages;
    const primaryReferenceIndex = inferPrimaryReferenceIndex(job, prompt, referenceImages.length);
    const primaryReference = referenceImages[primaryReferenceIndex] || referenceImages[0];
    const supportingReferences = referenceImages
      .filter((_, i) => i !== primaryReferenceIndex)
      .concat(cfg.additionalImages);
    const baseContext = buildMasterPrompt(cfg.remasterConfig, cfg.vehicleDescription);
    const taskLock = buildTaskOutputLock(job);

    // Detect if this is an interior/detail job – prevents AI from generating exterior views
    const isInteriorJob = job?.category === 'interior';
    const isDetailJob = job?.category === 'detail';

    // For interior jobs, add an explicit override to prevent exterior generation
    const interiorOverride = isInteriorJob
      ? `\n\nCRITICAL INTERIOR OVERRIDE (HÖCHSTE PRIORITÄT):
Dies ist eine INNENRAUM-Aufnahme. Das bereitgestellte Referenzbild zeigt das INTERIEUR des Fahrzeugs.
- Du MUSST das Interieur-Referenzbild remastern – NICHT eine Außenansicht generieren
- Behalte die EXAKTE Perspektive, den Blickwinkel und die Komposition des Referenzbildes bei
- Verbessere NUR die Beleuchtung, entferne Unordnung, und ersetze den durch die Scheiben sichtbaren Hintergrund durch den Showroom
- Generiere unter KEINEN Umständen eine Außenansicht des Fahrzeugs
- Das Fahrzeugdach, alle Säulen (A/B/C), Türverkleidungen, Sonnenblenden und der Rückspiegel müssen VOLLSTÄNDIG erhalten bleiben
- Schneide NICHTS ab – das Bild muss die gleiche Komposition wie das Original haben`
      : '';

    const fullPrompt = `${baseContext}${interiorOverride}\n\n${taskLock}\n\n--- PERSPECTIVE INSTRUCTION ---\n${prompt}`;

    // Always prefer cached base64 logos over URLs for consistency
    const manufacturerLogoBase64 = cfg.remasterConfig.showManufacturerLogo
      ? (cachedManufacturerLogoBase64Ref.current || cfg.remasterConfig.manufacturerLogoBase64 || null)
      : null;
    const dealerLogoBase64 = cfg.remasterConfig.showDealerLogo
      ? (cachedDealerLogoBase64Ref.current || cfg.remasterConfig.dealerLogoBase64 || null)
      : null;

    // For interior jobs: do NOT send the custom showroom image – it confuses the AI into generating exterior views
    // The showroom should only be visible THROUGH the windows, described via text prompt
    const showroomBase64ForRequest = isInteriorJob ? null : (cfg.remasterConfig.customShowroomBase64 || null);

    const { data, error } = await invokeRemasterVehicleImage({
      imageBase64: primaryReference,
      additionalImages: supportingReferences.length > 0 ? supportingReferences : undefined,
      vehicleDescription: cfg.vehicleDescription,
      modelTier: cfg.modelTier,
      dynamicPrompt: fullPrompt,
      customShowroomBase64: showroomBase64ForRequest,
      customPlateImageBase64: isInteriorJob ? null : (cfg.remasterConfig.customPlateImageBase64 || null),
      // Only pass URL as fallback if base64 is not available
      dealerLogoUrl: dealerLogoBase64 ? null : (cfg.remasterConfig.showDealerLogo ? cfg.remasterConfig.dealerLogoUrl : null),
      dealerLogoBase64: dealerLogoBase64,
      manufacturerLogoUrl: manufacturerLogoBase64 ? null : (cfg.remasterConfig.showManufacturerLogo ? cfg.resolvedManufacturerLogoUrl : null),
      manufacturerLogoBase64: manufacturerLogoBase64,
    });

    if (error || !data?.imageBase64) {
      return { base64: null, error: data?.error || error?.message || 'Generierung fehlgeschlagen' };
    }
    return { base64: data.imageBase64 };
  }, [fetchUrlToBase64]);

  const startPipeline = useCallback((cfg: PipelineConfig) => {
    setConfig(cfg);
    setSavedProjectId(cfg.projectId);
    const startTs = Date.now();
    setStartTime(startTs);
    setEndTime(null);
    setElapsedMs(0);
    setStatus('running');

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Initialize job states
    const initStates: Record<string, JobState> = {};
    cfg.selectedJobs.forEach(j => { initStates[j.key] = { status: 'pending', results: [] }; });
    setJobs(initStates);

    // Run pipeline async (survives navigation since context is at App level)
    (async () => {
      // Pre-cache logos as base64 ONCE before any image generation
      // This ensures the EXACT same logo binary is used for every single image
      cachedManufacturerLogoBase64Ref.current = null;
      cachedDealerLogoBase64Ref.current = null;

      const logoFetches: Promise<void>[] = [];
      if (cfg.remasterConfig.showManufacturerLogo) {
        if (cfg.remasterConfig.manufacturerLogoBase64) {
          cachedManufacturerLogoBase64Ref.current = cfg.remasterConfig.manufacturerLogoBase64;
        } else if (cfg.resolvedManufacturerLogoUrl) {
          logoFetches.push(
            fetchUrlToBase64(cfg.resolvedManufacturerLogoUrl).then(b64 => {
              if (b64) {
                cachedManufacturerLogoBase64Ref.current = b64;
                console.log('[Pipeline] Manufacturer logo pre-cached as base64 ✓');
              }
            })
          );
        }
      }
      if (cfg.remasterConfig.showDealerLogo) {
        if (cfg.remasterConfig.dealerLogoBase64) {
          cachedDealerLogoBase64Ref.current = cfg.remasterConfig.dealerLogoBase64;
        } else if (cfg.remasterConfig.dealerLogoUrl) {
          logoFetches.push(
            fetchUrlToBase64(cfg.remasterConfig.dealerLogoUrl).then(b64 => {
              if (b64) {
                cachedDealerLogoBase64Ref.current = b64;
                console.log('[Pipeline] Dealer logo pre-cached as base64 ✓');
              }
            })
          );
        }
      }
      if (logoFetches.length > 0) await Promise.all(logoFetches);

      const allResults: { key: string; base64: string; label: string; subIndex: number }[] = [];
      const jobTimings: Record<string, { start: number; end?: number }> = {};

      const taskQueue: { job: PipelineJob; promptIndex: number; prompt: string }[] = [];
      for (const job of cfg.selectedJobs) {
        const prompts = [job.prompt, ...(job.extraPrompts || [])];
        prompts.forEach((prompt, idx) => taskQueue.push({ job, promptIndex: idx, prompt }));
      }

      let taskPointer = 0;

      const runTask = async () => {
        while (taskPointer < taskQueue.length) {
          const idx = taskPointer++;
          const task = taskQueue[idx];

          if (task.promptIndex === 0) {
            jobTimings[task.job.key] = { start: Date.now() };
            setJobs(prev => ({ ...prev, [task.job.key]: { ...prev[task.job.key], status: 'running', startTime: Date.now() } }));
          }

          try {
            const result = await generateOneImage(task.prompt, task.job, cfg);
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

          // Check if job is done
          const jobPrompts = [task.job.prompt, ...(task.job.extraPrompts || [])];
          const completedForJob = allResults.filter(r => r.key === task.job.key).length;
          const errorsForJob = taskQueue.filter((t, ti) => t.job.key === task.job.key && ti < taskPointer).length - completedForJob;
          if (completedForJob + errorsForJob >= jobPrompts.length) {
            if (jobTimings[task.job.key]) jobTimings[task.job.key].end = Date.now();
            setJobs(prev => {
              const state = prev[task.job.key];
              return {
                ...prev,
                [task.job.key]: {
                  ...state,
                  status: state.results.length > 0 ? 'done' : 'error',
                  error: state.results.length === 0 ? (state.error || 'Alle Bilder fehlgeschlagen') : state.error,
                  endTime: Date.now(),
                },
              };
            });
          }
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, taskQueue.length) }, () => runTask());
      await Promise.all(workers);

      const endTs = Date.now();
      setEndTime(endTs);
      setElapsedMs(endTs - startTs);

      // Save results to gallery
      if (allResults.length > 0) {
        try {
          const folderName = getGalleryFolderName(cfg.vin);
          const storagePath = cfg.projectId ? cfg.projectId : `gallery/${folderName}`;

          const { data: existingImages } = cfg.projectId
            ? await supabase.from('project_images').select('sort_order').eq('project_id', cfg.projectId)
                .order('sort_order', { ascending: false }).limit(1)
            : { data: null };
          const startOrder = (existingImages?.[0]?.sort_order ?? -1) + 1;

          const urls: string[] = [];
          for (let i = 0; i < allResults.length; i++) {
            const r = allResults[i];
            const url = await uploadImageToStorage(r.base64, cfg.userId, `${storagePath}/${r.key}_${r.subIndex}.png`);
            if (url) urls.push(url);
          }

          if (urls.length > 0) {
            const imageRows = urls.map((url, i) => ({
              project_id: cfg.projectId || null, user_id: cfg.userId, image_url: url, image_base64: '',
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
        const jobDurations = cfg.selectedJobs.map(j => {
          const timing = jobTimings[j.key];
          const dur = timing?.end && timing?.start ? timing.end - timing.start : 0;
          const completed = allResults.filter(r => r.key === j.key).length;
          return { key: j.key, label: j.labelDe, duration_ms: dur, images: completed, status: completed > 0 ? 'done' : 'error' };
        });

        const failedCount = cfg.selectedJobs.reduce((s, j) => {
          const prompts = [j.prompt, ...(j.extraPrompts || [])];
          const completed = allResults.filter(r => r.key === j.key).length;
          return s + (prompts.length - completed);
        }, 0);

        await supabase.from('pipeline_timing_logs' as any).insert({
          user_id: cfg.userId, project_id: cfg.projectId || null, model_tier: cfg.modelTier,
          total_jobs: cfg.selectedJobs.length, total_images: cfg.totalImages,
          completed_images: allResults.length, failed_images: failedCount,
          total_duration_ms: endTs - startTs, job_durations: jobDurations,
          vehicle_description: cfg.vehicleDescription?.slice(0, 200) || null,
          detected_brand: cfg.detectedBrand || null,
        } as any);
      } catch (e) {
        console.error('Failed to save timing log:', e);
      }

      setStatus('finished');

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Pipeline fertig! ✅', {
            body: `${allResults.length} Bilder erfolgreich generiert.`,
            icon: '/favicon.ico',
          });
        } catch { /* ignore */ }
      }
    })();
  }, [generateOneImage]);

  const retryJob = useCallback(async (jobKey: string) => {
    if (!config) return;
    const job = config.availableJobs.find(j => j.key === jobKey);
    if (!job) return;

    setJobs(prev => ({ ...prev, [jobKey]: { status: 'running', results: [] } }));

    const prompts = [job.prompt, ...(job.extraPrompts || [])];
    const jobResults: string[] = [];
    let jobError: string | undefined;

    for (const prompt of prompts) {
      try {
        const result = await generateOneImage(prompt, job, config);
        if (result.base64) {
          jobResults.push(result.base64);
          setJobs(prev => ({
            ...prev, [jobKey]: { ...prev[jobKey], status: 'running', results: [...prev[jobKey].results, result.base64!] },
          }));
        } else { jobError = result.error; }
      } catch { jobError = 'Netzwerkfehler'; }
    }

    if (jobResults.length > 0) {
      setJobs(prev => ({ ...prev, [jobKey]: { status: 'done', results: jobResults, error: jobError } }));
      try {
        const folderName = getGalleryFolderName(config.vin);
        const storagePath = config.projectId ? config.projectId : `gallery/${folderName}`;
        for (let i = 0; i < jobResults.length; i++) {
          const url = await uploadImageToStorage(jobResults[i], config.userId, `${storagePath}/${jobKey}_retry_${i}.png`);
          if (url) {
            await supabase.from('project_images').insert({
              project_id: config.projectId || null, user_id: config.userId, image_url: url,
              image_base64: '', perspective: `Pipeline: ${job.labelDe} (Retry)`, sort_order: 999 + i,
              gallery_folder: folderName,
            } as any);
          }
        }
      } catch (e) { console.error('Retry save error:', e); }
    } else {
      setJobs(prev => ({ ...prev, [jobKey]: { status: 'error', results: [], error: jobError || 'Alle Bilder fehlgeschlagen' } }));
    }
  }, [config, generateOneImage]);

  const retrySingleImage = useCallback(async (resultId: string, allResultImages: ResultImage[]) => {
    if (!config) return;
    const resultImg = allResultImages.find(r => r.key === resultId);
    if (!resultImg) return;
    const job = config.availableJobs.find(j => j.key === resultImg.jobKey);
    if (!job) return;

    const prompts = [job.prompt, ...(job.extraPrompts || [])];
    const prompt = prompts[resultImg.promptIndex] || prompts[0];

    try {
      const result = await generateOneImage(prompt, job, config);
      if (result.base64) {
        setJobs(prev => {
          const state = prev[resultImg.jobKey];
          const newResults = [...(state?.results || [])];
          newResults[resultImg.promptIndex] = result.base64!;
          return { ...prev, [resultImg.jobKey]: { ...state, results: newResults } };
        });
        toast.success('Bild erfolgreich neu generiert.');
        try {
          const folderName = getGalleryFolderName(config.vin);
          const storagePath = config.projectId ? config.projectId : `gallery/${folderName}`;
          const url = await uploadImageToStorage(result.base64, config.userId, `${storagePath}/${resultImg.jobKey}_regen_${resultImg.promptIndex}.png`);
          if (url) {
            await supabase.from('project_images').insert({
              project_id: config.projectId || null, user_id: config.userId, image_url: url,
              image_base64: '', perspective: `Pipeline: ${resultImg.label} (Regen)`, sort_order: 999,
              gallery_folder: folderName,
            } as any);
          }
        } catch (e) { console.error('Regen save error:', e); }
      } else {
        toast.error(result.error || 'Generierung fehlgeschlagen');
      }
    } catch {
      toast.error('Netzwerkfehler bei Regenerierung');
    }
  }, [config, generateOneImage]);

  const clearPipeline = useCallback(() => {
    setStatus('idle');
    setJobs({});
    setStartTime(null);
    setEndTime(null);
    setElapsedMs(0);
    setConfig(null);
    setSavedProjectId(null);
  }, []);

  return (
    <PipelineContext.Provider value={{
      status, isRunning: status === 'running', isFinished: status === 'finished',
      jobs, startTime, endTime, elapsedMs, config, savedProjectId,
      totalImages: config?.totalImages ?? 0,
      startPipeline, retryJob, retrySingleImage, clearPipeline,
    }}>
      {children}
    </PipelineContext.Provider>
  );
};
