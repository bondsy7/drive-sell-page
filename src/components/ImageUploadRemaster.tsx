import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import RemasterOptions from '@/components/RemasterOptions';
import { type RemasterConfig, buildMasterPrompt } from '@/lib/remaster-prompt';

interface ImageUploadRemasterProps {
  vehicleDescription: string;
  vehicleBrand?: string;
  modelTier?: string;
  onComplete: (mainImage: string, galleryImages: string[]) => void;
  onBack: () => void;
}

interface UploadedImage {
  id: string;
  originalBase64: string;
  remasteredBase64: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const MAX_IMAGES = 10;
const MAX_SIZE_MB = 10;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DEFAULT_CONFIG: RemasterConfig = {
  scene: 'none',
  licensePlate: 'keep',
  changeColor: false,
  showManufacturerLogo: false,
  showDealerLogo: false,
};

const ImageUploadRemaster: React.FC<ImageUploadRemasterProps> = ({ vehicleDescription, vehicleBrand, modelTier, onComplete, onBack }) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [remasterConfig, setRemasterConfig] = useState<RemasterConfig>(DEFAULT_CONFIG);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximal ${MAX_IMAGES} Bilder erlaubt.`);
      return;
    }
    const toAdd = fileArray.slice(0, remaining);

    const newImages: UploadedImage[] = [];
    for (const file of toAdd) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} ist kein Bild.`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} ist zu groß (max ${MAX_SIZE_MB}MB).`);
        continue;
      }
      const base64 = await fileToBase64(file);
      newImages.push({
        id: crypto.randomUUID(),
        originalBase64: base64,
        remasteredBase64: null,
        status: 'pending',
      });
    }
    setImages(prev => [...prev, ...newImages]);
  }, [images.length]);

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const startRemastering = async () => {
    const pending = images.filter(img => img.status === 'pending' || img.status === 'error');
    if (pending.length === 0) {
      // All done already, just complete
      finishUp();
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      const img = pending[i];
      setProgress({ current: i + 1, total: pending.length });
      setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'processing' } : x));

      try {
        const dynamicPrompt = buildMasterPrompt(remasterConfig, vehicleDescription);
        const { data, error } = await supabase.functions.invoke('remaster-vehicle-image', {
          body: {
            imageBase64: img.originalBase64,
            vehicleDescription,
            modelTier: modelTier || 'standard',
            dynamicPrompt,
            customShowroomBase64: remasterConfig.customShowroomBase64 || null,
            customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
            dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
            manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null,
          },
        });

        if (error || !data?.imageBase64) {
          const errMsg = data?.error || error?.message || 'Fehler beim Remastering';
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: errMsg } : x));
        } else {
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'done', remasteredBase64: data.imageBase64 } : x));
        }
      } catch (e) {
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: 'Netzwerkfehler' } : x));
      }
    }

    setIsProcessing(false);
  };

  const finishUp = () => {
    const done = images.filter(img => img.status === 'done' && img.remasteredBase64);
    if (done.length === 0) {
      toast.error('Keine Bilder erfolgreich verarbeitet.');
      return;
    }
    const main = done[0].remasteredBase64!;
    const gallery = done.slice(1).map(img => img.remasteredBase64!);
    toast.success(`${done.length} Bilder erfolgreich remastered.`);
    onComplete(main, gallery);
  };

  const doneCount = images.filter(i => i.status === 'done').length;
  const allDone = images.length > 0 && images.every(i => i.status === 'done' || i.status === 'error') && !isProcessing;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Eigene Bilder hochladen & remastern</h2>
        <p className="text-sm text-muted-foreground">
          Lade deine Fahrzeugfotos hoch. Die KI setzt das Auto in einen professionellen Showroom – alle Details bleiben erhalten.
        </p>
      </div>

      {/* Remaster Options */}
      <RemasterOptions config={remasterConfig} onChange={setRemasterConfig} vehicleBrand={vehicleBrand} />

      {/* Drop zone */}
      {images.length < MAX_IMAGES && !isProcessing && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-accent rounded-2xl p-8 text-center cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50"
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Bilder hierhin ziehen oder <span className="text-accent font-medium">klicken zum Auswählen</span>
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">Max. {MAX_IMAGES} Bilder, je max. {MAX_SIZE_MB}MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
              <img
                src={img.remasteredBase64 || img.originalBase64}
                alt="Fahrzeug"
                className="w-full h-full object-cover"
              />
              {/* Status overlay */}
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                img.status === 'processing' ? 'bg-background/70' :
                img.status === 'error' ? 'bg-destructive/20' :
                img.status === 'done' ? 'bg-accent/10 opacity-0 group-hover:opacity-100' : ''
              }`}>
                {img.status === 'processing' && <Loader2 className="w-6 h-6 text-accent animate-spin" />}
                {img.status === 'error' && (
                  <div className="text-center px-2">
                    <AlertCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
                    <p className="text-[10px] text-destructive">{img.error}</p>
                  </div>
                )}
                {img.status === 'done' && <Check className="w-6 h-6 text-accent" />}
              </div>
              {/* Remove button */}
              {!isProcessing && (
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Remastered badge */}
              {img.status === 'done' && (
                <div className="absolute bottom-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-md">
                  Remastered
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Remastering läuft…</span>
            <span>Bild {progress.current} von {progress.total}</span>
          </div>
          <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack} disabled={isProcessing}>
          Zurück
        </Button>
        <div className="flex items-center gap-3">
          {images.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {images.length} Bild{images.length !== 1 ? 'er' : ''}{doneCount > 0 ? `, ${doneCount} fertig` : ''}
            </span>
          )}
          {!allDone ? (
            <Button
              onClick={startRemastering}
              disabled={images.length === 0 || isProcessing}
              className="gap-2 gradient-accent text-accent-foreground font-semibold"
            >
              {isProcessing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verarbeite…</>
              ) : (
                <><ImageIcon className="w-4 h-4" /> Bilder remastern</>
              )}
            </Button>
          ) : (
            <Button
              onClick={finishUp}
              disabled={doneCount === 0}
              className="gap-2 gradient-accent text-accent-foreground font-semibold"
            >
              <Check className="w-4 h-4" /> Weiter zur Landing Page
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageUploadRemaster;
