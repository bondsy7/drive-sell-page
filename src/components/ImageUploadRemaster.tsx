import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, Check, AlertCircle, Image as ImageIcon, RotateCcw, ZoomIn } from 'lucide-react';
import ImagePreviewLightbox from '@/components/ImagePreviewLightbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import RemasterOptions from '@/components/RemasterOptions';
import { type RemasterConfig, buildMasterPrompt } from '@/lib/remaster-prompt';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';

interface ImageUploadRemasterProps {
  vehicleDescription: string;
  vehicleBrand?: string;
  modelTier?: string;
  onComplete: (mainImage: string, galleryImages: string[]) => void;
  onBack: () => void;
  completeLabel?: string;
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

function compressImage(dataUrl: string, maxDim = 2048, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

const DEFAULT_CONFIG: RemasterConfig = {
  scene: 'none',
  licensePlate: 'keep',
  changeColor: false,
  showManufacturerLogo: false,
  showDealerLogo: false,
};

const ImageUploadRemaster: React.FC<ImageUploadRemasterProps> = ({ vehicleDescription, vehicleBrand, modelTier, onComplete, onBack, completeLabel }) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [remasterConfig, setRemasterConfig] = useState<RemasterConfig>(DEFAULT_CONFIG);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

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

      const rawBase64 = await fileToBase64(file);
      const base64 = await compressImage(rawBase64).catch(() => rawBase64);

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
    const total = pending.length;
    let completed = 0;
    setProgress({ current: 0, total });

    // Mark all as processing
    setImages(prev => prev.map(x => pending.some(p => p.id === x.id) ? { ...x, status: 'processing' } : x));

    const dynamicPrompt = buildMasterPrompt(remasterConfig, vehicleDescription);

    const processImage = async (img: UploadedImage) => {
      try {
        const { data, error } = await invokeRemasterVehicleImage({
          imageBase64: img.originalBase64,
          vehicleDescription,
          modelTier: modelTier || 'standard',
          dynamicPrompt,
          customShowroomBase64: remasterConfig.customShowroomBase64 || null,
          customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
          dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
          dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
          manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null,
          manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
        });

        if (error || !data?.imageBase64) {
          const errMsg = data?.error || error?.message || 'Fehler beim Remastering';
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: errMsg } : x));
        } else {
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'done', remasteredBase64: data.imageBase64 } : x));
        }
      } catch {
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: 'Netzwerkfehler' } : x));
      }
      completed++;
      setProgress({ current: completed, total });
    };

    // Process all images in parallel (max 4 concurrent)
    const CONCURRENCY = 4;
    const queue = [...pending];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const img = queue.shift()!;
        await processImage(img);
      }
    });
    await Promise.all(workers);

    setIsProcessing(false);
  };

  const retrySingleImage = async (id: string) => {
    const img = images.find(x => x.id === id);
    if (!img) return;
    setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'processing', error: undefined } : x));
    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      const dynamicPrompt = buildMasterPrompt(remasterConfig, vehicleDescription);
      const { data, error } = await invokeRemasterVehicleImage({
        imageBase64: img.originalBase64,
        vehicleDescription,
        modelTier: modelTier || 'standard',
        dynamicPrompt,
        customShowroomBase64: remasterConfig.customShowroomBase64 || null,
        customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
        dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
        dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
        manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null,
        manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
      });
      if (error || !data?.imageBase64) {
        const errMsg = data?.error || error?.message || 'Fehler beim Remastering';
        setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'error', error: errMsg } : x));
      } else {
        setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'done', remasteredBase64: data.imageBase64 } : x));
        toast.success('Bild erfolgreich neu generiert.');
      }
    } catch {
      setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'error', error: 'Netzwerkfehler' } : x));
    }
    setRegeneratingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    setLightboxOpen(true);
  };

  const lightboxImages = images
    .filter(img => img.status === 'done' && img.remasteredBase64)
    .map(img => ({
      id: img.id,
      src: img.remasteredBase64!,
      label: 'Remastered',
      originalSrc: img.originalBase64,
    }));

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
          {images.map((img, imgIndex) => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
              <img
                src={img.remasteredBase64 || img.originalBase64}
                alt="Fahrzeug"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => {
                  if (img.status === 'done') {
                    const doneImages = images.filter(i => i.status === 'done' && i.remasteredBase64);
                    const doneIdx = doneImages.findIndex(i => i.id === img.id);
                    if (doneIdx >= 0) openLightbox(doneIdx);
                  }
                }}
              />
              {/* Zoom icon for done images */}
              {img.status === 'done' && !isProcessing && (
                <button
                  onClick={() => {
                    const doneImages = images.filter(i => i.status === 'done' && i.remasteredBase64);
                    const doneIdx = doneImages.findIndex(i => i.id === img.id);
                    if (doneIdx >= 0) openLightbox(doneIdx);
                  }}
                  className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Vergrößern"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Status overlay */}
              {img.status === 'processing' && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                </div>
              )}
              {img.status === 'error' && (
                <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-2 px-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <p className="text-[10px] text-destructive text-center">{img.error}</p>
                  <button
                    onClick={() => retrySingleImage(img.id)}
                    className="flex items-center gap-1 bg-background/90 hover:bg-background text-foreground text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Erneut versuchen
                  </button>
                </div>
              )}
              {img.status === 'done' && !isProcessing && (
                <button
                  onClick={() => retrySingleImage(img.id)}
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Erneut generieren"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
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
              <Check className="w-4 h-4" /> {completeLabel || 'Weiter zur Landing Page'}
            </Button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <ImagePreviewLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onRegenerate={(id) => retrySingleImage(id)}
        regeneratingIds={regeneratingIds}
      />
    </div>
  );
};

export default ImageUploadRemaster;
