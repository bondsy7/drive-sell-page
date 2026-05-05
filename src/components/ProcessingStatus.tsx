import React, { useEffect, useRef, useState } from 'react';
import { Loader2, FileSearch, Image, Check, Timer } from 'lucide-react';
import type { AppState } from '@/types/vehicle';
import { Progress } from '@/components/ui/progress';
import { formatDuration } from '@/components/ProcessTimer';

interface ProcessingStatusProps {
  state: AppState;
  fileName?: string;
  imageProgress?: { current: number; total: number };
}

const steps = [
  { key: 'uploading', label: 'PDF wird gelesen…', icon: FileSearch },
  { key: 'analyzing', label: 'KI analysiert Fahrzeugdaten…', icon: Loader2 },
  { key: 'generating-image', label: 'Fahrzeugbilder werden generiert…', icon: Image },
];

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ state, fileName, imageProgress }) => {
  const currentIndex = steps.findIndex(s => s.key === state);

  // Total elapsed since the process started
  const startRef = useRef<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());
  // Per-step durations
  const stepStartsRef = useRef<Record<string, number>>({});
  const stepDurationsRef = useRef<Record<string, number>>({});
  const lastStateRef = useRef<string>('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Track per-step timestamps
  if (state && lastStateRef.current !== state) {
    if (lastStateRef.current && stepStartsRef.current[lastStateRef.current]) {
      stepDurationsRef.current[lastStateRef.current] = Date.now() - stepStartsRef.current[lastStateRef.current];
    }
    if (!stepStartsRef.current[state]) stepStartsRef.current[state] = Date.now();
    lastStateRef.current = state;
  }

  const total = now - startRef.current;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
        {fileName && (
          <p className="text-xs text-muted-foreground text-center mb-3 truncate">{fileName}</p>
        )}
        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono font-semibold">
            <Timer className="w-3.5 h-3.5" />
            Gesamt: {formatDuration(total)}
          </span>
        </div>
        <div className="space-y-4">
          {steps.map((step, i) => {
            const isActive = i === currentIndex;
            const isDone = i < currentIndex;
            const Icon = step.icon;
            const stepStart = stepStartsRef.current[step.key];
            let stepElapsed = stepDurationsRef.current[step.key] || 0;
            if (isActive && stepStart) stepElapsed = now - stepStart;
            return (
              <div key={step.key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all
                    ${isDone ? 'bg-accent/10 text-accent' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  `}>
                    {isDone ? <Check className="w-4 h-4" /> : <Icon className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${isActive ? 'text-foreground font-medium' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                        {step.label}
                      </span>
                      {(isActive || isDone) && stepElapsed > 0 && (
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                          {formatDuration(stepElapsed)}
                        </span>
                      )}
                    </div>
                    {isActive && step.key === 'generating-image' && imageProgress && imageProgress.total > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Bild {imageProgress.current} von {imageProgress.total}
                      </p>
                    )}
                  </div>
                </div>
                {isActive && step.key === 'generating-image' && imageProgress && imageProgress.total > 0 && (
                  <div className="ml-12">
                    <Progress value={(imageProgress.current / imageProgress.total) * 100} className="h-1.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProcessingStatus;
