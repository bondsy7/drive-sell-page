import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Car } from 'lucide-react';
import PDFUpload from '@/components/PDFUpload';
import ProcessingStatus from '@/components/ProcessingStatus';
import LandingPagePreview from '@/components/LandingPagePreview';
import { extractTextFromPDF } from '@/lib/pdf-utils';
import { supabase } from '@/integrations/supabase/client';
import type { AppState, VehicleData } from '@/types/vehicle';

const Index = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    setFileName(file.name);

    try {
      // Step 1: Extract text
      setAppState('uploading');
      const pdfText = await extractTextFromPDF(file);

      if (!pdfText || pdfText.length < 20) {
        toast.error('Der PDF-Text konnte nicht extrahiert werden. Bitte versuche eine andere Datei.');
        setAppState('idle');
        return;
      }

      // Step 2: Analyze with AI
      setAppState('analyzing');
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-pdf', {
        body: { pdfText },
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

      const { imagePrompt, ...vehicleInfo } = analysisData;
      setVehicleData(vehicleInfo as VehicleData);

      // Step 3: Generate image
      setAppState('generating-image');
      try {
        const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-vehicle-image', {
          body: { imagePrompt },
        });

        if (!imageError && imageData?.imageBase64) {
          setImageBase64(imageData.imageBase64);
        } else {
          console.warn('Image generation failed, continuing without image');
          toast.warning('Bild konnte nicht generiert werden. Die Landing Page wird ohne Bild erstellt.');
        }
      } catch {
        console.warn('Image generation failed');
        toast.warning('Bild konnte nicht generiert werden.');
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
    setFileName('');
  }, []);

  const isProcessing = appState === 'uploading' || appState === 'analyzing' || appState === 'generating-image';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Car className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-sm">AutoPage</span>
          </div>
          <span className="text-xs text-muted-foreground">Landing Page Generator</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {appState === 'idle' && (
          <div className="space-y-8">
            <div className="text-center max-w-lg mx-auto">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
                PDF hochladen,<br />
                <span className="text-accent">Landing Page generieren</span>
              </h1>
              <p className="text-muted-foreground text-sm">
                Lade ein Fahrzeugangebot als PDF hoch. Die KI erstellt automatisch eine professionelle Verkaufsseite mit generiertem Fahrzeugbild.
              </p>
            </div>
            <PDFUpload onFileSelected={handleFileSelected} isProcessing={false} />
          </div>
        )}

        {isProcessing && (
          <div className="mt-16">
            <ProcessingStatus state={appState} fileName={fileName} />
          </div>
        )}

        {appState === 'preview' && vehicleData && (
          <LandingPagePreview
            vehicleData={vehicleData}
            imageBase64={imageBase64}
            onReset={handleReset}
            onDataChange={setVehicleData}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
