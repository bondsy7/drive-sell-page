import React from 'react';
import { Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type SpinStep =
  | 'uploaded'
  | 'analyzing'
  | 'normalizing'
  | 'profiling'
  | 'generating_anchors'
  | 'generating_frames'
  | 'validating'
  | 'assembling'
  | 'completed'
  | 'failed'
  | 'needs_review'
  | 'generating_video'
  | 'extracting_frames';

interface Spin360ProgressProps {
  currentStep: SpinStep;
  error?: string | null;
  mode?: 'image2spin' | 'video2frames';
}

const IMAGE_STEPS: { key: SpinStep; label: string; description: string }[] = [
  { key: 'analyzing', label: 'Analyse', description: 'Bilder werden geprüft' },
  { key: 'normalizing', label: 'Normalisierung', description: 'Bilder werden optimiert' },
  { key: 'profiling', label: 'Fahrzeugprofil', description: 'Identität wird erstellt' },
  { key: 'generating_anchors', label: 'Ankerbilder', description: '4 Zwischenwinkel werden generiert' },
  { key: 'generating_frames', label: 'Frames', description: 'Alle Einzelbilder werden generiert' },
  { key: 'validating', label: 'Validierung', description: 'Konsistenz wird geprüft' },
  { key: 'assembling', label: 'Zusammenbau', description: '360° Spin wird erstellt' },
];

const VIDEO_STEPS: { key: SpinStep; label: string; description: string }[] = [
  { key: 'generating_video', label: 'Video-Generierung', description: '360°-Spin-Video wird erstellt' },
  { key: 'extracting_frames', label: 'Frame-Extraktion', description: '48 Frames werden aus dem Video extrahiert' },
];

const IMAGE_STEP_ORDER: SpinStep[] = ['uploaded', 'analyzing', 'normalizing', 'profiling', 'generating_anchors', 'generating_frames', 'validating', 'assembling', 'completed'];
const VIDEO_STEP_ORDER: SpinStep[] = ['uploaded', 'generating_video', 'extracting_frames', 'completed'];

function getStepIndex(step: SpinStep, order: SpinStep[]): number {
  return order.indexOf(step);
}

const Spin360Progress: React.FC<Spin360ProgressProps> = ({ currentStep, error, mode = 'image2spin' }) => {
  const isVideo = mode === 'video2frames';
  const steps = isVideo ? VIDEO_STEPS : IMAGE_STEPS;
  const stepOrder = isVideo ? VIDEO_STEP_ORDER : IMAGE_STEP_ORDER;
  const currentIdx = getStepIndex(currentStep, stepOrder);
  const isFailed = currentStep === 'failed' || currentStep === 'needs_review';
  const isCompleted = currentStep === 'completed';
  const progressPercent = isCompleted ? 100 : isFailed ? 0 : Math.round((currentIdx / (stepOrder.length - 1)) * 100);

  return (
    <div className="space-y-6">
      <div className="text-center">
        {isCompleted ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600 text-sm font-semibold">
            <Check className="w-4 h-4" /> 360° Spin fertig!
          </div>
        ) : isFailed ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold">
            <AlertCircle className="w-4 h-4" /> Fehler aufgetreten
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" /> Verarbeitung läuft…
          </div>
        )}
      </div>

      <Progress value={progressPercent} className="h-2" />

      <div className="space-y-2">
        {steps.map((step) => {
          const stepIdx = getStepIndex(step.key, stepOrder);
          const isActive = step.key === currentStep;
          const isDone = currentIdx > stepIdx || isCompleted;
          const isPending = currentIdx < stepIdx && !isCompleted;

          return (
            <div
              key={step.key}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
                isActive && 'bg-accent/10 border border-accent/20',
                isDone && 'opacity-70',
                isPending && 'opacity-40'
              )}
            >
              <div className="flex-shrink-0">
                {isDone ? (
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  </div>
                ) : isActive ? (
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <p className={cn('text-sm font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isFailed && error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};

export default Spin360Progress;