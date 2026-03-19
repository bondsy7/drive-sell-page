import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface SpinSlotData {
  perspective: 'front' | 'rear' | 'left' | 'right';
  file?: File;
  base64?: string;
  status: 'empty' | 'filled' | 'analyzing' | 'ok' | 'warning' | 'error';
  warning?: string;
}

interface Spin360UploadProps {
  onAllFilled: (slots: SpinSlotData[]) => void;
  disabled?: boolean;
}

const SLOT_CONFIG: { perspective: SpinSlotData['perspective']; label: string; sublabel: string }[] = [
  { perspective: 'front', label: 'Front', sublabel: 'Frontansicht des Fahrzeugs' },
  { perspective: 'rear', label: 'Heck', sublabel: 'Rückansicht des Fahrzeugs' },
  { perspective: 'left', label: 'Linke Seite', sublabel: 'Komplette linke Seite' },
  { perspective: 'right', label: 'Rechte Seite', sublabel: 'Komplette rechte Seite' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const Spin360Upload: React.FC<Spin360UploadProps> = ({ onAllFilled, disabled }) => {
  const [slots, setSlots] = useState<SpinSlotData[]>(
    SLOT_CONFIG.map(c => ({ perspective: c.perspective, status: 'empty' }))
  );
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateSlot = useCallback((index: number, update: Partial<SpinSlotData>) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...update };
      return next;
    });
  }, []);

  const handleFile = useCallback(async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilder hochladen');
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      updateSlot(index, { file, base64, status: 'filled' });
    } catch {
      toast.error('Fehler beim Laden des Bildes');
    }
  }, [updateSlot]);

  const handleDrop = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(index, file);
  }, [handleFile]);

  const handleCameraCapture = useCallback(async (index: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) handleFile(index, file);
    };
    input.click();
  }, [handleFile]);

  const removeSlot = useCallback((index: number) => {
    updateSlot(index, { file: undefined, base64: undefined, status: 'empty', warning: undefined });
  }, [updateSlot]);

  const filledCount = slots.filter(s => s.status !== 'empty').length;
  const allFilled = filledCount === 4;

  return (
    <div className="space-y-6">
      {/* Info header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
          <RotateCw className="w-3.5 h-3.5" />
          360° Spin erstellen
        </div>
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          4 Fotos hochladen
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Lade je ein Foto von jeder Seite hoch. Die KI erstellt daraus einen interaktiven 360°-Spin mit bis zu 36 Einzelbildern.
        </p>
      </div>

      {/* Upload grid */}
      <div className="grid grid-cols-2 gap-4">
        {SLOT_CONFIG.map((config, index) => {
          const slot = slots[index];
          const isFilled = slot.status !== 'empty';

          return (
            <div
              key={config.perspective}
              className={cn(
                'relative rounded-xl border-2 border-dashed transition-all overflow-hidden',
                isFilled
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-border hover:border-accent/30 bg-card',
                disabled && 'opacity-50 pointer-events-none'
              )}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => handleDrop(index, e)}
            >
              {isFilled && slot.base64 ? (
                // Preview
                <div className="relative aspect-[4/3]">
                  <img
                    src={slot.base64}
                    alt={config.label}
                    className="w-full h-full object-cover"
                  />
                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    {slot.status === 'analyzing' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Prüfe…
                      </span>
                    )}
                    {slot.status === 'ok' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/90 text-white text-xs font-medium">
                        <Check className="w-3 h-3" /> OK
                      </span>
                    )}
                    {slot.status === 'warning' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/90 text-white text-xs font-medium" title={slot.warning}>
                        <AlertTriangle className="w-3 h-3" /> Hinweis
                      </span>
                    )}
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => removeSlot(index)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {/* Label */}
                  <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-white text-xs font-semibold">{config.label}</span>
                  </div>
                </div>
              ) : (
                // Empty upload area
                <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 p-4">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{config.label}</p>
                  <p className="text-[11px] text-muted-foreground text-center">{config.sublabel}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => fileInputRefs.current[index]?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" /> Hochladen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleCameraCapture(index)}
                    >
                      <Camera className="w-3 h-3 mr-1" /> Foto
                    </Button>
                  </div>
                  <input
                    ref={el => { fileInputRefs.current[index] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(index, f);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress */}
      <div className="text-center space-y-3">
        <p className="text-xs text-muted-foreground">
          {filledCount} von 4 Fotos bereit
        </p>
        <Button
          size="lg"
          disabled={!allFilled || disabled}
          onClick={() => onAllFilled(slots)}
          className="min-w-[200px]"
        >
          <RotateCw className="w-4 h-4 mr-2" />
          360° Spin erstellen
        </Button>
      </div>
    </div>
  );
};

export default Spin360Upload;
