import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Check, AlertCircle, Zap, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadImageToStorage } from '@/lib/storage-utils';
import { toast } from 'sonner';
import { PIPELINE_JOBS, PIPELINE_CATEGORIES, type PipelineJob } from '@/lib/pipeline-jobs';
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
  resultBase64?: string;
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

  // Job selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    new Set(PIPELINE_JOBS.filter(j => j.defaultSelected).map(j => j.key))
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(PIPELINE_CATEGORIES.map(c => c.key))
  );

  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const selectedJobs = PIPELINE_JOBS.filter(j => selectedKeys.has(j.key));
  const totalJobs = selectedJobs.length;
  const doneCount = Object.values(jobs).filter(j => j.status === 'done').length;

  const toggleJob = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (catKey: string) => {
    const catJobs = PIPELINE_JOBS.filter(j => j.category === catKey);
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

  const runPipeline = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    if (selectedJobs.length === 0) { toast.error('Bitte wähle mindestens einen Job aus.'); return; }

    setRunning(true);
    const results: { key: string; base64: string; labelDe: string }[] = [];

    // Use original images as primary reference
    const referenceImages = originalImages && originalImages.length > 0 ? originalImages : inputImages;

    // Build the base context prompt with showroom/logo/plate settings from remasterConfig
    const baseContext = buildMasterPrompt(remasterConfig, vehicleDescription);

    // Initialize job states
    const initStates: Record<string, JobState> = {};
    selectedJobs.forEach(j => { initStates[j.key] = { status: 'pending' }; });
    setJobs(initStates);

    for (let i = 0; i < selectedJobs.length; i++) {
      const job = selectedJobs[i];
      setCurrentIndex(i);
      setJobs(prev => ({ ...prev, [job.key]: { status: 'running' } }));

      try {
        // Combine base context (showroom/logo/plate rules) with the job-specific perspective prompt
        const fullPrompt = `${baseContext}\n\n--- PERSPECTIVE INSTRUCTION ---\n${job.prompt}`;

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
          const errMsg = data?.error || error?.message || 'Generierung fehlgeschlagen';
          setJobs(prev => ({ ...prev, [job.key]: { status: 'error', error: errMsg } }));
        } else {
          setJobs(prev => ({ ...prev, [job.key]: { status: 'done', resultBase64: data.imageBase64 } }));
          results.push({ key: job.key, base64: data.imageBase64, labelDe: job.labelDe });
        }
      } catch {
        setJobs(prev => ({ ...prev, [job.key]: { status: 'error', error: 'Netzwerkfehler' } }));
      }
    }

    // Save results
    if (results.length > 0 && user) {
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
        for (let i = 0; i < results.length; i++) {
          const url = await uploadImageToStorage(
            results[i].base64, user.id, `${projectId}/${results[i].key}.png`,
          );
          if (url) urls.push(url);
        }

        if (urls.length > 0) {
          const imageRows = urls.map((url, i) => ({
            project_id: projectId,
            user_id: user.id,
            image_url: url,
            image_base64: '',
            perspective: `Pipeline: ${results[i]?.labelDe || `Bild ${i + 1}`}`,
            sort_order: startOrder + i,
          }));
          await supabase.from('project_images').insert(imageRows);
        }

        toast.success(`${results.length} Pipeline-Bilder erstellt und gespeichert!`);
      } catch (e) {
        console.error('Pipeline save error:', e);
        toast.error('Bilder generiert, aber Speichern fehlgeschlagen.');
      }
    }

    setRunning(false);
    setFinished(true);
  }, [inputImages, originalImages, vehicleDescription, remasterConfig, modelTier, user, savedProjectId, selectedJobs]);

  const progressPercent = running ? ((currentIndex + 1) / totalJobs) * 100 : finished ? 100 : 0;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          Image Generation Pipeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Wähle die gewünschten Perspektiven aus. Jedes Bild wird einzeln im gleichen Showroom generiert.
        </p>
      </div>

      {/* Job Selection by Category */}
      <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {PIPELINE_CATEGORIES.map(cat => {
          const catJobs = PIPELINE_JOBS.filter(j => j.category === cat.key);
          const selectedCount = catJobs.filter(j => selectedKeys.has(j.key)).length;
          const allSelected = selectedCount === catJobs.length;
          const someSelected = selectedCount > 0 && !allSelected;
          const isExpanded = expandedCategories.has(cat.key);

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
                  <span className="text-xs text-muted-foreground">({selectedCount}/{catJobs.length})</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
                </button>
              </div>

              {/* Jobs in category */}
              {isExpanded && catJobs.map(job => {
                const state = jobs[job.key];
                const isSelected = selectedKeys.has(job.key);

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
                      <p className={`text-sm font-medium truncate ${
                        state?.status === 'running' ? 'text-foreground' :
                        state?.status === 'done' ? 'text-muted-foreground' :
                        state?.status === 'error' ? 'text-destructive' :
                        isSelected ? 'text-foreground' : 'text-muted-foreground/60'
                      }`}>
                        {job.labelDe}
                      </p>
                      {state?.status === 'error' && state.error && (
                        <p className="text-xs text-destructive truncate">{state.error}</p>
                      )}
                    </div>
                    {state?.status === 'done' && state.resultBase64 && (
                      <img
                        src={state.resultBase64.startsWith('data:') ? state.resultBase64 : `data:image/png;base64,${state.resultBase64}`}
                        alt={job.labelDe}
                        className="w-12 h-9 rounded object-cover border border-border"
                      />
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
          {selectedJobs.length} von {PIPELINE_JOBS.length} Perspektiven ausgewählt
          {selectedJobs.length > 0 && ` · ca. ${selectedJobs.length * 2} Credits`}
        </p>
      )}

      {/* Progress Bar */}
      {(running || finished) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{running ? 'Pipeline läuft…' : `${doneCount} von ${totalJobs} abgeschlossen`}</span>
            {running && <span>Job {currentIndex + 1} von {totalJobs}</span>}
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
              <><Loader2 className="w-4 h-4 animate-spin" /> Generiere {selectedJobs[currentIndex]?.labelDe}…</>
            ) : (
              <><Zap className="w-4 h-4" /> {selectedJobs.length} Bilder generieren</>
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
