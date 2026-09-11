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
import { type RemasterConfig, buildMasterPrompt, fetchPromptOverrides, isInteriorSlotKey, WHEEL_VISIBILITY_RULE, SCENE_OPTIONS, LICENSE_PLATE_OPTIONS } from '@/lib/remaster-prompt';
import PipelineRunner from '@/components/PipelineRunner';
import { lookupBrandFromVin } from '@/lib/vin-wmi-lookup';
import { resolveCanonicalBrand, normalizeBrand } from '@/lib/brand-aliases';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import { detectVehicleBranding } from '@/lib/detect-branding';
import { uploadToGeminiFiles } from '@/lib/gemini-file-upload';
import { analyzeWheelReference, deriveWheelReferenceFromPhoto } from '@/lib/wheel-reference';
import type { WheelReference } from '@/types/wheel-reference';
import { ensureLogoCachedAsPng } from '@/lib/image-base64-cache';
import { ensureVehicleAuto } from '@/lib/vehicle-utils';
import { useAuth } from '@/hooks/useAuth';
import type { VehicleData } from '@/types/vehicle';
import type {
  ActiveVehicleClassKey,
  CaptureSlot,
  TruckWorkflowSelection,
  VehicleClassContext,
} from '@/config/vehicle-class-types';
import { getVehicleClassProfile, resolveVehicleClass } from '@/config/vehicle-classes';
import { resolveCaptureSlots } from '@/config/resolve-slots';
import { isTruckSelectionComplete } from '@/config/truck-workflow';
import { checkSourceCoverage } from '@/lib/source-coverage';
import VehicleClassStrip from '@/components/capture/VehicleClassStrip';
import CaptureSummaryPanel, { type SummaryRow } from '@/components/capture/CaptureSummaryPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import TruckWizard from '@/components/capture/TruckWizard';
import { TruckSketch } from '@/components/capture/TruckSketch';
import { usePipeline } from '@/contexts/PipelineContext';
import { createPipelineWorkflowKey } from '@/lib/pipeline-workflow';

interface ImageCaptureGridProps {
  vehicleDescription: string;
  vehicleData?: VehicleData;
  modelTier?: string;
  projectId?: string | null;
  vehicleId?: string | null;
  onComplete: (mainImage: string, galleryImages: string[], vin?: string, originals?: string[]) => void;
  onVehicleDataChange?: (data: VehicleData) => void;
  onBack: () => void;
  onPipelineComplete?: () => void;
}

/**
 * Slots kommen aus der Fahrzeugklassen-Registry.
 * Pkw: statische Liste (identisch zur bisherigen Hardcoding-Variante).
 * Lkw: dynamisch aus der Wizard-Auswahl.
 */
type PerspectiveSlot = CaptureSlot;

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

/** Kompakter Seitenabschnitt – auf Mobil optional einklappbar. */
const CaptureSection: React.FC<{
  title: string;
  subtitle?: string;
  badge?: string;
  badgeOk?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, badge, badgeOk, collapsible, children }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const canCollapse = !!collapsible && isMobile;
  const isOpen = canCollapse ? open : true;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header
        className={`flex items-start justify-between gap-3 ${canCollapse ? 'cursor-pointer' : ''}`}
        onClick={canCollapse ? () => setOpen(o => !o) : undefined}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                badgeOk ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'
              }`}
            >
              {badge}
            </span>
          )}
          {canCollapse && (
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>
      </header>
      {isOpen && <div className="mt-3">{children}</div>}
    </section>
  );
};


const DEFAULT_CONFIG: RemasterConfig = {
  scene: '',
  licensePlate: 'remove',
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

const ImageCaptureGrid: React.FC<ImageCaptureGridProps> = ({ vehicleDescription, vehicleData, modelTier, projectId, vehicleId, onComplete, onVehicleDataChange, onBack, onPipelineComplete }) => {
  const { user } = useAuth();
  const pipeline = usePipeline();
  const [showPipeline, setShowPipeline] = useState(false);

  // ── Fahrzeugklassen-Workflow ──
  const initialClass = resolveVehicleClass(vehicleData?.vehicleClass);
  const [vehicleClass, setVehicleClass] = useState<ActiveVehicleClassKey | null>(
    vehicleData?.vehicleClass ? initialClass : null,
  );
  const [truckSelection, setTruckSelection] = useState<Partial<TruckWorkflowSelection>>({
    truckConfiguration: vehicleData?.truckConfiguration ?? null,
    truckBodyType: vehicleData?.truckBodyType ?? null,
    cargoState: vehicleData?.cargoState ?? null,
    subjectScope: vehicleData?.subjectScope ?? null,
  });
  const [truckWizardDone, setTruckWizardDone] = useState(
    () => isTruckSelectionComplete({
      truckConfiguration: vehicleData?.truckConfiguration ?? null,
      truckBodyType: vehicleData?.truckBodyType ?? null,
      cargoState: vehicleData?.cargoState ?? null,
    }),
  );
  const [ensuredVehicleId, setEnsuredVehicleId] = useState<string | null>(vehicleId || null);
  const [isEnsuringVehicle, setIsEnsuringVehicle] = useState(false);
  const [captures, setCaptures] = useState<Record<string, CapturedImage>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [detectedVin, setDetectedVin] = useState<string | null>(null);
  const [remasterConfig, setRemasterConfig] = useState<RemasterConfig>(DEFAULT_CONFIG);
  const [brandDetectionStatus, setBrandDetectionStatus] = useState<'idle' | 'detecting' | 'found' | 'not-found'>('idle');
  const [detailImages, setDetailImages] = useState<string[]>([]);
  const detailFileRef = useRef<HTMLInputElement | null>(null);
  /** Dedizierte Felgenreferenz – bewusst eigener State, NICHT detailImages. */
  const [wheelReference, setWheelReference] = useState<WheelReference | null>(null);
  // Fallback: automatisch aus einem Fahrzeugfoto ausgeschnittene Felgenreferenz,
  // wenn der Nutzer KEINE dedizierte Felgenaufnahme hochgeladen hat.
  const derivedWheelRef = useRef<WheelReference | null>(null);
  const derivedWheelSourceRef = useRef<string | null>(null);
  const [wheelAnalyzing, setWheelAnalyzing] = useState(false);
  const wheelFileRef = useRef<HTMLInputElement | null>(null);
  const vinLookup = useVinLookup();
  const { makes } = useVehicleMakes();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const brandDetectionAttempted = useRef(false);
  const latestVehicleDataRef = useRef<VehicleData | undefined>(vehicleData);
  latestVehicleDataRef.current = vehicleData;

  /**
   * Ensure a vehicle row exists (using VIN if detected, otherwise a NOVIN
   * placeholder) before the pipeline runs, so every generated image is
   * attached to a vehicle and shows up in the dashboard.
   */
  const ensureVehicleForPipeline = useCallback(async (): Promise<string | null> => {
    if (ensuredVehicleId) return ensuredVehicleId;
    if (vehicleId) { setEnsuredVehicleId(vehicleId); return vehicleId; }
    if (!user) return null;
    setIsEnsuringVehicle(true);
    try {
      const vid = await ensureVehicleAuto(user.id, detectedVin || (vehicleData as any)?.vehicle?.vin || null, vehicleData);
      if (vid) setEnsuredVehicleId(vid);
      return vid;
    } finally {
      setIsEnsuringVehicle(false);
    }
  }, [ensuredVehicleId, vehicleId, user, vehicleData, detectedVin]);

  /** Coverage-Snapshot für Callbacks, die vor der Berechnung definiert sind. */
  const coverageRef = useRef<{ ok: boolean; missingLabels: string[] }>({ ok: true, missingLabels: [] });

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

  const activeClass: ActiveVehicleClassKey = vehicleClass ?? 'car';
  const classProfile = getVehicleClassProfile(activeClass);

  /** Verbindlicher Klassen-Kontext für Prompt-Bau und Edge Function. */
  const classContext: VehicleClassContext = useMemo(() => ({
    vehicleClass: activeClass,
    truckConfiguration: truckSelection.truckConfiguration ?? null,
    truckBodyType: truckSelection.truckBodyType ?? null,
    cargoState: truckSelection.cargoState ?? null,
    subjectScope: truckSelection.subjectScope ?? null,
  }), [activeClass, truckSelection]);

  const slots: PerspectiveSlot[] = useMemo(
    () => resolveCaptureSlots(classProfile, truckSelection),
    [classProfile, truckSelection],
  );

  const capturedCount = Object.keys(captures).length;
  const vehicleSlots = slots.filter(s => !s.isVin);
  const capturedVehicleImages = vehicleSlots.filter(s => captures[s.key]);
  const coverage = useMemo(
    () => checkSourceCoverage(slots, captures),
    [slots, captures],
  );
  coverageRef.current = { ok: coverage.ok, missingLabels: coverage.missingLabels };

  const handleCapture = useCallback(async (slot: PerspectiveSlot, file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name);
    if (!isImage) {
      toast.error('Bitte ein Bild auswählen.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Bild zu groß (max 25MB).');
      return;
    }

    let base64: string;
    try {
      const rawBase64 = await fileToBase64(file);
      // Compress to max 2048px and JPEG quality 0.85 to prevent edge function timeouts
      try {
        base64 = await compressImage(rawBase64);
      } catch {
        // z.B. HEIC/HEIF: Browser kann das Bild nicht in Canvas laden → Original verwenden
        base64 = rawBase64;
      }
    } catch {
      toast.error('Bild konnte nicht gelesen werden.');
      return;
    }
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
          const refs = await uploadToGeminiFiles([{ imageBase64: base64 }]);
          const body: any = refs?.[0] ? { imageFileUri: refs[0] } : { imageBase64: base64 };
          const { data: aiResult, error: aiError } = await supabase.functions.invoke('detect-vehicle-brand', {
            body,
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
        const refsVin = await uploadToGeminiFiles([{ imageBase64: base64 }]);
        const vinBody: any = refsVin?.[0] ? { imageFileUri: refsVin[0] } : { imageBase64: base64 };
        const { data, error } = await supabase.functions.invoke('ocr-vin', { body: vinBody });
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

  /** Upload/Ersetzen der dedizierten Felgenreferenz (genau EIN Bild). */
  const handleWheelReferenceFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name);
    if (!isImage) { toast.error('Bitte ein Bild auswählen.'); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error('Bild zu groß (max 25MB).'); return; }

    let base64: string;
    try {
      const raw = await fileToBase64(file);
      try { base64 = await compressImage(raw); } catch { base64 = raw; }
    } catch {
      toast.error('Bild konnte nicht gelesen werden.');
      return;
    }

    // Bild sofort übernehmen – die Analyse darf den Upload NIE blockieren.
    setWheelReference({ image: base64, analysis: null, confidence: 'unknown' });
    setWheelAnalyzing(true);
    try {
      const analyzed = await analyzeWheelReference(base64);
      setWheelReference(analyzed);
      if (analyzed.analysis) {
        console.log('[wheel-reference] Analyse:', analyzed.analysis, analyzed.confidence);
        toast.success('Felgenreferenz analysiert.');
      } else {
        toast.success('Felgenreferenz hinzugefügt.');
      }
    } catch {
      toast.success('Felgenreferenz hinzugefügt.');
    } finally {
      setWheelAnalyzing(false);
    }
  }, []);

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

  const isRemasterConfigValid = !!remasterConfig.scene;

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
    // Verbindliche Felgenquelle EINMAL bestimmen (Upload oder Auto-Crop).
    const primaryExteriorPhoto = toProcess.find(s => !isInteriorSlotKey(s.key))
      ? captures[toProcess.find(s => !isInteriorSlotKey(s.key))!.key]?.base64
      : undefined;
    const effectiveWheelRef = await resolveWheelReference(primaryExteriorPhoto);
    const processSlot = async (slot: typeof toProcess[0]) => {
      // Vision pre-scan for non-OEM branding when cleanup categories are selected.
      let detectedBranding: import('@/lib/detect-branding').DetectedBrandingItem[] | undefined;
      if (remasterConfig.cleanupItems && remasterConfig.cleanupItems.length > 0) {
        try {
          detectedBranding = await detectVehicleBranding(captures[slot.key].base64);
          console.log(`[Remaster] branding pre-scan slot=${slot.key} items=${detectedBranding?.length ?? 0}`);
        } catch (e) {
          console.warn('[Remaster] branding pre-scan failed, continuing without inventory:', e);
        }
      }
      const slotIsInterior = isInteriorSlotKey(slot.key);
      const slotWheelRef = !slotIsInterior && effectiveWheelRef?.image ? effectiveWheelRef : null;
      console.log(`[Remaster][wheel] slot=${slot.key} wheelAssetAvailable=${!!effectiveWheelRef} derived=${!!effectiveWheelRef?.derived} routed=${!!slotWheelRef}`);
      const slotConfig = { ...remasterConfig, detectedBranding, wheelReference: slotWheelRef };
      // Build per-slot prompt with perspective-specific instructions
      let dynamicPrompt = buildMasterPrompt(slotConfig, vehicleDescription, slot.key, promptOverrides, classContext);
      if (slotWheelRef) dynamicPrompt += `\n\n${WHEEL_VISIBILITY_RULE}`;

      const MAX_RETRIES = 2;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { data, error } = await invokeRemasterVehicleImage({
            classContext,
            imageBase64: captures[slot.key].base64,
            additionalImages: detailImages.length > 0 ? detailImages : undefined,
            wheelReferenceBase64: slotWheelRef?.image || null,
            wheelReferenceAnalysis: slotWheelRef?.analysis || null,
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
      let detectedBranding: import('@/lib/detect-branding').DetectedBrandingItem[] | undefined;
      if (remasterConfig.cleanupItems && remasterConfig.cleanupItems.length > 0) {
        try { detectedBranding = await detectVehicleBranding(captures[slotKey].base64); } catch { /* continue */ }
      }
      const slotIsInterior = isInteriorSlotKey(slotKey);
      const resolvedWheelRef = await resolveWheelReference(slotIsInterior ? null : captures[slotKey].base64);
      const slotWheelRef = !slotIsInterior && resolvedWheelRef?.image ? resolvedWheelRef : null;
      let dynamicPrompt = buildMasterPrompt({ ...remasterConfig, detectedBranding, wheelReference: slotWheelRef }, vehicleDescription, slotKey, overrides, classContext);
      if (slotWheelRef) dynamicPrompt += `\n\n${WHEEL_VISIBILITY_RULE}`;
      const { data, error } = await invokeRemasterVehicleImage({
        classContext,
        imageBase64: captures[slotKey].base64,
        additionalImages: detailImages.length > 0 ? detailImages : undefined,
        wheelReferenceBase64: slotWheelRef?.image || null,
        wheelReferenceAnalysis: slotWheelRef?.analysis || null,
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

  /**
   * Liefert die verbindliche Felgenreferenz: dedizierter Upload zuerst,
   * sonst ein automatisch erkannter Crop aus dem Fahrzeugfoto.
   */
  const resolveWheelReference = async (fallbackPhoto?: string | null): Promise<WheelReference | null> => {
    if (wheelReference?.image) return wheelReference;
    if (!fallbackPhoto) return null;
    if (derivedWheelSourceRef.current === fallbackPhoto) return derivedWheelRef.current;
    const derived = await deriveWheelReferenceFromPhoto(fallbackPhoto);
    derivedWheelSourceRef.current = fallbackPhoto;
    derivedWheelRef.current = derived;
    console.log(`[Remaster][wheel] Fallback-Crop ${derived ? 'erstellt' : 'nicht möglich'}`);
    return derived;
  };

  const finishUp = () => {
    const doneSlots = vehicleSlots.filter(s => captures[s.key]?.status === 'done' && captures[s.key]?.remasteredBase64);
    if (doneSlots.length === 0) {
      toast.error('Keine Bilder erfolgreich verarbeitet.');
      return;
    }
    const main = captures[doneSlots[0].key].remasteredBase64!;
    const gallery = doneSlots.slice(1).map(s => captures[s.key].remasteredBase64!);
    // Include ALL raw sources as originals: main perspective shots + weitere
    // Detailaufnahmen (Datenblatt, Innenraum, Felgen, Motor, Schäden, …).
    // So jede Aufnahme, die der Nutzer draußen am Auto macht, landet später
    // im Dashboard unter "Originale".
    const originals = [
      ...doneSlots.map(s => captures[s.key].base64),
      ...detailImages,
      ...(wheelReference?.image ? [wheelReference.image] : []),
    ];
    toast.success(`${doneSlots.length} Bilder erfolgreich remastered.`);
    onComplete(main, gallery, detectedVin || undefined, originals);
  };

  const allVehicleDone = capturedVehicleImages.length > 0 &&
    capturedVehicleImages.every(s => captures[s.key].status === 'done' || captures[s.key].status === 'error') &&
    !isProcessing;

  // Collect all captured base64 images for pipeline input
  const allCapturedBase64 = vehicleSlots
    .filter(s => captures[s.key])
    .map(s => captures[s.key].remasteredBase64 || captures[s.key].base64);
  const allCapturedRoles = vehicleSlots
    .filter(s => captures[s.key])
    .map(s => s.key);

  // Collect original (pre-remaster) images for AI reference
  // WICHTIG: NUR normale Perspektiv-Slots – die Felgenreferenz wird separat
  // via `wheelReference` durchgereicht, damit die indexbasierte
  // Primary-Reference-Logik der Pipeline nicht verfälscht wird.
  const allOriginalBase64 = vehicleSlots
    .filter(s => captures[s.key])
    .map(s => captures[s.key].base64);

  const openPipeline = useCallback(async () => {
    // Source-Coverage-Validierung: fehlende Pflichtperspektiven werden NIE
    // aus anderen Winkeln hochgerechnet – der Start wird stattdessen blockiert.
    if (!coverageRef.current.ok) {
      toast.error(`Fehlende Pflichtaufnahmen: ${coverageRef.current.missingLabels.join(', ')}`);
      return;
    }
    const currentVehicleId = await ensureVehicleForPipeline();
    const workflowKey = createPipelineWorkflowKey({
      projectId,
      vehicleId: currentVehicleId || vehicleId,
      vin: detectedVin,
      inputImages: allCapturedBase64,
    });
    if (pipeline.isRunning && pipeline.config?.workflowKey !== workflowKey) {
      toast.error('Eine andere Pipeline läuft noch. Bitte warte, bis sie abgeschlossen ist.');
      return;
    }
    if (pipeline.isFinished && pipeline.config?.workflowKey !== workflowKey) {
      pipeline.clearPipeline();
    }
    setShowPipeline(true);
  }, [allCapturedBase64, detectedVin, ensureVehicleForPipeline, pipeline, projectId, vehicleId]);

  // Fahrzeugart bleibt auf der Seite wählbar (kein eigener Schritt mehr).
  const chooseVehicleClass = (cls: ActiveVehicleClassKey) => {
    if (cls === vehicleClass) return;
    setVehicleClass(cls);
    setCaptures({});
    setTruckWizardDone(cls !== 'truck');
    const cur = latestVehicleDataRef.current;
    if (cur) onVehicleDataChange?.({ ...cur, vehicleClass: cls });
  };


  if (showPipeline) {
    return (
      <PipelineRunner
        inputImages={allCapturedBase64}
        referenceRoles={allCapturedRoles}
        originalImages={allOriginalBase64}
        additionalImages={detailImages.length > 0 ? detailImages : undefined}
        wheelReference={wheelReference}
        vehicleDescription={vehicleDescription}
        vehicleBrand={vehicleData?.vehicle?.brand}
        remasterConfig={remasterConfig}
        classContext={classContext}
        modelTier={modelTier}
        projectId={projectId}
        vehicleId={ensuredVehicleId || vehicleId}
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

  const vinSlot = slots.find(s => s.isVin);
  const requiredSlots = vehicleSlots.filter(s => s.required !== false);
  const requiredDone = requiredSlots.filter(s => captures[s.key]).length;
  const sceneLabel = SCENE_OPTIONS.find(o => o.value === remasterConfig.scene)?.label || 'Bitte wählen';
  const plateLabel = LICENSE_PLATE_OPTIONS.find(o => o.value === remasterConfig.licensePlate)?.label || '—';
  const brandModel = [vehicleData?.vehicle?.brand, vehicleData?.vehicle?.model].filter(Boolean).join(' ');

  const summaryRows: SummaryRow[] = [
    { label: 'Fahrzeugart', value: classProfile.label },
    { label: 'Marke / Modell', value: brandModel || 'Offen', ok: !!brandModel },
    { label: 'VIN', value: detectedVin ? 'Erkannt' : 'Offen', ok: !!detectedVin },
    { label: 'Pflichtaufnahmen', value: `${requiredDone} / ${requiredSlots.length}`, ok: coverage.ok },
    { label: 'Felgen / Reifen', value: wheelReference?.image ? '1 Foto' : '—' },
    { label: 'Detailaufnahmen', value: detailImages.length ? `${detailImages.length} Fotos` : '—' },
    { label: 'Showroom', value: sceneLabel, ok: !!remasterConfig.scene },
    { label: 'Nummernschild', value: plateLabel },
    { label: 'Fahrzeugfarbe', value: remasterConfig.changeColor ? (remasterConfig.colorHex || 'Eigene') : 'Original' },
    { label: 'Herstellerlogo', value: remasterConfig.showManufacturerLogo ? 'Aktiv' : 'Inaktiv' },
    { label: 'Autohauslogo', value: remasterConfig.showDealerLogo ? 'Aktiv' : 'Inaktiv' },
  ];

  const primaryAction = !allVehicleDone ? (
    <Button
      onClick={startRemastering}
      disabled={capturedVehicleImages.length === 0 || isProcessing || !isRemasterConfigValid}
      className="w-full gap-2 gradient-accent text-accent-foreground font-semibold"
    >
      {isProcessing ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Verarbeite…</>
      ) : (
        <><Camera className="w-4 h-4" /> Bilder remastern</>
      )}
    </Button>
  ) : (
    <Button
      onClick={openPipeline}
      disabled={isEnsuringVehicle}
      className="w-full gap-2 gradient-accent text-accent-foreground font-semibold"
    >
      {isEnsuringVehicle ? <><Loader2 className="w-4 h-4 animate-spin" /> Vorbereiten…</> : <><Zap className="w-4 h-4" /> Bilderset generieren</>}
    </Button>
  );

  const renderSlotCard = (slot: PerspectiveSlot) => {
    const cap = captures[slot.key];
    return (
      <div
        key={slot.key}
        className="relative group rounded-lg border border-border bg-card transition-colors hover:border-accent/50 overflow-hidden"
      >
        {cap ? (
          <div className="aspect-[4/3] relative">
            <img src={cap.remasteredBase64 || cap.base64} alt={slot.label} className="w-full h-full object-cover" />
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
            <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              <Check className="w-3 h-3 text-green-600" /> {slot.label}
            </span>
            {!isProcessing && (
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => fileRefs.current[slot.key]?.click()}
                  className="rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-background"
                >
                  Ersetzen
                </button>
                <button
                  onClick={() => removeCapture(slot.key)}
                  className="w-5 h-5 rounded-full bg-background/85 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileRefs.current[slot.key]?.click()}
            className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-1 p-3 hover:bg-muted/40 transition-colors"
          >
            {slot.icon ? (
              <img src={slot.icon} alt={slot.label} className="w-14 h-10 object-contain opacity-40" />
            ) : (
              <TruckSketch id={slot.sketch} className="w-16 h-10 text-muted-foreground/50" />
            )}
            <span className="text-[11px] font-medium text-foreground text-center leading-tight">
              {slot.label}
              {slot.required === false && <span className="text-muted-foreground"> (optional)</span>}
            </span>
            {slot.hint && (
              <span className="text-[10px] text-muted-foreground/70 text-center leading-tight px-1">{slot.hint}</span>
            )}
            <Camera className="w-3.5 h-3.5 text-muted-foreground/60" />
          </button>
        )}
        <input
          ref={(el) => { fileRefs.current[slot.key] = el; }}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCapture(slot, file);
            e.target.value = '';
          }}
        />
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1320px] mx-auto pb-24 lg:pb-0">
      {/* Kopfbereich */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            {classProfile.captureHeadline || 'Fahrzeug aufnehmen'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Pflichtangaben vervollständigen. Optionale Angaben verbessern das Ergebnis.
          </p>
        </div>
        <Button variant="outlineGray" size="sm" onClick={onBack} disabled={isProcessing}>Zurück</Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Hauptbereich */}
        <div className="space-y-4">
          <CaptureSection title="Fahrzeugart" subtitle="Bestimmt Pflichtaufnahmen und Aufbereitungslogik.">
            <VehicleClassStrip value={activeClass} onChange={chooseVehicleClass} disabled={isProcessing} />
            {activeClass === 'truck' && truckWizardDone && (
              <button
                onClick={() => setTruckWizardDone(false)}
                className="mt-2 text-[11px] underline text-muted-foreground hover:text-foreground"
              >
                Lkw-Konfiguration ändern
              </button>
            )}
          </CaptureSection>

          {activeClass === 'truck' && !truckWizardDone && (
            <CaptureSection title="Lkw-Konfiguration" subtitle="Bestimmt die benötigten Aufnahmen.">
              <TruckWizard
                selection={truckSelection}
                onChange={setTruckSelection}
                onComplete={(sel) => {
                  setTruckSelection(sel);
                  setTruckWizardDone(true);
                  const cur = latestVehicleDataRef.current;
                  if (cur) onVehicleDataChange?.({
                    ...cur,
                    vehicleClass: 'truck',
                    truckConfiguration: sel.truckConfiguration,
                    truckBodyType: sel.truckBodyType,
                    cargoState: sel.cargoState,
                    subjectScope: sel.subjectScope,
                  });
                }}
                onBack={onBack}
              />
            </CaptureSection>
          )}

          {(activeClass !== 'truck' || truckWizardDone) && (
            <>
              <CaptureSection
                title="Pflichtangaben"
                subtitle="Diese Angaben werden für die Generierung benötigt."
                badge={`${requiredDone} / ${requiredSlots.length} Pflichtaufnahmen`}
                badgeOk={coverage.ok}
              >
                {!coverage.ok && (
                  <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Pflichtaufnahmen fehlen: </span>
                    {coverage.missingLabels.join(', ')}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {vehicleSlots.map(renderSlotCard)}
                </div>

                {vinSlot && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-semibold text-foreground">Fahrzeug-Identifikationsnummer (VIN)</p>
                    <p className="mb-3 text-[11px] text-muted-foreground">
                      Das VIN-Foto wird automatisch ausgelesen und für den Fahrzeug-Lookup verwendet.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                      {renderSlotCard(vinSlot)}
                      <div className="flex flex-col justify-center gap-1.5">
                        {detectedVin ? (
                          <>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                              <Check className="w-3.5 h-3.5" /> VIN erkannt
                              {vinLookup.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            </span>
                            <span className="font-mono text-sm font-bold text-foreground">{detectedVin}</span>
                            {brandModel && <span className="text-[11px] text-muted-foreground">{brandModel}</span>}
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Noch keine VIN erkannt – Foto aufnehmen oder Datei hochladen.
                          </span>
                        )}
                        <button
                          onClick={() => fileRefs.current[vinSlot.key]?.click()}
                          className="self-start text-[11px] underline text-muted-foreground hover:text-foreground"
                        >
                          {detectedVin ? 'VIN-Foto ersetzen' : 'Datei hochladen'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </CaptureSection>

              <CaptureSection
                title="Felgen / Reifen"
                subtitle="Optional: Für Sonderfelgen oder abweichende Bereifung. Wird als verbindliche Referenz verwendet."
                collapsible
                badge={wheelReference?.image ? '1 Foto' : 'Optional'}
              >
                {wheelReference?.image ? (
                  <div className="relative w-full max-w-[200px] aspect-[4/3] rounded-lg overflow-hidden border border-border bg-card">
                    <img src={wheelReference.image} alt="Felgenreferenz" className="w-full h-full object-cover" />
                    {wheelAnalyzing && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center text-xs font-medium">
                        Analysiere…
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 flex">
                      <button type="button" onClick={() => wheelFileRef.current?.click()} className="flex-1 py-1.5 text-[11px] bg-background/85 hover:bg-background">
                        Ersetzen
                      </button>
                      <button type="button" onClick={() => setWheelReference(null)} className="flex-1 py-1.5 text-[11px] bg-background/85 hover:bg-background text-destructive">
                        Löschen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => wheelFileRef.current?.click()}
                    className="flex w-full max-w-[220px] items-center gap-3 rounded-lg border border-dashed border-border bg-card px-3 py-3 text-left transition-colors hover:border-accent hover:bg-muted/30"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">＋</span>
                    <span className="text-xs font-medium text-foreground">Felgenfoto hinzufügen</span>
                  </button>
                )}
                <input
                  ref={wheelFileRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) await handleWheelReferenceFile(file);
                  }}
                />
              </CaptureSection>

              <CaptureSection
                title="Weitere Detailaufnahmen"
                subtitle="Zusätzliche Aufnahmen verbessern Details und Fahrzeugtreue (bis zu 10 Bilder)."
                collapsible
                badge={detailImages.length ? `${detailImages.length} Fotos` : 'Optional'}
              >
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {detailImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-card">
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
                      className="aspect-square rounded-lg border border-dashed border-border hover:border-accent bg-card flex flex-col items-center justify-center gap-1 transition-colors"
                      disabled={isProcessing}
                    >
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Hinzufügen</span>
                    </button>
                  )}
                </div>

                {activeClass !== 'motorcycle' && detailImages.length === 0 && (
                  <img
                    src="/images/detail-upload-guide.png"
                    alt="Detailaufnahmen Guide – Mittelkonsole, Armaturenbrett, Infotainment, Lenkrad, Reifen"
                    className="mt-3 w-full max-w-md rounded-lg border border-border opacity-70"
                    loading="lazy"
                  />
                )}

                <p className="mt-3 text-[11px] text-muted-foreground">
                  {activeClass === 'motorcycle'
                    ? 'Empfohlen: bis zu zehn weitere Detailaufnahmen für ein optimales Ergebnis.'
                    : 'Empfohlen: Innenraum (Mittelkonsole, Lenkrad, Infotainment), Exterieur (Felgen, Kofferraum), Schäden, Logos, Motorraum.'}
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
              </CaptureSection>

              <CaptureSection
                title="Showroom, Nummernschild & Branding"
                subtitle="Diese Angaben bestimmen Hintergrund, Kennzeichen, Farbe und Logos der generierten Bilder."
                collapsible
                badge={sceneLabel}
                badgeOk={!!remasterConfig.scene}
              >
                <RemasterOptions
                  config={remasterConfig}
                  onChange={setRemasterConfig}
                  vehicleBrand={vehicleData?.vehicle?.brand}
                  vehicleModel={vehicleData?.vehicle?.model}
                  brandDetectionStatus={brandDetectionStatus}
                  onBrandChange={(brand) => {
                    if (vehicleData && onVehicleDataChange) {
                      onVehicleDataChange({ ...vehicleData, vehicle: { ...vehicleData.vehicle, brand } });
                    }
                    if (brand) setBrandDetectionStatus('found');
                  }}
                  onModelChange={(model) => {
                    if (vehicleData && onVehicleDataChange) {
                      onVehicleDataChange({ ...vehicleData, vehicle: { ...vehicleData.vehicle, model } });
                    }
                  }}
                />
              </CaptureSection>
            </>
          )}
        </div>

        {/* Rechte Spalte: Zusammenfassung */}
        <aside className="lg:sticky lg:top-4">
          <CaptureSummaryPanel
            complete={coverage.ok && !!remasterConfig.scene}
            completeText={coverage.ok && remasterConfig.scene ? 'Pflichtfelder vollständig' : 'Pflichtfelder unvollständig'}
            hintText={
              !coverage.ok
                ? `Es fehlen: ${coverage.missingLabels.join(', ')}`
                : !remasterConfig.scene
                  ? 'Bitte noch eine Szene auswählen.'
                  : 'Alle erforderlichen Angaben wurden ergänzt.'
            }
            rows={summaryRows}
          >
            {isProcessing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Remastering läuft…</span>
                  <span>Bild {progress.current} von {progress.total}</span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
              </div>
            )}
            <div className="hidden lg:block">{primaryAction}</div>
            {allVehicleDone && (
              <Button variant="outline" size="sm" className="w-full" onClick={finishUp}>
                {projectId ? (
                  <><Check className="w-4 h-4 mr-1" /> Weiter zur Landing Page</>
                ) : (
                  <><ImageIcon className="w-4 h-4 mr-1" /> Zur Galerie</>
                )}
              </Button>
            )}
            <p className="text-[10px] leading-snug text-muted-foreground">
              Je nach Anzahl der Aufnahmen und gewählten Optionen kann der tatsächliche Verbrauch leicht abweichen.
            </p>
          </CaptureSummaryPanel>
        </aside>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">Pflichtaufnahmen</p>
            <p className="text-xs font-semibold text-foreground">{requiredDone} / {requiredSlots.length}</p>
          </div>
          <div className="flex-1">{primaryAction}</div>
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

