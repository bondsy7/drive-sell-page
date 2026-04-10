import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Camera, Upload, X, Loader2, Check, AlertCircle, Search, Zap, RotateCcw, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVinLookup } from '@/hooks/useVinLookup';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import VinDataDialog from '@/components/VinDataDialog';
import RemasterOptions from '@/components/RemasterOptions';
import { type RemasterConfig, buildMasterPrompt, fetchPromptOverrides } from '@/lib/remaster-prompt';
import PipelineRunner from '@/components/PipelineRunner';
import { lookupBrandFromVin } from '@/lib/vin-wmi-lookup';
import { resolveCanonicalBrand, normalizeBrand } from '@/lib/brand-aliases';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import { ensureLogoCachedAsPng } from '@/lib/image-base64-cache';
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

/** Resize image to max dimension and compress as JPEG to reduce payload size */
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
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

const DEFAULT_CONFIG: RemasterConfig = {
  scene: '',
  licensePlate: '',
  changeColor: false,
  showManufacturerLogo: false,
  showDealerLogo: false,
};

const EMPTY_FINANCE: VehicleData['finance'] = {
  monthlyRate: '',
  downPayment: '',
  duration: '',
  totalPrice: '',
  annualMileage: '',
  specialPayment: '',
  residualValue: '',
  interestRate: '',
};

const EMPTY_DEALER: VehicleData['dealer'] = {
  name: '',
  address: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  taxId: '',
  logoUrl: '',
  facebookUrl: '',
  instagramUrl: '',
  xUrl: '',
  tiktokUrl: '',
  youtubeUrl: '',
  whatsappNumber: '',
  leasingBank: '',
  leasingLegalText: '',
  financingBank: '',
  financingLegalText: '',
  defaultLegalText: '',
};

const EMPTY_CONSUMPTION: VehicleData['consumption'] = {
  origin: '',
  mileage: '',
  displacement: '',
  power: '',
  driveType: '',
  fuelType: '',
  consumptionCombined: '',
  co2Emissions: '',
  co2Class: '',
  consumptionCity: '',
  consumptionSuburban: '',
  consumptionRural: '',
  consumptionHighway: '',
  energyCostPerYear: '',
  fuelPrice: '',
  co2CostMedium: '',
  co2CostLow: '',
  co2CostHigh: '',
  vehicleTax: '',
  isPluginHybrid: false,
  co2EmissionsDischarged: '',
  co2ClassDischarged: '',
  consumptionCombinedDischarged: '',
  electricRange: '',
  consumptionElectric: '',
  hsnTsn: '', electricMotorPower: '', electricMotorTorque: '', gearboxType: '',
  topSpeed: '', acceleration: '', curbWeight: '', grossWeight: '', warranty: '', paintColor: '',
};

const ImageCaptureGrid: React.FC<ImageCaptureGridProps> = ({ vehicleDescription, vehicleData, modelTier, projectId, onComplete, onVehicleDataChange, onBack, onPipelineComplete }) => {
  const [showPipeline, setShowPipeline] = useState(false);
  const [captures, setCaptures] = useState<Record<string, CapturedImage>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [detectedVin, setDetectedVin] = useState<string | null>(null);
  const [remasterConfig, setRemasterConfig] = useState<RemasterConfig>(DEFAULT_CONFIG);
  const [brandDetectionStatus, setBrandDetectionStatus] = useState<'idle' | 'detecting' | 'found' | 'not-found'>('idle');
  const [detailImages, setDetailImages] = useState<string[]>([]);
  const detailFileRef = useRef<HTMLInputElement | null>(null);
  const vinLookup = useVinLookup();
  const { makes } = useVehicleMakes();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const brandDetectionAttempted = useRef(false);
  const latestVehicleDataRef = useRef<VehicleData | undefined>(vehicleData);
  latestVehicleDataRef.current = vehicleData;

  const makeKeys = useMemo(() => makes.map(m => m.key), [makes]);

  const resolveBrandFromSource = useCallback((source?: string | null) => {
    if (!source || makeKeys.length === 0) return null;
    return resolveCanonicalBrand(source, makeKeys);
  }, [makeKeys]);

  const resolveModelForBrand = useCallback((brand: string, sourceModel?: string | null) => {
    if (!sourceModel) return '';
    const sourceNorm = normalizeBrand(sourceModel);
    const matchedMake = makes.find((make) => make.key === brand);
    if (!matchedMake) return sourceModel;

    const exact = matchedMake.models
      .filter((item) => item.key !== 'ANDERE')
      .find((item) => normalizeBrand(item.key) === sourceNorm);
    if (exact) return exact.key;

    const partial = matchedMake.models
      .filter((item) => item.key !== 'ANDERE')
      .find((item) => {
        const modelNorm = normalizeBrand(item.key);
        return modelNorm.includes(sourceNorm) || sourceNorm.includes(modelNorm);
      });

    return partial?.key || sourceModel;
  }, [makes]);

  const buildVehicleState = useCallback((): VehicleData => {
    const vd = latestVehicleDataRef.current;
    return {
      category: vd?.category || 'Kauf',
      vehicle: {
        brand: vd?.vehicle?.brand || '',
        model: vd?.vehicle?.model || '',
        variant: vd?.vehicle?.variant || '',
        year: vd?.vehicle?.year || new Date().getFullYear(),
        color: vd?.vehicle?.color || '',
        fuelType: vd?.vehicle?.fuelType || '',
        transmission: vd?.vehicle?.transmission || '',
        power: vd?.vehicle?.power || '',
        features: [...(vd?.vehicle?.features || [])],
        ...(vd?.vehicle?.vin ? { vin: vd.vehicle.vin } : {}),
      },
      finance: vd?.finance ? { ...vd.finance } : { ...EMPTY_FINANCE },
      dealer: vd?.dealer ? { ...vd.dealer } : { ...EMPTY_DEALER },
      consumption: vd?.consumption ? { ...vd.consumption } : { ...EMPTY_CONSUMPTION },
    };
  }, []);

  const patchVehicleData = useCallback((updater: (current: VehicleData) => VehicleData) => {
    if (!onVehicleDataChange) return;
    const updated = updater(buildVehicleState());
    latestVehicleDataRef.current = updated;
    onVehicleDataChange(updated);
  }, [buildVehicleState, onVehicleDataChange]);

  useEffect(() => {
    if (makes.length === 0) return;

    const currentBrand = vehicleData?.vehicle?.brand;
    if (currentBrand && currentBrand.trim()) {
      setBrandDetectionStatus('found');
      brandDetectionAttempted.current = true;
      return;
    }

    if (!brandDetectionAttempted.current && vehicleDescription) {
      let matchedBrand = resolveBrandFromSource(vehicleDescription);

      if (!matchedBrand) {
        const words = vehicleDescription.split(/[\s,;|/\-–]+/).filter(w => w.length > 1);
        for (const word of words) {
          matchedBrand = resolveBrandFromSource(word);
          if (matchedBrand) break;
        }
      }

      if (matchedBrand) {
        brandDetectionAttempted.current = true;
        setBrandDetectionStatus('found');
        patchVehicleData((current) => ({
          ...current,
          vehicle: { ...current.vehicle, brand: matchedBrand },
        }));
      }
    }
  }, [vehicleData, vehicleDescription, makes, patchVehicleData, resolveBrandFromSource]);

  useEffect(() => {
    const outvinVehicle = vinLookup.outvinData;
    if (!outvinVehicle || makes.length === 0 || !onVehicleDataChange) return;

    const currentData = buildVehicleState();
    const matchedBrand = resolveBrandFromSource(outvinVehicle.brand)
      || resolveBrandFromSource(currentData.vehicle.brand)
      || (detectedVin ? resolveBrandFromSource(lookupBrandFromVin(detectedVin) || '') : null);

    if (!matchedBrand) {
      if (!currentData.vehicle.brand) setBrandDetectionStatus('not-found');
      return;
    }

    const matchedModel = resolveModelForBrand(matchedBrand, outvinVehicle.model);
    const sameBrand = normalizeBrand(currentData.vehicle.brand || '') === normalizeBrand(matchedBrand);
    const sameModel = normalizeBrand(currentData.vehicle.model || '') === normalizeBrand(matchedModel);

    setBrandDetectionStatus('found');
    brandDetectionAttempted.current = true;

    if (sameBrand && sameModel) return;

    patchVehicleData((current) => ({
      ...current,
      vehicle: {
        ...current.vehicle,
        brand: matchedBrand,
        model: matchedModel || current.vehicle.model,
      },
    }));
  }, [buildVehicleState, detectedVin, makes, onVehicleDataChange, patchVehicleData, resolveBrandFromSource, resolveModelForBrand, vinLookup.outvinData]);

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
    const rawBase64 = await fileToBase64(file);
    // Compress to max 2048px and JPEG quality 0.85 to prevent edge function timeouts
    const base64 = await compressImage(rawBase64);
    setCaptures(prev => ({ ...prev, [slot.key]: { base64, status: 'captured' } }));

    if (!slot.isVin && (!brandDetectionAttempted.current || brandDetectionStatus === 'not-found') && makes.length > 0) {
      let matchedBrand = resolveBrandFromSource(vehicleDescription);
      if (!matchedBrand) {
        const words = vehicleDescription.split(/[\s,;|/\-–]+/).filter(w => w.length > 1);
        for (const word of words) {
          matchedBrand = resolveBrandFromSource(word);
          if (matchedBrand) break;
        }
      }

      if (matchedBrand) {
        brandDetectionAttempted.current = true;
        setBrandDetectionStatus('found');
        patchVehicleData((current) => ({
          ...current,
          vehicle: { ...current.vehicle, brand: matchedBrand },
        }));
      } else {
        setBrandDetectionStatus('detecting');
        brandDetectionAttempted.current = true;
        try {
          const { data: aiResult, error: aiError } = await supabase.functions.invoke('detect-vehicle-brand', {
            body: { imageBase64: base64 },
          });

          if (!aiError && aiResult?.brand && aiResult.confidence !== 'low') {
            const resolvedAiBrand = resolveBrandFromSource(aiResult.brand);
            if (resolvedAiBrand) {
              setBrandDetectionStatus('found');
              const resolvedModel = aiResult.model ? resolveModelForBrand(resolvedAiBrand, aiResult.model) : '';
              patchVehicleData((current) => ({
                ...current,
                vehicle: {
                  ...current.vehicle,
                  brand: resolvedAiBrand,
                  model: resolvedModel || current.vehicle.model,
                },
              }));
              toast.success(`Marke per Bild erkannt: ${resolvedAiBrand}${resolvedModel ? ` ${resolvedModel}` : ''}`);
            } else {
              brandDetectionAttempted.current = false;
              setBrandDetectionStatus('not-found');
            }
          } else {
            brandDetectionAttempted.current = false;
            setBrandDetectionStatus('not-found');
          }
        } catch {
          brandDetectionAttempted.current = false;
          console.error('AI brand detection failed');
          setBrandDetectionStatus('not-found');
        }
      }
    }

    if (slot.isVin) {
      try {
        const { data, error } = await supabase.functions.invoke('ocr-vin', { body: { imageBase64: base64 } });
        if (data?.error === 'insufficient_credits') {
          toast.error('Nicht genügend Credits für VIN-Erkennung.');
        } else if (!error && data?.vin) {
          const recognizedVin = data.vin as string;
          setDetectedVin(recognizedVin);
          patchVehicleData((current) => ({
            ...current,
            vehicle: { ...current.vehicle, vin: recognizedVin },
          }));
          toast.success(`VIN erkannt: ${recognizedVin}`);

          const vinBrand = lookupBrandFromVin(recognizedVin);
          if (vinBrand) {
            const resolved = resolveBrandFromSource(vinBrand);
            if (resolved) {
              setBrandDetectionStatus('found');
              brandDetectionAttempted.current = true;
              patchVehicleData((current) => ({
                ...current,
                vehicle: { ...current.vehicle, vin: recognizedVin, brand: resolved },
              }));
              toast.success(`Marke erkannt: ${resolved}`);
            }
          }

          const lookupBase = buildVehicleState();
          await vinLookup.lookup(recognizedVin, {
            ...lookupBase,
            vehicle: {
              ...lookupBase.vehicle,
              vin: recognizedVin,
            },
          });
        } else {
          toast.warning('VIN konnte nicht erkannt werden. Bitte prüfe das Foto.');
        }
      } catch {
        toast.warning('VIN-Erkennung fehlgeschlagen.');
      }
    }
  }, [brandDetectionStatus, buildVehicleState, makes.length, patchVehicleData, resolveBrandFromSource, resolveModelForBrand, vehicleDescription, vinLookup]);

  const removeCapture = (key: string) => {
    setCaptures(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === 'vin') setDetectedVin(null);
  };

  // Ref to hold pre-cached logo base64 for consistent use across all remaster calls
  const cachedMfgLogoRef = useRef<string | null>(null);
  const cachedDealerLogoRef = useRef<string | null>(null);

  const isRemasterConfigValid = remasterConfig.scene && remasterConfig.licensePlate;

  const startRemastering = async () => {
    if (!remasterConfig.scene || !remasterConfig.licensePlate) {
      toast.error('Bitte wähle zuerst Szene und Nummernschild-Option aus.');
      return;
    }

    const toProcess = vehicleSlots.filter(s => captures[s.key] && captures[s.key].status !== 'done');
    if (toProcess.length === 0) {
      finishUp();
      return;
    }

    setIsProcessing(true);
    const total = toProcess.length;
    let completed = 0;
    setProgress({ current: 0, total });

    // Pre-cache logos as PNG ONCE before any remastering to ensure consistency
    cachedMfgLogoRef.current = null;
    cachedDealerLogoRef.current = null;
    try {
      const logoPromises: Promise<void>[] = [];
      if (remasterConfig.showManufacturerLogo) {
        const src = remasterConfig.manufacturerLogoBase64 || remasterConfig.manufacturerLogoUrl;
        if (src) {
          logoPromises.push(
            ensureLogoCachedAsPng(src).then(b64 => {
              if (b64?.startsWith('data:')) cachedMfgLogoRef.current = b64;
            }).catch(() => {
              if (remasterConfig.manufacturerLogoBase64) cachedMfgLogoRef.current = remasterConfig.manufacturerLogoBase64;
            })
          );
        }
      }
      if (remasterConfig.showDealerLogo) {
        const src = remasterConfig.dealerLogoBase64 || remasterConfig.dealerLogoUrl;
        if (src) {
          logoPromises.push(
            ensureLogoCachedAsPng(src).then(b64 => {
              if (b64?.startsWith('data:')) cachedDealerLogoRef.current = b64;
            }).catch(() => {
              if (remasterConfig.dealerLogoBase64) cachedDealerLogoRef.current = remasterConfig.dealerLogoBase64;
            })
          );
        }
      }
      if (logoPromises.length > 0) await Promise.all(logoPromises);
    } catch (e) {
      console.warn('[Remaster] Logo pre-cache failed:', e);
    }

    // Mark all as processing
    setCaptures(prev => {
      const next = { ...prev };
      for (const slot of toProcess) {
        next[slot.key] = { ...next[slot.key], status: 'processing' };
      }
      return next;
    });

    const promptOverrides = await fetchPromptOverrides();
    const processSlot = async (slot: typeof toProcess[0]) => {
      // Build per-slot prompt with perspective-specific instructions
      const dynamicPrompt = buildMasterPrompt(remasterConfig, vehicleDescription, slot.key, promptOverrides);

      const MAX_RETRIES = 2;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { data, error } = await invokeRemasterVehicleImage({
            imageBase64: captures[slot.key].base64,
            additionalImages: detailImages.length > 0 ? detailImages : undefined,
            vehicleDescription,
            modelTier: modelTier || 'standard',
            dynamicPrompt,
            customShowroomBase64: remasterConfig.customShowroomBase64 || null,
            customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
            dealerLogoUrl: cachedDealerLogoRef.current ? null : (remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null),
            dealerLogoBase64: remasterConfig.showDealerLogo ? (cachedDealerLogoRef.current || remasterConfig.dealerLogoBase64) : null,
            manufacturerLogoUrl: cachedMfgLogoRef.current ? null : (remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null),
            manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? (cachedMfgLogoRef.current || remasterConfig.manufacturerLogoBase64) : null,
          });

          if (error || !data?.imageBase64) {
            const errMsg = data?.error || error?.message || 'Fehler beim Remastering';
            // Retry on connection / body errors
            if (attempt < MAX_RETRIES && (errMsg.includes('Verbindung') || errMsg.includes('FunctionsFetchError') || errMsg.includes('Failed to fetch'))) {
              console.warn(`[Remaster] Retry ${attempt + 1}/${MAX_RETRIES} for ${slot.key}: ${errMsg}`);
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
              continue;
            }
            setCaptures(prev => ({ ...prev, [slot.key]: { ...prev[slot.key], status: 'error', error: errMsg } }));
          } else {
            setCaptures(prev => ({ ...prev, [slot.key]: { ...prev[slot.key], status: 'done', remasteredBase64: data.imageBase64 } }));
          }
          break; // success or non-retryable error
        } catch (e) {
          if (attempt < MAX_RETRIES) {
            console.warn(`[Remaster] Network retry ${attempt + 1}/${MAX_RETRIES} for ${slot.key}`);
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          setCaptures(prev => ({ ...prev, [slot.key]: { ...prev[slot.key], status: 'error', error: 'Netzwerkfehler – bitte erneut versuchen' } }));
        }
      }
      completed++;
      setProgress({ current: completed, total });
    };

    // Use lower concurrency on mobile to prevent connection drops
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
      const overrides = await fetchPromptOverrides();
      const dynamicPrompt = buildMasterPrompt(remasterConfig, vehicleDescription, undefined, overrides);
      const { data, error } = await invokeRemasterVehicleImage({
        imageBase64: captures[slotKey].base64,
        additionalImages: detailImages.length > 0 ? detailImages : undefined,
        vehicleDescription,
        modelTier: modelTier || 'standard',
        dynamicPrompt,
        customShowroomBase64: remasterConfig.customShowroomBase64 || null,
        customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
        dealerLogoUrl: cachedDealerLogoRef.current ? null : (remasterConfig.showDealerLogo ? remasterConfig.dealerLogoUrl : null),
        dealerLogoBase64: remasterConfig.showDealerLogo ? (cachedDealerLogoRef.current || remasterConfig.dealerLogoBase64) : null,
        manufacturerLogoUrl: cachedMfgLogoRef.current ? null : (remasterConfig.showManufacturerLogo ? remasterConfig.manufacturerLogoUrl : null),
        manufacturerLogoBase64: remasterConfig.showManufacturerLogo ? (cachedMfgLogoRef.current || remasterConfig.manufacturerLogoBase64) : null,
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
        additionalImages={detailImages.length > 0 ? detailImages : undefined}
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

      {/* Detail image upload – directly below main grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Weitere Detailaufnahmen (Multiupload)</h3>

        {/* Category icons grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {DETAIL_CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => detailFileRef.current?.click()}
              disabled={isProcessing || detailImages.length >= 10}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border border-border bg-card hover:border-accent hover:bg-muted/50 transition-colors text-center"
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="text-[9px] leading-tight font-medium text-muted-foreground">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Uploaded detail images */}
        {detailImages.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {detailImages.map((img, idx) => (
              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-card">
                <img src={img} alt={`Detail ${idx + 1}`} className="w-full h-full object-cover" />
                {!isProcessing && (
                  <button
                    onClick={() => setDetailImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {detailImages.length < 10 && (
              <button
                onClick={() => detailFileRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent bg-card flex flex-col items-center justify-center gap-1 transition-colors"
                disabled={isProcessing}
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Mehr</span>
              </button>
            )}
          </div>
        )}

        {/* Upload button when no details yet */}
        {detailImages.length === 0 && (
          <button
            onClick={() => detailFileRef.current?.click()}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-accent bg-card hover:bg-muted/50 transition-colors"
          >
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Durchsuchen und Hinzufügen</span>
          </button>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          Um ein optimales Ergebnis zu erzielen, laden Sie bitte bis zu zehn weitere Detailaufnahmen hoch – Innenraum (Mittelkonsole, Lenkrad, Infotainment), Exterieur (Felgen, Kofferraum), Schäden, Logos, Motorraum etc.
        </p>

        <input
          ref={detailFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            const remaining = 10 - detailImages.length;
            const toProcess = files.slice(0, remaining);
            const newImages: string[] = [];
            for (const file of toProcess) {
              if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) continue;
              try {
                const raw = await fileToBase64(file);
                const compressed = await compressImage(raw);
                newImages.push(compressed);
              } catch { /* skip */ }
            }
            if (newImages.length > 0) {
              setDetailImages(prev => [...prev, ...newImages]);
              toast.success(`${newImages.length} Detailbild${newImages.length > 1 ? 'er' : ''} hinzugefügt`);
            }
          }}
        />
      </div>

      {/* Remaster Options */}
      <RemasterOptions
        config={remasterConfig}
        onChange={setRemasterConfig}
        vehicleBrand={vehicleData?.vehicle?.brand}
        vehicleModel={vehicleData?.vehicle?.model}
        brandDetectionStatus={brandDetectionStatus}
        onBrandChange={(brand) => {
          if (vehicleData && onVehicleDataChange) {
            onVehicleDataChange({
              ...vehicleData,
              vehicle: { ...vehicleData.vehicle, brand },
            });
          }
          if (brand) setBrandDetectionStatus('found');
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
              disabled={capturedVehicleImages.length === 0 || isProcessing || !isRemasterConfigValid}
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
