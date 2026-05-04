import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, Video, Loader2, Download, RotateCcw, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface VideoGeneratorProps {
  onBack: () => void;
  /** Pre-loaded image from another workflow */
  preloadedImage?: string;
}

type VideoState = 'idle' | 'uploading' | 'generating' | 'polling' | 'done' | 'error';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ onBack, preloadedImage }) => {
  const [imageBase64, setImageBase64] = useState<string | null>(preloadedImage || null);
  const [videoState, setVideoState] = useState<VideoState>('idle');
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [pollProgress, setPollProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte ein Bild hochladen');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Max. 10 MB');
      return;
    }
    const base64 = await fileToBase64(file);
    setImageBase64(base64);
    setVideoBase64(null);
    setVideoState('idle');
  }, []);

  const startGeneration = useCallback(async () => {
    if (!imageBase64) {
      toast.error('Bitte zuerst ein Bild hochladen');
      return;
    }

    setVideoState('generating');
    setErrorMessage('');
    setPollProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          action: 'start',
          imageBase64,
          prompt: customPrompt || undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        if (data.error === 'insufficient_credits') {
          toast.error(`Nicht genügend Credits. Guthaben: ${data.balance}, benötigt: ${data.cost}`);
          setVideoState('error');
          setErrorMessage('Nicht genügend Credits');
          return;
        }
        throw new Error(data.error);
      }

      const operationName = data.operationName;
      if (!operationName) throw new Error('Keine Operation-ID erhalten');

      // Start polling
      setVideoState('polling');
      let attempts = 0;
      const maxAttempts = 60; // 5 min max

      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        setPollProgress(Math.min((attempts / maxAttempts) * 100, 95));

        try {
          const { data: pollData, error: pollError } = await supabase.functions.invoke('generate-video', {
            body: { action: 'poll', operationName, vehicleId: vehicleId || undefined },
          });

          if (pollError) {
            console.error('Poll error:', pollError);
            return;
          }

          if (pollData?.done) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

            const videoSrc = pollData.videoUrl || pollData.videoBase64 || pollData.videoUri;
            if (videoSrc) {
              setVideoBase64(videoSrc);
              setVideoState('done');
              setPollProgress(100);
              toast.success('Video erfolgreich erstellt!');
            } else {
              setVideoState('error');
              setErrorMessage(pollData.error || 'Unbekannter Fehler');
              toast.error('Video-Generierung fehlgeschlagen');
            }
          }

          if (attempts >= maxAttempts) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setVideoState('error');
            setErrorMessage('Zeitüberschreitung – bitte erneut versuchen');
          }
        } catch (e) {
          console.error('Poll exception:', e);
        }
      }, 5000);
    } catch (err: any) {
      console.error('Video generation error:', err);
      setVideoState('error');
      setErrorMessage(err.message || 'Fehler bei der Video-Generierung');
      toast.error(err.message || 'Fehler bei der Video-Generierung');
    }
  }, [imageBase64, customPrompt]);

  const handleDownload = useCallback(() => {
    if (!videoBase64) return;
    const a = document.createElement('a');
    a.href = videoBase64;
    a.download = 'fahrzeug-video.mp4';
    a.click();
  }, [videoBase64]);

  const handleReset = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setVideoBase64(null);
    setVideoState('idle');
    setPollProgress(0);
    setErrorMessage('');
  }, []);

  const isProcessing = videoState === 'generating' || videoState === 'polling';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} disabled={isProcessing}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Video Erstellung</h2>
          <p className="text-sm text-muted-foreground">Lade ein Fahrzeugbild hoch und erstelle ein Showroom-Video per KI</p>
        </div>
      </div>

      {/* Image Upload */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Fahrzeugbild</label>
        {imageBase64 ? (
          <div className="relative rounded-xl overflow-hidden border border-border bg-card">
            <img src={imageBase64} alt="Fahrzeug" className="w-full max-h-64 object-contain" />
            {!isProcessing && videoState !== 'done' && (
              <button
                onClick={() => { setImageBase64(null); fileInputRef.current && (fileInputRef.current.value = ''); }}
                className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1.5 hover:bg-background transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-foreground" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-xl p-8 hover:border-accent/50 transition-colors flex flex-col items-center gap-2 text-muted-foreground"
          >
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Bild hochladen</span>
            <span className="text-xs">JPG, PNG, WebP – max. 10 MB</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Custom Prompt */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Video-Prompt <span className="text-muted-foreground font-normal">(optional – Standard wird verwendet)</span>
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="z.B. Das Auto dreht sich langsam auf einer Drehscheibe in einem modernen Showroom..."
          className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background text-foreground text-sm resize-y"
          disabled={isProcessing}
        />
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {videoState === 'generating' ? 'Video wird gestartet…' : 'Video wird generiert…'}
              </p>
              <p className="text-xs text-muted-foreground">
                Dies kann 2–5 Minuten dauern. Bitte Seite nicht schließen.
              </p>
            </div>
          </div>
          <Progress value={pollProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{Math.round(pollProgress)}%</p>
        </div>
      )}

      {/* Error */}
      {videoState === 'error' && (
        <div className="bg-destructive/10 rounded-xl border border-destructive/30 p-4 space-y-2">
          <p className="text-sm font-medium text-destructive">Fehler</p>
          <p className="text-xs text-muted-foreground">{errorMessage}</p>
          <Button variant="outline" size="sm" onClick={handleReset}>Erneut versuchen</Button>
        </div>
      )}

      {/* Result */}
      {videoState === 'done' && videoBase64 && (
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-border bg-card">
            <video
              src={videoBase64}
              controls
              autoPlay
              loop
              className="w-full max-h-[400px]"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="gap-1.5">
              <Download className="w-4 h-4" /> Video herunterladen
            </Button>
            <Button variant="outline" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="w-4 h-4" /> Neues Video
            </Button>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {videoState === 'idle' && imageBase64 && (
        <div className="space-y-2">
          <Button onClick={startGeneration} size="lg" className="w-full gap-2">
            <Play className="w-5 h-5" /> Video generieren
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Kostet <strong className="text-accent">10 Credits</strong> · Veo 3.1 · ~8 Sekunden Video
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoGenerator;
