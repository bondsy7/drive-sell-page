import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, RotateCw, Download, Zap, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import CreditConfirmDialog from '@/components/CreditConfirmDialog';
import Spin360Upload, { type SpinSlotData, type SpinMode } from './Spin360Upload';
import Spin360Progress, { type SpinStep } from './Spin360Progress';
import Spin360Viewer from './Spin360Viewer';
import Video2FramesProcessor from './Video2FramesProcessor';
import { uploadImageToStorage } from '@/lib/storage-utils';

interface Spin360WorkflowProps {
  onBack: () => void;
}

const SPIN360_VIDEO_PROMPT = `Professional 360-degree turntable rotation of the exact vehicle shown in the reference images. The car rotates smoothly and continuously on a white turntable platform, completing exactly one full 360-degree rotation. Clean white studio background, soft even lighting, no shadows. Perfectly steady camera at eye level, fixed position. No sound. Smooth constant rotation speed. 8 seconds duration for one complete revolution.`;

const Spin360Workflow: React.FC<Spin360WorkflowProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { balance, getCost } = useCredits();
  const [phase, setPhase] = useState<'upload' | 'confirm' | 'processing' | 'video_extracting' | 'result'>('upload');
  const [spinMode, setSpinMode] = useState<SpinMode>('image2spin');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<SpinStep>('uploaded');
  const [jobError, setJobError] = useState<string | null>(null);
  const [resultFrames, setResultFrames] = useState<string[]>([]);
  const [uploadedSlots, setUploadedSlots] = useState<SpinSlotData[]>([]);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Calculate total cost based on mode
  const imageCost = (getCost('spin360_analysis', 'standard') || 1) +
    (getCost('spin360_normalize', 'standard') || 4) +
    (getCost('spin360_generate', 'standard') || 15);
  const videoCost = getCost('spin360_video', 'standard') || 10;
  const totalCost = spinMode === 'video2frames' ? videoCost : imageCost;

  const handleSlotsReady = useCallback((slots: SpinSlotData[]) => {
    setUploadedSlots(slots);
    setCreditDialogOpen(true);
  }, []);

  /* ─── Image2Spin Flow (existing) ─── */
  const startImage2Spin = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    setCreditDialogOpen(false);
    setPhase('processing');
    setIsProcessing(true);
    setJobStatus('uploaded');
    setJobError(null);

    try {
      const sourceUrls: { perspective: string; url: string }[] = [];
      for (const slot of uploadedSlots) {
        if (!slot.base64) continue;
        const url = await uploadImageToStorage(
          slot.base64, user.id,
          `spin360/sources/${slot.perspective}_${Date.now()}.jpg`,
        );
        if (url) sourceUrls.push({ perspective: slot.perspective, url });
      }

      if (sourceUrls.length < 4) {
        toast.error('Fehler beim Hochladen der Bilder');
        setPhase('upload'); setIsProcessing(false); return;
      }

      const { data: job, error: jobErr } = await supabase
        .from('spin360_jobs' as any)
        .insert({ user_id: user.id, status: 'uploaded', target_frame_count: 36 } as any)
        .select('id').single();

      if (jobErr || !job) {
        toast.error('Fehler beim Erstellen des Auftrags');
        setPhase('upload'); setIsProcessing(false); return;
      }

      const newJobId = (job as any).id;
      setJobId(newJobId);

      const sourceRows = sourceUrls.map((s, i) => ({
        job_id: newJobId, user_id: user.id, perspective: s.perspective, image_url: s.url, sort_order: i,
      }));
      await supabase.from('spin360_source_images' as any).insert(sourceRows as any);

      const { data: pipelineResult, error: pipelineError } = await supabase.functions.invoke('generate-360-spin', {
        body: { jobId: newJobId, sourceImages: sourceUrls },
      });

      if (pipelineError) {
        console.log('Edge function call failed but job was created. Will poll for updates.');
        return;
      }
      if (pipelineResult?.error) {
        setJobStatus('failed'); setJobError(pipelineResult.error); setIsProcessing(false); return;
      }
    } catch (err) {
      console.error('Start processing error:', err);
      setJobStatus('failed'); setJobError('Unerwarteter Fehler'); setIsProcessing(false);
    }
  }, [user, uploadedSlots]);

  /* ─── Video2Frames Flow ─── */
  const startVideo2Frames = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    setCreditDialogOpen(false);
    setPhase('processing');
    setIsProcessing(true);
    setJobStatus('generating_video');
    setJobError(null);

    try {
      // Upload source images
      const sourceUrls: { perspective: string; url: string }[] = [];
      for (const slot of uploadedSlots) {
        if (!slot.base64) continue;
        const url = await uploadImageToStorage(
          slot.base64, user.id,
          `spin360/sources/${slot.perspective}_${Date.now()}.jpg`,
        );
        if (url) sourceUrls.push({ perspective: slot.perspective, url });
      }

      if (sourceUrls.length < 4) {
        toast.error('Fehler beim Hochladen der Bilder');
        setPhase('upload'); setIsProcessing(false); return;
      }

      // Create spin job with video mode
      const { data: job, error: jobErr } = await supabase
        .from('spin360_jobs' as any)
        .insert({ user_id: user.id, status: 'generating_video', target_frame_count: 48 } as any)
        .select('id').single();

      if (jobErr || !job) {
        toast.error('Fehler beim Erstellen des Auftrags');
        setPhase('upload'); setIsProcessing(false); return;
      }

      const newJobId = (job as any).id;
      setJobId(newJobId);

      // Save source images
      const sourceRows = sourceUrls.map((s, i) => ({
        job_id: newJobId, user_id: user.id, perspective: s.perspective, image_url: s.url, sort_order: i,
      }));
      await supabase.from('spin360_source_images' as any).insert(sourceRows as any);

      // Use the front image as reference for video generation
      const frontSlot = uploadedSlots.find(s => s.perspective === 'front');
      const imageBase64 = frontSlot?.base64 || uploadedSlots[0]?.base64;

      // Start video generation
      const { data: startResult, error: startError } = await supabase.functions.invoke('generate-video', {
        body: { action: 'spin360_start', imageBase64, prompt: SPIN360_VIDEO_PROMPT, jobId: newJobId },
      });

      if (startError || startResult?.error) {
        setJobStatus('failed');
        setJobError(startResult?.error || 'Video-Generierung fehlgeschlagen');
        setIsProcessing(false);
        return;
      }

      const operationName = startResult?.operationName;
      if (!operationName) {
        setJobStatus('failed'); setJobError('Keine Operation-ID erhalten'); setIsProcessing(false); return;
      }

      // Poll for video completion
      const pollVideo = async () => {
        let attempts = 0;
        const maxAttempts = 120; // 10 min max
        while (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;

          const { data: pollResult } = await supabase.functions.invoke('generate-video', {
            body: { action: 'poll', operationName },
          });

          if (pollResult?.done) {
            if (pollResult.videoUrl) {
              setVideoUrl(pollResult.videoUrl);
              setJobStatus('extracting_frames');
              setPhase('video_extracting');
              return;
            }
            setJobStatus('failed');
            setJobError(pollResult.error || 'Kein Video in der Antwort');
            setIsProcessing(false);
            return;
          }
        }
        setJobStatus('failed'); setJobError('Timeout bei Video-Generierung'); setIsProcessing(false);
      };

      pollVideo();
    } catch (err) {
      console.error('Video2Frames error:', err);
      setJobStatus('failed'); setJobError('Unerwarteter Fehler'); setIsProcessing(false);
    }
  }, [user, uploadedSlots]);

  const startProcessing = useCallback(() => {
    if (spinMode === 'video2frames') startVideo2Frames();
    else startImage2Spin();
  }, [spinMode, startVideo2Frames, startImage2Spin]);

  // Poll job status for image2spin mode
  useEffect(() => {
    if (!jobId || spinMode === 'video2frames') return;

    const channel = supabase
      .channel(`spin360-job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'spin360_jobs', filter: `id=eq.${jobId}`,
      }, (payload: any) => {
        const newStatus = payload.new?.status as SpinStep;
        if (newStatus) {
          setJobStatus(newStatus);
          if (newStatus === 'completed') { loadResultFrames(jobId); setIsProcessing(false); }
          else if (newStatus === 'failed' || newStatus === 'needs_review') {
            setJobError(payload.new?.error_message || 'Unbekannter Fehler'); setIsProcessing(false);
          }
        }
      }).subscribe();

    const pollInterval = setInterval(async () => {
      const { data } = await supabase.from('spin360_jobs' as any).select('status, error_message').eq('id', jobId).single();
      if (data) {
        const s = (data as any).status as SpinStep;
        setJobStatus(s);
        if (s === 'completed') { loadResultFrames(jobId); setIsProcessing(false); clearInterval(pollInterval); }
        else if (s === 'failed' || s === 'needs_review') {
          setJobError((data as any).error_message || 'Unbekannter Fehler'); setIsProcessing(false); clearInterval(pollInterval);
        }
      }
    }, 5000);

    return () => { supabase.removeChannel(channel); clearInterval(pollInterval); };
  }, [jobId, spinMode]);

  const loadResultFrames = useCallback(async (jId: string) => {
    const { data } = await supabase
      .from('spin360_generated_frames' as any)
      .select('image_url, frame_index')
      .eq('job_id', jId)
      .eq('validation_status', 'passed')
      .order('frame_index', { ascending: true });

    if (data && (data as any[]).length > 0) {
      setResultFrames((data as any[]).map((f: any) => f.image_url));
      setPhase('result');
    }
  }, []);

  const handleVideoFramesComplete = useCallback((frameUrls: string[]) => {
    setResultFrames(frameUrls);
    setIsProcessing(false);
    setPhase('result');
    toast.success('360° Video-Spin fertig!');
  }, []);

  const handleVideoFramesError = useCallback((error: string) => {
    setJobStatus('failed');
    setJobError(error);
    setIsProcessing(false);
    setPhase('processing');
  }, []);

  const handleExportFrames = useCallback(async () => {
    if (resultFrames.length === 0) return;
    const manifest = { jobId, frameCount: resultFrames.length, createdAt: new Date().toISOString(), frames: resultFrames };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `spin360_${jobId?.slice(0, 8)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Manifest exportiert');
  }, [resultFrames, jobId]);

  const resetWorkflow = useCallback(() => {
    setPhase('upload'); setResultFrames([]); setJobId(null);
    setVideoUrl(null); setJobStatus('uploaded'); setJobError(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} disabled={isProcessing}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">360° Spin</h2>
          <p className="text-sm text-muted-foreground">
            {spinMode === 'video2frames'
              ? '4 Fotos → KI-Video → 48 Frames'
              : '4 Fotos hochladen – KI erstellt den Rest automatisch'}
          </p>
        </div>
      </div>

      {/* Credit info */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="w-3 h-3 text-accent" />
        <span>Geschätzte Kosten: <strong className="text-accent">{totalCost} Credits</strong> — Guthaben: <strong className="text-foreground">{balance} Credits</strong></span>
      </div>

      {/* Phase: Upload */}
      {phase === 'upload' && (
        <Spin360Upload
          onAllFilled={handleSlotsReady}
          disabled={isProcessing}
          spinMode={spinMode}
          onModeChange={setSpinMode}
        />
      )}

      {/* Phase: Processing */}
      {phase === 'processing' && (
        <Spin360Progress currentStep={jobStatus} error={jobError} mode={spinMode} />
      )}

      {/* Phase: Video frame extraction */}
      {phase === 'video_extracting' && videoUrl && jobId && user && (
        <Video2FramesProcessor
          videoUrl={videoUrl}
          jobId={jobId}
          userId={user.id}
          targetFrames={48}
          onComplete={handleVideoFramesComplete}
          onError={handleVideoFramesError}
        />
      )}

      {/* Phase: Result */}
      {phase === 'result' && resultFrames.length > 0 && (
        <div className="space-y-6">
          <Spin360Viewer frames={resultFrames} autoplay autoplaySpeed={100} />
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={handleExportFrames}>
              <Download className="w-4 h-4 mr-2" /> Manifest exportieren
            </Button>
            <Button onClick={resetWorkflow}>
              <RotateCw className="w-4 h-4 mr-2" /> Neuen Spin erstellen
            </Button>
          </div>
        </div>
      )}

      {/* Credit confirmation */}
      <CreditConfirmDialog
        open={creditDialogOpen}
        cost={totalCost}
        balance={balance}
        actionLabel={spinMode === 'video2frames' ? 'Video-Spin starten' : '360° Spin starten'}
        isProcessing={isProcessing}
        onConfirm={startProcessing}
        onCancel={() => setCreditDialogOpen(false)}
      />
    </div>
  );
};

export default Spin360Workflow;