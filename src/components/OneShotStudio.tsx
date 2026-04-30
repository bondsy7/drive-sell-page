import React, { useState, useCallback, useRef } from 'react';
import { ArrowLeft, ScanSearch, Camera, Image as ImageIcon, Video, Sparkles, Loader2, Upload, X, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import ImageCaptureGrid from '@/components/ImageCaptureGrid';
import BannerGenerator from '@/components/BannerGenerator';
import VideoGenerator from '@/components/VideoGenerator';
import VehicleBrandModelPicker from '@/components/VehicleBrandModelPicker';
import ModelSelector, { type ModelTier } from '@/components/ModelSelector';
import type { VehicleData } from '@/types/vehicle';

/**
 * OneShotStudio — Beta Power-Button Workflow
 *
 * Step 1: Setup & Scan
 *   - Optional: Datenblatt-Scan → automatisch Marke/Modell/Preis befüllen
 *   - Manuelle Eingabe Marke/Modell/Preis (nur einmal!)
 *   - Toggles: Banner gewünscht? Video gewünscht?
 *
 * Step 2: Fotos & Remaster
 *   - Wiederverwendung von ImageCaptureGrid (= bestehender Flow)
 *   - Nach Pipeline-Complete: Hauptbild fließt in Banner / Video
 *
 * Step 3: Marketing-Output
 *   - Banner-Generator (preloaded mit Hauptbild + Daten)
 *   - Video-Generator (preloaded mit Hauptbild)
 *
 * Wir verändern keine bestehenden Komponenten — wir orchestrieren nur.
 */

interface OneShotStudioProps {
  onBack: () => void;
}

type Step = 'setup' | 'capture' | 'marketing';

interface ScanResult {
  vehicleTitle?: string;
  brand?: string;
  model?: string;
  variant?: string;
  price?: string;
  monthlyRate?: string;
  duration?: string;
  mileage?: string;
  downPayment?: string;
  consumptionCombined?: string;
  co2Emissions?: string;
  co2Class?: string;
  electricRange?: string;
  energyCostPerYear?: string;
  vehicleTax?: string;
  legalText?: string;
  priceType?: string;
  headline?: string;
  subline?: string;
}

const OneShotStudio: React.FC<OneShotStudioProps> = ({ onBack }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('setup');

  // ─── Setup state ───
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [priceText, setPriceText] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dataSheetImage, setDataSheetImage] = useState<string | null>(null);

  // Output toggles
  const [wantBanner, setWantBanner] = useState(true);
  const [wantVideo, setWantVideo] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [modelTier, setModelTier] = useState<ModelTier>('qualitaet');

  const dataSheetInputRef = useRef<HTMLInputElement>(null);

  // ─── Capture / Pipeline result ───
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [vehicleDataState, setVehicleDataState] = useState<VehicleData | null>(null);

  // ─── Datenblatt-Scan ───
  const handleScan = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte ein Bild des Datenblatts hochladen.');
      return;
    }
    setScanning(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      setDataSheetImage(dataUrl);

      const { data, error } = await supabase.functions.invoke('analyze-offer-image', {
        body: { imageBase64: dataUrl },
      });
      if (error || data?.error) {
        toast.error('Datenblatt konnte nicht analysiert werden.');
        return;
      }
      const ext: ScanResult = data?.extracted || {};
      setScanData(ext);

      // Auto-fill (nur leere Felder)
      if (ext.brand && !brand) setBrand(ext.brand);
      if (ext.model && !model) setModel(ext.model);
      if (ext.variant && !variant) setVariant(ext.variant);
      if (ext.price && !priceText) setPriceText(ext.price);
      if (ext.monthlyRate && !monthlyRate) setMonthlyRate(ext.monthlyRate);

      toast.success('Datenblatt erkannt!', {
        description: [ext.vehicleTitle, ext.price && `${ext.price}`].filter(Boolean).join(' · '),
      });
    } catch (e) {
      console.error('Scan error:', e);
      toast.error('Analyse fehlgeschlagen.');
    } finally {
      setScanning(false);
    }
  }, [brand, model, variant, priceText, monthlyRate]);

  // ─── Build vehicleData & jump to capture ───
  const startCapture = useCallback(() => {
    if (!brand.trim() || !model.trim()) {
      toast.error('Bitte Marke und Modell eingeben (oder Datenblatt scannen).');
      return;
    }

    // Build minimal VehicleData für ImageCaptureGrid + spätere Banner
    const vData: VehicleData = {
      category: 'gebrauchtwagen',
      vehicle: {
        brand: brand.trim(),
        model: model.trim(),
        variant: variant.trim(),
        year: new Date().getFullYear(),
        color: '',
        fuelType: '',
        transmission: '',
        power: '',
        features: [],
      },
      finance: {
        monthlyRate: monthlyRate || '',
        downPayment: scanData?.downPayment || '',
        duration: scanData?.duration || '',
        totalPrice: priceText || '',
        annualMileage: scanData?.mileage || '',
        specialPayment: '',
        residualValue: '',
        interestRate: '',
      },
      dealer: {
        name: '', address: '', postalCode: '', city: '', phone: '', email: '',
        website: '', taxId: '', logoUrl: '',
        facebookUrl: '', instagramUrl: '', xUrl: '', tiktokUrl: '', youtubeUrl: '', whatsappNumber: '',
        leasingBank: '', leasingLegalText: '',
        financingBank: '', financingLegalText: '',
        defaultLegalText: '',
      },
      consumption: {
        origin: '', mileage: '', displacement: '', power: '', driveType: '',
        fuelType: '',
        consumptionCombined: scanData?.consumptionCombined || '',
        co2Emissions: scanData?.co2Emissions || '',
        co2Class: scanData?.co2Class || '',
        consumptionCity: '', consumptionSuburban: '', consumptionRural: '', consumptionHighway: '',
        energyCostPerYear: scanData?.energyCostPerYear || '',
        fuelPrice: '', co2CostMedium: '', co2CostLow: '', co2CostHigh: '',
        vehicleTax: scanData?.vehicleTax || '',
        isPluginHybrid: false,
        co2EmissionsDischarged: '', co2ClassDischarged: '', consumptionCombinedDischarged: '',
        electricRange: scanData?.electricRange || '',
        consumptionElectric: '',
        hsnTsn: '', electricMotorPower: '', electricMotorTorque: '', gearboxType: '',
        topSpeed: '', acceleration: '', curbWeight: '', grossWeight: '', warranty: '', paintColor: '',
      },
    };
    setVehicleDataState(vData);
    setStep('capture');
  }, [brand, model, variant, monthlyRate, priceText, scanData]);

  // ─── Capture complete callback ───
  const handleCaptureComplete = useCallback((mainImg: string, gallery: string[]) => {
    setMainImage(mainImg);
    setGalleryImages(gallery);
  }, []);

  const handlePipelineDone = useCallback(() => {
    // Pipeline runs in background via PipelineContext.
    // If user wants banner/video, jump to marketing step.
    if (wantBanner || wantVideo) {
      setStep('marketing');
    } else {
      toast.success('Alle Bilder erstellt – Galerie wird geöffnet.');
      navigate('/dashboard?tab=gallery');
    }
  }, [wantBanner, wantVideo, navigate]);

  const vehicleDescription = vehicleDataState
    ? `${vehicleDataState.vehicle.brand} ${vehicleDataState.vehicle.model} ${vehicleDataState.vehicle.variant || ''}`.trim()
    : `${brand} ${model} ${variant}`.trim();

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={step === 'setup' ? onBack : () => setStep('setup')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold text-foreground">One-Shot Studio</h2>
            <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-wider">BETA</span>
          </div>
          <p className="text-sm text-muted-foreground">Bilder remastern + Marketing in einem Rutsch.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {[
          { num: 1, label: 'Setup', key: 'setup' as Step },
          { num: 2, label: 'Fotos & Remaster', key: 'capture' as Step },
          { num: 3, label: 'Marketing', key: 'marketing' as Step },
        ].map((s, i) => {
          const active = step === s.key;
          const done = (step === 'capture' && s.key === 'setup') || (step === 'marketing' && s.key !== 'marketing');
          return (
            <React.Fragment key={s.num}>
              {i > 0 && <div className={`w-8 h-px ${done || active ? 'bg-accent' : 'bg-border'}`} />}
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
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

      {/* ─── STEP 1: Setup ─── */}
      {step === 'setup' && (
        <div className="space-y-5">
          {/* Power-Button Hero */}
          <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm mb-1">Was passiert hier?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Du gibst einmal die Daten ein (oder scannst ein Datenblatt) – wir liefern in einem Rutsch:
                  professionelle Fahrzeugfotos, kompletten Bilderset (Heck, Innen, Details) und optional Banner & Video.
                </p>
              </div>
            </div>
          </div>

          {/* Datenblatt-Scan */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ScanSearch className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-foreground text-sm">Datenblatt / Preisliste scannen</h3>
              <span className="ml-auto text-[10px] text-muted-foreground">empfohlen</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Lade ein Foto deines Datenblatts, einer Preisliste oder eines WLTP-Labels hoch.
              Die KI erkennt Marke, Modell, Preis, Verbrauch und alle Pflichtangaben automatisch.
            </p>

            {dataSheetImage ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={dataSheetImage} alt="Datenblatt" className="w-full h-32 object-cover" />
                <button
                  onClick={() => { setDataSheetImage(null); setScanData(null); }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {scanning && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                  </div>
                )}
                {scanData && !scanning && (
                  <div className="absolute bottom-0 left-0 right-0 bg-accent text-accent-foreground px-2 py-1 text-[10px] font-semibold">
                    ✓ Erkannt: {[scanData.brand, scanData.model, scanData.price].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => dataSheetInputRef.current?.click()}
                disabled={scanning}
                className="w-full border-2 border-dashed border-border hover:border-accent rounded-lg p-6 text-center cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50 disabled:opacity-50"
              >
                {scanning ? (
                  <Loader2 className="w-6 h-6 text-muted-foreground mx-auto mb-2 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                )}
                <p className="text-xs text-muted-foreground">
                  {scanning ? 'Analysiere Datenblatt…' : 'Datenblatt / Preisliste hochladen'}
                </p>
              </button>
            )}

            <button
              type="button"
              onClick={() => { setDataSheetImage(null); setScanData(null); }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline w-full text-center"
            >
              Überspringen und manuell eingeben
            </button>

            <input
              ref={dataSheetInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleScan(f);
                e.target.value = '';
              }}
            />
          </div>

          {/* Fahrzeug-Stammdaten */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Fahrzeugdaten</h3>

            <VehicleBrandModelPicker
              brand={brand}
              model={model}
              onBrandChange={setBrand}
              onModelChange={setModel}
            />

            <div>
              <Label className="text-xs">Variante / Ausstattung</Label>
              <Input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="z.B. M Competition" className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Preis</Label>
                <Input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="z.B. 49.900 €" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Monatsrate (optional)</Label>
                <Input value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} placeholder="z.B. 549 €" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Marketing-Outputs */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Was möchtest du zusätzlich erzeugen?</h3>

            {/* Banner Toggle */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-accent" />
                  <Label className="text-sm font-medium cursor-pointer">Banner / Marketing-Material</Label>
                </div>
                <Switch checked={wantBanner} onCheckedChange={setWantBanner} />
              </div>
              {wantBanner && (
                <p className="text-[11px] text-muted-foreground pl-6">
                  Format & Stil wählst du nach dem Remastering – das Hauptbild wird automatisch übernommen.
                </p>
              )}
            </div>

            {/* Video Toggle */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-accent" />
                  <Label className="text-sm font-medium cursor-pointer">360°-Video</Label>
                </div>
                <Switch checked={wantVideo} onCheckedChange={setWantVideo} />
              </div>
              {wantVideo && (
                <div className="pl-6 space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Aus 3/4-Front + Heck wird ein 8-Sek 360°-Video erstellt. Optional eigener Prompt:
                  </p>
                  <Input
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Optional: z.B. langsame Kamerafahrt um das Fahrzeug"
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Model Tier */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-foreground text-sm">KI-Qualität</h3>
            <ModelSelector value={modelTier} onChange={setModelTier} />
          </div>

          {/* Continue */}
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" onClick={onBack}>Zurück</Button>
            <Button
              onClick={startCapture}
              disabled={!brand.trim() || !model.trim()}
              className="gap-2 gradient-accent text-accent-foreground font-semibold"
            >
              Weiter zu Fotos <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Capture (wraps existing ImageCaptureGrid) ─── */}
      {step === 'capture' && vehicleDataState && (
        <div>
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 mb-4 flex items-center gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-foreground">
              Schritt 2/3 · Nimm die Fahrzeugfotos auf, starte Remastering & Pipeline.
              Danach geht's automatisch {wantBanner && wantVideo ? 'zu Banner & Video' : wantBanner ? 'zum Banner' : wantVideo ? 'zum Video' : 'zur Galerie'}.
            </span>
          </div>
          <ImageCaptureGrid
            vehicleDescription={vehicleDescription}
            vehicleData={vehicleDataState}
            modelTier={modelTier}
            projectId={null}
            onComplete={handleCaptureComplete}
            onVehicleDataChange={setVehicleDataState}
            onBack={() => setStep('setup')}
            onPipelineComplete={handlePipelineDone}
          />
        </div>
      )}

      {/* ─── STEP 3: Marketing (Banner + Video) ─── */}
      {step === 'marketing' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 flex items-center gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-foreground">
              Bilder fertig · Jetzt Marketing-Material erstellen. Hauptbild ist bereits vorgeladen.
            </span>
          </div>

          {wantBanner && mainImage && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold">Banner-Generator</span>
              </div>
              <BannerGenerator onBack={() => setStep('capture')} preloadedImage={mainImage} />
            </div>
          )}

          {wantVideo && mainImage && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center gap-2">
                <Video className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold">360°-Video</span>
              </div>
              <VideoGenerator onBack={() => setStep('capture')} />
            </div>
          )}

          {!mainImage && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Kein Hauptbild verfügbar. Bitte gehe zurück zu Schritt 2.
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('capture')}>Zurück zu Fotos</Button>
            <Button onClick={() => navigate('/dashboard?tab=gallery')} className="gap-2">
              Zur Galerie <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OneShotStudio;
