import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Car, LayoutDashboard, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PDFUpload from '@/components/PDFUpload';
import ProcessingStatus from '@/components/ProcessingStatus';
import LandingPagePreview from '@/components/LandingPagePreview';
import TemplateSidebar from '@/components/TemplateSidebar';
import ImageSourceChoice from '@/components/ImageSourceChoice';
import ImageUploadRemaster from '@/components/ImageUploadRemaster';
import { extractPDFAsBase64 } from '@/lib/pdf-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AppState, VehicleData } from '@/types/vehicle';
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

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [appState, setAppState] = useState<AppState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 });
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const saveProject = useCallback(async (vData: VehicleData, mainImg: string | null, allImages: string[], templateId: TemplateId) => {
    if (!user) return null;
    const title = `${vData.vehicle.brand} ${vData.vehicle.model} ${vData.vehicle.variant || ''}`.trim();
    const { data: project, error } = await supabase.from('projects').insert({
      user_id: user.id,
      title,
      vehicle_data: vData as any,
      template_id: templateId,
      main_image_base64: mainImg,
    }).select('id').single();

    if (error || !project) { console.error('Save project error:', error); return null; }

    // Save images
    if (allImages.length > 0) {
      const imageRows = allImages.map((img, i) => ({
        project_id: project.id,
        user_id: user.id,
        image_base64: img,
        perspective: PERSPECTIVES[i]?.label || `Bild ${i + 1}`,
        sort_order: i,
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
    return {
      ...vData,
      dealer: {
        ...vData.dealer,
        name: vData.dealer?.name || pr.company_name || '',
        address: vData.dealer?.address || pr.address || '',
        postalCode: pr.postal_code || vData.dealer?.postalCode || '',
        city: pr.city || vData.dealer?.city || '',
        phone: vData.dealer?.phone || pr.phone || '',
        email: vData.dealer?.email || pr.email || '',
        website: pr.website || vData.dealer?.website || '',
        taxId: pr.tax_id || '',
        logoUrl: pr.logo_url || '',
        facebookUrl: pr.facebook_url || '',
        instagramUrl: pr.instagram_url || '',
        xUrl: pr.x_url || '',
        tiktokUrl: pr.tiktok_url || '',
        youtubeUrl: pr.youtube_url || '',
        leasingBank: pr.leasing_bank || '',
        leasingLegalText: pr.leasing_legal_text || '',
        financingBank: pr.financing_bank || '',
        financingLegalText: pr.financing_legal_text || '',
        defaultLegalText: pr.default_legal_text || '',
      },
    };
  }, [user]);

  const handleFileSelected = useCallback(async (file: File) => {
    setFileName(file.name);
    setGalleryImages([]);
    setImageBase64(null);
    setSavedProjectId(null);

    try {
      setAppState('uploading');
      const pdfBase64 = await extractPDFAsBase64(file);

      setAppState('analyzing');
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-pdf', {
        body: { pdfBase64 },
      });

      if (analysisError) {
        console.error('Analysis error:', analysisError);
        toast.error('Fehler bei der Analyse. Bitte versuche es erneut.');
        setAppState('idle');
        return;
      }

      if (analysisData?.error) {
        toast.error(analysisData.error);
        setAppState('idle');
        return;
      }

      const { imagePrompt: basePrompt, ...vehicleInfo } = analysisData;
      const enriched = await loadProfileIntoDealer(vehicleInfo as VehicleData);
      setVehicleData(enriched);
      setAppState('choosing-image-source');
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      setAppState('idle');
    }
  }, [loadProfileIntoDealer]);

  const handleChooseGenerate = useCallback(async () => {
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
          body: { imagePrompt: showroomBase + perspective.prompt },
        });

        if (!imageError && imageData?.imageBase64) {
          generatedImages.push(imageData.imageBase64);
          if (i === 0) setImageBase64(imageData.imageBase64);
          setGalleryImages([...generatedImages]);
        }
      } catch {
        console.warn(`Image generation failed for ${perspective.key}`);
      }
    }

    if (generatedImages.length === 0) {
      toast.warning('Bilder konnten nicht generiert werden.');
    } else {
      toast.success(`${generatedImages.length} von ${total} Bilder generiert.`);
    }

    // Auto-save project
    const projectId = await saveProject(vehicleData, generatedImages[0] || null, generatedImages, selectedTemplate);
    if (projectId) setSavedProjectId(projectId);

    setAppState('preview');
  }, [vehicleData, saveProject, selectedTemplate]);

  const handleChooseUpload = useCallback(() => {
    setAppState('uploading-images');
  }, []);

  const handleRemasterComplete = useCallback(async (mainImage: string, gallery: string[]) => {
    setImageBase64(mainImage);
    setGalleryImages(gallery);

    // Auto-save project
    if (vehicleData) {
      const allImgs = [mainImage, ...gallery];
      const projectId = await saveProject(vehicleData, mainImage, allImgs, selectedTemplate);
      if (projectId) setSavedProjectId(projectId);
    }

    setAppState('preview');
  }, [vehicleData, saveProject, selectedTemplate]);

  const handleReset = useCallback(() => {
    setAppState('idle');
    setVehicleData(null);
    setImageBase64(null);
    setGalleryImages([]);
    setImageProgress({ current: 0, total: 0 });
    setFileName('');
    setSavedProjectId(null);
  }, []);

  const isProcessing = appState === 'uploading' || appState === 'analyzing' || appState === 'generating-image';

  const vehicleDescription = vehicleData
    ? `${vehicleData.vehicle.brand} ${vehicleData.vehicle.model} ${vehicleData.vehicle.variant}, ${vehicleData.vehicle.color}, ${vehicleData.vehicle.fuelType}`
    : '';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Car className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-sm">AutoPage</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Dashboard</Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" size="icon"><User className="w-4 h-4" /></Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      {appState === 'preview' && vehicleData ? (
        <div className="flex h-[calc(100vh-56px)]">
          <TemplateSidebar selectedTemplate={selectedTemplate} onSelectTemplate={setSelectedTemplate} />
          <main className="flex-1 overflow-y-auto px-4 py-10">
            <div className="max-w-5xl mx-auto">
              <LandingPagePreview
                vehicleData={vehicleData}
                imageBase64={imageBase64}
                galleryImages={galleryImages.slice(1)}
                onReset={handleReset}
                onDataChange={setVehicleData}
                selectedTemplate={selectedTemplate}
              />
            </div>
          </main>
        </div>
      ) : (
        <main className="max-w-5xl mx-auto px-4 py-10">
          {appState === 'idle' && (
            <div className="space-y-8">
              <div className="text-center max-w-lg mx-auto">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
                  PDF hochladen,<br />
                  <span className="text-accent">Landing Page generieren</span>
                </h1>
                <p className="text-muted-foreground text-sm">
                  Lade ein Fahrzeugangebot als PDF hoch. Die KI erstellt automatisch eine professionelle Verkaufsseite mit generierten Fahrzeugbildern aus 7 Perspektiven.
                </p>
              </div>
              <PDFUpload onFileSelected={handleFileSelected} isProcessing={false} />
            </div>
          )}

          {isProcessing && (
            <div className="mt-16">
              <ProcessingStatus state={appState} fileName={fileName} imageProgress={imageProgress} />
            </div>
          )}

          {appState === 'choosing-image-source' && (
            <div className="mt-16">
              <ImageSourceChoice
                onChooseGenerate={handleChooseGenerate}
                onChooseUpload={handleChooseUpload}
              />
            </div>
          )}

          {appState === 'uploading-images' && (
            <div className="mt-16">
              <ImageUploadRemaster
                vehicleDescription={vehicleDescription}
                onComplete={handleRemasterComplete}
                onBack={() => setAppState('choosing-image-source')}
              />
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default Index;
