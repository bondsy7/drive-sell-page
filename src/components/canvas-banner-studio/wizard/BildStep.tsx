import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2, RotateCcw, Crop, Image as ImageIcon, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import Step2Master from "../step2/Step2Master";
import ReframeHistoryStrip from "../step2/ReframeHistoryStrip";
import ReframeVariantsDialog from "../step2/ReframeVariantsDialog";
import ManualCropDialog from "../step2/ManualCropDialog";
import { reframeImageForFormat } from "../ai/reframeClient";

import type { CanvasBannerStore } from "../state/useCanvasBannerStore";
import { getFormatById } from "../data/formats";
import type { BannerTextFieldKey } from "../state/types";

interface Props {
  store: CanvasBannerStore;
  onContinue: () => void;
}

const BildStep: React.FC<Props> = ({ store, onContinue }) => {
  const { state, actions, activeComposition, activeFormat } = store;
  const [reframeBusy, setReframeBusy] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  const applyReframeResult = (fid: string, newUrl: string, sourceUrl?: string) => {
    const comp = state.compositions[fid];
    const prev = comp?.backgroundImageUrl;
    if (prev && prev !== newUrl) actions.pushReframeHistory(prev, fid);
    if (sourceUrl && !comp?.masterImageUrl) actions.setMasterImage(sourceUrl, fid);
    actions.setBackground(newUrl, fid);
  };

  const handleReframeAll = async () => {
    const src = activeComposition.backgroundImageUrl;
    if (!src || !src.startsWith("data:")) {
      toast.error("Bitte erst ein Bild übernehmen.");
      return;
    }
    setReframeBusy(true);
    let done = 0;
    let failed = 0;
    try {
      const source = activeComposition.masterImageUrl ?? src;
      for (const fid of state.selectedFormatIds) {
        const f = getFormatById(fid);
        try {
          const out = await reframeImageForFormat(source, f.width, f.height);
          applyReframeResult(fid, out.imageDataUrl, source);
          done++;
          toast.message(`${done}/${state.selectedFormatIds.length}: ${f.name}`);
        } catch (e) {
          console.error("reframe failed", fid, e);
          failed++;
        }
      }
      toast.success(`Reframe fertig · ${done} ok · ${failed} fehlgeschlagen`);
    } finally {
      setReframeBusy(false);
    }
  };

  const handleReframeActive = async () => {
    const src = activeComposition.backgroundImageUrl;
    if (!src || !src.startsWith("data:")) { toast.error("Bitte erst ein Bild übernehmen."); return; }
    setReframeBusy(true);
    try {
      const source = activeComposition.masterImageUrl ?? src;
      const out = await reframeImageForFormat(source, activeFormat.width, activeFormat.height);
      applyReframeResult(activeFormat.id, out.imageDataUrl, source);
      toast.success(`Bild auf ${activeFormat.name} angepasst (${out.resolution})`);
    } catch (e: any) {
      toast.error(e?.message ?? "Reframe fehlgeschlagen");
    } finally {
      setReframeBusy(false);
    }
  };

  const hasImage = !!activeComposition.backgroundImageUrl;

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
          Dann reframen wir es passgenau für jedes Banner-Format.
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
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">AI</span>
          </div>
          {!hasImage ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Sobald ein Bild übernommen ist, kannst du es hier auf alle gewählten Formate bringen.
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Erweitert das Bild generativ auf die exakten Banner-Maße (kein Crop, voller Inhalt bleibt erhalten).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={handleReframeActive} disabled={reframeBusy}>
                  {reframeBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  Aktives Format
                </Button>
                <Button size="sm" onClick={handleReframeAll} disabled={reframeBusy || state.selectedFormatIds.length === 0}>
                  {reframeBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
                  Alle ({state.selectedFormatIds.length})
                </Button>
                <Button size="sm" variant="outline" onClick={() => setVariantsOpen(true)} disabled={reframeBusy}>
                  3 Varianten
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCropOpen(true)} disabled={reframeBusy}>
                  <Crop className="w-3.5 h-3.5 mr-1" /> Manuell
                </Button>
              </div>
              {reframeBusy && (
                <p className="text-[11px] text-muted-foreground">Reframe läuft – bis zu 30 s pro Format.</p>
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
