import React, { useState, useCallback, useRef, lazy, Suspense } from 'react';
import { Upload, X, Loader2, Check, AlertCircle, Image as ImageIcon, RotateCcw, ZoomIn, Sparkles, Zap, Crown, Rocket, Diamond, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCredits } from '@/hooks/useCredits';
import RemasterOptions from '@/components/RemasterOptions';
import { type RemasterConfig, buildMasterPrompt, fetchPromptOverrides } from '@/lib/remaster-prompt';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import ImagePreviewLightbox from '@/components/ImagePreviewLightbox';
import type { PresetData } from './PresetSelectionModal';
import type { ModelTier } from '@/components/ModelSelector';

const PresetSelectionModal = lazy(() => import('./PresetSelectionModal'));
const PlaceholderRenderer = lazy(() => import('./PlaceholderRenderer'));

interface PresetUploadFlowProps {
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

const MAX_IMAGES = 20;
const MAX_SIZE_MB = 10;
const CONCURRENCY = 4;

const TIERS: { id: ModelTier; label: string; sublabel: string; icon: React.ReactNode }[] = [
  { id: 'schnell', label: 'Schnell', sublabel: 'schnell & günstig', icon: <Zap className="w-3 h-3" /> },
  { id: 'qualitaet', label: 'Qualität', sublabel: 'ausgewogen', icon: <Sparkles className="w-3 h-3" /> },
  { id: 'premium', label: 'Premium', sublabel: 'beste Ergebnisse', icon: <Crown className="w-3 h-3" /> },
  { id: 'turbo', label: 'Turbo', sublabel: 'schnell & kreativ', icon: <Rocket className="w-3 h-3" /> },
  { id: 'ultra', label: 'Ultra', sublabel: 'höchste Qualität', icon: <Diamond className="w-3 h-3" /> },
];

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
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
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

const PresetUploadFlow: React.FC<PresetUploadFlowProps> = ({ onComplete, onBack }) => {
  const { getCost, balance } = useCredits();
  const [step, setStep] = useState<'preset' | 'config' | 'upload' | 'processing' | 'done'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<PresetData | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [modelTier, setModelTier] = useState<ModelTier>('qualitaet');
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const [remasterConfig, setRemasterConfig] = useState<RemasterConfig>(DEFAULT_CONFIG);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const costPerImage = getCost('image_remaster', modelTier) || 1;

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast.error(`Maximal ${MAX_IMAGES} Bilder erlaubt.`); return; }
    const toAdd = fileArray.slice(0, remaining);
    const newImages: UploadedImage[] = [];
    for (const file of toAdd) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name} ist kein Bild.`); continue; }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`${file.name} ist zu groß (max ${MAX_SIZE_MB}MB).`); continue; }
      const rawBase64 = await fileToBase64(file);
      const base64 = await compressImage(rawBase64).catch(() => rawBase64);
      newImages.push({ id: crypto.randomUUID(), originalBase64: base64, remasteredBase64: null, status: 'pending' });
    }
    setImages(prev => [...prev, ...newImages]);
  }, [images.length]);

  const removeImage = (id: string) => setImages(prev => prev.filter(img => img.id !== id));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const startRemastering = async () => {
    const pending = images.filter(img => img.status === 'pending' || img.status === 'error');
    if (pending.length === 0) { finishUp(); return; }

    // Build the prompt combining preset prompt + remaster config
    const presetPrompt = selectedPreset?.prompt_secret || '';
    // Replace placeholders in preset prompt with dynamic field values
    let resolvedPrompt = presetPrompt;
    Object.entries(dynamicFields).forEach(([key, value]) => {
      resolvedPrompt = resolvedPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    });

    const promptOverrides = await fetchPromptOverrides();
    const dynamicPrompt = resolvedPrompt
      ? `${resolvedPrompt}\n\n${buildMasterPrompt(remasterConfig, '', undefined, promptOverrides)}`
      : buildMasterPrompt(remasterConfig, '', undefined, promptOverrides);

    setIsProcessing(true);
    setStep('processing');
    const total = pending.length;
    let completed = 0;
    setProgress({ current: 0, total });
    setImages(prev => prev.map(x => pending.some(p => p.id === x.id) ? { ...x, status: 'processing' } : x));

    const processImage = async (img: UploadedImage) => {
      try {
        const { data, error } = await invokeRemasterVehicleImage({
          imageBase64: img.originalBase64,
          vehicleDescription: '',
          modelTier: modelTier,
          dynamicPrompt,
          customShowroomBase64: remasterConfig.customShowroomBase64 || null,
          customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
          dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
          dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
          manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null,
          manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
        });
        if (error || !data?.imageBase64) {
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: data?.error || error?.message || 'Fehler' } : x));
        } else {
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'done', remasteredBase64: data.imageBase64 } : x));
        }
      } catch {
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: 'Netzwerkfehler' } : x));
      }
      completed++;
      setProgress({ current: completed, total });
    };

    const queue = [...pending];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) { await processImage(queue.shift()!); }
    });
    await Promise.all(workers);
    setIsProcessing(false);
    setStep('done');
  };

  const retrySingleImage = async (id: string) => {
    const img = images.find(x => x.id === id);
    if (!img) return;
    setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'processing', error: undefined } : x));
    setRegeneratingIds(prev => new Set(prev).add(id));

    const presetPrompt = selectedPreset?.prompt_secret || '';
    let resolvedPrompt = presetPrompt;
    Object.entries(dynamicFields).forEach(([key, value]) => {
      resolvedPrompt = resolvedPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    });
    const dynamicPrompt = resolvedPrompt
      ? `${resolvedPrompt}\n\n${buildMasterPrompt(remasterConfig, '')}`
      : buildMasterPrompt(remasterConfig, '');

    try {
      const { data, error } = await invokeRemasterVehicleImage({
        imageBase64: img.originalBase64, vehicleDescription: '', modelTier: modelTier,
        dynamicPrompt,
        customShowroomBase64: remasterConfig.customShowroomBase64 || null,
        customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
        dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
        dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
        manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null,
        manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
      });
      if (error || !data?.imageBase64) {
        setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'error', error: data?.error || error?.message || 'Fehler' } : x));
      } else {
        setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'done', remasteredBase64: data.imageBase64 } : x));
        toast.success('Bild neu generiert.');
      }
    } catch {
      setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'error', error: 'Netzwerkfehler' } : x));
    }
    setRegeneratingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const finishUp = () => {
    const done = images.filter(img => img.status === 'done' && img.remasteredBase64);
    if (done.length === 0) { toast.error('Keine Bilder erfolgreich verarbeitet.'); return; }
    const main = done[0].remasteredBase64!;
    const gallery = done.slice(1).map(img => img.remasteredBase64!);
    toast.success(`${done.length} Bilder erfolgreich verarbeitet.`);
    onComplete(main, gallery);
  };

  const openLightbox = (i: number) => { setLightboxIndex(i); setLightboxOpen(true); };
  const lightboxImages = images.filter(img => img.status === 'done' && img.remasteredBase64).map(img => ({
    id: img.id, src: img.remasteredBase64!, label: 'Remastered', originalSrc: img.originalBase64,
  }));

  const doneCount = images.filter(i => i.status === 'done').length;
  const allDone = images.length > 0 && images.every(i => i.status === 'done' || i.status === 'error') && !isProcessing;

  // ─── Step 1: Preset Selection ───
  if (step === 'preset') {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Bildergenerator</h2>
            <p className="text-sm text-muted-foreground">Wähle ein Preset und lade deine Bilder hoch</p>
          </div>
        </div>

        {/* Model Tier */}
        <Card className="p-4">
          <label className="text-sm font-semibold mb-3 block">Qualitätsstufe</label>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted flex-wrap">
            {TIERS.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setModelTier(tier.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  modelTier === tier.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tier.icon} {tier.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Zap className="w-3 h-3 text-accent" />
            <span>Guthaben: <strong className="text-foreground">{balance} Credits</strong></span>
            <span className="ml-2">• {costPerImage} Credit{costPerImage !== 1 ? 's' : ''}/Bild</span>
          </div>
        </Card>

        {/* Preset Selector */}
        <Card className="p-4">
          <label className="text-sm font-semibold mb-3 block">AI Preset *</label>
          <Button
            variant="outline"
            className="w-full h-auto py-4 justify-between"
            onClick={() => setPresetModalOpen(true)}
          >
            <div className="flex flex-col items-start gap-1">
              {selectedPreset ? (
                <>
                  <span className="font-semibold text-sm">{selectedPreset.name}</span>
                  <span className="text-xs text-muted-foreground">{selectedPreset.category}</span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">Preset auswählen...</span>
              )}
            </div>
            <Sparkles className="w-5 h-5 text-accent shrink-0" />
          </Button>
        </Card>

        {/* Dynamic Fields */}
        {selectedPreset && (
          <Card className="p-4">
            <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Laden...</div>}>
              <PlaceholderRenderer
                presetId={selectedPreset.id}
                values={dynamicFields}
                onChange={(key, value) => setDynamicFields(prev => ({ ...prev, [key]: value }))}
                onImageUpload={(key, file) => {
                  const reader = new FileReader();
                  reader.onloadend = () => setDynamicFields(prev => ({ ...prev, [key]: reader.result as string }));
                  reader.readAsDataURL(file);
                }}
              />
            </Suspense>
          </Card>
        )}

        <Button
          onClick={() => setStep('config')}
          disabled={!selectedPreset}
          className="w-full gap-2 gradient-accent text-accent-foreground font-semibold"
        >
          Weiter <ArrowLeft className="w-4 h-4 rotate-180" />
        </Button>

        <Suspense fallback={null}>
          <PresetSelectionModal
            open={presetModalOpen}
            onOpenChange={setPresetModalOpen}
            onSelectPreset={(preset) => setSelectedPreset(preset)}
            selectedPresetId={selectedPreset?.id}
          />
        </Suspense>
      </div>
    );
  }

  // ─── Step 2: Remaster Config + Upload ───
  if (step === 'config' || step === 'upload') {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep('preset')}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Bilder hochladen</h2>
            <p className="text-sm text-muted-foreground">
              Preset: <strong>{selectedPreset?.name}</strong> • {modelTier} • {costPerImage} Credit{costPerImage !== 1 ? 's' : ''}/Bild
            </p>
          </div>
        </div>

        {/* Remaster Options */}
        <RemasterOptions config={remasterConfig} onChange={setRemasterConfig} />

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
              Bilder hierhin ziehen oder <span className="text-accent font-medium">klicken</span>
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">Max. {MAX_IMAGES} Bilder, je max. {MAX_SIZE_MB}MB</p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </div>
        )}

        {/* Image grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
                <img
                  src={img.remasteredBase64 || img.originalBase64}
                  alt="Bild"
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => {
                    if (img.status === 'done') {
                      const doneImgs = images.filter(i => i.status === 'done' && i.remasteredBase64);
                      const idx = doneImgs.findIndex(i => i.id === img.id);
                      if (idx >= 0) openLightbox(idx);
                    }
                  }}
                />
                {img.status === 'processing' && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  </div>
                )}
                {img.status === 'error' && (
                  <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-2 px-2">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <p className="text-[10px] text-destructive text-center">{img.error}</p>
                    <button onClick={() => retrySingleImage(img.id)} className="flex items-center gap-1 bg-background/90 text-foreground text-[10px] font-semibold px-2.5 py-1.5 rounded-lg">
                      <RotateCcw className="w-3 h-3" /> Erneut
                    </button>
                  </div>
                )}
                {img.status === 'done' && !isProcessing && (
                  <>
                    <button onClick={() => { const d = images.filter(i => i.status === 'done' && i.remasteredBase64); const idx = d.findIndex(i => i.id === img.id); if (idx >= 0) openLightbox(idx); }}
                      className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => retrySingleImage(img.id)}
                      className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-md">Remastered</div>
                  </>
                )}
                {!isProcessing && (
                  <button onClick={() => removeImage(img.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cost preview */}
        {images.length > 0 && (
          <Card className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Kosten:</span>
              <span className="font-semibold">{images.length} × {costPerImage} = {images.length * costPerImage} Credits</span>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setStep('preset')} disabled={isProcessing}>Zurück</Button>
          <div className="flex items-center gap-3">
            {images.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {images.length} Bild{images.length !== 1 ? 'er' : ''}{doneCount > 0 ? `, ${doneCount} fertig` : ''}
              </span>
            )}
            <Button onClick={startRemastering} disabled={images.length === 0 || isProcessing}
              className="gap-2 gradient-accent text-accent-foreground font-semibold">
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Verarbeite…</> : <><ImageIcon className="w-4 h-4" /> Bilder verarbeiten</>}
            </Button>
          </div>
        </div>

        <ImagePreviewLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen}
          onClose={() => setLightboxOpen(false)} onRegenerate={(id) => retrySingleImage(id)} regeneratingIds={regeneratingIds} />
      </div>
    );
  }

  // ─── Step 3: Processing / Done ───
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">
          {isProcessing ? 'Bilder werden verarbeitet...' : 'Verarbeitung abgeschlossen'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Preset: <strong>{selectedPreset?.name}</strong>
        </p>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Verarbeitung läuft…</span>
            <span>Bild {progress.current} von {progress.total}</span>
          </div>
          <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
            <img src={img.remasteredBase64 || img.originalBase64} alt="Bild" className="w-full h-full object-cover" />
            {img.status === 'processing' && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            )}
            {img.status === 'error' && (
              <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-2 px-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-[10px] text-destructive text-center">{img.error}</p>
                <button onClick={() => retrySingleImage(img.id)} className="flex items-center gap-1 bg-background/90 text-foreground text-[10px] font-semibold px-2.5 py-1.5 rounded-lg">
                  <RotateCcw className="w-3 h-3" /> Erneut
                </button>
              </div>
            )}
            {img.status === 'done' && (
              <div className="absolute bottom-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-md">✓</div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {allDone && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => { setStep('config'); }}>Weitere Bilder</Button>
          <Button onClick={finishUp} disabled={doneCount === 0} className="gap-2 gradient-accent text-accent-foreground font-semibold">
            <Check className="w-4 h-4" /> Zur Galerie
          </Button>
        </div>
      )}

      <ImagePreviewLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen}
        onClose={() => setLightboxOpen(false)} onRegenerate={(id) => retrySingleImage(id)} regeneratingIds={regeneratingIds} />
    </div>
  );
};

export default PresetUploadFlow;
