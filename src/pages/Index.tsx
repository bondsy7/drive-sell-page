import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import ActionHub, { HubAction } from '@/components/ActionHub';
import PDFUpload from '@/components/PDFUpload';
import SamplePdfGallery from '@/components/SamplePdfGallery';
import ProcessingStatus from '@/components/ProcessingStatus';
import LandingPagePreview from '@/components/LandingPagePreview';
import TemplateSidebar from '@/components/TemplateSidebar';
import ImageSourceChoice from '@/components/ImageSourceChoice';
import ImageUploadRemaster from '@/components/ImageUploadRemaster';
import ImageCaptureGrid from '@/components/ImageCaptureGrid';
import ManualLandingGenerator from '@/components/ManualLandingGenerator';
import CreditConfirmDialog from '@/components/CreditConfirmDialog';
import VideoGenerator from '@/components/VideoGenerator';
import BannerGenerator from '@/components/BannerGenerator';
import VehicleSelectBeforeGenerate from '@/components/VehicleSelectBeforeGenerate';
import { extractPDFAsBase64 } from '@/lib/pdf-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { uploadImagesToStorage } from '@/lib/storage-utils';
import type { AppState, VehicleData } from '@/types/vehicle';
import type { TemplateId } from '@/types/template';
import type { ModelTier } from '@/components/ModelSelector';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ExtendedAppState = AppState | 'capturing-images' | 'hub' | 'standalone-photo-choice' | 'standalone-capture' | 'standalone-upload' | 'standalone-generate-select' | 'standalone-generating' | 'video' | 'banner' | 'manual-landing' | 'manual-landing-preview';

const PERSPECTIVES = [
  { key: 'front', label: 'Frontansicht', prompt: 'Front view, straight on, symmetrical composition' },
  { key: '34front', label: '3/4 Frontansicht', prompt: '3/4 front angle view, slightly from the left side, dynamic composition' },
  { key: 'side', label: 'Seitenansicht', prompt: 'Side profile view, perfectly level, full length visible' },
  { key: '34rear', label: '3/4 Rückansicht', prompt: '3/4 rear angle view, slightly from the right side, dynamic composition' },
  { key: 'rear', label: 'Rückansicht', prompt: 'Rear view, straight on, symmetrical composition showing taillights and exhaust' },
  { key: 'trunk', label: 'Kofferraum', prompt: 'Open trunk/boot view showing cargo space, slightly elevated angle' },
  { key: 'interior', label: 'Interieur', prompt: 'Interior view from driver door, showing dashboard, steering wheel, seats, and center console' },
];

const Index = () => {
  const { user } = useAuth();
  const { balance, getCost } = useCredits();
  const navigate = useNavigate();
  const [appState, setAppState] = useState<ExtendedAppState>('hub');
  const [fileName, setFileName] = useState('');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 });
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('autohaus');
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [selectedModelTier, setSelectedModelTier] = useState<ModelTier>('schnell');
  const [creditDialog, setCreditDialog] = useState<{ open: boolean; cost: number; label: string; onConfirm: () => void }>({
    open: false, cost: 0, label: '', onConfirm: () => {},
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // For standalone photo results
  const [standalonePhotoResults, setStandalonePhotoResults] = useState<string[]>([]);
  // For manual landing page HTML
  const [manualLandingHTML, setManualLandingHTML] = useState<string | null>(null);

  const currentStep = appState === 'hub' || appState === 'idle' ? 1 : appState === 'preview' ? 3 : 2;

  const saveProject = useCallback(async (vData: VehicleData, mainImg: string | null, allImages: string[], templateId: TemplateId) => {
    if (!user) return null;
    const title = `${vData.vehicle.brand} ${vData.vehicle.model} ${vData.vehicle.variant || ''}`.trim();
    const { data: project, error } = await supabase.from('projects').insert({
      user_id: user.id, title, vehicle_data: vData as any, template_id: templateId,
    }).select('id').single();
    if (error || !project) { console.error('Save project error:', error); return null; }
    if (allImages.length > 0) {
      const urls = await uploadImagesToStorage(allImages, user.id, project.id);
      if (urls.length > 0) {
        await supabase.from('projects').update({ main_image_url: urls[0] }).eq('id', project.id);
      }
      const imageRows = urls.map((url, i) => ({
        project_id: project.id, user_id: user.id, image_url: url, image_base64: '',
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

  // ─── PDF → Landing Page Flow ───
  const handleFileSelected = useCallback(async (file: File) => {
    const pdfCost = getCost('pdf_analysis', 'standard') || 1;
    setPendingFile(file);
    setCreditDialog({
      open: true, cost: pdfCost, label: 'PDF analysieren',
      onConfirm: () => { setPendingFile(null); setCreditDialog(prev => ({ ...prev, open: false })); processFile(file); },
    });
  }, [getCost]);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setGalleryImages([]); setImageBase64(null); setSavedProjectId(null);
    try {
      setAppState('uploading');
      const pdfBase64 = await extractPDFAsBase64(file);
      setAppState('analyzing');
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-pdf', { body: { pdfBase64 } });
      if (analysisError) { toast.error('Fehler bei der Analyse.'); setAppState('idle'); return; }
      if (analysisData?.error) {
        if (analysisData.error === 'insufficient_credits') {
          toast.error(`Nicht genügend Credits. Guthaben: ${analysisData.balance}, benötigt: ${analysisData.cost}.`, { duration: 8000 });
        } else if (analysisData.error === 'not_vehicle_offer') {
          toast.error(`Kein Fahrzeugangebot, sondern "${analysisData.documentType}".`, { duration: 8000 });
        } else if (analysisData.error === 'Nicht authentifiziert') {
          toast.error('Bitte melde dich an.');
        } else { toast.error(analysisData.error); }
        setAppState('idle'); return;
      }
      const { imagePrompt: _bp, isVehicleOffer: _iv, ...vehicleInfo } = analysisData;
      const enriched = await loadProfileIntoDealer(vehicleInfo as VehicleData);
      setVehicleData(enriched);
      // If we have standalone photos already, skip image source choice and go straight to preview
      if (standalonePhotoResults.length > 0) {
        setImageBase64(standalonePhotoResults[0]);
        setGalleryImages(standalonePhotoResults.slice(1));
        const projectId = await saveProject(enriched, standalonePhotoResults[0], standalonePhotoResults, selectedTemplate);
        if (projectId) setSavedProjectId(projectId);
        setAppState('preview');
        toast.success('Vorhandene Fotos wurden automatisch verknüpft!');
      } else {
        setAppState('choosing-image-source');
      }
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Ein Fehler ist aufgetreten.');
      setAppState('idle');
    }
  }, [loadProfileIntoDealer, standalonePhotoResults, saveProject, selectedTemplate]);

  // ─── Image Generation (within PDF flow) ───
  const handleChooseGenerate = useCallback(async (modelTier: ModelTier = 'schnell') => {
    if (!vehicleData) return;
    setSelectedModelTier(modelTier);
    const costPerImage = getCost('image_generate', modelTier) || 2;
    const totalCost = costPerImage * PERSPECTIVES.length;
    const tierLabels: Record<ModelTier, string> = { schnell: 'Schnell', qualitaet: 'Qualität', premium: 'Premium', turbo: 'Turbo', ultra: 'Ultra' };
    setCreditDialog({
      open: true, cost: totalCost,
      label: `${PERSPECTIVES.length} Bilder generieren (${tierLabels[modelTier]})`,
      onConfirm: () => { setCreditDialog(prev => ({ ...prev, open: false })); doGenerate(modelTier); },
    });
  }, [vehicleData, getCost]);

  const doGenerate = useCallback(async (modelTier: ModelTier = 'schnell') => {
    if (!vehicleData) return;
    setAppState('generating-image');
    const total = PERSPECTIVES.length;
    setImageProgress({ current: 0, total });
    const showroomBase = `Photorealistic image of a ${vehicleData.vehicle?.brand || ''} ${vehicleData.vehicle?.model || ''} ${vehicleData.vehicle?.variant || ''} in ${vehicleData.vehicle?.color || 'the original color'}. The car is in a modern, bright, luxurious car dealership showroom with polished floors and soft lighting. `;
    const generatedImages: string[] = [];
    for (let i = 0; i < PERSPECTIVES.length; i++) {
      setImageProgress({ current: i + 1, total });
      try {
        const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-vehicle-image', {
          body: { imagePrompt: showroomBase + PERSPECTIVES[i].prompt, modelTier },
        });
        if (imageData?.error === 'insufficient_credits') { toast.error(`Nicht genügend Credits.`, { duration: 8000 }); break; }
        if (imageData?.error === 'Nicht authentifiziert') { toast.error('Bitte melde dich an.'); break; }
        if (!imageError && imageData?.imageBase64) {
          generatedImages.push(imageData.imageBase64);
          if (i === 0) setImageBase64(imageData.imageBase64);
          setGalleryImages([...generatedImages]);
        }
      } catch { console.warn(`Image generation failed for ${PERSPECTIVES[i].key}`); }
    }
    if (generatedImages.length === 0) toast.warning('Bilder konnten nicht generiert werden.');
    else toast.success(`${generatedImages.length} von ${total} Bilder generiert.`);
    const projectId = await saveProject(vehicleData, generatedImages[0] || null, generatedImages, selectedTemplate);
    if (projectId) setSavedProjectId(projectId);
    setAppState('preview');
  }, [vehicleData, saveProject, selectedTemplate]);

  const handleChooseUpload = useCallback((modelTier: ModelTier = 'schnell') => {
    setSelectedModelTier(modelTier);
    setAppState('uploading-images');
  }, []);

  const handleChooseCapture = useCallback((modelTier: ModelTier = 'schnell') => {
    setSelectedModelTier(modelTier);
    setAppState('capturing-images' as any);
  }, []);

  const handleCaptureComplete = useCallback(async (mainImage: string, gallery: string[], vin?: string) => {
    setImageBase64(mainImage);
    setGalleryImages(gallery);
    if (vehicleData) {
      const updatedData = vin ? { ...vehicleData, vehicle: { ...vehicleData.vehicle, vin } } : vehicleData;
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

  // ─── Save standalone images to storage + DB ───
  const saveStandaloneImages = useCallback(async (allImages: string[]) => {
    if (!user || allImages.length === 0) return;
    try {
      // Upload to storage
      const urls = await uploadImagesToStorage(allImages, user.id, `standalone-${Date.now()}`);
      if (urls.length === 0) return;
      // Save to project_images (without a project_id – we use a placeholder project)
      // Create a lightweight project to hold these images
      const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const { data: project } = await supabase.from('projects').insert({
        user_id: user.id,
        title: `Showroom-Fotos ${dateStr}`,
        vehicle_data: { vehicle: { brand: 'Showroom', model: 'Fotos' } } as any,
        template_id: 'modern',
        main_image_url: urls[0],
      }).select('id').single();
      if (!project) return;
      const imageRows = urls.map((url, i) => ({
        project_id: project.id,
        user_id: user.id,
        image_url: url,
        image_base64: '',
        perspective: PERSPECTIVES[i]?.label || `Bild ${i + 1}`,
        sort_order: i,
      }));
      await supabase.from('project_images').insert(imageRows);
      // main_image_url already set in insert above
    } catch (e) {
      console.error('Error saving standalone images:', e);
    }
  }, [user]);

  // ─── Standalone Photo Flow ───
  const handleStandaloneCaptureComplete = useCallback((mainImage: string, gallery: string[], _vin?: string) => {
    const allImages = [mainImage, ...gallery];
    setStandalonePhotoResults(allImages);
    saveStandaloneImages(allImages);
    toast.success(`${allImages.length} Showroom-Bilder erstellt und im Dashboard gespeichert!`);
    navigate('/dashboard?tab=gallery');
  }, [saveStandaloneImages, navigate]);

  const handleStandaloneRemasterComplete = useCallback((mainImage: string, gallery: string[]) => {
    const allImages = [mainImage, ...gallery];
    setStandalonePhotoResults(allImages);
    saveStandaloneImages(allImages);
    toast.success(`${allImages.length} Showroom-Bilder erstellt und im Dashboard gespeichert!`);
    navigate('/dashboard?tab=gallery');
  }, [saveStandaloneImages, navigate]);

  // ─── Hub Action Handler ───
  const handleHubAction = useCallback((action: HubAction) => {
    switch (action) {
      case 'photos':
        setAppState('standalone-photo-choice');
        break;
      case 'pdf-landing':
        setAppState('idle');
        break;
      case 'video':
        setAppState('video');
        break;
      case 'banner':
        setAppState('banner');
        break;
      case 'manual-landing':
        setAppState('manual-landing');
        break;
      default:
        toast.info('Diese Funktion ist bald verfügbar!');
    }
  }, []);

  const handleReset = useCallback(() => {
    setAppState('hub'); setVehicleData(null); setImageBase64(null);
    setGalleryImages([]); setImageProgress({ current: 0, total: 0 }); setFileName(''); setSavedProjectId(null);
    setManualLandingHTML(null);
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
          {/* ─── Hub ─── */}
          {appState === 'hub' && (
            <>
              <ActionHub onSelect={handleHubAction} />
              {standalonePhotoResults.length > 0 && (
                <div className="mt-6 p-4 rounded-xl border border-accent/30 bg-accent/5 text-center">
                  <p className="text-sm text-foreground font-medium">
                    ✅ {standalonePhotoResults.length} Showroom-Bilder bereit
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Starte "PDF → Angebotsseite" um sie automatisch zu verknüpfen.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ─── Standalone Photo Choice ─── */}
          {appState === 'standalone-photo-choice' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="icon" onClick={() => setAppState('hub')}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">Fotos & Remastering</h2>
                  <p className="text-sm text-muted-foreground">Wähle wie du Bilder bereitstellen möchtest</p>
                </div>
              </div>
              <ImageSourceChoice
                onChooseGenerate={(tier) => { setSelectedModelTier(tier); setAppState('standalone-generate-select' as any); }}
                onChooseUpload={(tier) => { setSelectedModelTier(tier); setAppState('standalone-upload'); }}
                onChooseCapture={(tier) => { setSelectedModelTier(tier); setAppState('standalone-capture'); }}
              />
            </div>
          )}

          {/* ─── Standalone Generate: Vehicle Selection ─── */}
          {appState === 'standalone-generate-select' && (
            <VehicleSelectBeforeGenerate
              modelTier={selectedModelTier}
              onBack={() => setAppState('standalone-photo-choice')}
              onConfirm={async (brand, model, variant, color) => {
                const newVehicleData: VehicleData = {
                  category: 'Kauf',
                  vehicle: { brand, model, variant, year: new Date().getFullYear(), color: color || 'Original', fuelType: '', transmission: '', power: '', features: [] },
                  finance: { monthlyRate: '', downPayment: '', duration: '', totalPrice: '', annualMileage: '', specialPayment: '', residualValue: '', interestRate: '' },
                  dealer: { name: '', address: '', postalCode: '', city: '', phone: '', email: '', website: '', taxId: '', logoUrl: '', facebookUrl: '', instagramUrl: '', xUrl: '', tiktokUrl: '', youtubeUrl: '', whatsappNumber: '', leasingBank: '', leasingLegalText: '', financingBank: '', financingLegalText: '', defaultLegalText: '' },
                  consumption: { origin: '', mileage: '', displacement: '', power: '', driveType: '', fuelType: '', consumptionCombined: '', co2Emissions: '', co2Class: '', consumptionCity: '', consumptionSuburban: '', consumptionRural: '', consumptionHighway: '', energyCostPerYear: '', fuelPrice: '', co2CostMedium: '', co2CostLow: '', co2CostHigh: '', vehicleTax: '', isPluginHybrid: false, co2EmissionsDischarged: '', co2ClassDischarged: '', consumptionCombinedDischarged: '', electricRange: '', consumptionElectric: '' },
                };
                const enriched = await loadProfileIntoDealer(newVehicleData);
                setVehicleData(enriched);

                // Start generation
                const costPerImage = getCost('image_generate', selectedModelTier) || 2;
                const totalCost = costPerImage * PERSPECTIVES.length;
                setCreditDialog({
                  open: true, cost: totalCost,
                  label: `${PERSPECTIVES.length} Bilder für ${brand} ${model} generieren`,
                  onConfirm: () => {
                    setCreditDialog(prev => ({ ...prev, open: false }));
                    setAppState('standalone-generating' as any);
                    doStandaloneGenerate(enriched);
                  },
                });
              }}
            />
          )}

          {/* ─── Standalone Capture ─── */}
          {appState === 'standalone-capture' && (
            <div className="mt-4">
              <ImageCaptureGrid
                vehicleDescription=""
                vehicleData={undefined}
                modelTier={selectedModelTier}
                onComplete={handleStandaloneCaptureComplete}
                onVehicleDataChange={setVehicleData}
                onBack={() => setAppState('standalone-photo-choice')}
                onPipelineComplete={() => navigate('/dashboard?tab=gallery')}
              />
            </div>
          )}

          {/* ─── Standalone Upload ─── */}
          {appState === 'standalone-upload' && (
            <div className="mt-4">
              <ImageUploadRemaster
                vehicleDescription=""
                modelTier={selectedModelTier}
                onComplete={handleStandaloneRemasterComplete}
                onBack={() => setAppState('standalone-photo-choice')}
              />
            </div>
          )}

          {/* ─── Video Generator ─── */}
          {appState === 'video' && (
            <VideoGenerator
              onBack={() => setAppState('hub')}
              preloadedImage={standalonePhotoResults.length > 0 ? standalonePhotoResults[0] : undefined}
            />
          )}

          {/* ─── Manual Landing Generator ─── */}
          {appState === 'manual-landing' && (
            <ManualLandingGenerator
              onBack={() => setAppState('hub')}
              onComplete={(projectId) => {
                navigate(`/project/${projectId}`);
              }}
            />
          )}

          {/* ─── Banner Generator ─── */}
          {appState === 'banner' && (
            <BannerGenerator
              onBack={() => setAppState('hub')}
              preloadedImage={standalonePhotoResults.length > 0 ? standalonePhotoResults[0] : undefined}
            />
          )}

          {appState === 'idle' && (
            <div className="space-y-8">
              <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="icon" onClick={() => setAppState('hub')}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">PDF → Angebotsseite</h2>
                  <p className="text-sm text-muted-foreground">
                    PDF hochladen → KI liest aus → fertige Angebotsseite
                  </p>
                </div>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {[{ num: 1, label: 'PDF hochladen' }, { num: 2, label: 'KI analysiert' }, { num: 3, label: 'Bearbeiten & Download' }].map((step, i) => (
                  <React.Fragment key={step.num}>
                    {i > 0 && <div className={`w-8 h-px ${currentStep > i ? 'bg-accent' : 'bg-border'}`} />}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                        currentStep >= step.num ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                      }`}>{step.num}</div>
                      <span className={`text-xs font-medium ${currentStep >= step.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <PDFUpload onFileSelected={handleFileSelected} isProcessing={false} />
              <div className="flex items-center justify-center gap-1 text-accent">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium text-muted-foreground">
                  KI-Analyse kostet <strong className="text-accent">{getCost('pdf_analysis', 'standard') || 1} Credit</strong> — Guthaben: <strong className="text-foreground">{balance} Credits</strong>
                </span>
              </div>
              <SamplePdfGallery
                onSelect={async (pdfUrl, title) => {
                  try {
                    const response = await fetch(pdfUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `${title}.pdf`, { type: 'application/pdf' });
                    handleFileSelected(file);
                  } catch { toast.error('Fehler beim Laden des Beispiel-PDFs'); }
                }}
                isProcessing={false}
              />
              {standalonePhotoResults.length > 0 && (
                <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 text-center">
                  <p className="text-xs text-muted-foreground">
                    ✅ {standalonePhotoResults.length} Showroom-Bilder werden nach Analyse automatisch verknüpft
                  </p>
                </div>
              )}
            </div>
          )}

          {isProcessing && (
            <div className="mt-8">
              <ProcessingStatus state={appState as AppState} fileName={fileName} imageProgress={imageProgress} />
            </div>
          )}

          {appState === 'choosing-image-source' && (
            <div className="mt-8">
              <ImageSourceChoice onChooseGenerate={handleChooseGenerate} onChooseUpload={handleChooseUpload} onChooseCapture={handleChooseCapture} />
            </div>
          )}

          {appState === 'capturing-images' && (
            <div className="mt-8">
              <ImageCaptureGrid vehicleDescription={vehicleDescription} vehicleData={vehicleData || undefined} modelTier={selectedModelTier} onComplete={handleCaptureComplete} onVehicleDataChange={setVehicleData} onBack={() => setAppState('choosing-image-source')} onPipelineComplete={() => navigate('/dashboard?tab=gallery')} />
            </div>
          )}

          {appState === 'uploading-images' && (
            <div className="mt-8">
              <ImageUploadRemaster vehicleDescription={vehicleDescription} vehicleBrand={vehicleData?.vehicle?.brand} modelTier={selectedModelTier} onComplete={handleRemasterComplete} onBack={() => setAppState('choosing-image-source')} />
            </div>
          )}
        </main>
      )}

      <CreditConfirmDialog
        open={creditDialog.open}
        cost={creditDialog.cost}
        balance={balance}
        actionLabel={creditDialog.label}
        onConfirm={creditDialog.onConfirm}
        onCancel={() => { setCreditDialog(prev => ({ ...prev, open: false })); setPendingFile(null); }}
      />
    </div>
  );
};

export default Index;
