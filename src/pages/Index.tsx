import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import PDFUpload from '@/components/PDFUpload';
import SamplePdfGallery from '@/components/SamplePdfGallery';
import ProcessingStatus from '@/components/ProcessingStatus';
import LandingPagePreview from '@/components/LandingPagePreview';
import TemplateSidebar from '@/components/TemplateSidebar';
import ImageSourceChoice from '@/components/ImageSourceChoice';
import ImageUploadRemaster from '@/components/ImageUploadRemaster';
import ImageCaptureGrid from '@/components/ImageCaptureGrid';
import CreditConfirmDialog from '@/components/CreditConfirmDialog';
import { extractPDFAsBase64 } from '@/lib/pdf-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { uploadImagesToStorage } from '@/lib/storage-utils';
import type { AppState, VehicleData } from '@/types/vehicle';

// Extend AppState locally to include 'capturing-images'
type ExtendedAppState = AppState | 'capturing-images';
import type { TemplateId } from '@/types/template';

const PERSPECTIVES = [
  { key: 'front', label: 'Frontansicht', prompt: 'Front view, straight on, symmetrical composition' },
  { key: '34front', label: '3/4 Frontansicht', prompt: '3/4 front angle view, slightly from the left side, dynamic composition' },
  { key: 'side', label: 'Seitenansicht', prompt: 'Side profile view, perfectly level, full length visible' },
  { key: '34rear', label: '3/4 Rückansicht', prompt: '3/4 rear angle view, slightly from the right side, dynamic composition' },
  { key: 'rear', label: 'Rückansicht', prompt: 'Rear view, straight on, symmetrical composition showing taillights and exhaust' },
  { key: 'trunk', label: 'Kofferraum', prompt: 'Open trunk/boot view showing cargo space, slightly elevated angle' },
  { key: 'interior', label: 'Interieur', prompt: 'Interior view from driver door, showing dashboard, steering wheel, seats, and center console' },
];

const STEPS = [
  { num: 1, label: 'PDF hochladen' },
  { num: 2, label: 'KI analysiert' },
  { num: 3, label: 'Bearbeiten & Download' },
];

const Index = () => {
  const { user, signOut } = useAuth();
  const { balance, getCost } = useCredits();
  const navigate = useNavigate();
  const [appState, setAppState] = useState<ExtendedAppState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 });
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('autohaus');
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [selectedModelTier, setSelectedModelTier] = useState<'standard' | 'pro'>('standard');
  const [creditDialog, setCreditDialog] = useState<{ open: boolean; cost: number; label: string; onConfirm: () => void }>({
    open: false, cost: 0, label: '', onConfirm: () => {},
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const currentStep = appState === 'idle' ? 1 : appState === 'preview' ? 3 : 2;

  const saveProject = useCallback(async (vData: VehicleData, mainImg: string | null, allImages: string[], templateId: TemplateId) => {
    if (!user) return null;
    const title = `${vData.vehicle.brand} ${vData.vehicle.model} ${vData.vehicle.variant || ''}`.trim();

    // Create project first (without images)
    const { data: project, error } = await supabase.from('projects').insert({
      user_id: user.id, title, vehicle_data: vData as any, template_id: templateId,
    }).select('id').single();
    if (error || !project) { console.error('Save project error:', error); return null; }

    // Upload images to storage
    if (allImages.length > 0) {
      const urls = await uploadImagesToStorage(allImages, user.id, project.id);

      // Save main image URL
      if (urls.length > 0) {
        await supabase.from('projects').update({ main_image_url: urls[0] }).eq('id', project.id);
      }

      // Save image references
      const imageRows = urls.map((url, i) => ({
        project_id: project.id, user_id: user.id, image_url: url, image_base64: '', // empty, kept for schema compat
        perspective: PERSPECTIVES[i]?.label || `Bild ${i + 1}`, sort_order: i,
      }));
      await supabase.from('project_images').insert(imageRows);
    }
    return project.id;
  }, [user]);

  const loadProfileIntoDealer = useCallback(async (vData: VehicleData): Promise<VehicleData> => {
    if (!user) return vData;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!p) return vData;
    const pr = p as any;
    const d = vData.dealer || {} as any;
    return {
      ...vData,
      dealer: {
        ...vData.dealer,
        name: d.name || pr.company_name || '',
        address: d.address || pr.address || '',
        postalCode: d.postalCode || pr.postal_code || '',
        city: d.city || pr.city || '',
        phone: d.phone || pr.phone || '',
        email: d.email || pr.email || '',
        website: d.website || pr.website || '',
        taxId: d.taxId || pr.tax_id || '',
        logoUrl: d.logoUrl || pr.logo_url || '',
        facebookUrl: d.facebookUrl || pr.facebook_url || '',
        instagramUrl: d.instagramUrl || pr.instagram_url || '',
        xUrl: d.xUrl || pr.x_url || '',
        tiktokUrl: d.tiktokUrl || pr.tiktok_url || '',
        youtubeUrl: d.youtubeUrl || pr.youtube_url || '',
        whatsappNumber: d.whatsappNumber || pr.whatsapp_number || '',
        leasingBank: d.leasingBank || pr.leasing_bank || '',
        leasingLegalText: d.leasingLegalText || pr.leasing_legal_text || '',
        financingBank: d.financingBank || pr.financing_bank || '',
        financingLegalText: d.financingLegalText || pr.financing_legal_text || '',
        defaultLegalText: d.defaultLegalText || pr.default_legal_text || '',
      },
    };
  }, [user]);

  const handleFileSelected = useCallback(async (file: File) => {
    const pdfCost = getCost('pdf_analysis', 'standard') || 1;
    setPendingFile(file);
    setCreditDialog({
      open: true,
      cost: pdfCost,
      label: 'PDF analysieren',
      onConfirm: () => {
        setPendingFile(null);
        setCreditDialog(prev => ({ ...prev, open: false }));
        processFile(file);
      },
    });
  }, [getCost]);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setGalleryImages([]);
    setImageBase64(null);
    setSavedProjectId(null);
    try {
      setAppState('uploading');
      const pdfBase64 = await extractPDFAsBase64(file);
      setAppState('analyzing');
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-pdf', { body: { pdfBase64 } });
      if (analysisError) { console.error('Analysis error:', analysisError); toast.error('Fehler bei der Analyse.'); setAppState('idle'); return; }
      if (analysisData?.error) {
        if (analysisData.error === 'insufficient_credits') {
          toast.error(`Nicht genügend Credits. Guthaben: ${analysisData.balance}, benötigt: ${analysisData.cost}. Bitte lade Credits nach.`, { duration: 8000 });
        } else if (analysisData.error === 'not_vehicle_offer') {
          toast.error(`Das hochgeladene Dokument ist kein Fahrzeugangebot, sondern eine "${analysisData.documentType}". Bitte lade ein Fahrzeugangebot (Leasing, Finanzierung oder Kaufangebot) als PDF hoch.`, { duration: 8000 });
        } else if (analysisData.error === 'Nicht authentifiziert') {
          toast.error('Bitte melde dich an, um diese Funktion zu nutzen.');
        } else {
          toast.error(analysisData.error);
        }
        setAppState('idle'); return;
      }
      const { imagePrompt: basePrompt, isVehicleOffer, ...vehicleInfo } = analysisData;
      const enriched = await loadProfileIntoDealer(vehicleInfo as VehicleData);
      setVehicleData(enriched);
      setAppState('choosing-image-source');
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Ein Fehler ist aufgetreten.');
      setAppState('idle');
    }
  }, [loadProfileIntoDealer]);

  const handleChooseGenerate = useCallback(async (modelTier: 'standard' | 'pro' = 'standard') => {
    if (!vehicleData) return;
    setSelectedModelTier(modelTier);
    const costPerImage = getCost('image_generate', modelTier) || 2;
    const totalCost = costPerImage * PERSPECTIVES.length;
    setCreditDialog({
      open: true,
      cost: totalCost,
      label: `${PERSPECTIVES.length} Bilder generieren (${modelTier === 'pro' ? 'Pro' : 'Basic'})`,
      onConfirm: () => {
        setCreditDialog(prev => ({ ...prev, open: false }));
        doGenerate(modelTier);
      },
    });
  }, [vehicleData, getCost]);

  const doGenerate = useCallback(async (modelTier: 'standard' | 'pro' = 'standard') => {
    if (!vehicleData) return;
    setAppState('generating-image');
    const total = PERSPECTIVES.length;
    setImageProgress({ current: 0, total });
    const showroomBase = `Photorealistic image of a ${vehicleData.vehicle?.brand || ''} ${vehicleData.vehicle?.model || ''} ${vehicleData.vehicle?.variant || ''} in ${vehicleData.vehicle?.color || 'the original color'}. The car is in a modern, bright, luxurious car dealership showroom with polished floors and soft lighting. `;
    const generatedImages: string[] = [];
    for (let i = 0; i < PERSPECTIVES.length; i++) {
      const perspective = PERSPECTIVES[i];
      setImageProgress({ current: i + 1, total });
      try {
        const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-vehicle-image', {
          body: { imagePrompt: showroomBase + perspective.prompt, modelTier },
        });
        if (imageData?.error === 'insufficient_credits') {
          toast.error(`Nicht genügend Credits für die Bildgenerierung. Guthaben: ${imageData.balance}`, { duration: 8000 });
          break;
        }
        if (imageData?.error === 'Nicht authentifiziert') {
          toast.error('Bitte melde dich an, um Bilder zu generieren.');
          break;
        }
        if (!imageError && imageData?.imageBase64) {
          generatedImages.push(imageData.imageBase64);
          if (i === 0) setImageBase64(imageData.imageBase64);
          setGalleryImages([...generatedImages]);
        }
      } catch { console.warn(`Image generation failed for ${perspective.key}`); }
    }
    if (generatedImages.length === 0) { toast.warning('Bilder konnten nicht generiert werden.'); }
    else { toast.success(`${generatedImages.length} von ${total} Bilder generiert.`); }
    const projectId = await saveProject(vehicleData, generatedImages[0] || null, generatedImages, selectedTemplate);
    if (projectId) setSavedProjectId(projectId);
    setAppState('preview');
  }, [vehicleData, saveProject, selectedTemplate]);

  const handleChooseUpload = useCallback((modelTier: 'standard' | 'pro' = 'standard') => {
    setSelectedModelTier(modelTier);
    setAppState('uploading-images');
  }, []);
  const handleChooseCapture = useCallback((modelTier: 'standard' | 'pro' = 'standard') => {
    setSelectedModelTier(modelTier);
    setAppState('capturing-images' as any);
  }, []);

  const handleCaptureComplete = useCallback(async (mainImage: string, gallery: string[], vin?: string) => {
    setImageBase64(mainImage);
    setGalleryImages(gallery);
    if (vehicleData) {
      // Add VIN to vehicle data if detected
      const updatedData = vin ? {
        ...vehicleData,
        vehicle: { ...vehicleData.vehicle, vin },
      } : vehicleData;
      if (vin) setVehicleData(updatedData);
      const allImgs = [mainImage, ...gallery];
      const projectId = await saveProject(updatedData, mainImage, allImgs, selectedTemplate);
      if (projectId) setSavedProjectId(projectId);
    }
    setAppState('preview');
  }, [vehicleData, saveProject, selectedTemplate]);

  const handleRemasterComplete = useCallback(async (mainImage: string, gallery: string[]) => {
    setImageBase64(mainImage);
    setGalleryImages(gallery);
    if (vehicleData) {
      const allImgs = [mainImage, ...gallery];
      const projectId = await saveProject(vehicleData, mainImage, allImgs, selectedTemplate);
      if (projectId) setSavedProjectId(projectId);
    }
    setAppState('preview');
  }, [vehicleData, saveProject, selectedTemplate]);

  const handleReset = useCallback(() => {
    setAppState('idle'); setVehicleData(null); setImageBase64(null);
    setGalleryImages([]); setImageProgress({ current: 0, total: 0 }); setFileName(''); setSavedProjectId(null);
  }, []);

  const isProcessing = appState === 'uploading' || appState === 'analyzing' || appState === 'generating-image';
  const vehicleDescription = vehicleData
    ? `${vehicleData.vehicle.brand} ${vehicleData.vehicle.model} ${vehicleData.vehicle.variant}, ${vehicleData.vehicle.color}, ${vehicleData.vehicle.fuelType}` : '';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {appState === 'preview' && vehicleData ? (
        <div className="flex h-[calc(100vh-56px)]">
          <TemplateSidebar selectedTemplate={selectedTemplate} onSelectTemplate={setSelectedTemplate} vehicleData={vehicleData} />
          <main className="flex-1 overflow-y-auto px-4 py-10">
            <div className="max-w-5xl mx-auto">
              <LandingPagePreview
                vehicleData={vehicleData} imageBase64={imageBase64}
                galleryImages={galleryImages} onReset={handleReset}
                onDataChange={setVehicleData} selectedTemplate={selectedTemplate}
                projectId={savedProjectId}
              />
            </div>
          </main>
        </div>
      ) : (
        <main className="max-w-3xl mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              KI-Angebotsgenerator
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              Angebotsseite erstellen
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              PDF hochladen → KI liest aus → fertige Angebotsseite bearbeiten & herunterladen
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {STEPS.map((step, i) => (
              <React.Fragment key={step.num}>
                {i > 0 && <div className={`w-8 h-px ${currentStep > i ? 'bg-accent' : 'bg-border'}`} />}
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                    currentStep >= step.num
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.num}
                  </div>
                  <span className={`text-xs font-medium ${currentStep >= step.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {appState === 'idle' && (
            <div className="space-y-8">
              <PDFUpload onFileSelected={handleFileSelected} isProcessing={false} />
              <div className="flex items-center justify-center gap-1 text-accent">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium text-muted-foreground">
                  KI-Analyse kostet <strong className="text-accent">{getCost('pdf_analysis', 'standard') || 1} Credit</strong> — Guthaben: <strong className="text-foreground">{balance} Credits</strong>
                </span>
              </div>

              {/* Sample PDF Gallery */}
              <SamplePdfGallery
                onSelect={async (pdfUrl, title) => {
                  // Download PDF from URL and convert to File
                  try {
                    const response = await fetch(pdfUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `${title}.pdf`, { type: 'application/pdf' });
                    handleFileSelected(file);
                  } catch {
                    toast.error('Fehler beim Laden des Beispiel-PDFs');
                  }
                }}
                isProcessing={false}
              />

              <p className="text-center text-[11px] text-muted-foreground">
                Die KI erkennt automatisch Leasing, Kauf oder Finanzierung und füllt alle Felder vor.
              </p>
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
                <span>📄 Leasing</span>
                <span>💰 Kauf</span>
                <span>🏦 Finanzierung</span>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="mt-8">
              <ProcessingStatus state={appState} fileName={fileName} imageProgress={imageProgress} />
            </div>
          )}

          {appState === 'choosing-image-source' && (
            <div className="mt-8">
              <ImageSourceChoice onChooseGenerate={handleChooseGenerate} onChooseUpload={handleChooseUpload} onChooseCapture={handleChooseCapture} />
            </div>
          )}

          {appState === 'capturing-images' && (
            <div className="mt-8">
              <ImageCaptureGrid vehicleDescription={vehicleDescription} vehicleData={vehicleData || undefined} modelTier={selectedModelTier} onComplete={handleCaptureComplete} onVehicleDataChange={setVehicleData} onBack={() => setAppState('choosing-image-source')} />
            </div>
          )}

          {appState === 'uploading-images' && (
            <div className="mt-8">
              <ImageUploadRemaster vehicleDescription={vehicleDescription} modelTier={selectedModelTier} onComplete={handleRemasterComplete} onBack={() => setAppState('choosing-image-source')} />
            </div>
          )}
        </main>
      )}

      {/* Credit Confirmation Dialog */}
      <CreditConfirmDialog
        open={creditDialog.open}
        cost={creditDialog.cost}
        balance={balance}
        actionLabel={creditDialog.label}
        onConfirm={creditDialog.onConfirm}
        onCancel={() => {
          setCreditDialog(prev => ({ ...prev, open: false }));
          setPendingFile(null);
        }}
      />
    </div>
  );
};

export default Index;