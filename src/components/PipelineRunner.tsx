import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Check, AlertCircle, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadImageToStorage } from '@/lib/storage-utils';
import { toast } from 'sonner';
import { PIPELINE_JOBS, type PipelineJob } from '@/lib/pipeline-jobs';
import type { RemasterConfig } from '@/lib/remaster-prompt';

interface PipelineRunnerProps {
  /** Base64 images captured/uploaded by the user (remastered) */
  inputImages: string[];
  /** Original (pre-remaster) base64 images for reference */
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
  const [jobs, setJobs] = useState<Record<string, JobState>>(() => {
    const init: Record<string, JobState> = {};
    PIPELINE_JOBS.forEach(j => { init[j.key] = { status: 'pending' }; });
    return init;
  });
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const totalJobs = PIPELINE_JOBS.length;
  const doneCount = Object.values(jobs).filter(j => j.status === 'done').length;

  // Save the remastered input images to storage+DB on mount
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
            inputImages[i],
            user.id,
            `${project.id}/remaster_${i}.png`,
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
    setRunning(true);
    const results: { key: string; base64: string }[] = [];

    // Use original (pre-remaster) images as reference if available, otherwise remastered
    const referenceImages = originalImages && originalImages.length > 0 ? originalImages : inputImages;

    for (let i = 0; i < PIPELINE_JOBS.length; i++) {
      const job = PIPELINE_JOBS[i];
      setCurrentIndex(i);
      setJobs(prev => ({ ...prev, [job.key]: { status: 'running' } }));

      try {
        // Send all reference images to the edge function
        const { data, error } = await supabase.functions.invoke('remaster-vehicle-image', {
          body: {
            imageBase64: referenceImages[0],
            additionalImages: referenceImages.slice(1),
            vehicleDescription,
            modelTier,
            dynamicPrompt: job.prompt,
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
          results.push({ key: job.key, base64: data.imageBase64 });
        }
      } catch {
        setJobs(prev => ({ ...prev, [job.key]: { status: 'error', error: 'Netzwerkfehler' } }));
      }
    }

    // Save pipeline results to existing project or create new one
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

        // Get current max sort_order
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
            results[i].base64,
            user.id,
            `${projectId}/${results[i].key}.png`,
          );
          if (url) urls.push(url);
        }

        if (urls.length > 0) {
          const imageRows = urls.map((url, i) => ({
            project_id: projectId,
            user_id: user.id,
            image_url: url,
            image_base64: '',
            perspective: `Pipeline: ${PIPELINE_JOBS[i]?.labelDe || `Bild ${i + 1}`}`,
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
  }, [inputImages, originalImages, vehicleDescription, remasterConfig, modelTier, user, savedProjectId]);

  const progressPercent = running ? ((currentIndex + 1) / totalJobs) * 100 : finished ? 100 : 0;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          Image Generation Pipeline
        </h2>
        <p className="text-sm text-muted-foreground">
          5 professionelle Perspektiven werden aus deinen Fotos generiert.
        </p>
      </div>

      {/* Job List */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        {PIPELINE_JOBS.map((job, i) => {
          const state = jobs[job.key];
          return (
            <div key={job.key} className="flex items-center gap-3">
              <div className={`
                w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all
                ${state.status === 'done' ? 'bg-accent/10 text-accent' :
                  state.status === 'running' ? 'bg-primary text-primary-foreground' :
                  state.status === 'error' ? 'bg-destructive/10 text-destructive' :
                  'bg-muted text-muted-foreground'}
              `}>
                {state.status === 'done' ? <Check className="w-4 h-4" /> :
                 state.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 state.status === 'error' ? <AlertCircle className="w-4 h-4" /> :
                 <span className="text-xs font-bold">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  state.status === 'running' ? 'text-foreground' :
                  state.status === 'done' ? 'text-muted-foreground' :
                  state.status === 'error' ? 'text-destructive' :
                  'text-muted-foreground/60'
                }`}>
                  {job.labelDe}
                </p>
                {state.status === 'error' && state.error && (
                  <p className="text-xs text-destructive truncate">{state.error}</p>
                )}
              </div>
              {state.status === 'done' && state.resultBase64 && (
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
            disabled={running || inputImages.length === 0}
            className="gap-2 gradient-accent text-accent-foreground font-semibold"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generiere {PIPELINE_JOBS[currentIndex]?.labelDe}…</>
            ) : (
              <><Zap className="w-4 h-4" /> Pipeline starten</>
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
