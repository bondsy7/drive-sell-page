import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Car } from 'lucide-react';
import PDFUpload from '@/components/PDFUpload';
import ProcessingStatus from '@/components/ProcessingStatus';
import LandingPagePreview from '@/components/LandingPagePreview';
import TemplateSidebar from '@/components/TemplateSidebar';
import { extractPDFAsBase64 } from '@/lib/pdf-utils';
import { supabase } from '@/integrations/supabase/client';
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
  const [appState, setAppState] = useState<AppState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 });
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');

  const handleFileSelected = useCallback(async (file: File) => {
    setFileName(file.name);
    setGalleryImages([]);
    setImageBase64(null);

    try {
      // Step 1: Extract PDF
      setAppState('uploading');
      const pdfBase64 = await extractPDFAsBase64(file);

      // Step 2: Analyze with AI
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
      setVehicleData(vehicleInfo as VehicleData);

      // Step 3: Generate multiple images from different perspectives
      setAppState('generating-image');
      const total = PERSPECTIVES.length;
      setImageProgress({ current: 0, total });

      const showroomBase = `Photorealistic image of a ${vehicleInfo.vehicle?.brand || ''} ${vehicleInfo.vehicle?.model || ''} ${vehicleInfo.vehicle?.variant || ''} in ${vehicleInfo.vehicle?.color || 'the original color'}. The car is in a modern, bright, luxurious car dealership showroom with polished floors and soft lighting. `;

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
            // Set first image as main image immediately
            if (i === 0) {
              setImageBase64(imageData.imageBase64);
            }
            // Update gallery progressively
            setGalleryImages([...generatedImages]);
          } else {
            console.warn(`Image generation failed for ${perspective.key}`);
          }
        } catch {
          console.warn(`Image generation failed for ${perspective.key}`);
        }
      }

      if (generatedImages.length === 0) {
        toast.warning('Bilder konnten nicht generiert werden. Die Landing Page wird ohne Bilder erstellt.');
      } else {
        toast.success(`${generatedImages.length} von ${total} Bilder erfolgreich generiert.`);
      }

      setAppState('preview');
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      setAppState('idle');
    }
  }, []);

  const handleReset = useCallback(() => {
    setAppState('idle');
    setVehicleData(null);
    setImageBase64(null);
    setGalleryImages([]);
    setImageProgress({ current: 0, total: 0 });
    setFileName('');
  }, []);

  const isProcessing = appState === 'uploading' || appState === 'analyzing' || appState === 'generating-image';

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
          <span className="text-xs text-muted-foreground">Landing Page Generator</span>
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
        </main>
      )}
    </div>
  );
};

export default Index;
