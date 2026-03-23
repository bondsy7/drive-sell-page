import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Film, Check, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface Video2FramesProcessorProps {
  videoUrl: string;
  jobId: string;
  userId: string;
  referenceImageBase64?: string;
  targetFrames?: number;
  onComplete: (frameUrls: string[]) => void;
  onError: (error: string) => void;
}

type ProcessorStep = 'loading' | 'extracting' | 'uploading' | 'saving' | 'done' | 'error';

const START_TRIM_RATIO = 0.18;
const MIN_START_TRIM_SECONDS = 1.2;
const MAX_START_TRIM_RATIO = 0.3;
const MIN_EXTRACTION_WINDOW_SECONDS = 2;
const END_TRIM_SECONDS = 0.05;
const TARGET_FRAME_INTERVAL_SECONDS = 0.1;
const MAX_DYNAMIC_FRAMES = 72;
const REFERENCE_SCAN_STEP_SECONDS = 0.2;
const REFERENCE_DIFFERENCE_THRESHOLD = 0.14;
const REFERENCE_STABLE_MATCHES = 2;
const REFERENCE_SAFETY_BUFFER_SECONDS = 0.25;
const MAX_REFERENCE_SCAN_SECONDS = 3;

const loadImageElement = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Referenzbild konnte nicht geladen werden.'));
  image.src = src;
});

const calculateFrameDifference = (frameData: Uint8ClampedArray, referenceData: Uint8ClampedArray) => {
  let difference = 0;

  for (let i = 0; i < frameData.length; i += 4) {
    difference += Math.abs(frameData[i] - referenceData[i]);
    difference += Math.abs(frameData[i + 1] - referenceData[i + 1]);
    difference += Math.abs(frameData[i + 2] - referenceData[i + 2]);
  }

  return difference / ((frameData.length / 4) * 255 * 3);
};

const Video2FramesProcessor: React.FC<Video2FramesProcessorProps> = ({
  videoUrl, jobId, userId, referenceImageBase64, targetFrames = 48, onComplete, onError
}) => {
  const [step, setStep] = useState<ProcessorStep>('loading');
  const [progress, setProgress] = useState(0);
  const [extractedCount, setExtractedCount] = useState(0);
  const [plannedFrameCount, setPlannedFrameCount] = useState(targetFrames);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingRef = useRef(false);

  const extractFrames = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const duration = video.duration;
    const requestedStartTrim = Math.max(duration * START_TRIM_RATIO, MIN_START_TRIM_SECONDS);
    const maxSafeStartTrim = Math.max(duration * MAX_START_TRIM_RATIO, 0);
    let extractionStart = Math.max(0, Math.min(requestedStartTrim, maxSafeStartTrim));

    if (referenceImageBase64) {
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = 64;
      analysisCanvas.height = 64;
      const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });

      if (analysisContext) {
        const referenceImage = await loadImageElement(referenceImageBase64);
        analysisContext.drawImage(referenceImage, 0, 0, 64, 64);
        const referenceImageData = analysisContext.getImageData(0, 0, 64, 64).data;

        let stableDifferentFrames = 0;
        const scanLimit = Math.min(MAX_REFERENCE_SCAN_SECONDS, Math.max(0, duration - MIN_EXTRACTION_WINDOW_SECONDS));

        for (let time = 0; time <= scanLimit; time += REFERENCE_SCAN_STEP_SECONDS) {
          await new Promise<void>((resolve) => {
            video.currentTime = time;
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              analysisContext.clearRect(0, 0, 64, 64);
              analysisContext.drawImage(video, 0, 0, 64, 64);
              const frameImageData = analysisContext.getImageData(0, 0, 64, 64).data;
              const difference = calculateFrameDifference(frameImageData, referenceImageData);

              if (difference >= REFERENCE_DIFFERENCE_THRESHOLD) {
                stableDifferentFrames += 1;
              } else {
                stableDifferentFrames = 0;
              }

              if (stableDifferentFrames >= REFERENCE_STABLE_MATCHES) {
                extractionStart = Math.max(
                  extractionStart,
                  Math.min(
                    time + REFERENCE_SAFETY_BUFFER_SECONDS,
                    Math.max(0, duration - MIN_EXTRACTION_WINDOW_SECONDS - END_TRIM_SECONDS),
                  ),
                );
              }

              resolve();
            };

            video.addEventListener('seeked', onSeeked);
          });

          if (stableDifferentFrames >= REFERENCE_STABLE_MATCHES) {
            break;
          }
        }
      }
    }

    const extractionEnd = Math.max(extractionStart, duration - END_TRIM_SECONDS);
    const extractionWindow = extractionEnd - extractionStart;

    if (extractionWindow < MIN_EXTRACTION_WINDOW_SECONDS) {
      throw new Error('Das generierte Video ist zu kurz für eine saubere 360°-Extraktion.');
    }

    const effectiveFrameCount = Math.min(
      MAX_DYNAMIC_FRAMES,
      Math.max(targetFrames, Math.round(extractionWindow / TARGET_FRAME_INTERVAL_SECONDS)),
    );
    const interval = effectiveFrameCount > 1 ? extractionWindow / (effectiveFrameCount - 1) : extractionWindow;
    const frames: { index: number; blob: Blob }[] = [];
    setPlannedFrameCount(effectiveFrameCount);

    setStep('extracting');

    for (let i = 0; i < effectiveFrameCount; i++) {
      const time = Math.min(extractionEnd, extractionStart + i * interval);
      await new Promise<void>((resolve) => {
        video.currentTime = time;
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) frames.push({ index: i, blob });
            setExtractedCount(i + 1);
            setProgress(Math.round(((i + 1) / effectiveFrameCount) * 50));
            resolve();
          }, 'image/jpeg', 0.92);
        };
        video.addEventListener('seeked', onSeeked);
      });
    }

    // Upload frames to storage
    setStep('uploading');
    const frameUrls: string[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const filePath = `${userId}/spin360/${jobId}/frame_${String(frame.index).padStart(3, '0')}.jpg`;
      const arrayBuffer = await frame.blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('vehicle-images')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error(`Frame ${i} upload error:`, uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage.from('vehicle-images').getPublicUrl(filePath);
      frameUrls.push(urlData.publicUrl);
      setProgress(50 + Math.round(((i + 1) / frames.length) * 40));
    }

    // Save to DB
    setStep('saving');
    const frameCount = frameUrls.length || targetFrames;
    const rows = frameUrls.map((url, i) => ({
      job_id: jobId,
      user_id: userId,
      frame_index: i,
      image_url: url,
      frame_type: 'video_extracted',
      angle_degrees: Math.round((360 / frameCount) * i),
      model_used: 'veo-3.1-generate-preview',
      validation_status: 'passed',
    }));

    await supabase.from('spin360_generated_frames' as any).insert(rows as any);

    // Update job status
    await supabase
      .from('spin360_jobs' as any)
      .update({ status: 'completed', target_frame_count: frameUrls.length, updated_at: new Date().toISOString() } as any)
      .eq('id', jobId);

    setProgress(100);
    setStep('done');
    onComplete(frameUrls);
  }, [jobId, onComplete, referenceImageBase64, targetFrames, userId]);

  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.duration === 0 || isNaN(video.duration)) return;
    extractFrames().catch((err) => {
      console.error('Frame extraction failed:', err);
      setStep('error');
      onError(String(err));
    });
  }, [extractFrames, onError]);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('Video load error:', e);
    setStep('error');
    onError('Video konnte nicht geladen werden. Möglicherweise CORS-Problem.');
  }, [onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Add cache buster to avoid CORS cache issues
    const separator = videoUrl.includes('?') ? '&' : '?';
    video.src = `${videoUrl}${separator}t=${Date.now()}`;
    video.load();
  }, [videoUrl]);

  const stepLabel = {
    loading: 'Video wird geladen…',
    extracting: `Frames extrahieren (${extractedCount}/${plannedFrameCount})…`,
    uploading: 'Frames werden hochgeladen…',
    saving: 'Frames werden gespeichert…',
    done: 'Fertig!',
    error: 'Fehler beim Verarbeiten',
  }[step];

  const stepIcon = {
    loading: <Loader2 className="w-4 h-4 animate-spin" />,
    extracting: <Film className="w-4 h-4 animate-pulse" />,
    uploading: <Loader2 className="w-4 h-4 animate-spin" />,
    saving: <Loader2 className="w-4 h-4 animate-spin" />,
    done: <Check className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-destructive" />,
  }[step];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
        {stepIcon}
        <span>{stepLabel}</span>
      </div>
      <Progress value={progress} className="h-2" />
      {/* Hidden video + canvas */}
      <video
        ref={videoRef}
        className="hidden"
        crossOrigin="anonymous"
        muted
        playsInline
        preload="auto"
        onLoadedData={handleVideoLoaded}
        onError={handleVideoError}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Video2FramesProcessor;