// OneShotStudio – Beta Power-Button Workflow (v2)
//
// Step 1 "Aufnahme":
//   - Multi-Upload für 5–15 Fahrzeugbilder (gemischt) + optionales Datenblatt
//   - Parallel im Hintergrund:
//       • analyze-offer-image (Datenblatt)
//       • classify-vehicle-images (alle Fahrzeugbilder in einem Call)
//       • ocr-vin → lookup-vin (für Bilder die als VIN klassifiziert wurden)
//
// Step 2 "Setup":
//   - Komplette Banner-Felder vorbefüllt aus Scan/VIN-Lookup
//   - Quellen-Badges zeigen "manuell / Datenblatt / VIN / aus Bild"
//   - Pipeline-Optionen via RemasterOptions (Szene, Plate, Logos)
//   - Banner-Format-Auswahl (mehrfach), Video an/aus + Prompt
//
// Step 3 "Generierung":
//   - Hero zuerst (Master-Image), dann Rest der Pipeline + Banner + Video parallel
//   - Bilder werden klassifiziert und automatisch der richtigen Pipeline-Position zugeordnet
//
// Bestehende Komponenten (BannerGenerator, ImageCaptureGrid, /generator/fotos)
// bleiben unangetastet — wir orchestrieren nur.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft, ScanSearch, Loader2, Upload, X, ChevronRight, Zap, Image as ImageIcon,
  Video, FileText, Hash, Layers, AlertCircle, Sparkles, Camera, Database, Car,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';

import RemasterOptions from '@/components/RemasterOptions';
import ModelSelector, { type ModelTier } from '@/components/ModelSelector';
import {
  type RemasterConfig, SCENE_OPTIONS, buildMasterPrompt,
} from '@/lib/remaster-prompt';
import {
  PIPELINE_JOBS, PIPELINE_CATEGORIES, applyPromptOverrides, injectLogoPlaceholder,
  detectBrandFromDescription, getTotalImageCount, type PipelineJob,
} from '@/lib/pipeline-jobs';
import { fetchPromptOverrides } from '@/lib/remaster-prompt';
import { resolveCanonicalBrand, normalizeBrand } from '@/lib/brand-aliases';
import { lookupBrandFromVin } from '@/lib/vin-wmi-lookup';
import { usePipelineSafe } from '@/contexts/PipelineContext';
import { compressImageForAI, fileToBase64 } from '@/lib/image-compress';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import { ensureVehicle } from '@/lib/vehicle-utils';

import OneShotMarketingForm from './oneshot/OneShotMarketingForm';
import OneShotLightbox, { type LightboxItem } from './oneshot/OneShotLightbox';
import {
  DEFAULT_FORM, DEFAULT_SOURCES, ONESHOT_BANNER_FORMATS,
  type ClassifiedImage, type ImageCategory, type MarketingForm,
  type FieldSources, type ScanData, type BannerFormatId,
} from './oneshot/oneshot-types';

interface OneShotStudioProps {
  onBack: () => void;
}

type Step = 'aufnahme' | 'setup' | 'generierung';

interface BannerOutput {
  formatId: BannerFormatId;
  formatLabel: string;
  ratio: string;
  imageBase64: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

const HERO_CATEGORY_PRIORITY: ImageCategory[] = [
  'exterior_34_front',
  'exterior_front',
  'exterior_34_rear',
  'exterior_side_left',
  'exterior_side_right',
  'exterior_rear',
];

/* ─── Helpers ─── */
const stripDataPrefix = (b: string) => (b.includes(',') ? b.split(',')[1] : b);
const newId = () => Math.random().toString(36).slice(2, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Bestimmt den Fahrzeugzustand (Pkw-EnVKV) aus Erstzulassung + Kilometerstand
 * und liefert eine menschenlesbare Begründung mit der getriggerten Regel zurück.
 */
function deriveVehicleCondition(args: {
  firstRegistration?: string | null;
  mileageKm?: string | null;
  explicitCondition?: string | null;
}): {
  condition: string;
  firstReg: string;
  km: number | null;
  monthsOld: number | null;
  rule: string;
  confidence: number;          // 0–100
  confidenceLabel: 'Hoch' | 'Mittel' | 'Niedrig';
  confidenceFactors: string[]; // einzelne Begründungen
} {
  const fr = String(args.firstRegistration || '').trim();
  const kmMatch = String(args.mileageKm || '').match(/([\d.,]+)/);
  const km = kmMatch ? parseInt(kmMatch[1].replace(/[.,]/g, ''), 10) : null;

  let monthsOld: number | null = null;
  const dateMatch = fr.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})|(\d{1,2})[./](\d{4})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1] || dateMatch[4] || '1', 10);
    const year = parseInt(dateMatch[3] || dateMatch[5] || '0', 10);
    if (year > 1990) {
      const now = new Date();
      monthsOld = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
    }
  }

  // ─── Confidence-Berechnung ───
  let confidence = 30;
  const factors: string[] = [];
  const hasFr = !!fr && monthsOld !== null;
  const hasKm = km !== null;
  const hasExplicit = !!args.explicitCondition && ['Vorführwagen', 'Tageszulassung', 'Jahreswagen', 'Neuwagen', 'Gebrauchtwagen'].includes(args.explicitCondition || '');

  if (hasFr) { confidence += 25; factors.push('+25 gültige Erstzulassung'); }
  if (hasKm) { confidence += 25; factors.push('+25 Kilometerstand erkannt'); }
  if (hasFr && hasKm) { confidence += 10; factors.push('+10 beide Signale verfügbar'); }

  // ─── Berechne Zustand aus den ZAHLEN — Pkw-EnVKV (Fassung seit 23.02.2024) ───
  // § 2 Nr. 1: Neuwagen = noch nicht zum Weiterverkauf zugelassen UND
  //            (Erstzulassung ≤ 8 Monate ODER Kilometerstand ≤ 1.000 km).
  let derived = 'Unbekannt';
  let derivedRule = 'Keine Erstzulassung oder Kilometerstand erkannt.';
  const isNew = (monthsOld === null || monthsOld <= 8) && (km === null || km <= 1000);

  if (isNew) {
    derived = 'Neuwagen';
    const partsN: string[] = [];
    partsN.push(monthsOld !== null ? `EZ ${monthsOld} Mon. ≤ 8 Mon.` : 'keine Erstzulassung');
    partsN.push(km !== null ? `${km.toLocaleString('de-DE')} km ≤ 1.000 km` : 'km ≤ 1.000');
    derivedRule = `${partsN.join(' & ')} → Neuwagen (§ 2 Nr. 1 Pkw-EnVKV).`;
  } else if (monthsOld !== null && monthsOld <= 1 && km !== null && km < 100) {
    derived = 'Tageszulassung';
    derivedRule = `EZ < 1 Monat & ${km} km < 100 km → Tageszulassung.`;
  } else if (monthsOld !== null && monthsOld <= 18 && km !== null && km < 25000) {
    derived = 'Jahreswagen';
    derivedRule = `EZ ${monthsOld} Mon. alt & ${km.toLocaleString('de-DE')} km → Jahreswagen.`;
  } else {
    derived = 'Gebrauchtwagen';
    const reasons: string[] = [];
    if (monthsOld !== null && monthsOld > 8) reasons.push(`EZ ${monthsOld} Mon. > 8 Mon.`);
    if (km !== null && km > 1000) reasons.push(`${km.toLocaleString('de-DE')} km > 1.000 km`);
    derivedRule = `${reasons.join(' & ') || 'Neuwagen-Definition nicht erfüllt'} → Gebrauchtwagen (§ 2 Nr. 1 Pkw-EnVKV).`;
  }

  // ─── Konflikt-Erkennung zwischen explicit (AI) und berechnetem Wert ───
  const explicit = args.explicitCondition || '';
  const conflict = hasExplicit && derived !== 'Unbekannt' && explicit !== derived;

  if (conflict) {
    // Daten gewinnen IMMER (Pkw-EnVKV). AI-Wert wird verworfen.
    confidence -= 35;
    factors.push(`−35 Konflikt: Datenblatt sagt „${explicit}", Zahlen sagen „${derived}"`);
    confidence = Math.max(0, Math.min(100, confidence));
    const confidenceLabel: 'Hoch' | 'Mittel' | 'Niedrig' =
      confidence >= 75 ? 'Hoch' : confidence >= 45 ? 'Mittel' : 'Niedrig';
    return {
      condition: derived,
      firstReg: fr,
      km,
      monthsOld,
      rule: `${derivedRule} (Hinweis: AI las „${explicit}", durch Pkw-EnVKV-Regel überschrieben.)`,
      confidence,
      confidenceLabel,
      confidenceFactors: factors,
    };
  }

  if (hasExplicit) { confidence += 40; factors.push('+40 Datenblatt + Zahlen stimmen überein'); }

  // Konflikte ohne explicit: EZ alt & 0 km, oder EZ neu & viele km
  if (hasFr && hasKm && monthsOld !== null && km !== null) {
    if (monthsOld > 24 && km < 100) {
      confidence -= 30;
      factors.push('−30 Konflikt: EZ alt, aber kaum gefahren');
    }
    if (monthsOld <= 2 && km > 10000) {
      confidence -= 25;
      factors.push('−25 Konflikt: EZ neu, aber viele km');
    }
  }
  if (!hasFr && !hasKm && !hasExplicit) {
    confidence -= 20;
    factors.push('−20 keine verlässlichen Signale');
  }

  confidence = Math.max(0, Math.min(100, confidence));
  const confidenceLabel: 'Hoch' | 'Mittel' | 'Niedrig' =
    confidence >= 75 ? 'Hoch' : confidence >= 45 ? 'Mittel' : 'Niedrig';

  // Wenn explicit vorhanden und kein Konflikt → explicit bestätigt
  if (hasExplicit) {
    return {
      condition: explicit,
      firstReg: fr,
      km,
      monthsOld,
      rule: derived !== 'Unbekannt'
        ? `${derivedRule} Datenblatt bestätigt: „${explicit}".`
        : `Explizit im Datenblatt als „${explicit}" ausgewiesen.`,
      confidence,
      confidenceLabel,
      confidenceFactors: factors,
    };
  }

  return {
    condition: derived,
    firstReg: fr,
    km,
    monthsOld,
    rule: derivedRule,
    confidence,
    confidenceLabel,
    confidenceFactors: factors,
  };
}


/** Detect transient edge-function failures (cold-start boot, 503, 429). */
function isTransientEdgeError(err: any, data: any): boolean {
  const msg = String(err?.message || data?.error || '').toLowerCase();
  return (
    msg.includes('boot_error') ||
    msg.includes('failed to start') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('zeitüberschreitung')
  );
}

/** Invoke an edge function with retry on transient boot/rate errors. */
async function invokeWithRetry<T = any>(
  fnName: string,
  body: any,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<{ data: T | null; error: any }> {
  const retries = opts.retries ?? 2;
  const baseDelay = opts.baseDelayMs ?? 1500;
  let lastErr: any = null;
  let lastData: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    let enrichedError = error;
    if (error?.context instanceof Response) {
      const status = error.context.status;
      let details = '';
      try { details = await error.context.clone().text(); } catch { /* ignore */ }
      enrichedError = new Error(`${error.message || 'Edge Function error'} (${status}) ${details}`);
    }
    if (!error && !data?.error) return { data: data as T, error: null };
    lastErr = enrichedError; lastData = data;
    if (attempt >= retries || !isTransientEdgeError(enrichedError, data)) {
      return { data: data as T, error: enrichedError || new Error(data?.error || 'Edge error') };
    }
    await sleep(baseDelay * (attempt + 1));
  }
  return { data: lastData, error: lastErr };
}

async function uploadGenerationRefs(images: ClassifiedImage[]): Promise<{ uri: string; mimeType: string }[] | null> {
  if (images.length === 0) return null;
  const { data, error } = await invokeWithRetry<{ fileUris?: { uri: string; mimeType: string }[] }>(
    'upload-pipeline-images',
    { images: images.map((i) => i.base64) },
    { retries: 2, baseDelayMs: 1200 },
  );
  if (error || !data?.fileUris?.length) {
    console.warn('[OneShot] File API upload failed, using inline image fallback:', error || data);
    return null;
  }
  return data.fileUris;
}

/** Pick the first image whose category matches one of priorities. */
function pickByCategory(images: ClassifiedImage[], priorities: ImageCategory[]): ClassifiedImage | null {
  for (const cat of priorities) {
    const m = images.find((i) => i.category === cat);
    if (m) return m;
  }
  return null;
}

const OneShotStudio: React.FC<OneShotStudioProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { balance, getCost } = useCredits();
  const { getLogoForMake, makes } = useVehicleMakes();
  const navigate = useNavigate();
  const pipelineCtx = usePipelineSafe();

  const [step, setStep] = useState<Step>('aufnahme');

  /* ─── Step 1: Uploads ─── */
  const [vehicleImages, setVehicleImages] = useState<ClassifiedImage[]>([]);
  const [dataSheetBase64s, setDataSheetBase64s] = useState<string[]>([]);

  const [classifying, setClassifying] = useState(false);
  const [analyzingSheet, setAnalyzingSheet] = useState(false);
  const [vinLookingUp, setVinLookingUp] = useState(false);

  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [vin, setVin] = useState<string | null>(null);
  const [vinVehicle, setVinVehicle] = useState<Record<string, any> | null>(null);
  const [vinEquipment, setVinEquipment] = useState<string[]>([]);

  const filesInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  /* ─── Step 2: Form ─── */
  const [form, setForm] = useState<MarketingForm>({ ...DEFAULT_FORM });
  const [sources, setSources] = useState<FieldSources>({ ...DEFAULT_SOURCES });

  const [remasterConfig, setRemasterConfig] = useState<RemasterConfig>({
    scene: 'showroom-1',
    licensePlate: 'keep',
    changeColor: false,
    showManufacturerLogo: false,
    showDealerLogo: false,
  });

  // Pipeline job selection
  const [selectedJobKeys, setSelectedJobKeys] = useState<Set<string>>(() => {
    return new Set(PIPELINE_JOBS.filter((j) => j.defaultSelected && !j.brand).map((j) => j.key));
  });

  // Banner formats
  const [selectedBannerFormats, setSelectedBannerFormats] = useState<Set<BannerFormatId>>(new Set(['story']));
  // Video
  const [wantVideo, setWantVideo] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');
  // Model tier
  const [modelTier, setModelTier] = useState<ModelTier>('qualitaet');

  /* ─── Step 3: Generation runtime ─── */
  const [heroBase64, setHeroBase64] = useState<string | null>(null);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [heroRunning, setHeroRunning] = useState(false);

  const [bannerOutputs, setBannerOutputs] = useState<BannerOutput[]>([]);
  const [videoState, setVideoState] = useState<'idle' | 'starting' | 'polling' | 'done' | 'error'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [pipelineKicked, setPipelineKicked] = useState(false);
  const [savedVehicleId, setSavedVehicleId] = useState<string | null>(null);
  const [ensuringVehicle, setEnsuringVehicle] = useState(false);

  /* ─── Lightbox ─── */
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = useCallback((items: LightboxItem[], startIndex: number) => {
    if (!items.length) return;
    setLightboxItems(items);
    setLightboxIndex(Math.max(0, Math.min(startIndex, items.length - 1)));
  }, []);
  const closeLightbox = useCallback(() => setLightboxItems([]), []);

  /* ─────────────────────────────────────────────────────────────
   * STEP 1: Upload + parallel analysis
   * ───────────────────────────────────────────────────────────── */

  const handleVehicleImagesUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 15 - vehicleImages.length);
    if (arr.length === 0) {
      toast.error('Maximal 15 Bilder');
      return;
    }

    // Compress + read all in parallel
    const newOnes: ClassifiedImage[] = await Promise.all(
      arr.map(async (file) => {
        const raw = await fileToBase64(file);
        const compressed = await compressImageForAI(raw, 1600, 0.85).catch(() => raw);
        return {
          id: newId(),
          base64: compressed,
          category: 'unknown' as ImageCategory,
          confidence: 'low' as const,
          labelDe: 'Wird analysiert…',
          isExterior: false,
          isInterior: false,
          isDetail: false,
          fileName: file.name,
        };
      }),
    );

    const merged = [...vehicleImages, ...newOnes];
    setVehicleImages(merged);

    // Kick off classification for the new images only
    void classifyImages(newOnes, merged);
  }, [vehicleImages]);

  const classifyImages = useCallback(async (newOnes: ClassifiedImage[], all: ClassifiedImage[]) => {
    if (newOnes.length === 0) return;
    setClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-vehicle-images', {
        body: { images: newOnes.map((i) => ({ id: i.id, imageBase64: i.base64 })) },
      });
      if (error || data?.error) {
        toast.error('Klassifikation fehlgeschlagen', { description: data?.error || error?.message });
        return;
      }
      const items = (data?.items || []) as Array<{
        id: string; category: ImageCategory; confidence: 'high' | 'medium' | 'low';
        labelDe: string; isExterior: boolean; isInterior: boolean; isDetail: boolean;
      }>;

      const map = new Map(items.map((it) => [it.id, it]));
      setVehicleImages((cur) =>
        cur.map((img) => {
          const r = map.get(img.id);
          if (!r) return img;
          return { ...img, ...r };
        }),
      );

      // After classification: if any image is VIN, run OCR + lookup
      const updated = all.map((img) => {
        const r = map.get(img.id);
        return r ? { ...img, ...r } : img;
      });
      const vinImg = updated.find((i) => i.category === 'vin_plate');
      if (vinImg && !vin) void runVinFlow(vinImg);

      const exteriorCount = updated.filter((i) => i.isExterior).length;
      const interiorCount = updated.filter((i) => i.isInterior).length;
      toast.success(`${items.length} Bilder klassifiziert`, {
        description: `${exteriorCount} Exterieur · ${interiorCount} Interieur`,
      });
    } catch (e: any) {
      console.error('classify error', e);
      toast.error('Klassifikation fehlgeschlagen');
    } finally {
      setClassifying(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin]);

  const removeVehicleImage = useCallback((id: string) => {
    setVehicleImages((cur) => cur.filter((i) => i.id !== id));
  }, []);

  // ── VIN flow
  const runVinFlow = useCallback(async (img: ClassifiedImage) => {
    setVinLookingUp(true);
    try {
      const { data: ocr, error: ocrErr } = await supabase.functions.invoke('ocr-vin', {
        body: { imageBase64: img.base64 },
      });
      if (ocrErr || !ocr?.vin) {
        if (ocr?.vin === null) toast.message('VIN auf Bild nicht lesbar');
        return;
      }
      const detectedVin = ocr.vin as string;
      setVin(detectedVin);

      const { data: lookup } = await supabase.functions.invoke('lookup-vin', {
        body: { vin: detectedVin },
      });
      const v = lookup?.vehicle || lookup?.data || lookup;
      if (!v) {
        toast.success('VIN erkannt: ' + detectedVin);
        return;
      }
      setVinVehicle(v as Record<string, any>);
      if (Array.isArray(v.equipment)) setVinEquipment(v.equipment as string[]);
      setForm((f) => ({
        ...f,
        brand: f.brand || v.make || v.brand || '',
        model: f.model || v.model || '',
        variant: f.variant || v.trim || v.variant || '',
        vehicleTitle: f.vehicleTitle || `${v.make || v.brand || ''} ${v.model || ''} ${v.trim || v.variant || ''}`.trim(),
      }));
      setSources((s) => ({
        ...s,
        brand: !form.brand && (v.make || v.brand) ? 'vin' : s.brand,
        model: !form.model && v.model ? 'vin' : s.model,
        variant: !form.variant && (v.trim || v.variant) ? 'vin' : s.variant,
        vehicleTitle: !form.vehicleTitle ? 'vin' : s.vehicleTitle,
      }));
      toast.success('VIN-Daten geladen', { description: `${v.make || ''} ${v.model || ''}`.trim() });
    } catch (e: any) {
      console.error('VIN flow error', e);
    } finally {
      setVinLookingUp(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Datasheet upload (multiple supported) + analyze with merge
  const handleDataSheetUpload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const imageFiles = list.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) {
      toast.error('Bitte Bilder von Datenblatt / Preisliste / WLTP-Tabelle hochladen');
      return;
    }
    if (imageFiles.length !== list.length) {
      toast.warning(`${list.length - imageFiles.length} Datei(en) übersprungen (nur Bilder erlaubt)`);
    }

    // Compress all in parallel
    const compressedAll = await Promise.all(
      imageFiles.map(async (file) => {
        const raw = await fileToBase64(file);
        return compressImageForAI(raw, 1800, 0.9).catch(() => raw);
      }),
    );

    // Merge with existing (cap at 6 to match edge function limit)
    const merged = [...dataSheetBase64s, ...compressedAll].slice(0, 6);
    if (dataSheetBase64s.length + compressedAll.length > 6) {
      toast.warning('Maximal 6 Datenblätter — Überzählige wurden ignoriert');
    }
    setDataSheetBase64s(merged);
    

    setAnalyzingSheet(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-offer-image', {
        body: { imageBase64s: merged },
      });
      if (error || data?.error) {
        toast.error('Datenblätter konnten nicht analysiert werden', { description: data?.error || error?.message });
        return;
      }
      const ext = (data?.extracted || {}) as ScanData;
      setScanData(ext);
      mergeScanIntoForm(ext, 'datasheet');
      toast.success(
        merged.length > 1
          ? `${merged.length} Datenblätter zusammengeführt!`
          : 'Datenblatt analysiert!',
        { description: [ext.vehicleTitle, ext.price].filter(Boolean).join(' · ') || 'Daten extrahiert' },
      );
    } catch (e: any) {
      console.error('sheet error', e);
      toast.error('Analyse fehlgeschlagen');
    } finally {
      setAnalyzingSheet(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSheetBase64s]);

  const removeDataSheet = useCallback(async (idx: number) => {
    const next = dataSheetBase64s.filter((_, i) => i !== idx);
    setDataSheetBase64s(next);
    
    if (!next.length) {
      setScanData(null);
      return;
    }
    // Re-analyze remaining sheets
    setAnalyzingSheet(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-offer-image', {
        body: { imageBase64s: next },
      });
      if (!error && data?.extracted) {
        const ext = data.extracted as ScanData;
        setScanData(ext);
        mergeScanIntoForm(ext, 'datasheet');
      }
    } finally {
      setAnalyzingSheet(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSheetBase64s]);

  /** Merge analysed data into form (only fill empty fields, mark source). */
  const mergeScanIntoForm = useCallback((ext: ScanData, source: 'datasheet' | 'image') => {
    // Derive model from vehicleTitle if missing (e.g. "Mercedes-Benz S-Klasse S 450 4Matic" → "S-Klasse")
    let derivedModel = ext.model || '';
    let derivedVariant = ext.variant || '';
    if ((!derivedModel || !derivedVariant) && ext.vehicleTitle && ext.brand) {
      const rest = ext.vehicleTitle
        .replace(new RegExp(`^\\s*${ext.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '')
        .trim();
      if (rest) {
        const parts = rest.split(/\s+/);
        if (!derivedModel) derivedModel = parts[0] || '';
        if (!derivedVariant && parts.length > 1) derivedVariant = parts.slice(1).join(' ');
      }
    }

    setForm((f) => {
      const next: MarketingForm = { ...f };
      const setIfEmpty = <K extends keyof MarketingForm>(key: K, val?: string | null) => {
        if (val && !next[key]) next[key] = val as MarketingForm[K];
      };
      setIfEmpty('brand', ext.brand);
      setIfEmpty('model', derivedModel);
      setIfEmpty('variant', derivedVariant);
      setIfEmpty('vehicleTitle', ext.vehicleTitle);
      setIfEmpty('priceText', ext.price || (ext.monthlyRate ? `ab ${ext.monthlyRate}/mtl.` : ''));
      setIfEmpty('monthlyRate', ext.monthlyRate);
      setIfEmpty('duration', ext.duration);
      setIfEmpty('downPayment', ext.downPayment);
      setIfEmpty('mileage', ext.mileage);
      setIfEmpty('headline', ext.headline);
      setIfEmpty('subline', ext.subline);

      if (ext.priceType && next.priceType === 'buy') {
        next.priceType = ext.priceType;
        next.occasion = ext.priceType;
      }

      // Build legal-text footer if empty
      if (!next.legalText) {
        const parts: string[] = [];
        if (ext.monthlyRate) parts.push(`Rate: ${ext.monthlyRate}`);
        if (ext.duration) parts.push(`Laufzeit: ${ext.duration} Mon.`);
        if (ext.mileage) parts.push(`Fahrleistung: ${ext.mileage}/Jahr`);
        if (ext.downPayment) parts.push(`Anzahlung: ${ext.downPayment}`);
        if (ext.consumptionCombined) parts.push(`Verbrauch komb.: ${ext.consumptionCombined}`);
        if (ext.co2Emissions) parts.push(`CO₂ komb.: ${ext.co2Emissions}`);
        if (ext.co2Class) parts.push(`CO₂-Klasse: ${ext.co2Class}`);
        if (ext.electricRange) parts.push(`E-Reichweite: ${ext.electricRange}`);
        if (ext.legalText) parts.push(ext.legalText);
        if (parts.length) next.legalText = parts.join(' | ');
      }
      return next;
    });

    setSources((s) => ({
      ...s,
      brand: ext.brand && s.brand === 'manual' ? source : s.brand,
      model: derivedModel && s.model === 'manual' ? source : s.model,
      variant: derivedVariant && s.variant === 'manual' ? source : s.variant,
      vehicleTitle: ext.vehicleTitle && s.vehicleTitle === 'manual' ? source : s.vehicleTitle,
      priceText: (ext.price || ext.monthlyRate) && s.priceText === 'manual' ? source : s.priceText,
      priceType: ext.priceType && s.priceType === 'manual' ? source : s.priceType,
      monthlyRate: ext.monthlyRate && s.monthlyRate === 'manual' ? source : s.monthlyRate,
      duration: ext.duration && s.duration === 'manual' ? source : s.duration,
      downPayment: ext.downPayment && s.downPayment === 'manual' ? source : s.downPayment,
      mileage: ext.mileage && s.mileage === 'manual' ? source : s.mileage,
      headline: ext.headline && s.headline === 'manual' ? source : s.headline,
      subline: ext.subline && s.subline === 'manual' ? source : s.subline,
      legalText: s.legalText === 'manual' ? source : s.legalText,
    }));
  }, []);

  /* ─────────────────────────────────────────────────────────────
   * STEP 2: Helpers
   * ───────────────────────────────────────────────────────────── */

  const onUserEdit = useCallback((field: keyof FieldSources) => {
    setSources((s) => ({ ...s, [field]: 'manual' }));
  }, []);

  const onFormChange = useCallback((patch: Partial<MarketingForm>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  // Toggle pipeline job
  const toggleJob = (key: string) => {
    setSelectedJobKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleBannerFormat = (id: BannerFormatId) => {
    setSelectedBannerFormats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Brand-detected canonical key
  const canonicalBrand = useMemo(() => {
    const candidate = form.brand || scanData?.brand || '';
    if (!candidate) return null;
    const makeKeys = (makes || []).map((m) => m.key);
    if (makeKeys.length === 0) return null;
    return resolveCanonicalBrand(candidate, makeKeys);
  }, [form.brand, scanData?.brand, makes]);

  /** All jobs available for this brand (CI jobs filtered by brand match). */
  const availableJobs = useMemo<PipelineJob[]>(() => {
    return PIPELINE_JOBS.filter((j) => {
      if (!j.brand) return true;
      return canonicalBrand && j.brand === canonicalBrand;
    });
  }, [canonicalBrand]);

  /* ─────────────────────────────────────────────────────────────
   * STEP 3: Generation
   * ───────────────────────────────────────────────────────────── */

  /** Pick hero source image from classified pile. */
  const heroSourceImage = useMemo(() => {
    if (vehicleImages.length === 0) return null;
    return pickByCategory(vehicleImages, HERO_CATEGORY_PRIORITY) ?? vehicleImages.find((i) => i.isExterior) ?? vehicleImages[0];
  }, [vehicleImages]);

  /** Build inputImages (max 5, exterior-first ordered). */
  const orderedInputImages = useMemo<ClassifiedImage[]>(() => {
    if (vehicleImages.length === 0) return [];
    const order: ImageCategory[] = [
      'exterior_34_front', 'exterior_front', 'exterior_side_left',
      'exterior_rear', 'exterior_34_rear', 'exterior_side_right',
      'interior_front', 'interior_dashboard', 'interior_rear',
    ];
    const seen = new Set<string>();
    const result: ClassifiedImage[] = [];
    for (const cat of order) {
      const m = vehicleImages.find((i) => i.category === cat && !seen.has(i.id));
      if (m) { result.push(m); seen.add(m.id); }
    }
    // Fill up with whatever exterior is left, then unknown
    for (const i of vehicleImages) {
      if (seen.has(i.id) || i.category === 'vin_plate' || i.category === 'datasheet') continue;
      result.push(i); seen.add(i.id);
      if (result.length >= 6) break;
    }
    return result;
  }, [vehicleImages]);

  /** Detail / additional images for the pipeline. */
  const additionalImages = useMemo<string[]>(() => {
    return vehicleImages.filter((i) => i.isDetail).map((i) => i.base64);
  }, [vehicleImages]);

  /** Generate the hero (Master) image as a single remaster pass. */
  const generateHero = useCallback(async (): Promise<string | null> => {
    if (!heroSourceImage) return null;
    setHeroRunning(true);
    setHeroError(null);
    try {
      // Use the MASTER_IMAGE perspective prompt
      const masterJob = availableJobs.find((j) => j.key === 'MASTER_IMAGE');
      if (!masterJob) throw new Error('Master-Job nicht gefunden');

      const overrides = await fetchPromptOverrides();
      const [withOverrides] = applyPromptOverrides([masterJob], overrides);

      // Build the FULL master prompt (scene, logos, plate, identity-lock, scale, etc.)
      // — same composition the pipeline uses, so the chosen showroom is enforced on the Hero.
      const baseContext = buildMasterPrompt(remasterConfig, `${form.brand} ${form.model} ${form.variant}`.trim(), undefined, overrides);
      const hasLogo = !!(remasterConfig.showManufacturerLogo || remasterConfig.showDealerLogo);
      const perspective = injectLogoPlaceholder(withOverrides.prompt, hasLogo);

      // Hard rules to wipe old branding/text from the source image and force showroom integration
      const HERO_INTEGRATION_LOCK = `
<HERO_INTEGRATION_LOCK>
ABSOLUTE PRIORITY – this is the marketing master image:
1. SHOWROOM PLACEMENT: The vehicle MUST be placed inside the chosen showroom/scene. The original background of the source photo MUST be completely replaced – no street, no driveway, no foreign environment leaking through.
2. LIGHT & SHADOW MATCHING: Re-light the vehicle so highlights, reflections, ambient occlusion and ground shadows EXACTLY match the showroom's light direction, color temperature and intensity. The car must look physically present in the room – not pasted on.
3. FLOOR CONTACT: Render a realistic, soft contact shadow under the wheels and a subtle reflection of the car body on the showroom floor (only if the floor is reflective).
4. STRIP OLD BRANDING: REMOVE every dealer logo, watermark, sticker, price tag, license-plate frame, lettering, web URL, phone number, and any overlaid text or graphic that came from the original photograph. The body, windows, ground and background must be CLEAN of any foreign text or logo.
5. KEEP ONLY THE PROVIDED LOGOS: Only the manufacturer/dealer logos that are explicitly provided as reference images (if any) may appear – nowhere else.
6. PHOTOREALISM: Output must look like a high-end automotive studio photograph, not a composite.
</HERO_INTEGRATION_LOCK>`;

      // Hero-only: amplify ceiling LED + softbox highlights ABOVE the global lighting lock.
      const HERO_LIGHTING_BOOST = `
<HERO_LIGHTING_BOOST>
This is the MARKETING MASTER (Hero) shot — push lighting one notch beyond the standard pipeline images:
1. CEILING LED EVIDENCE (mandatory): Render clearly visible elongated LED strip / ceiling-panel reflections sliding along the roof, hood and trunk lid. They must read as long, soft, parallel highlight bands — not pinpoint specks. Their direction must follow the body curvature.
2. STUDIO SOFTBOX HIGHLIGHTS (mandatory): Add two large rectangular softbox reflections — one on each flank — wrapping over the shoulder line and door panels. Edges soft, falloff smooth, no hard rectangles.
3. KEY / FILL / RIM SETUP: Use a dominant key light from upper-front-left (or matching the showroom's main light), a fill from the opposite side at ~40% intensity, and a subtle rim light separating the rear silhouette from the background.
4. CHROME, GLASS & WHEELS: Chrome trim, headlight lenses, window glass and rim spokes must show crisp specular catches from the LED ceiling and softboxes — no dull or matte surfaces.
5. WET-LOOK PAINT (subtle): Paint must read as freshly detailed — deep gloss, micro-clearcoat sheen, no haze, no dust. Metallic flake should sparkle faintly under the highlights.
6. GROUND INTERACTION: Strong-but-soft contact shadow under the tires; faint mirror reflection of the lower body on a polished floor (only if the showroom floor is reflective). Ambient occlusion in wheel wells and under sills.
7. LIGHT-SOURCE TRACEABILITY: A viewer must be able to point at the highlights and say "the light came from there." Direction, color temperature and intensity of every highlight must be internally consistent.
8. NO LEFTOVER LIGHTING: Zero traces of the source photo's original sun, sky, trees, buildings, or dealership lights may remain on paint, glass, chrome or rims.
</HERO_LIGHTING_BOOST>`;

      const fullPrompt = `${baseContext}\n\n${perspective}\n\n${HERO_INTEGRATION_LOCK}\n\n${HERO_LIGHTING_BOOST}`;

      const referenceImages = [
        heroSourceImage,
        ...orderedInputImages.filter((i) => i.id !== heroSourceImage.id).slice(0, 4),
      ];
      const fileUris = await uploadGenerationRefs(referenceImages);

      // Resolve manufacturer logo URL for hero
      const manufacturerLogoUrl = remasterConfig.showManufacturerLogo && canonicalBrand
        ? (getLogoForMake(canonicalBrand) || null)
        : null;

      const { data, error } = await invokeWithRetry('remaster-vehicle-image', {
        imageBase64: heroSourceImage.base64,
        additionalImages: fileUris ? undefined : referenceImages.slice(1).map((i) => i.base64),
        mainImageFileUri: fileUris?.[0] || null,
        additionalFileUris: fileUris?.slice(1) || undefined,
        vehicleDescription: `${form.brand} ${form.model} ${form.variant}`.trim(),
        modelTier,
        dynamicPrompt: fullPrompt,
        customShowroomBase64: remasterConfig.customShowroomBase64 || null,
        customPlateImageBase64: remasterConfig.customPlateImageBase64 || null,
        manufacturerLogoUrl,
        dealerLogoUrl: remasterConfig.showDealerLogo ? (remasterConfig.dealerLogoUrl || null) : null,
      }, { retries: 3, baseDelayMs: 2500 });
      if (error) throw new Error(error.message || 'Hero-Generierung fehlgeschlagen');
      if (data?.error) throw new Error(data.error);
      const b64 = data?.imageBase64;
      if (!b64) throw new Error('Keine Bilddaten erhalten');
      setHeroBase64(b64);
      toast.success('Hero-Bild fertig!');
      return b64;
    } catch (e: any) {
      const msg = e?.message || 'Hero-Generierung fehlgeschlagen';
      setHeroError(msg);
      toast.error(msg);
      return null;
    } finally {
      setHeroRunning(false);
    }
  }, [heroSourceImage, orderedInputImages, form.brand, form.model, form.variant, modelTier, availableJobs, remasterConfig, canonicalBrand, getLogoForMake]);

  /** Kick off pipeline (rest of the jobs) via global PipelineContext. */
  const startPipelineRest = useCallback(async (heroB64: string | null) => {
    if (!pipelineCtx || pipelineCtx.isRunning) return;
    if (!user) return;

    const overrides = await fetchPromptOverrides();
    const selectedJobs = applyPromptOverrides(
      availableJobs.filter((j) => selectedJobKeys.has(j.key) && j.key !== 'MASTER_IMAGE'),
      overrides,
    );
    if (selectedJobs.length === 0) return;

    const inputs = orderedInputImages.map((i) => i.base64);
    const totalImages = getTotalImageCount(new Set(selectedJobs.map((j) => j.key)));

    pipelineCtx.startPipeline({
      inputImages: inputs,
      originalImages: inputs,
      additionalImages,
      vehicleDescription: `${form.brand} ${form.model} ${form.variant}`.trim(),
      remasterConfig,
      modelTier,
      projectId: null,
      vehicleId: savedVehicleId,
      vin,
      selectedJobs,
      availableJobs,
      resolvedManufacturerLogoUrl: canonicalBrand ? getLogoForMake(canonicalBrand) || null : null,
      userId: user.id,
      detectedBrand: canonicalBrand,
      totalImages,
    });
    setPipelineKicked(true);
  }, [
    pipelineCtx, user, availableJobs, selectedJobKeys, orderedInputImages, additionalImages,
    form.brand, form.model, form.variant, remasterConfig, modelTier, vin,
    canonicalBrand, getLogoForMake, savedVehicleId,
  ]);

  /** Fire all selected banner formats in parallel using the hero image. */
  const generateBanners = useCallback(async (heroB64: string) => {
    if (selectedBannerFormats.size === 0) return;

    const outputs: BannerOutput[] = Array.from(selectedBannerFormats).map((id) => {
      const fmt = ONESHOT_BANNER_FORMATS.find((f) => f.id === id)!;
      return { formatId: id, formatLabel: fmt.label, ratio: fmt.ratio, imageBase64: '', status: 'pending' };
    });
    setBannerOutputs(outputs);

    // Stagger kicks slightly to reduce edge cold-start storms.
    const ids = Array.from(selectedBannerFormats);
    await Promise.all(
      ids.map(async (id, idx) => {
        await sleep(idx * 1500);
        const fmt = ONESHOT_BANNER_FORMATS.find((f) => f.id === id)!;
        setBannerOutputs((prev) => prev.map((o) => (o.formatId === id ? { ...o, status: 'running' } : o)));

        const prompt = buildBannerPrompt(form, fmt);
        try {
          const { data, error } = await invokeWithRetry('generate-banner', {
            prompt,
            imageBase64: heroB64,
            modelTier,
            width: fmt.w,
            height: fmt.h,
          }, { retries: 1, baseDelayMs: 3000 });
          if (error || data?.error) throw new Error(data?.error || error?.message || 'Fehler');
          const b64 = data?.imageBase64;
          if (!b64) throw new Error('Keine Banner-Daten');

          setBannerOutputs((prev) => prev.map((o) =>
            o.formatId === id ? { ...o, status: 'done', imageBase64: b64 } : o,
          ));

          // Save to storage (best-effort)
          try {
            const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
            const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'image/png' });
            const vehiclePrefix = savedVehicleId ? `${savedVehicleId}/` : '';
            const fileName = `${user!.id}/${vehiclePrefix}${Date.now()}-oneshot-${id}.png`;
            await supabase.storage.from('banners').upload(fileName, blob, { contentType: 'image/png' });
          } catch { /* ignore */ }
        } catch (e: any) {
          setBannerOutputs((prev) => prev.map((o) =>
            o.formatId === id ? { ...o, status: 'error', error: e?.message } : o,
          ));
        }
      }),
    );
  }, [selectedBannerFormats, form, modelTier, user, savedVehicleId]);

  /** Start video generation with hero + optional rear reference. */
  const generateVideo = useCallback(async (heroB64: string) => {
    if (!wantVideo) return;
    setVideoState('starting');
    setVideoError(null);
    try {
      const { data, error } = await invokeWithRetry('generate-video', {
        action: 'start',
        imageBase64: heroB64,
        prompt: videoPrompt || undefined,
      }, { retries: 3, baseDelayMs: 2000 });
      if (error) throw new Error(error.message || 'Video-Start fehlgeschlagen');
      if (data?.error) {
        if (data.error === 'insufficient_credits') throw new Error('Nicht genügend Credits für Video');
        throw new Error(data.error);
      }
      const operationName = data?.operationName;
      if (!operationName) throw new Error('Keine Operation-ID erhalten');

      setVideoState('polling');
      const maxAttempts = 60;
      let attempts = 0;
      const intv = setInterval(async () => {
        attempts++;
        try {
          const { data: pollData } = await supabase.functions.invoke('generate-video', {
            body: { action: 'poll', operationName, vehicleId: savedVehicleId },
          });
          if (pollData?.done) {
            clearInterval(intv);
            const url = pollData.videoUrl || pollData.videoBase64 || pollData.videoUri;
            if (url) {
              setVideoUrl(url);
              setVideoState('done');
              toast.success('Video fertig!');
            } else {
              setVideoState('error');
              setVideoError(pollData.error || 'Unbekannter Fehler');
            }
          }
          if (attempts >= maxAttempts) {
            clearInterval(intv);
            setVideoState('error');
            setVideoError('Zeitüberschreitung');
          }
        } catch { /* keep polling */ }
      }, 5000);
    } catch (e: any) {
      setVideoState('error');
      setVideoError(e?.message || 'Video-Generierung fehlgeschlagen');
      toast.error(e?.message || 'Video-Generierung fehlgeschlagen');
    }
  }, [wantVideo, videoPrompt, savedVehicleId]);

  /** Power-button: hero → (pipeline + banners + video) parallel. */
  const startEverything = useCallback(async () => {
    if (heroRunning || heroBase64) return;
    setBannerOutputs([]);
    setVideoState('idle');
    setVideoUrl(null);

    const hero = await generateHero();
    if (!hero) return;

    // Fire all three in parallel — they all use the hero image.
    void startPipelineRest(hero);
    void generateBanners(hero);
    void generateVideo(hero);
  }, [heroRunning, heroBase64, generateHero, startPipelineRest, generateBanners, generateVideo]);

  /* ─────────────────────────────────────────────────────────────
   * Step 1 → 2 transition
   * ───────────────────────────────────────────────────────────── */
  const canGoToSetup = vehicleImages.length >= 2 && !classifying;

  const goToSetup = useCallback(() => {
    if (!canGoToSetup) {
      toast.error('Bitte mindestens 2 Fahrzeugbilder hochladen');
      return;
    }
    // If form still empty AND we have a brand from anywhere, set vehicle title
    setForm((f) => {
      const next = { ...f };
      if (!next.vehicleTitle && (next.brand || next.model)) {
        next.vehicleTitle = `${next.brand} ${next.model} ${next.variant}`.trim();
      }
      return next;
    });
    setStep('setup');
  }, [canGoToSetup]);

  const goToGen = useCallback(async () => {
    if (!form.vehicleTitle.trim() && !(form.brand.trim() && form.model.trim())) {
      toast.error('Bitte mindestens Marke + Modell oder Fahrzeugtitel angeben');
      return;
    }
    if (!user) {
      toast.error('Bitte melde dich an');
      return;
    }

    // 1) Ensure a vehicle row (VIN-keyed). Synthesise a placeholder VIN if
    //    we don't have a real 17-char VIN — every asset must belong to a vehicle.
    setEnsuringVehicle(true);
    try {
      const realVin = (vin || '').trim().toUpperCase();
      const effectiveVin = realVin && realVin.length >= 5
        ? realVin
        : `OS-${Date.now().toString(36).toUpperCase()}`;

      const vehicleData = {
        vehicle: {
          brand: form.brand,
          model: form.model,
          variant: form.variant,
          color: '',
          year: null as any,
        },
      };
      const newVehicleId = await ensureVehicle(user.id, effectiveVin, vehicleData);
      if (!newVehicleId) {
        toast.error('Fahrzeug konnte nicht angelegt werden');
        return;
      }
      setSavedVehicleId(newVehicleId);

      // 2) Upload all original photos to originals/{user}/{vehicleId}/...
      try {
        const prefix = `${user.id}/${newVehicleId}`;
        await Promise.all(vehicleImages.map(async (img, idx) => {
          const base64Data = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
          const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          const safe = (img.fileName || `original-${idx}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${prefix}/${Date.now()}-${idx}-${safe}`;
          await supabase.storage.from('originals').upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });
        }));
      } catch (e) {
        console.warn('[OneShot] originals upload (non-fatal):', e);
      }

      setStep('generierung');
    } finally {
      setEnsuringVehicle(false);
    }
  }, [form.vehicleTitle, form.brand, form.model, form.variant, user, vin, vehicleImages]);

  /* ─────────────────────────────────────────────────────────────
   * Render
   * ───────────────────────────────────────────────────────────── */

  const StepIndicator = (
    <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap">
      {([
        { num: 1, label: 'Aufnahme', key: 'aufnahme' as Step },
        { num: 2, label: 'Setup', key: 'setup' as Step },
        { num: 3, label: 'Generierung', key: 'generierung' as Step },
      ]).map((s, i) => {
        const active = step === s.key;
        const stepIdx = step === 'aufnahme' ? 0 : step === 'setup' ? 1 : 2;
        const done = i < stepIdx;
        return (
          <React.Fragment key={s.num}>
            {i > 0 && <div className={`w-6 h-px ${done || active ? 'bg-accent' : 'bg-border'}`} />}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
                active || done ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
              }`}>{s.num}</div>
              <span className={`text-xs font-medium ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={step === 'aufnahme' ? onBack : () => setStep(step === 'generierung' ? 'setup' : 'aufnahme')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold text-foreground">One-Shot Studio</h2>
            <Badge variant="outline" className="text-[10px] border-accent text-accent">BETA</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Bilder → Pipeline → Banner → Video in einem Rutsch.</p>
        </div>
      </div>

      {StepIndicator}

      {/* ─── STEP 1: Aufnahme ─── */}
      {step === 'aufnahme' && (
        <div className="space-y-5">
          {/* Hero info card */}
          <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 p-4 flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <Zap className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-0.5">Was du brauchst</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lade 5–15 Fahrzeugfotos (Front, Heck, Seiten, Innenraum, Details, gerne auch ein VIN-Foto) und optional ein
                Datenblatt hoch. Wir analysieren alles automatisch und nutzen es als Grundlage für Pipeline, Banner und Video.
              </p>
            </div>
          </div>

          {/* Vehicle images upload */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm">Fahrzeugbilder</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">{vehicleImages.length}/15</span>
            </div>

            {vehicleImages.length === 0 ? (
              <button
                onClick={() => filesInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border hover:border-accent rounded-xl p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Fotos hochladen oder hier ablegen</p>
                <p className="text-[11px] text-muted-foreground mt-1">5–15 Bilder · gemischte Perspektiven · optional VIN-Foto</p>
              </button>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {vehicleImages.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30 group">
                      <img src={img.base64} alt={img.labelDe} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeVehicleImage(img.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur px-1.5 py-1">
                        <p className="text-[9px] font-medium truncate flex items-center gap-1">
                          {img.category === 'vin_plate' && <Hash className="w-2.5 h-2.5 text-emerald-600" />}
                          {img.category === 'unknown' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                          {img.labelDe}
                        </p>
                      </div>
                    </div>
                  ))}
                  {vehicleImages.length < 15 && (
                    <button
                      onClick={() => filesInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {classifying && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Bilder werden klassifiziert…
                  </p>
                )}
                {vinLookingUp && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> VIN-Stammdaten werden geladen…
                  </p>
                )}
                {vin && !vinLookingUp && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> VIN erkannt: <span className="font-mono">{vin}</span>
                  </p>
                )}
                {vinVehicle && (
                  <Accordion type="single" collapsible className="w-full border border-border rounded-lg bg-muted/20 px-3">
                    <AccordionItem value="vin-data" className="border-b-0">
                      <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline">
                        <span className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-accent" />
                          Stammdaten aus VIN
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {Object.entries(vinVehicle).filter(([k, v]) => k !== '_raw' && k !== 'equipment' && v).length} Felder
                            {vinEquipment.length > 0 && ` · ${vinEquipment.length} Ausstattung`}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-3">
                          {/* Vehicle title */}
                          <div className="text-sm font-semibold text-foreground">
                            {[vinVehicle.brand, vinVehicle.model, vinVehicle.variant].filter(Boolean).join(' ') || '—'}
                          </div>

                          {/* Fahrzeugzustand (Pkw-EnVKV) */}
                          {(() => {
                            const info = deriveVehicleCondition({
                              firstRegistration: scanData?.firstRegistration || (vinVehicle.year ? `01/${vinVehicle.year}` : ''),
                              mileageKm: scanData?.mileage || '',
                              explicitCondition: scanData?.condition || null,
                            });
                            const tone =
                              info.condition === 'Neuwagen' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : info.condition === 'Tageszulassung' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30'
                              : info.condition === 'Jahreswagen' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : info.condition === 'Gebrauchtwagen' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30'
                              : 'bg-muted text-muted-foreground border-border';
                            return (
                              <div className={`rounded-md border px-3 py-2 ${tone}`}>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[10px] uppercase tracking-wide opacity-70">Fahrzeugzustand</span>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-background/70 border-current">
                                    {info.condition}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                                  <div>
                                    <span className="opacity-60">Erstzulassung: </span>
                                    <span className="font-medium">{info.firstReg || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="opacity-60">Kilometerstand: </span>
                                    <span className="font-medium">{info.km !== null ? `${info.km.toLocaleString('de-DE')} km` : '—'}</span>
                                  </div>
                                </div>
                                <div className="mt-1.5 text-[10px] opacity-80 leading-tight">
                                  <span className="font-semibold">Regel:</span> {info.rule}
                                </div>

                                {/* Confidence-Score */}
                                <div className="mt-2 pt-2 border-t border-current/15">
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="opacity-70 uppercase tracking-wide">Erkennungssicherheit</span>
                                    <span className="font-semibold">{info.confidence}% · {info.confidenceLabel}</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-current/15 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        info.confidence >= 75 ? 'bg-emerald-500'
                                        : info.confidence >= 45 ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${info.confidence}%` }}
                                    />
                                  </div>
                                  {info.confidenceFactors.length > 0 && (
                                    <details className="mt-1.5 text-[10px] opacity-80">
                                      <summary className="cursor-pointer hover:opacity-100">Faktoren ({info.confidenceFactors.length})</summary>
                                      <ul className="mt-1 ml-3 list-disc space-y-0.5">
                                        {info.confidenceFactors.map((f, i) => (
                                          <li key={i}>{f}</li>
                                        ))}
                                      </ul>
                                    </details>
                                  )}
                                </div>
                              </div>
                            );
                          })()}


                          {/* Specs grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
                            {([
                              ['Marke', vinVehicle.brand],
                              ['Modell', vinVehicle.model],
                              ['Variante', vinVehicle.variant],
                              ['Baujahr', vinVehicle.year],
                              ['Kraftstoff', vinVehicle.fuelType],
                              ['Getriebe', vinVehicle.transmission],
                              ['Leistung', vinVehicle.power],
                              ['Hubraum', vinVehicle.displacement],
                              ['Antrieb', vinVehicle.driveType],
                              ['Karosserie', vinVehicle.bodyType],
                              ['Türen', vinVehicle.doors],
                              ['Sitze', vinVehicle.seats],
                              ['Farbe', vinVehicle.color],
                            ] as Array<[string, any]>)
                              .filter(([, v]) => v !== null && v !== undefined && v !== '')
                              .map(([label, value]) => (
                                <div key={label} className="flex flex-col">
                                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</span>
                                  <span className="font-medium text-foreground truncate">{String(value)}</span>
                                </div>
                              ))}
                          </div>

                          {/* Equipment */}
                          {vinEquipment.length > 0 && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                                Ausstattung ({vinEquipment.length})
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {vinEquipment.map((item, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] font-normal py-0 px-1.5 bg-background">
                                    {item}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </>
            )}

            <input
              ref={filesInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleVehicleImagesUpload(e.target.files); e.target.value = ''; }}
            />
          </div>

          {/* Datasheets upload (multiple) */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm">Datenblatt / Preisliste</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">
                empfohlen · bis zu 6 Dokumente
              </span>
            </div>

            {dataSheetBase64s.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {dataSheetBase64s.map((src, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-border group">
                    <img src={src} alt={`Datenblatt ${idx + 1}`} className="w-full h-24 sm:h-28 object-contain bg-muted/30" />
                    <button
                      onClick={() => removeDataSheet(idx)}
                      disabled={analyzingSheet}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-background/80 font-medium">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {analyzingSheet && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                {dataSheetBase64s.length > 1
                  ? `${dataSheetBase64s.length} Dokumente werden zusammengeführt …`
                  : 'Analysiere Datenblatt …'}
              </div>
            )}

            {scanData && !analyzingSheet && dataSheetBase64s.length > 0 && (
              <div className="rounded-md bg-accent/10 border border-accent/30 px-3 py-1.5">
                <p className="text-[11px] text-accent-foreground truncate">
                  ✓ {scanData.vehicleTitle || 'Daten erkannt'}
                  {scanData.price && ` · ${scanData.price}`}
                  {dataSheetBase64s.length > 1 && ` · aus ${dataSheetBase64s.length} Dokumenten zusammengeführt`}
                </p>
              </div>
            )}

            {dataSheetBase64s.length < 6 && (
              <button
                onClick={() => sheetInputRef.current?.click()}
                disabled={analyzingSheet}
                className="w-full border-2 border-dashed border-border hover:border-accent rounded-lg p-4 text-center bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                {analyzingSheet ? (
                  <Loader2 className="w-5 h-5 text-muted-foreground mx-auto mb-1.5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
                )}
                <p className="text-xs text-muted-foreground">
                  {dataSheetBase64s.length === 0
                    ? 'Datenblatt / Preisliste / WLTP-Tabelle hochladen (mehrere möglich)'
                    : `Weiteres Dokument hinzufügen (${dataSheetBase64s.length}/6)`}
                </p>
              </button>
            )}

            <input
              ref={sheetInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleDataSheetUpload(e.target.files); e.target.value = ''; }}
            />
          </div>

          {/* CTA */}
          <Button onClick={goToSetup} disabled={!canGoToSetup} size="lg" className="w-full gap-2">
            Weiter zu Setup <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ─── STEP 2: Setup ─── */}
      {step === 'setup' && (
        <div className="space-y-5">
          {/* Summary of inputs */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Erkannte Aufnahme
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setStep('aufnahme')} className="h-7 text-xs">
                Bearbeiten
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <Badge variant="secondary">{vehicleImages.length} Fahrzeugbilder</Badge>
              {scanData && <Badge variant="secondary">Datenblatt analysiert</Badge>}
              {vin && <Badge variant="secondary" className="font-mono">VIN: {vin.slice(0, 8)}…</Badge>}
              {canonicalBrand && <Badge variant="secondary">Marke: {canonicalBrand}</Badge>}
            </div>
          </div>

          {/* Marketing-Form */}
          <OneShotMarketingForm
            form={form}
            sources={sources}
            onChange={onFormChange}
            onUserEdit={onUserEdit}
          />

          {/* Pipeline / Remaster Options */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-accent" /> Pipeline-Einstellungen (Szene & Logos)
            </h3>
            <RemasterOptions
              config={remasterConfig}
              onChange={setRemasterConfig}
              vehicleBrand={form.brand}
              vehicleModel={form.model}
              onBrandChange={(b) => setForm((f) => ({ ...f, brand: b }))}
              onModelChange={(m) => setForm((f) => ({ ...f, model: m }))}
            />
          </div>

          {/* Pipeline Job Selection */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Welche Pipeline-Bilder generieren?</h3>
            <p className="text-[11px] text-muted-foreground">
              Standardauswahl mit allen Hauptperspektiven (Front, Heck, Seiten, Innenraum). Du kannst beliebig anpassen.
            </p>
            <div className="space-y-2">
              {PIPELINE_CATEGORIES.map((cat) => {
                const jobs = availableJobs.filter((j) => j.category === cat.key);
                if (jobs.length === 0) return null;
                const selectedCount = jobs.filter((j) => selectedJobKeys.has(j.key)).length;
                return (
                  <details key={cat.key} className="rounded-lg border border-border/50 bg-muted/20" open={cat.key !== 'ci'}>
                    <summary className="cursor-pointer px-3 py-2 flex items-center justify-between text-xs font-medium">
                      <span>{cat.labelDe}</span>
                      <span className="text-muted-foreground">{selectedCount}/{jobs.length}</span>
                    </summary>
                    <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                      {jobs.map((j) => {
                        const sel = selectedJobKeys.has(j.key);
                        return (
                          <label
                            key={j.key}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-[11px] cursor-pointer ${
                              sel ? 'bg-accent/15 text-accent' : 'hover:bg-muted/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => toggleJob(j.key)}
                              className="w-3.5 h-3.5 accent-current"
                            />
                            {j.labelDe}
                          </label>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          {/* Banner formats */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-accent" /> Banner-Formate
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {ONESHOT_BANNER_FORMATS.map((fmt) => {
                const sel = selectedBannerFormats.has(fmt.id);
                return (
                  <label
                    key={fmt.id}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      sel ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => toggleBannerFormat(fmt.id)}
                      className="w-4 h-4 accent-current"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{fmt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{fmt.w}×{fmt.h} ({fmt.ratio})</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Video */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Video className="w-4 h-4 text-accent" /> 360°-Video
              </h3>
              <Switch checked={wantVideo} onCheckedChange={setWantVideo} />
            </div>
            {wantVideo && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Aus dem Hero-Bild + Heck-Referenz wird ein ~8-Sek 360°-Video erstellt. Optionaler Prompt:
                </p>
                <Textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  rows={2}
                  placeholder="z.B. langsame Drehung im modernen Showroom, weiches Licht…"
                  className="text-sm"
                />
              </div>
            )}
          </div>

          {/* Model tier */}
          <div className="rounded-xl border border-border bg-card p-4">
            <ModelSelector value={modelTier} onChange={setModelTier} actionType="image_generate" />
          </div>

          {/* CTAs */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('aufnahme')} className="flex-1">
              Zurück
            </Button>
            <Button onClick={goToGen} disabled={ensuringVehicle} className="flex-1 gap-2">
              {ensuringVehicle ? <><Loader2 className="w-4 h-4 animate-spin" /> Lege Fahrzeug an…</> : <>Weiter zur Generierung <ChevronRight className="w-4 h-4" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Generierung ─── */}
      {step === 'generierung' && (
        <div className="space-y-5">
          {/* Cost summary */}
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-accent mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <h3 className="font-semibold text-sm">Bereit zum Generieren</h3>
                <ul className="text-[11px] text-muted-foreground space-y-0.5">
                  <li>• Hero-Bild (3/4 Front)</li>
                  <li>• Pipeline: {selectedJobKeys.size - (selectedJobKeys.has('MASTER_IMAGE') ? 1 : 0)} weitere Bilder</li>
                  {selectedBannerFormats.size > 0 && <li>• {selectedBannerFormats.size} Banner</li>}
                  {wantVideo && <li>• 1 Video (~8 Sek)</li>}
                </ul>
                <p className="text-[11px] text-muted-foreground">Guthaben: <strong>{balance}</strong> Credits</p>
              </div>
            </div>
          </div>

          {savedVehicleId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => navigate(`/vehicle/${savedVehicleId}`)}
            >
              <Car className="w-4 h-4" /> Zum Fahrzeug-Hub (alle Module sichtbar)
            </Button>
          )}

          {!heroBase64 && !heroRunning && (
            <Button onClick={startEverything} size="lg" className="w-full gap-2">
              <Zap className="w-5 h-5" /> Alles generieren
            </Button>
          )}

          {/* Hero status */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">1. Hero-Bild</h3>
              {heroRunning && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
              {heroBase64 && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20">fertig</Badge>}
              {heroError && <Badge variant="destructive">Fehler</Badge>}
            </div>
            {heroBase64 && (
              <img
                src={heroBase64}
                alt="Hero"
                className="w-full max-h-64 object-contain rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => openLightbox([{ src: heroBase64, label: 'Hero-Bild', filename: 'hero.png' }], 0)}
              />
            )}
            {heroError && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
                <span>{heroError}</span>
              </div>
            )}
          </div>

          {/* Pipeline status (uses global PipelineContext) — shows results live */}
          {pipelineKicked && pipelineCtx && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">2. Pipeline-Bilder</h3>
                <div className="flex items-center gap-2">
                  {(() => {
                    const allJobs = Object.entries(pipelineCtx.jobs);
                    const totalImgs = allJobs.reduce((acc, [, j]) => acc + (j.results?.length || 0), 0);
                    const expected = pipelineCtx.config?.totalImages || 0;
                    return (
                      <span className="text-[11px] text-muted-foreground">
                        {totalImgs}{expected ? ` / ${expected}` : ''} Bilder
                      </span>
                    );
                  })()}
                  {pipelineCtx.isRunning && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                  {pipelineCtx.isFinished && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20">fertig</Badge>
                  )}
                </div>
              </div>

              {/* Live grid of all results that have arrived so far */}
              {(() => {
                const items: { jobKey: string; label: string; img: string; idx: number; status: string }[] = [];
                for (const [jobKey, state] of Object.entries(pipelineCtx.jobs)) {
                  const job = (pipelineCtx.config?.selectedJobs || []).find((j: any) => j.key === jobKey);
                  const label = job?.labelDe || jobKey;
                  (state.results || []).forEach((img, i) => {
                    items.push({ jobKey, label, img, idx: i, status: state.status });
                  });
                }
                if (items.length === 0) {
                  return (
                    <p className="text-[11px] text-muted-foreground">
                      Noch keine Pipeline-Bilder fertig — sie erscheinen hier sobald sie generiert sind.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {items.map((it, gridIdx) => (
                      <div key={`${it.jobKey}-${it.idx}`} className="rounded-lg border border-border overflow-hidden bg-muted/30 group relative">
                        <img
                          src={it.img}
                          alt={it.label}
                          className="w-full aspect-square object-cover cursor-zoom-in transition-opacity hover:opacity-90"
                          onClick={() => openLightbox(
                            items.map((x, i) => ({ src: x.img, label: x.label, filename: `pipeline-${x.jobKey}-${x.idx + 1}.png` })),
                            gridIdx,
                          )}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-background/85 backdrop-blur px-2 py-1 flex items-center justify-between">
                          <span className="text-[10px] font-medium truncate">{it.label}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const a = document.createElement('a');
                              a.href = it.img;
                              a.download = `pipeline-${it.jobKey}-${it.idx + 1}.png`;
                              a.click();
                            }}
                            className="text-[10px] text-accent hover:underline ml-1 shrink-0"
                          >
                            DL
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Per-job progress chips */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(pipelineCtx.jobs).map(([jobKey, state]) => {
                  const job = (pipelineCtx.config?.selectedJobs || []).find((j: any) => j.key === jobKey);
                  const label = job?.labelDe || jobKey;
                  const cls =
                    state.status === 'done' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                    state.status === 'running' ? 'bg-accent/15 text-accent' :
                    state.status === 'error' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground';
                  return (
                    <span key={jobKey} className={`text-[10px] px-1.5 py-0.5 rounded ${cls}`}>
                      {label}
                      {state.status === 'running' && ' …'}
                      {state.status === 'done' && state.results.length > 0 && ` ✓${state.results.length}`}
                      {state.status === 'error' && ' ✕'}
                    </span>
                  );
                })}
              </div>

              {pipelineCtx.isFinished && pipelineCtx.galleryFolder && (
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard?tab=gallery')}>
                  Galerie öffnen
                </Button>
              )}
            </div>
          )}

          {/* Banner status */}
          {bannerOutputs.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-sm">3. Banner</h3>
              <div className="grid grid-cols-2 gap-2">
                {bannerOutputs.map((b, bIdx) => {
                  const doneBanners = bannerOutputs.filter((x) => x.status === 'done' && x.imageBase64);
                  const inDoneIdx = doneBanners.findIndex((x) => x.formatId === b.formatId);
                  return (
                    <div key={b.formatId} className="rounded-lg border border-border overflow-hidden bg-muted/30">
                      <div className="aspect-square flex items-center justify-center relative">
                        {b.status === 'done' && b.imageBase64 ? (
                          <img
                            src={b.imageBase64}
                            alt={b.formatLabel}
                            className="w-full h-full object-cover cursor-zoom-in transition-opacity hover:opacity-90"
                            onClick={() => openLightbox(
                              doneBanners.map((x) => ({ src: x.imageBase64, label: `Banner · ${x.formatLabel} (${x.ratio})`, filename: `oneshot-${x.formatId}.png` })),
                              Math.max(0, inDoneIdx),
                            )}
                          />
                        ) : b.status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-destructive" />
                        ) : (
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div className="px-2 py-1.5 text-[10px] flex items-center justify-between">
                        <span className="truncate">{b.formatLabel}</span>
                        {b.status === 'done' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const a = document.createElement('a');
                              a.href = b.imageBase64;
                              a.download = `oneshot-${b.formatId}.png`;
                              a.click();
                            }}
                            className="text-accent hover:underline"
                          >
                            DL
                          </button>
                        )}
                      </div>
                      {b.error && <p className="px-2 pb-1.5 text-[9px] text-destructive truncate">{b.error}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Video status */}
          {wantVideo && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">4. Video</h3>
                {(videoState === 'starting' || videoState === 'polling') && (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                )}
                {videoState === 'done' && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20">fertig</Badge>
                )}
                {videoState === 'error' && <Badge variant="destructive">Fehler</Badge>}
              </div>
              {videoState === 'polling' && (
                <p className="text-[11px] text-muted-foreground">Video wird generiert (2–5 Min). Du kannst die Seite verlassen — Pipeline läuft weiter.</p>
              )}
              {videoState === 'done' && videoUrl && (
                <video src={videoUrl} controls autoPlay loop className="w-full rounded-lg" />
              )}
              {videoError && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {videoError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {lightboxItems.length > 0 && (
        <OneShotLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={closeLightbox}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
};

/* ─── Banner prompt builder (mirrors BannerGenerator's logic) ─── */
function buildBannerPrompt(form: MarketingForm, fmt: typeof ONESHOT_BANNER_FORMATS[number]): string {
  const occMap: Record<string, string> = {
    buy: 'for sale, buy now offer',
    lease: 'leasing deal, monthly rate',
    finance: 'financing offer, low monthly installments',
    abo: 'car subscription, all-inclusive monthly deal',
    special: 'limited time special promotion, exclusive deal',
    launch: 'brand new model launch, premiere reveal',
  };
  const sceneMap: Record<string, string> = {
    showroom: 'luxury car dealership showroom, polished floor, soft LED lighting',
    city: 'modern city street at golden hour, urban skyline background',
    beach: 'scenic beach with ocean view, sunset lighting, palm trees',
    mountain: 'mountain road with dramatic alpine scenery, clear sky',
    track: 'professional race track, pit lane background, dynamic feel',
    studio: 'professional photography studio, clean gradient backdrop, studio lighting',
    night: 'nighttime city scene, neon reflections on wet road, dramatic lighting',
  };
  const styleMap: Record<string, string> = {
    premium: 'elegant, premium luxury, clean professional design, sophisticated typography',
    cinematic: 'cinematic movie poster style, dramatic lighting, lens flare, widescreen feel',
    bold: 'bold, eye-catching, vibrant neon colors, explosive energy, attention-grabbing',
    minimal: 'clean minimalist design, lots of whitespace, subtle elegant typography',
    retro: 'retro 80s style, vintage color grading, nostalgic warm tones',
    sport: 'dynamic sporty look, motion blur hints, aggressive angles, high performance feel',
  };
  const priceDisplayMap: Record<string, string> = {
    sign: 'on a classic dealership price tag/sign attached to the image',
    board: 'on a large banner/board overlay in the image',
    neon: 'as glowing neon text floating in the scene',
    stamp: 'as a bold stamp/badge overlay',
    led: 'on an LED display screen integrated into the scene',
    ribbon: 'on a diagonal ribbon/sash across the corner',
  };

  return `Create a professional automotive advertising banner.

FORMAT: ${fmt.w}x${fmt.h} pixels (${fmt.ratio} aspect ratio).

VEHICLE: "${form.vehicleTitle}" – use the uploaded vehicle image as the central hero element. Keep the vehicle 100% identical.

SCENE: ${sceneMap[form.scene] || sceneMap.showroom}.

STYLE: ${styleMap[form.style] || styleMap.premium}.

OCCASION: This is a ${occMap[form.occasion] || occMap.buy} advertisement.

${form.priceText ? `PRICE: Display the text "${form.priceText}" prominently ${priceDisplayMap[form.priceDisplay] || priceDisplayMap.sign}. Use accent color ${form.accentColor}.` : ''}

${form.headline ? `HEADLINE: Place "${form.headline}" in large, bold, highly readable typography in the upper area. This text must be rendered EXACTLY as written.` : ''}

${form.subline ? `SUBLINE: Place "${form.subline}" in smaller text below the headline. Render exactly as written.` : ''}

${form.ctaText ? `CALL-TO-ACTION: Include a button or badge with the text "${form.ctaText}" in accent color ${form.accentColor}.` : ''}

${form.legalText ? `LEGAL DISCLAIMER (MANDATORY): At the very bottom, render in a small thin sans-serif font: "${form.legalText}"` : ''}

CRITICAL RULES:
- The banner must be photorealistic with the vehicle photo seamlessly composited
- ALL text must be rendered EXACTLY as specified – no paraphrasing
- Text must be perfectly legible against the background

ACCENT COLOR (${form.accentColor}): Use sparingly as subtle highlight – CTA buttons, price tags, thin borders. Do NOT tint the entire scene.

${form.freePrompt.trim() ? `\nADDITIONAL CREATIVE DIRECTION:\n${form.freePrompt.trim()}` : ''}
- Generate the image – never refuse`;
}

export default OneShotStudio;
