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

const SPIN360_VIDEO_PROMPT = `A seamless, perfect 360-degree rotation of the provided car. The car is placed realistically on the turntable inside the provided empty showroom environment. The camera is mounted on a tripod, completely locked, and perfectly static. The car rotates smoothly around its own vertical center axis at a constant speed. No audio, no background shifting, and no original backgrounds from the reference images. The entire sequence happens strictly inside the showroom lighting and environment. Do not mention any specific car brands.`;

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

  /* ─── Video2Frames Flow (refactored: 3 images) ─── */
  const pollVideoOperation = useCallback(async (operationName: string, currentJobId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 10 min max
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      try {
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
          await supabase.from('spin360_jobs' as any)
            .update({ status: 'failed', error_message: pollResult.error || 'Kein Video in der Antwort', updated_at: new Date().toISOString() } as any)
            .eq('id', currentJobId);
          setJobStatus('failed');
          setJobError(pollResult.error || 'Kein Video in der Antwort');
          setIsProcessing(false);
          return;
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }
    await supabase.from('spin360_jobs' as any)
      .update({ status: 'failed', error_message: 'Timeout bei Video-Generierung', updated_at: new Date().toISOString() } as any)
      .eq('id', currentJobId);
    setJobStatus('failed'); setJobError('Timeout bei Video-Generierung'); setIsProcessing(false);
  }, []);

  const startVideo2Frames = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    setCreditDialogOpen(false);
    setPhase('processing');
    setIsProcessing(true);
    setJobStatus('generating_video');
    setJobError(null);

    try {
      // Upload source images (front_34, rear_34, showroom)
      const sourceUrls: { perspective: string; url: string }[] = [];
      for (const slot of uploadedSlots) {
        if (!slot.base64) continue;
        const url = await uploadImageToStorage(
          slot.base64, user.id,
          `spin360/sources/${slot.perspective}_${Date.now()}.jpg`,
        );
        if (url) sourceUrls.push({ perspective: slot.perspective, url });
      }

      if (sourceUrls.length < 3) {
        toast.error('Fehler beim Hochladen der Bilder');
        setPhase('upload'); setIsProcessing(false); return;
      }

      // Create spin job with video mode
      const { data: job, error: jobErr } = await supabase
        .from('spin360_jobs' as any)
        .insert({ user_id: user.id, status: 'generating_video', target_frame_count: 36 } as any)
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

      // Collect base64 images for all 3 inputs
      const frontSlot = uploadedSlots.find(s => s.perspective === 'front_34');
      const rearSlot = uploadedSlots.find(s => s.perspective === 'rear_34');
      const showroomSlot = uploadedSlots.find(s => s.perspective === 'showroom');

      const images: { base64: string; label: string }[] = [];
      if (frontSlot?.base64) images.push({ base64: frontSlot.base64, label: 'front_34' });
      if (rearSlot?.base64) images.push({ base64: rearSlot.base64, label: 'rear_34' });
      if (showroomSlot?.base64) images.push({ base64: showroomSlot.base64, label: 'showroom' });

      // Start video generation with all 3 images
      const { data: startResult, error: startError } = await supabase.functions.invoke('generate-video', {
        body: {
          action: 'spin360_start',
          images,
          prompt: SPIN360_VIDEO_PROMPT,
          jobId: newJobId,
        },
      });

      if (startError || startResult?.error) {
        await supabase.from('spin360_jobs' as any)
          .update({ status: 'failed', error_message: startResult?.error || 'Video-Generierung fehlgeschlagen', updated_at: new Date().toISOString() } as any)
          .eq('id', newJobId);
        setJobStatus('failed');
        setJobError(startResult?.error || 'Video-Generierung fehlgeschlagen');
        setIsProcessing(false);
        return;
      }

      const operationName = startResult?.operationName;
      if (!operationName) {
        await supabase.from('spin360_jobs' as any)
          .update({ status: 'failed', error_message: 'Keine Operation-ID erhalten', updated_at: new Date().toISOString() } as any)
          .eq('id', newJobId);
        setJobStatus('failed'); setJobError('Keine Operation-ID erhalten'); setIsProcessing(false); return;
      }

      // Persist operationName in job manifest for recovery
      await supabase.from('spin360_jobs' as any)
        .update({ manifest: { operationName, videoMode: true } as any, updated_at: new Date().toISOString() } as any)
        .eq('id', newJobId);

      // Poll for video completion
      pollVideoOperation(operationName, newJobId);
    } catch (err) {
      console.error('Video2Frames error:', err);
      setJobStatus('failed'); setJobError('Unerwarteter Fehler'); setIsProcessing(false);
    }
  }, [user, uploadedSlots, pollVideoOperation]);

  const startProcessing = useCallback(() => {
    if (spinMode === 'video2frames') startVideo2Frames();
    else startImage2Spin();
  }, [spinMode, startVideo2Frames, startImage2Spin]);

  // Recovery: on mount, check for stuck video2frames jobs and resume polling
  useEffect(() => {
    if (!user) return;
    const recoverStuckJob = async () => {
      const { data } = await supabase
        .from('spin360_jobs' as any)
        .select('id, status, manifest, target_frame_count')
        .eq('user_id', user.id)
        .eq('status', 'generating_video')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!data || (data as any[]).length === 0) return;
      const stuckJob = (data as any[])[0];
      const manifest = stuckJob.manifest as any;
      const operationName = manifest?.operationName;

      if (!operationName) {
        await supabase.from('spin360_jobs' as any)
          .update({ status: 'failed', error_message: 'Job wurde unterbrochen (keine Operation-ID)', updated_at: new Date().toISOString() } as any)
          .eq('id', stuckJob.id);
        return;
      }

      const jobAge = Date.now() - new Date(stuckJob.updated_at || stuckJob.created_at).getTime();
      if (jobAge > 15 * 60 * 1000) {
        await supabase.from('spin360_jobs' as any)
          .update({ status: 'failed', error_message: 'Job-Timeout: Video-Generierung dauerte zu lange', updated_at: new Date().toISOString() } as any)
          .eq('id', stuckJob.id);
        return;
      }

      setJobId(stuckJob.id);
      setSpinMode('video2frames');
      setPhase('processing');
      setJobStatus('generating_video');
      setIsProcessing(true);
      toast.info('Laufender Video-Spin wird fortgesetzt…');
      pollVideoOperation(operationName, stuckJob.id);
    };
    recoverStuckJob();
  }, [user, pollVideoOperation]);

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
              ? '3 Bilder → KI-Video → 36 Frames'
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
          targetFrames={36}
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
