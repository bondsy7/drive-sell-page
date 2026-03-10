import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Loader2, Check, AlertCircle, Zap, ArrowRight, ChevronDown, ChevronUp, Image, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadImageToStorage } from '@/lib/storage-utils';
import { toast } from 'sonner';
import {
  PIPELINE_JOBS,
  PIPELINE_CATEGORIES,
  type PipelineJob,
  detectBrandFromDescription,
  getTotalImageCount,
} from '@/lib/pipeline-jobs';
import { buildMasterPrompt, type RemasterConfig } from '@/lib/remaster-prompt';

interface PipelineRunnerProps {
  inputImages: string[];
  originalImages?: string[];
  vehicleDescription: string;
  remasterConfig: RemasterConfig;
  modelTier?: string;
  onComplete: () => void;
  onBack: () => void;
}

type JobStatus = 'pending' | 'running' | 'done' | 'error';

interface JobState {
  status: JobStatus;
  /** For multi-image jobs: array of base64 results */
  results: string[];
  error?: string;
}

const PipelineRunner: React.FC<PipelineRunnerProps> = ({
  inputImages,
  originalImages,
  vehicleDescription,
  remasterConfig,
  modelTier = 'standard',
  onComplete,
  onBack,
}) => {
  const { user } = useAuth();

  // Detect brand for CI filtering
  const detectedBrand = useMemo(
    () => detectBrandFromDescription(vehicleDescription),
    [vehicleDescription],
  );

  // Filter jobs: show non-CI jobs always, CI jobs only for detected brand
  const availableJobs = useMemo(() =>
    PIPELINE_JOBS.filter(j => {
      if (j.category !== 'ci') return true;
      return j.brand === detectedBrand;
    }),
    [detectedBrand],
  );

  // Job selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    new Set(availableJobs.filter(j => j.defaultSelected).map(j => j.key))
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(PIPELINE_CATEGORIES.map(c => c.key))
  );

  // Re-sync selection when brand changes
  useEffect(() => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      // Add newly available default CI jobs
      availableJobs.forEach(j => {
        if (j.category === 'ci' && j.defaultSelected && !next.has(j.key)) {
          next.add(j.key);
        }
      });
      // Remove CI jobs from other brands
      PIPELINE_JOBS.forEach(j => {
        if (j.category === 'ci' && j.brand !== detectedBrand) {
          next.delete(j.key);
        }
      });
      return next;
    });
  }, [detectedBrand, availableJobs]);

  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSubIndex, setCurrentSubIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const selectedJobs = availableJobs.filter(j => selectedKeys.has(j.key));
  const totalImages = getTotalImageCount(selectedKeys);
  const doneImages = Object.values(jobs).reduce((s, j) => s + j.results.length, 0);

  const toggleJob = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (catKey: string) => {
    const catJobs = availableJobs.filter(j => j.category === catKey);
    const allSelected = catJobs.every(j => selectedKeys.has(j.key));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      catJobs.forEach(j => {
        if (allSelected) next.delete(j.key);
        else next.add(j.key);
      });
      return next;
    });
  };

  const toggleCategoryExpand = (catKey: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  };

  // Save remastered input images on mount
  useEffect(() => {
    if (!user || inputImages.length === 0 || savedProjectId) return;
    (async () => {
      try {
        const dateStr = new Date().toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        const { data: project } = await supabase.from('projects').insert({
          user_id: user.id,
          title: `Showroom ${dateStr}`,
          vehicle_data: { vehicle: { brand: vehicleDescription || 'Showroom' } } as any,
          template_id: 'modern',
        }).select('id').single();

        if (!project) return;
        setSavedProjectId(project.id);

        const urls: string[] = [];
        for (let i = 0; i < inputImages.length; i++) {
          const url = await uploadImageToStorage(
            inputImages[i], user.id, `${project.id}/remaster_${i}.png`,
          );
          if (url) urls.push(url);
        }

        if (urls.length > 0) {
          await supabase.from('projects').update({ main_image_url: urls[0] }).eq('id', project.id);
          const perspectives = ['3/4 Front', 'Seite', 'Hinten', 'Interieur Fahrersitz', 'Interieur Rücksitz'];
          const imageRows = urls.map((url, i) => ({
            project_id: project.id,
            user_id: user.id,
            image_url: url,
            image_base64: '',
            perspective: perspectives[i] || `Bild ${i + 1}`,
            sort_order: i,
          }));
          await supabase.from('project_images').insert(imageRows);
        }
      } catch (e) {
        console.error('Error saving remastered images:', e);
      }
    })();
  }, [user, inputImages, vehicleDescription, savedProjectId]);

  /** Generate a single image from a prompt */
  const generateOneImage = useCallback(async (prompt: string): Promise<{ base64: string | null; error?: string }> => {
    const referenceImages = originalImages && originalImages.length > 0 ? originalImages : inputImages;
    const baseContext = buildMasterPrompt(remasterConfig, vehicleDescription);
    const fullPrompt = `${baseContext}\n\n--- PERSPECTIVE INSTRUCTION ---\n${prompt}`;

    const { data, error } = await supabase.functions.invoke('remaster-vehicle-image', {
      body: {
        imageBase64: referenceImages[0],
        additionalImages: referenceImages.slice(1),
        vehicleDescription,
        modelTier,
        dynamicPrompt: fullPrompt,
        customShowroomBase64: remasterConfig.customShowroomBase64 || null,
        customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
        dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
      },
    });

    if (error || !data?.imageBase64) {
      return { base64: null, error: data?.error || error?.message || 'Generierung fehlgeschlagen' };
    }
    return { base64: data.imageBase64 };
  }, [inputImages, originalImages, vehicleDescription, remasterConfig, modelTier]);

  const runPipeline = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    if (selectedJobs.length === 0) { toast.error('Bitte wähle mindestens einen Job aus.'); return; }

    setRunning(true);
    const allResults: { key: string; base64: string; label: string; subIndex: number }[] = [];

    // Initialize job states
    const initStates: Record<string, JobState> = {};
    selectedJobs.forEach(j => { initStates[j.key] = { status: 'pending', results: [] }; });
    setJobs(initStates);

    let globalImageIndex = 0;

    for (let i = 0; i < selectedJobs.length; i++) {
      const job = selectedJobs[i];
      setCurrentIndex(i);
      setCurrentSubIndex(0);
      setJobs(prev => ({ ...prev, [job.key]: { status: 'running', results: [] } }));

      // Collect all prompts for this job
      const prompts = [job.prompt, ...(job.extraPrompts || [])];
      const jobResults: string[] = [];
      let jobError: string | undefined;

      for (let p = 0; p < prompts.length; p++) {
        setCurrentSubIndex(p);
        globalImageIndex++;

        try {
          const result = await generateOneImage(prompts[p]);
          if (result.base64) {
            jobResults.push(result.base64);
            allResults.push({
              key: job.key,
              base64: result.base64,
              label: prompts.length > 1 ? `${job.labelDe} (${p + 1}/${prompts.length})` : job.labelDe,
              subIndex: p,
            });
            // Update state with partial results
            setJobs(prev => ({
              ...prev,
              [job.key]: { status: 'running', results: [...prev[job.key].results, result.base64!] },
            }));
          } else {
            jobError = result.error;
          }
        } catch {
          jobError = 'Netzwerkfehler';
        }
      }

      // Finalize job status
      if (jobResults.length > 0) {
        setJobs(prev => ({
          ...prev,
          [job.key]: { status: jobResults.length === prompts.length ? 'done' : 'done', results: jobResults, error: jobError },
        }));
      } else {
        setJobs(prev => ({
          ...prev,
          [job.key]: { status: 'error', results: [], error: jobError || 'Alle Bilder fehlgeschlagen' },
        }));
      }
    }

    // Save all results
    if (allResults.length > 0 && user) {
      try {
        const projectId = savedProjectId || crypto.randomUUID();

        if (!savedProjectId) {
          const dateStr = new Date().toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
          await supabase.from('projects').insert({
            id: projectId,
            user_id: user.id,
            title: `Pipeline ${dateStr}`,
            vehicle_data: { vehicle: { brand: vehicleDescription || 'Pipeline' } } as any,
            template_id: 'modern',
          });
        }

        const { data: existingImages } = await supabase
          .from('project_images')
          .select('sort_order')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: false })
          .limit(1);
        const startOrder = (existingImages?.[0]?.sort_order ?? -1) + 1;

        const urls: string[] = [];
        for (let i = 0; i < allResults.length; i++) {
          const r = allResults[i];
          const url = await uploadImageToStorage(
            r.base64, user.id, `${projectId}/${r.key}_${r.subIndex}.png`,
          );
          if (url) urls.push(url);
        }

        if (urls.length > 0) {
          const imageRows = urls.map((url, i) => ({
            project_id: projectId,
            user_id: user.id,
            image_url: url,
            image_base64: '',
            perspective: `Pipeline: ${allResults[i]?.label || `Bild ${i + 1}`}`,
            sort_order: startOrder + i,
          }));
          await supabase.from('project_images').insert(imageRows);
        }

        toast.success(`${allResults.length} Pipeline-Bilder erstellt und gespeichert!`);
      } catch (e) {
        console.error('Pipeline save error:', e);
        toast.error('Bilder generiert, aber Speichern fehlgeschlagen.');
      }
    }

    setRunning(false);
    setFinished(true);
  }, [inputImages, originalImages, vehicleDescription, remasterConfig, modelTier, user, savedProjectId, selectedJobs, generateOneImage]);

  const progressPercent = running ? (doneImages / totalImages) * 100 : finished ? 100 : 0;

  // Check which categories have available jobs
  const categoriesWithJobs = PIPELINE_CATEGORIES.filter(cat =>
    availableJobs.some(j => j.category === cat.key)
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          Image Generation Pipeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Wähle die gewünschten Perspektiven und Pakete. Jedes Bild wird einzeln im gleichen Showroom generiert.
        </p>
        {detectedBrand && (
          <Badge variant="secondary" className="mt-2 gap-1.5">
            <Image className="w-3 h-3" />
            CI-Guidelines: {detectedBrand.charAt(0).toUpperCase() + detectedBrand.slice(1)} erkannt
          </Badge>
        )}
      </div>

      {/* Job Selection by Category */}
      <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
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
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={() => !running && toggleCategory(cat.key)}
                  disabled={running}
                  className="shrink-0"
                />
                <button
                  onClick={() => toggleCategoryExpand(cat.key)}
                  className="flex items-center gap-2 flex-1 text-left"
                  disabled={running}
                >
                  <span className="text-sm font-semibold text-foreground">{cat.labelDe}</span>
                  <span className="text-xs text-muted-foreground">
                    ({selectedCount}/{catJobs.length})
                    {catImageCount > 0 && ` · ${catImageCount} Bilder`}
                  </span>
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
                </button>
              </div>

              {/* Jobs in category */}
              {isExpanded && catJobs.map(job => {
                const state = jobs[job.key];
                const isSelected = selectedKeys.has(job.key);
                const imgCount = job.outputCount ?? 1;

                return (
                  <div key={job.key} className="flex items-center gap-3 px-4 py-2.5 pl-10">
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
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${
                          state?.status === 'running' ? 'text-foreground' :
                          state?.status === 'done' ? 'text-muted-foreground' :
                          state?.status === 'error' ? 'text-destructive' :
                          isSelected ? 'text-foreground' : 'text-muted-foreground/60'
                        }`}>
                          {job.labelDe}
                        </p>
                        {imgCount > 1 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Images className="w-2.5 h-2.5" />
                            {imgCount}
                          </Badge>
                        )}
                      </div>
                      {state?.status === 'running' && imgCount > 1 && (
                        <p className="text-xs text-muted-foreground">
                          Bild {(state.results?.length ?? 0) + 1} von {imgCount}
                        </p>
                      )}
                      {state?.status === 'error' && state.error && (
                        <p className="text-xs text-destructive truncate">{state.error}</p>
                      )}
                    </div>
                    {/* Thumbnails for completed multi-image jobs */}
                    {state?.status === 'done' && state.results.length > 0 && (
                      <div className="flex gap-1 shrink-0">
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
        <p className="text-xs text-muted-foreground text-center">
          {selectedJobs.length} Jobs · {totalImages} Bilder ausgewählt
          {totalImages > 0 && ` · ca. ${totalImages * 2} Credits`}
        </p>
      )}

      {/* Progress Bar */}
      {(running || finished) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{running ? 'Pipeline läuft…' : `${doneImages} von ${totalImages} Bilder erstellt`}</span>
            {running && <span>Bild {doneImages + 1} von {totalImages}</span>}
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack} disabled={running}>
          Zurück
        </Button>

        {!finished ? (
          <Button
            onClick={runPipeline}
            disabled={running || selectedJobs.length === 0 || inputImages.length === 0}
            className="gap-2 gradient-accent text-accent-foreground font-semibold"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generiere…</>
            ) : (
              <><Zap className="w-4 h-4" /> {totalImages} Bilder generieren</>
            )}
          </Button>
        ) : (
          <Button
            onClick={onComplete}
            className="gap-2 gradient-accent text-accent-foreground font-semibold"
          >
            <ArrowRight className="w-4 h-4" /> Zur Galerie
          </Button>
        )}
      </div>
    </div>
  );
};

export default PipelineRunner;
