import React from 'react';
import { Loader2, FileSearch, Image, Check } from 'lucide-react';
import type { AppState } from '@/types/vehicle';
import { Progress } from '@/components/ui/progress';

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

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
        {fileName && (
          <p className="text-xs text-muted-foreground text-center mb-6 truncate">
            {fileName}
          </p>
        )}
        <div className="space-y-4">
          {steps.map((step, i) => {
            const isActive = i === currentIndex;
            const isDone = i < currentIndex;
            const Icon = step.icon;
            return (
              <div key={step.key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all
                    ${isDone ? 'bg-accent/10 text-accent' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  `}>
                    {isDone ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm ${isActive ? 'text-foreground font-medium' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                      {step.label}
                    </span>
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
