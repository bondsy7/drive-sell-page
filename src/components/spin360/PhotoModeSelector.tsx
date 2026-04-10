import React from 'react';
import { Images, RotateCw, Sparkles, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleAccess, type ModuleKey } from '@/hooks/useModuleAccess';

export type PhotoMode = 'preset-upload' | 'multi' | 'spin360';

interface PhotoModeSelectorProps {
  onSelect: (mode: PhotoMode) => void;
}

const MODES: { id: PhotoMode; moduleKey: ModuleKey; icon: React.ReactNode; title: string; description: string }[] = [
  {
    id: 'preset-upload',
    moduleKey: 'photos-preset',
    icon: <Sparkles className="w-6 h-6" />,
    title: 'Bildergenerator',
    description: 'Bilder hochladen, AI-Preset wählen und in professionelle Aufnahmen verwandeln.',
  },
  {
    id: 'multi',
    moduleKey: 'photos-multi',
    icon: <Images className="w-6 h-6" />,
    title: 'Mehrfach-Perspektiven',
    description: 'Fotos aus verschiedenen Winkeln aufnehmen oder hochladen – KI erstellt einen einheitlichen Showroom-Satz.',
  },
  {
    id: 'spin360',
    moduleKey: 'photos-spin360',
    icon: <RotateCw className="w-6 h-6" />,
    title: '360° Spin',
    description: 'Nur 4 Fotos hochladen – KI erstellt einen interaktiven 360°-Rundgang mit bis zu 36 Bildern.',
  },
];

const PhotoModeSelector: React.FC<PhotoModeSelectorProps> = ({ onSelect }) => {
  const { disabledModules } = useModuleAccess();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          Modus wählen
        </h2>
        <p className="text-sm text-muted-foreground">
          Wähle wie du mit deinen Fahrzeugfotos arbeiten möchtest.
        </p>
      </div>

      <div className="grid gap-4">
        {MODES.map((mode) => {
          const isDisabled = disabledModules.has(mode.moduleKey);
          return (
            <button
              key={mode.id}
              onClick={() => !isDisabled && onSelect(mode.id)}
              disabled={isDisabled}
              className={cn(
                'group text-left p-5 rounded-xl border border-border bg-card',
                'transition-all duration-200',
                isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5 cursor-pointer'
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                  isDisabled
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground'
                )}>
                  {isDisabled ? <Lock className="w-5 h-5" /> : mode.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{mode.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{mode.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PhotoModeSelector;
