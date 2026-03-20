import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, AlertTriangle, Loader2, RotateCw, Film, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type SpinMode = 'image2spin' | 'video2frames';

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
  spinMode: SpinMode;
  onModeChange: (mode: SpinMode) => void;
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

/* ─── Mode Toggle ─── */
const SpinModeToggle: React.FC<{ mode: SpinMode; onChange: (m: SpinMode) => void; disabled?: boolean }> = ({ mode, onChange, disabled }) => (
  <div className="flex items-center justify-center">
    <div className="relative flex items-center bg-muted rounded-full p-1 gap-0.5">
      <button
        disabled={disabled}
        onClick={() => onChange('image2spin')}
        className={cn(
          'relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors',
          mode === 'image2spin'
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Images className="w-3.5 h-3.5" /> Image2Spin
      </button>
      <button
        disabled={disabled}
        onClick={() => onChange('video2frames')}
        className={cn(
          'relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors',
          mode === 'video2frames'
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Film className="w-3.5 h-3.5" /> Video2Frames
      </button>
    </div>
  </div>
);

/* ─── Upload Slot ─── */
const UploadSlot: React.FC<{
  config: typeof SLOT_CONFIG[0];
  slot: SpinSlotData;
  index: number;
  disabled?: boolean;
  onFile: (i: number, f: File) => void;
  onRemove: (i: number) => void;
  onCamera: (i: number) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  triggerInput: () => void;
}> = ({ config, slot, index, disabled, onFile, onRemove, onCamera, inputRef, triggerInput }) => {
  const isFilled = slot.status !== 'empty';
  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all overflow-hidden',
        isFilled ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/30 bg-card',
        disabled && 'opacity-50 pointer-events-none'
      )}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(index, f); }}
    >
      {isFilled && slot.base64 ? (
        <div className="relative aspect-[4/3]">
          <img src={slot.base64} alt={config.label} className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2">
            {slot.status === 'analyzing' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Prüfe…
              </span>
            )}
            {slot.status === 'ok' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/90 text-accent-foreground text-xs font-medium">
                <Check className="w-3 h-3" /> OK
              </span>
            )}
            {slot.status === 'warning' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/90 text-accent-foreground text-xs font-medium" title={slot.warning}>
                <AlertTriangle className="w-3 h-3" /> Hinweis
              </span>
            )}
          </div>
          <button
            onClick={() => onRemove(index)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
            <span className="text-accent-foreground text-xs font-semibold">{config.label}</span>
          </div>
        </div>
      ) : (
        <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 p-4">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">{config.label}</p>
          <p className="text-[11px] text-muted-foreground text-center">{config.sublabel}</p>
          <div className="flex items-center gap-2 mt-1">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={triggerInput}>
              <Upload className="w-3 h-3 mr-1" /> Hochladen
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onCamera(index)}>
              <Camera className="w-3 h-3 mr-1" /> Foto
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(index, f); e.target.value = ''; }}
          />
        </div>
      )}
    </div>
  );
};

/* ─── Main Component ─── */
const Spin360Upload: React.FC<Spin360UploadProps> = ({ onAllFilled, disabled, spinMode, onModeChange }) => {
  const [slots, setSlots] = useState<SpinSlotData[]>(
    SLOT_CONFIG.map(c => ({ perspective: c.perspective, status: 'empty' }))
  );
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateSlot = useCallback((index: number, update: Partial<SpinSlotData>) => {
    setSlots(prev => { const next = [...prev]; next[index] = { ...next[index], ...update }; return next; });
  }, []);

  const handleFile = useCallback(async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Bitte nur Bilder hochladen'); return; }
    try {
      const base64 = await fileToBase64(file);
      updateSlot(index, { file, base64, status: 'filled' });
    } catch { toast.error('Fehler beim Laden des Bildes'); }
  }, [updateSlot]);

  const handleCameraCapture = useCallback(async (index: number) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async () => { const f = input.files?.[0]; if (f) handleFile(index, f); };
    input.click();
  }, [handleFile]);

  const removeSlot = useCallback((index: number) => {
    updateSlot(index, { file: undefined, base64: undefined, status: 'empty', warning: undefined });
  }, [updateSlot]);

  const filledCount = slots.filter(s => s.status !== 'empty').length;
  const allFilled = filledCount === 4;
  const frameCount = spinMode === 'video2frames' ? 48 : 36;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
          <RotateCw className="w-3.5 h-3.5" />
          360° Spin erstellen
        </div>
        <h2 className="font-display text-xl font-bold text-foreground mb-2">4 Fotos hochladen</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Lade je ein Foto von jeder Seite hoch. Die KI erstellt daraus einen interaktiven 360°-Spin mit bis zu {frameCount} Einzelbildern.
        </p>
      </div>

      <SpinModeToggle mode={spinMode} onChange={onModeChange} disabled={disabled} />

      <div className="text-center">
        <p className="text-[11px] text-muted-foreground">
          {spinMode === 'image2spin'
            ? 'KI generiert Einzelbilder zwischen den 4 Perspektiven (36 Frames)'
            : 'KI erstellt ein 360°-Video, daraus werden 48 Frames extrahiert'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {SLOT_CONFIG.map((config, index) => (
          <UploadSlot
            key={config.perspective}
            config={config}
            slot={slots[index]}
            index={index}
            disabled={disabled}
            onFile={handleFile}
            onRemove={removeSlot}
            onCamera={handleCameraCapture}
            inputRef={el => { fileInputRefs.current[index] = el; }}
            triggerInput={() => fileInputRefs.current[index]?.click()}
          />
        ))}
      </div>

      <div className="text-center space-y-3">
        <p className="text-xs text-muted-foreground">{filledCount} von 4 Fotos bereit</p>
        <Button size="lg" disabled={!allFilled || disabled} onClick={() => onAllFilled(slots)} className="min-w-[200px]">
          {spinMode === 'video2frames' ? <Film className="w-4 h-4 mr-2" /> : <RotateCw className="w-4 h-4 mr-2" />}
          {spinMode === 'video2frames' ? 'Video-Spin erstellen' : '360° Spin erstellen'}
        </Button>
      </div>
    </div>
  );
};

export default Spin360Upload;