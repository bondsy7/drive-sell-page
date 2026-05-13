import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Wand2, Loader2, Crop, Image as ImageIcon, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import Step2Master from "../step2/Step2Master";
import ReframeHistoryStrip from "../step2/ReframeHistoryStrip";
import ReframeVariantsDialog from "../step2/ReframeVariantsDialog";
import ManualCropDialog from "../step2/ManualCropDialog";
import { reframeImageForFormat } from "../ai/reframeClient";
import {
  startReframeJob,
  subscribeJob,
  type ReframeJobProgress,
  type ReframeResult,
} from "../ai/reframeJobManager";
import { useBackgroundTasksSafe } from "@/contexts/BackgroundTasksContext";

import type { CanvasBannerStore } from "../state/useCanvasBannerStore";
import { getFormatById } from "../data/formats";
import type { BannerTextFieldKey } from "../state/types";

interface Props {
  store: CanvasBannerStore;
  onContinue: () => void;
}

const BildStep: React.FC<Props> = ({ store, onContinue }) => {
  const { state, actions, activeComposition, activeFormat } = store;
  const [activeBusy, setActiveBusy] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReframeJobProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number>(0);
  const bgTasks = useBackgroundTasksSafe();

  const applyReframeResult = (fid: string, newUrl: string, sourceUrl?: string) => {
    const comp = state.compositions[fid];
    const prev = comp?.backgroundImageUrl;
    if (prev && prev !== newUrl) actions.pushReframeHistory(prev, fid);
    if (sourceUrl && !comp?.masterImageUrl) actions.setMasterImage(sourceUrl, fid);
    actions.setBackground(newUrl, fid);
  };

  // Subscribe to active job (also picks up when component remounts)
  useEffect(() => {
    if (!jobId) return;
    const unsub = subscribeJob(jobId, {
      onResult: (r: ReframeResult) => {
        applyReframeResult(r.formatId, r.imageDataUrl, r.sourceUrl);
      },
      onProgress: (p) => {
        setProgress(p);
        if (bgTasks) {
          bgTasks.updateTask(jobId, {
            completed: p.done + p.failed,
            total: p.total,
            status: p.finished ? (p.failed === p.total ? "error" : "done") : "running",
            finishedAt: p.finished ? Date.now() : undefined,
            errorMessage: p.failed === p.total ? "Reframe fehlgeschlagen" : undefined,
          });
        }
        if (p.finished) {
          if (p.failed === 0) toast.success(`Reframe fertig · ${p.done} Banner`);
          else if (p.done === 0) toast.error(`Reframe fehlgeschlagen (${p.failed})`);
          else toast.message(`Reframe fertig · ${p.done} ok · ${p.failed} fehlgeschlagen`);
        }
      },
    });
    return unsub;
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick elapsed seconds while running
  useEffect(() => {
    if (!progress || progress.finished) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [progress?.finished, progress]);

  const handleReframeAll = () => {
    const src = activeComposition.backgroundImageUrl;
    if (!src || !src.startsWith("data:")) {
      toast.error("Bitte erst ein Bild übernehmen.");
      return;
    }
    if (state.selectedFormatIds.length === 0) {
      toast.error("Keine Formate ausgewählt.");
      return;
    }
    const source = activeComposition.masterImageUrl ?? src;
    const targets = state.selectedFormatIds.map((fid) => {
      const f = getFormatById(fid);
      return { formatId: fid, width: f.width, height: f.height, label: f.name };
    });
    startedAtRef.current = Date.now();
    setElapsed(0);
    const id = startReframeJob({ source, formats: targets });
    setJobId(id);
    if (bgTasks) {
      bgTasks.addTask({
        id,
        type: "banner",
        label: `Banner-Reframe · ${targets.length} Formate`,
        total: targets.length,
        completed: 0,
        status: "running",
        resultRoute: "/generator/canvas-banner-studio",
      });
    }
    toast.message(`Reframe gestartet · ${targets.length} Formate (läuft im Hintergrund)`);
  };

  const handleReframeActive = async () => {
    const src = activeComposition.backgroundImageUrl;
    if (!src || !src.startsWith("data:")) { toast.error("Bitte erst ein Bild übernehmen."); return; }
    setActiveBusy(true);
    try {
      const source = activeComposition.masterImageUrl ?? src;
      const out = await reframeImageForFormat(source, activeFormat.width, activeFormat.height);
      applyReframeResult(activeFormat.id, out.imageDataUrl, source);
      toast.success(`Bild auf ${activeFormat.name} angepasst (${out.resolution})`);
    } catch (e: any) {
      toast.error(e?.message ?? "Reframe fehlgeschlagen");
    } finally {
      setActiveBusy(false);
    }
  };

  const hasImage = !!activeComposition.backgroundImageUrl;
  const total = progress?.total ?? 0;
  const handled = (progress?.done ?? 0) + (progress?.failed ?? 0);
  const pct = total > 0 ? Math.round((handled / total) * 100) : 0;
  const isRunning = !!progress && !progress.finished;
  const avgPerFormat = progress && progress.done > 0 ? elapsed / progress.done : 0;
  const remaining = isRunning && avgPerFormat > 0
    ? Math.max(1, Math.ceil(avgPerFormat * (total - handled) / Math.max(1, 3))) // /3 = concurrency
    : 0;

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon className="w-4 h-4 text-accent" />
          <span className="text-xs uppercase tracking-wider text-accent font-semibold">Schritt 2</span>
        </div>
        <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
          Bild wählen, remastern & auf alle Formate bringen
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Lade ein Bild hoch, hol es aus der Galerie oder lass die KI ein Marketing-Master generieren.
          Dann reframen wir es passgenau für jedes Banner-Format – parallel und im Hintergrund.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Image source / remaster */}
        <div className="rounded-xl border border-border bg-card p-4">
          <Step2Master
            backgroundImageUrl={activeComposition.backgroundImageUrl}
            onApplyMaster={(url) => actions.setBackground(url)}
            onClearMaster={() => actions.setBackground(undefined)}
            onApplyFields={(fields) => {
              (Object.entries(fields) as [BannerTextFieldKey, string][]).forEach(([k, v]) => {
                if (v) actions.setText(k, v);
              });
            }}
          />
        </div>

        {/* Reframe controls */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 lg:sticky lg:top-24 self-start">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Auf Banner-Formate anpassen</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">Ideogram v3 · TURBO</span>
          </div>
          {!hasImage ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Sobald ein Bild übernommen ist, kannst du es hier auf alle gewählten Formate bringen.
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Erweitert das Bild generativ auf die exakten Banner-Maße. Läuft parallel im Hintergrund –
                du kannst weiterklicken oder die Seite wechseln.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={handleReframeActive} disabled={activeBusy || isRunning}>
                  {activeBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  Aktives Format
                </Button>
                <Button size="sm" onClick={handleReframeAll} disabled={isRunning || state.selectedFormatIds.length === 0}>
                  {isRunning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
                  Alle ({state.selectedFormatIds.length})
                </Button>
                <Button size="sm" variant="outline" onClick={() => setVariantsOpen(true)} disabled={isRunning}>
                  3 Varianten
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCropOpen(true)} disabled={isRunning}>
                  <Crop className="w-3.5 h-3.5 mr-1" /> Manuell
                </Button>
              </div>

              {progress && (
                <div className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {progress.finished ? "Fertig" : "Reframe läuft …"}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {handled}/{total} · {pct}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {progress.current ? `Zuletzt: ${progress.current}` : "Verarbeite Formate parallel"}
                      {progress.failed > 0 && (
                        <span className="ml-2 text-destructive">{progress.failed} Fehler</span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {isRunning ? `${elapsed}s${remaining > 0 ? ` · ~${remaining}s übrig` : ""}` : `${elapsed}s gesamt`}
                    </span>
                  </div>
                </div>
              )}

              <ReframeHistoryStrip
                history={activeComposition.reframeHistory ?? []}
                current={activeComposition.backgroundImageUrl}
                onRollback={() => { actions.rollbackReframe(); toast.success("Vorherige Version wiederhergestellt"); }}
                onPick={(url) => {
                  const prev = activeComposition.backgroundImageUrl;
                  if (prev && prev !== url) actions.pushReframeHistory(prev);
                  actions.setBackground(url);
                }}
                onClear={() => actions.clearReframeHistory()}
              />
              <div className="flex justify-end pt-2 border-t border-border">
                <Button size="sm" onClick={onContinue}>
                  Weiter zum Feinschliff <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <ReframeVariantsDialog
        open={variantsOpen}
        onOpenChange={setVariantsOpen}
        sourceImageUrl={activeComposition.masterImageUrl ?? activeComposition.backgroundImageUrl}
        targetWidth={activeFormat.width}
        targetHeight={activeFormat.height}
        onPick={(url) => applyReframeResult(activeFormat.id, url, activeComposition.masterImageUrl ?? activeComposition.backgroundImageUrl)}
      />
      <ManualCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        sourceImageUrl={activeComposition.masterImageUrl ?? activeComposition.backgroundImageUrl}
        targetWidth={activeFormat.width}
        targetHeight={activeFormat.height}
        onPick={(url) => {
          applyReframeResult(activeFormat.id, url, activeComposition.masterImageUrl ?? activeComposition.backgroundImageUrl);
          toast.success("Manueller Crop übernommen");
        }}
      />
    </section>
  );
};

export default BildStep;
