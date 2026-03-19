import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Loader2, Check, AlertCircle, Search, Zap, RotateCcw, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVinLookup } from '@/hooks/useVinLookup';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import VinDataDialog from '@/components/VinDataDialog';
import RemasterOptions from '@/components/RemasterOptions';
import { type RemasterConfig, buildMasterPrompt } from '@/lib/remaster-prompt';
import PipelineRunner from '@/components/PipelineRunner';
import type { VehicleData } from '@/types/vehicle';

interface ImageCaptureGridProps {
  vehicleDescription: string;
  vehicleData?: VehicleData;
  modelTier?: string;
  projectId?: string | null;
  onComplete: (mainImage: string, galleryImages: string[], vin?: string) => void;
  onVehicleDataChange?: (data: VehicleData) => void;
  onBack: () => void;
  onPipelineComplete?: () => void;
}

interface PerspectiveSlot {
  key: string;
  label: string;
  icon: string; // path to placeholder icon
  capture: 'environment' | 'user'; // camera facing
  isVin?: boolean;
}

const SLOTS: PerspectiveSlot[] = [
  { key: '34front', label: '3/4 Front', icon: '/images/perspectives/34_Vorne.png', capture: 'environment' },
  { key: 'side', label: 'Seite', icon: '/images/perspectives/Seite.png', capture: 'environment' },
  { key: 'rear', label: 'Hinten', icon: '/images/perspectives/Hinten.png', capture: 'environment' },
  { key: 'interior-front', label: 'Interieur Fahrersitz', icon: '/images/perspectives/Interieur_Fahrersitz.png', capture: 'environment' },
  { key: 'interior-rear', label: 'Interieur Rücksitz', icon: '/images/perspectives/Interieur_Ruecksitz.png', capture: 'environment' },
  { key: 'vin', label: 'VIN', icon: '/images/perspectives/VIN.png', capture: 'environment', isVin: true },
];

interface CapturedImage {
  base64: string;
  remasteredBase64?: string;
  status: 'captured' | 'processing' | 'done' | 'error';
  error?: string;
}

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

const ImageCaptureGrid: React.FC<ImageCaptureGridProps> = ({ vehicleDescription, vehicleData, modelTier, projectId, onComplete, onVehicleDataChange, onBack, onPipelineComplete }) => {
  const [showPipeline, setShowPipeline] = useState(false);
  const [captures, setCaptures] = useState<Record<string, CapturedImage>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [detectedVin, setDetectedVin] = useState<string | null>(null);
  const [remasterConfig, setRemasterConfig] = useState<RemasterConfig>(DEFAULT_CONFIG);
  const [brandDetectionStatus, setBrandDetectionStatus] = useState<'idle' | 'detecting' | 'found' | 'not-found'>('idle');
  const vinLookup = useVinLookup();
  const { makes, getLogoForMake } = useVehicleMakes();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const brandDetectionAttempted = useRef(false);

  const capturedCount = Object.keys(captures).length;
  const vehicleSlots = SLOTS.filter(s => !s.isVin);
  const capturedVehicleImages = vehicleSlots.filter(s => captures[s.key]);

  const handleCapture = useCallback(async (slot: PerspectiveSlot, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte ein Bild auswählen.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Bild zu groß (max 10MB).');
      return;
    }
    const base64 = await fileToBase64(file);
    setCaptures(prev => ({ ...prev, [slot.key]: { base64, status: 'captured' } }));

    // If VIN slot, trigger OCR immediately
    if (slot.isVin) {
      try {
        const { data, error } = await supabase.functions.invoke('ocr-vin', { body: { imageBase64: base64 } });
        if (data?.error === 'insufficient_credits') {
          toast.error('Nicht genügend Credits für VIN-Erkennung.');
        } else if (!error && data?.vin) {
          setDetectedVin(data.vin);
          toast.success(`VIN erkannt: ${data.vin}`);
          if (vehicleData) {
            vinLookup.lookup(data.vin, vehicleData);
          }
        } else {
          toast.warning('VIN konnte nicht erkannt werden. Bitte prüfe das Foto.');
        }
      } catch {
        toast.warning('VIN-Erkennung fehlgeschlagen.');
      }
    }
  }, [vehicleData, vinLookup]);

  const removeCapture = (key: string) => {
    setCaptures(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === 'vin') setDetectedVin(null);
  };

  const startRemastering = async () => {
    const toProcess = vehicleSlots.filter(s => captures[s.key] && captures[s.key].status !== 'done');
    if (toProcess.length === 0) {
      finishUp();
      return;
    }

    setIsProcessing(true);
    const total = toProcess.length;
    let completed = 0;
    setProgress({ current: 0, total });

    // Mark all as processing
    setCaptures(prev => {
      const next = { ...prev };
      for (const slot of toProcess) {
        next[slot.key] = { ...next[slot.key], status: 'processing' };
      }
      return next;
    });

    const dynamicPrompt = buildMasterPrompt(remasterConfig, vehicleDescription);

    const processSlot = async (slot: typeof toProcess[0]) => {
      try {
        const { data, error } = await supabase.functions.invoke('remaster-vehicle-image', {
          body: {
            imageBase64: captures[slot.key].base64,
            vehicleDescription,
            modelTier: modelTier || 'standard',
            dynamicPrompt,
            customShowroomBase64: remasterConfig.customShowroomBase64 || null,
            customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
            dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
            dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
            manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null,
            manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
          },
        });

        if (error || !data?.imageBase64) {
          const errMsg = data?.error || error?.message || 'Fehler beim Remastering';
          setCaptures(prev => ({ ...prev, [slot.key]: { ...prev[slot.key], status: 'error', error: errMsg } }));
        } else {
          setCaptures(prev => ({ ...prev, [slot.key]: { ...prev[slot.key], status: 'done', remasteredBase64: data.imageBase64 } }));
        }
      } catch {
        setCaptures(prev => ({ ...prev, [slot.key]: { ...prev[slot.key], status: 'error', error: 'Netzwerkfehler' } }));
      }
      completed++;
      setProgress({ current: completed, total });
    };

    // Process all images in parallel (max 4 concurrent)
    const CONCURRENCY = 4;
    const queue = [...toProcess];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const slot = queue.shift()!;
        await processSlot(slot);
      }
    });
    await Promise.all(workers);

    setIsProcessing(false);
  };

  const retrySingleSlot = async (slotKey: string) => {
    const slot = vehicleSlots.find(s => s.key === slotKey);
    if (!slot || !captures[slotKey]) return;
    setCaptures(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], status: 'processing', error: undefined } }));
    try {
      const dynamicPrompt = buildMasterPrompt(remasterConfig, vehicleDescription);
      const { data, error } = await supabase.functions.invoke('remaster-vehicle-image', {
        body: {
          imageBase64: captures[slotKey].base64,
          vehicleDescription,
          modelTier: modelTier || 'standard',
          dynamicPrompt,
          customShowroomBase64: remasterConfig.customShowroomBase64 || null,
          customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
          dealerLogoUrl: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null,
          dealerLogoBase64: remasterConfig.showDealerLogo ? remasterConfig.dealerLogoBase64 : null,
          manufacturerLogoUrl: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null,
          manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoBase64 : null,
        },
      });
      if (error || !data?.imageBase64) {
        const errMsg = data?.error || error?.message || 'Fehler beim Remastering';
        setCaptures(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], status: 'error', error: errMsg } }));
      } else {
        setCaptures(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], status: 'done', remasteredBase64: data.imageBase64 } }));
        toast.success('Bild erfolgreich neu generiert.');
      }
    } catch {
      setCaptures(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], status: 'error', error: 'Netzwerkfehler' } }));
    }
  };

  const finishUp = () => {
    const doneSlots = vehicleSlots.filter(s => captures[s.key]?.status === 'done' && captures[s.key]?.remasteredBase64);
    if (doneSlots.length === 0) {
      toast.error('Keine Bilder erfolgreich verarbeitet.');
      return;
    }
    const main = captures[doneSlots[0].key].remasteredBase64!;
    const gallery = doneSlots.slice(1).map(s => captures[s.key].remasteredBase64!);
    toast.success(`${doneSlots.length} Bilder erfolgreich remastered.`);
    onComplete(main, gallery, detectedVin || undefined);
  };

  const allVehicleDone = capturedVehicleImages.length > 0 &&
    capturedVehicleImages.every(s => captures[s.key].status === 'done' || captures[s.key].status === 'error') &&
    !isProcessing;

  // Collect all captured base64 images for pipeline input
  const allCapturedBase64 = vehicleSlots
    .filter(s => captures[s.key])
    .map(s => captures[s.key].remasteredBase64 || captures[s.key].base64);

  // Collect original (pre-remaster) images for AI reference
  const allOriginalBase64 = vehicleSlots
    .filter(s => captures[s.key])
    .map(s => captures[s.key].base64);

  if (showPipeline) {
    return (
      <PipelineRunner
        inputImages={allCapturedBase64}
        originalImages={allOriginalBase64}
        vehicleDescription={vehicleDescription}
        vehicleBrand={vehicleData?.vehicle?.brand}
        remasterConfig={remasterConfig}
        modelTier={modelTier}
        projectId={projectId}
        vin={detectedVin}
        onComplete={() => {
          if (onPipelineComplete) {
            onPipelineComplete();
          } else {
            finishUp();
          }
        }}
        onBack={() => setShowPipeline(false)}
      />
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold text-foreground mb-2">Fahrzeugfotos aufnehmen</h2>
        <p className="text-sm text-muted-foreground">
          Fotografiere das Fahrzeug aus den vorgegebenen Perspektiven. Die KI setzt es in einen professionellen Showroom.
        </p>
      </div>

      {/* Grid of perspective slots */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SLOTS.map((slot) => {
          const cap = captures[slot.key];
          return (
            <div
              key={slot.key}
              className="relative group rounded-2xl border-2 border-dashed border-border hover:border-accent bg-card transition-all overflow-hidden"
            >
              {cap ? (
                <div className="aspect-[4/3] relative">
                  <img
                    src={cap.remasteredBase64 || cap.base64}
                    alt={slot.label}
                    className="w-full h-full object-cover"
                  />
                  {cap.status === 'processing' && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    </div>
                  )}
                  {cap.status === 'error' && (
                    <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <button
                        onClick={() => retrySingleSlot(slot.key)}
                        className="flex items-center gap-1 bg-background/90 hover:bg-background text-foreground text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Erneut versuchen
                      </button>
                    </div>
                  )}
                  {cap.status === 'done' && (
                    <>
                      <div className="absolute bottom-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-md">
                        Remastered
                      </div>
                      {!isProcessing && (
                        <button
                          onClick={() => retrySingleSlot(slot.key)}
                          className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Erneut generieren"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                  {!isProcessing && (
                    <button
                      onClick={() => removeCapture(slot.key)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileRefs.current[slot.key]?.click()}
                  className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 p-3 hover:bg-muted/50 transition-colors"
                >
                  <img
                    src={slot.icon}
                    alt={slot.label}
                    className="w-16 h-12 object-contain opacity-40"
                  />
                  <span className="text-xs font-medium text-muted-foreground">{slot.label}</span>
                  <Camera className="w-4 h-4 text-muted-foreground/50" />
                </button>
              )}
              <input
                ref={(el) => { fileRefs.current[slot.key] = el; }}
                type="file"
                accept="image/*"
                capture={slot.capture}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCapture(slot, file);
                  e.target.value = '';
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Remaster Options */}
      <RemasterOptions
        config={remasterConfig}
        onChange={setRemasterConfig}
        vehicleBrand={vehicleData?.vehicle?.brand}
        vehicleModel={vehicleData?.vehicle?.model}
        onBrandChange={(brand) => {
          if (vehicleData && onVehicleDataChange) {
            onVehicleDataChange({
              ...vehicleData,
              vehicle: { ...vehicleData.vehicle, brand },
            });
          }
        }}
        onModelChange={(model) => {
          if (vehicleData && onVehicleDataChange) {
            onVehicleDataChange({
              ...vehicleData,
              vehicle: { ...vehicleData.vehicle, model },
            });
          }
        }}
      />

      {/* VIN display */}
      {detectedVin && (
        <div className="flex items-center gap-2 bg-accent/10 text-accent px-4 py-2.5 rounded-xl text-sm font-medium">
          <Check className="w-4 h-4" />
          VIN erkannt: <span className="font-mono font-bold">{detectedVin}</span>
          {vinLookup.loading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
        </div>
      )}

      {/* Progress */}
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
          {capturedVehicleImages.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {capturedVehicleImages.length} von {vehicleSlots.length} Perspektiven
            </span>
          )}
          {!allVehicleDone ? (
            <Button
              onClick={startRemastering}
              disabled={capturedVehicleImages.length === 0 || isProcessing}
              className="gap-2 gradient-accent text-accent-foreground font-semibold"
            >
              {isProcessing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verarbeite…</>
              ) : (
                <><Camera className="w-4 h-4" /> Bilder remastern</>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={finishUp}
              >
                {projectId ? (
                  <><Check className="w-4 h-4 mr-1" /> Weiter zur Landing Page</>
                ) : (
                  <><ImageIcon className="w-4 h-4 mr-1" /> Zur Galerie</>
                )}
              </Button>
              <Button
                onClick={() => setShowPipeline(true)}
                className="gap-2 gradient-accent text-accent-foreground font-semibold"
              >
                <Zap className="w-4 h-4" /> Pipeline starten
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* VIN Data Dialog */}
      {vehicleData && (
        <VinDataDialog
          open={vinLookup.dialogOpen}
          onClose={() => vinLookup.setDialogOpen(false)}
          diffs={vinLookup.diffs}
          equipment={vinLookup.equipment}
          vin={detectedVin || ''}
          onApply={(fields, replaceEquipment, selectedEquipment) => {
            const updated = vinLookup.applyFields(fields, vehicleData, replaceEquipment, selectedEquipment);
            onVehicleDataChange?.(updated);
          }}
        />
      )}
    </div>
  );
};

export default ImageCaptureGrid;
