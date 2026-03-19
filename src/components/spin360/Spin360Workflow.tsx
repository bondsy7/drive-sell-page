import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, RotateCw, Download, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import CreditConfirmDialog from '@/components/CreditConfirmDialog';
import Spin360Upload, { type SpinSlotData } from './Spin360Upload';
import Spin360Progress, { type SpinStep } from './Spin360Progress';
import Spin360Viewer from './Spin360Viewer';
import { uploadImageToStorage } from '@/lib/storage-utils';

interface Spin360WorkflowProps {
  onBack: () => void;
}

const Spin360Workflow: React.FC<Spin360WorkflowProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { balance, getCost } = useCredits();
  const [phase, setPhase] = useState<'upload' | 'confirm' | 'processing' | 'result'>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<SpinStep>('uploaded');
  const [jobError, setJobError] = useState<string | null>(null);
  const [resultFrames, setResultFrames] = useState<string[]>([]);
  const [uploadedSlots, setUploadedSlots] = useState<SpinSlotData[]>([]);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate total cost
  const analysisCost = getCost('spin360_analysis', 'standard') || 1;
  const normalizeCost = getCost('spin360_normalize', 'standard') || 4;
  const generateCost = getCost('spin360_generate', 'standard') || 15;
  const totalCost = analysisCost + normalizeCost + generateCost;

  const handleSlotsReady = useCallback((slots: SpinSlotData[]) => {
    setUploadedSlots(slots);
    setCreditDialogOpen(true);
  }, []);

  const startProcessing = useCallback(async () => {
    if (!user) { toast.error('Bitte melde dich an.'); return; }
    setCreditDialogOpen(false);
    setPhase('processing');
    setIsProcessing(true);
    setJobStatus('uploaded');
    setJobError(null);

    try {
      // 1. Upload source images to storage
      const sourceUrls: { perspective: string; url: string }[] = [];
      for (const slot of uploadedSlots) {
        if (!slot.base64) continue;
        const url = await uploadImageToStorage(
          slot.base64,
          user.id,
          `spin360/sources/${slot.perspective}_${Date.now()}.jpg`,
        );
        if (url) sourceUrls.push({ perspective: slot.perspective, url });
      }

      if (sourceUrls.length < 4) {
        toast.error('Fehler beim Hochladen der Bilder');
        setPhase('upload');
        setIsProcessing(false);
        return;
      }

      // 2. Create spin job
      const { data: job, error: jobError } = await supabase
        .from('spin360_jobs' as any)
        .insert({
          user_id: user.id,
          status: 'uploaded',
          target_frame_count: 36,
        } as any)
        .select('id')
        .single();

      if (jobError || !job) {
        console.error('Job creation error:', jobError);
        toast.error('Fehler beim Erstellen des Auftrags');
        setPhase('upload');
        setIsProcessing(false);
        return;
      }

      const newJobId = (job as any).id;
      setJobId(newJobId);

      // 3. Insert source images
      const sourceRows = sourceUrls.map((s, i) => ({
        job_id: newJobId,
        user_id: user.id,
        perspective: s.perspective,
        image_url: s.url,
        sort_order: i,
      }));
      await supabase.from('spin360_source_images' as any).insert(sourceRows as any);

      // 4. Start the pipeline via edge function
      const { data: pipelineResult, error: pipelineError } = await supabase.functions.invoke('generate-360-spin', {
        body: {
          jobId: newJobId,
          sourceImages: sourceUrls,
        },
      });

      if (pipelineError) {
        console.error('Pipeline error:', pipelineError);
        // The edge function may still be running in the background even if the fetch failed
        // (e.g. timeout on long-running function). Keep polling.
        console.log('Edge function call failed but job was created. Will poll for updates.');
        return;
      }

      if (pipelineResult?.error) {
        setJobStatus('failed');
        setJobError(pipelineResult.error);
        setIsProcessing(false);
        return;
      }

      // Pipeline started - now poll for updates
    } catch (err) {
      console.error('Start processing error:', err);
      setJobStatus('failed');
      setJobError('Unerwarteter Fehler');
      setIsProcessing(false);
    }
  }, [user, uploadedSlots]);

  // Poll job status via realtime
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`spin360-job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'spin360_jobs',
        filter: `id=eq.${jobId}`,
      }, (payload: any) => {
        const newStatus = payload.new?.status as SpinStep;
        if (newStatus) {
          setJobStatus(newStatus);
          if (newStatus === 'completed') {
            loadResultFrames(jobId);
            setIsProcessing(false);
          } else if (newStatus === 'failed' || newStatus === 'needs_review') {
            setJobError(payload.new?.error_message || 'Unbekannter Fehler');
            setIsProcessing(false);
          }
        }
      })
      .subscribe();

    // Also poll periodically as fallback
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('spin360_jobs' as any)
        .select('status, error_message')
        .eq('id', jobId)
        .single();
      if (data) {
        const s = (data as any).status as SpinStep;
        setJobStatus(s);
        if (s === 'completed') {
          loadResultFrames(jobId);
          setIsProcessing(false);
          clearInterval(pollInterval);
        } else if (s === 'failed' || s === 'needs_review') {
          setJobError((data as any).error_message || 'Unbekannter Fehler');
          setIsProcessing(false);
          clearInterval(pollInterval);
        }
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [jobId]);

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

  const handleExportFrames = useCallback(async () => {
    if (resultFrames.length === 0) return;
    // Create a simple manifest
    const manifest = {
      jobId,
      frameCount: resultFrames.length,
      createdAt: new Date().toISOString(),
      frames: resultFrames,
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spin360_${jobId?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Manifest exportiert');
  }, [resultFrames, jobId]);

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
            4 Fotos hochladen – KI erstellt den Rest automatisch
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
        <Spin360Upload onAllFilled={handleSlotsReady} disabled={isProcessing} />
      )}

      {/* Phase: Processing */}
      {phase === 'processing' && (
        <Spin360Progress currentStep={jobStatus} error={jobError} />
      )}

      {/* Phase: Result */}
      {phase === 'result' && resultFrames.length > 0 && (
        <div className="space-y-6">
          <Spin360Viewer frames={resultFrames} autoplay autoplaySpeed={100} />
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={handleExportFrames}>
              <Download className="w-4 h-4 mr-2" /> Manifest exportieren
            </Button>
            <Button onClick={() => { setPhase('upload'); setResultFrames([]); setJobId(null); }}>
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
        actionLabel="360° Spin starten"
        isProcessing={isProcessing}
        onConfirm={startProcessing}
        onCancel={() => setCreditDialogOpen(false)}
      />
    </div>
  );
};

export default Spin360Workflow;
