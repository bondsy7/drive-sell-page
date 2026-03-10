import React, { useState, useCallback } from 'react';
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
  /** Base64 images captured/uploaded by the user */
  inputImages: string[];
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

  const totalJobs = PIPELINE_JOBS.length;
  const doneCount = Object.values(jobs).filter(j => j.status === 'done').length;
  const errorCount = Object.values(jobs).filter(j => j.status === 'error').length;

  const runPipeline = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    setRunning(true);
    const results: { key: string; base64: string }[] = [];

    for (let i = 0; i < PIPELINE_JOBS.length; i++) {
      const job = PIPELINE_JOBS[i];
      setCurrentIndex(i);
      setJobs(prev => ({ ...prev, [job.key]: { status: 'running' } }));

      try {
        // Use the first input image as reference
        const referenceImage = inputImages[0];

        const { data, error } = await supabase.functions.invoke('remaster-vehicle-image', {
          body: {
            imageBase64: referenceImage,
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

    // Save all results to storage + DB
    if (results.length > 0 && user) {
      try {
        const dateStr = new Date().toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        const { data: project } = await supabase.from('projects').insert({
          user_id: user.id,
          title: `Pipeline ${dateStr}`,
          vehicle_data: { vehicle: { brand: vehicleDescription || 'Pipeline' } } as any,
          template_id: 'modern',
        }).select('id').single();

        if (project) {
          const urls: string[] = [];
          for (let i = 0; i < results.length; i++) {
            const url = await uploadImageToStorage(
              results[i].base64,
              user.id,
              `${project.id}/${results[i].key}.png`,
            );
            if (url) urls.push(url);
          }

          if (urls.length > 0) {
            await supabase.from('projects').update({ main_image_url: urls[0] }).eq('id', project.id);

            const imageRows = urls.map((url, i) => ({
              project_id: project.id,
              user_id: user.id,
              image_url: url,
              image_base64: '',
              perspective: PIPELINE_JOBS[i]?.labelDe || `Bild ${i + 1}`,
              sort_order: i,
            }));
            await supabase.from('project_images').insert(imageRows);
          }
        }

        toast.success(`${results.length} Pipeline-Bilder erstellt und gespeichert!`);
      } catch (e) {
        console.error('Pipeline save error:', e);
        toast.error('Bilder generiert, aber Speichern fehlgeschlagen.');
      }
    }

    setRunning(false);
    setFinished(true);
  }, [inputImages, vehicleDescription, remasterConfig, modelTier, user]);

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
