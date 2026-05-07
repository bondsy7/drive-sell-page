import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, Video, Loader2, Download, RotateCcw, Play, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import ProcessTimer from '@/components/ProcessTimer';
import { Badge } from '@/components/ui/badge';
import VehicleAssetPicker from '@/components/VehicleAssetPicker';
import { useVehicleAssets } from '@/hooks/useVehicleAssets';
import { useBackgroundTasks } from '@/contexts/BackgroundTasksContext';
import { useAuth } from '@/hooks/useAuth';
import { ensureVehicleAuto } from '@/lib/vehicle-utils';

interface VideoGeneratorProps {
  onBack: () => void;
  /** Pre-loaded image from another workflow */
  preloadedImage?: string;
  /** When set, the generated video is stored under {userId}/{vehicleId}/videos/... so it appears in the vehicle's Videos tab. */
  vehicleId?: string | null;
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

/**
 * Crop/pad an image data URL to a target aspect ratio.
 * Veo image-to-video derives the output aspect from the input image — so we
 * must pre-shape the image to match the user-selected format (16:9 or 9:16).
 * Strategy: cover-crop (fill the target frame, crop overflow) — keeps the car
 * dominant and avoids letterboxing.
 */
async function cropImageToAspect(dataUrl: string, aspect: '16:9' | '9:16'): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetRatio = aspect === '16:9' ? 16 / 9 : 9 / 16;
      // Pick canvas size: keep largest dimension up to 1280
      const maxDim = 1280;
      let cw: number, ch: number;
      if (targetRatio >= 1) { cw = maxDim; ch = Math.round(maxDim / targetRatio); }
      else { ch = maxDim; cw = Math.round(maxDim * targetRatio); }

      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }

      // Cover-fit: scale image to fill canvas, crop overflow
      const srcRatio = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcRatio > targetRatio) {
        // source wider than target → crop sides
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else if (srcRatio < targetRatio) {
        // source taller than target → crop top/bottom
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ onBack, preloadedImage, vehicleId }) => {
  const [imageBase64, setImageBase64] = useState<string | null>(preloadedImage || null);
  const [videoState, setVideoState] = useState<VideoState>('idle');
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [pollProgress, setPollProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [autoPromptShown, setAutoPromptShown] = useState(false);
  const { data: vehicleAssets } = useVehicleAssets(vehicleId);
  const bgTasks = useBackgroundTasks();

  // Auto-open picker when vehicle has existing assets and no image preloaded
  useEffect(() => {
    if (autoPromptShown) return;
    if (!vehicleId || preloadedImage || imageBase64) return;
    if (vehicleAssets && vehicleAssets.total > 0) {
      setAssetPickerOpen(true);
      setAutoPromptShown(true);
    }
  }, [vehicleId, preloadedImage, imageBase64, vehicleAssets, autoPromptShown]);

  /** Convert remote URL → base64 data URL (same format as upload). */
  const urlToBase64 = useCallback(async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('urlToBase64 failed:', e);
      return null;
    }
  }, []);

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
      // Pre-crop the source image to the requested aspect — Veo uses the
      // input image's aspect for image-to-video and otherwise ignores the
      // aspectRatio parameter, producing the wrong format.
      const shapedImage = await cropImageToAspect(imageBase64, aspectRatio);

      // Upload via Gemini File API to keep payload small (edge function resolves it back to bytes for Veo).
      const { uploadToGeminiFiles } = await import('@/lib/gemini-file-upload');
      const refs = await uploadToGeminiFiles([{ imageBase64: shapedImage }]);

      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          action: 'start',
          ...(refs?.[0] ? { imageFileUri: refs[0] } : { imageBase64: shapedImage }),
          prompt: customPrompt || undefined,
          aspectRatio,
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

      // Polling läuft im BackgroundTasksProvider weiter, auch wenn die Seite verlassen wird.
      setVideoState('polling');
      toast.success('Video wird im Hintergrund erstellt – du kannst die Seite verlassen.');

      bgTasks.startVideoPolling({
        operationName,
        vehicleId: vehicleId || undefined,
        onDone: (result) => {
          if (result.error) {
            setVideoState('error');
            setErrorMessage(result.error);
            return;
          }
          const videoSrc = result.videoUrl || result.videoBase64 || result.videoUri;
          if (videoSrc) {
            setVideoBase64(videoSrc);
            setVideoState('done');
            setPollProgress(100);
          }
        },
      });

      // Lokaler Fortschritts-Spinner als visueller Hinweis (nur wenn Komponente noch sichtbar ist)
      let attempts = 0;
      const maxAttempts = 90;
      pollIntervalRef.current = setInterval(() => {
        attempts++;
        setPollProgress(Math.min((attempts / maxAttempts) * 100, 95));
        if (attempts >= maxAttempts && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      }, 5000);
    } catch (err: any) {
      console.error('Video generation error:', err);
      setVideoState('error');
      setErrorMessage(err.message || 'Fehler bei der Video-Generierung');
      toast.error(err.message || 'Fehler bei der Video-Generierung');
    }
  }, [imageBase64, customPrompt, aspectRatio, vehicleId, bgTasks]);

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
          <div className="space-y-2">
            {vehicleId && vehicleAssets && vehicleAssets.total > 0 && (
              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-accent/40 bg-accent/5 hover:bg-accent/10 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-md bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Vorhandene Bilder verwenden ({vehicleAssets.total - vehicleAssets.video.length})</p>
                  <p className="text-[10px] text-muted-foreground">
                    Banner {vehicleAssets.banner.length} · Galerie {vehicleAssets.gallery.length} · Original {vehicleAssets.original.length}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">0 Credits</Badge>
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-8 hover:border-accent/50 transition-colors flex flex-col items-center gap-2 text-muted-foreground"
            >
              <Upload className="w-8 h-8" />
              <span className="text-sm font-medium">Bild hochladen</span>
              <span className="text-xs">JPG, PNG, WebP – max. 10 MB</span>
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Format</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: '16:9', label: 'Querformat 16:9', hint: 'Web, YouTube, Showroom' },
            { v: '9:16', label: 'Hochformat 9:16', hint: 'Reels, TikTok, Stories' },
          ] as const).map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setAspectRatio(opt.v)}
              disabled={isProcessing}
              className={`rounded-lg border p-3 text-left transition-colors ${
                aspectRatio === opt.v
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-background hover:border-accent/50'
              }`}
            >
              <div className="text-sm font-medium text-foreground">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.hint}</div>
            </button>
          ))}
        </div>
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
                Dies kann 2–5 Minuten dauern. Du kannst die Seite verlassen – der Status wird unten rechts angezeigt.
              </p>
            </div>
          </div>
          <Progress value={pollProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <ProcessTimer running label="Dauer" />
            <span>{Math.round(pollProgress)}%</span>
          </div>
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

      <VehicleAssetPicker
        open={assetPickerOpen}
        vehicleId={vehicleId}
        multi={false}
        allowedKinds={['banner', 'gallery', 'original']}
        title="Bild als Startframe wählen"
        description="Wähle ein vorhandenes Bild aus diesem Fahrzeug — z. B. einen bereits generierten Banner oder Galeriebild — als Startframe für das Video."
        onCancel={() => setAssetPickerOpen(false)}
        onConfirm={async (assets) => {
          setAssetPickerOpen(false);
          const url = assets[0]?.url;
          if (!url) return;
          // If it's already a data URL, use as-is; otherwise fetch and convert.
          if (url.startsWith('data:')) {
            setImageBase64(url);
          } else {
            const b64 = await urlToBase64(url);
            if (b64) setImageBase64(b64);
            else toast.error('Bild konnte nicht geladen werden.');
          }
        }}
      />
    </div>
  );
};

export default VideoGenerator;
