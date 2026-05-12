import React, { useRef, useState } from "react";
import type Konva from "konva";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Eye, EyeOff, Package, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import AppHeader from "@/components/AppHeader";
import { useCanvasBannerStore } from "./state/useCanvasBannerStore";
import { getFormatById } from "./data/formats";
import BannerCanvas from "./canvas/BannerCanvas";
import MultiFormatPreview from "./canvas/MultiFormatPreview";
import FormatPicker from "./controls/FormatPicker";

import OverlayControls from "./controls/OverlayControls";
import TextFieldsPanel from "./controls/TextFieldsPanel";
import LayoutTemplatePicker from "./controls/LayoutTemplatePicker";
import LayerOrderControls from "./controls/LayerOrderControls";
import LogoPanel from "./controls/LogoPanel";
import LegalCheck from "./controls/LegalCheck";
import Step2Master from "./step2/Step2Master";
import type { BannerTextFieldKey } from "./state/types";
import { buildFilename, downloadDataUrl, exportStage, type ExportFormat } from "./export/exportCanvas";
import { exportAllAsZip } from "./export/zipExport";
import { positionToCoords, suggestLayoutFromImage } from "./ai/layoutSuggestClient";
import { reframeImageForFormat } from "./ai/reframeClient";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS: { id: Step; title: string; subtitle: string }[] = [
  { id: 1, title: "Format", subtitle: "Größe wählen" },
  { id: 2, title: "Bild", subtitle: "Hintergrund" },
  { id: 3, title: "Text", subtitle: "Inhalte" },
  { id: 4, title: "Layout", subtitle: "Anordnung" },
  { id: 5, title: "Export", subtitle: "Download" },
];

const SMALL_FORMATS = new Set(["g-medrect", "g-leader", "g-skyscraper"]);

const CanvasBannerStudioShell: React.FC = () => {
  const navigate = useNavigate();
  const { state, actions, activeComposition, activeFormat, resolveColor } = useCanvasBannerStore();
  const [step, setStep] = useState<Step>(1);
  const [previewMobileOpen, setPreviewMobileOpen] = useState(true);
  const stageRef = useRef<Konva.Stage | null>(null);

  const [zipBusy, setZipBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [reframeBusy, setReframeBusy] = useState(false);

  const handleReframeActive = async () => {
    const src = activeComposition.backgroundImageUrl;
    if (!src || !src.startsWith("data:")) {
      toast.error("Lade zuerst ein Hintergrundbild hoch.");
      return;
    }
    setReframeBusy(true);
    try {
      const out = await reframeImageForFormat(src, activeFormat.width, activeFormat.height);
      actions.setBackground(out.imageDataUrl);
      toast.success(`Bild auf ${activeFormat.name} angepasst (${out.resolution})`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Reframe fehlgeschlagen");
    } finally {
      setReframeBusy(false);
    }
  };

  const handleReframeAll = async () => {
    const src = activeComposition.backgroundImageUrl;
    if (!src || !src.startsWith("data:")) {
      toast.error("Lade zuerst ein Hintergrundbild hoch.");
      return;
    }
    setReframeBusy(true);
    let done = 0;
    let failed = 0;
    try {
      for (const fid of state.selectedFormatIds) {
        const f = getFormatById(fid);
        try {
          const out = await reframeImageForFormat(src, f.width, f.height);
          actions.setBackground(out.imageDataUrl, fid);
          done++;
          toast.message(`${done}/${state.selectedFormatIds.length} angepasst: ${f.name}`);
        } catch (e) {
          console.error("reframe failed for", fid, e);
          failed++;
        }
      }
      toast.success(`Reframe abgeschlossen · ${done} ok · ${failed} fehlgeschlagen`);
    } finally {
      setReframeBusy(false);
    }
  };

  const handleExport = (type: ExportFormat) => {
    const stage = stageRef.current;
    if (!stage) {
      toast.error("Vorschau noch nicht bereit.");
      return;
    }
    try {
      const url = exportStage(stage, activeFormat, type);
      downloadDataUrl(url, buildFilename(activeFormat, type));
      toast.success(`Exportiert in ${activeFormat.width}×${activeFormat.height}`);
    } catch (e) {
      console.error(e);
      toast.error("Export fehlgeschlagen.");
    }
  };

  const handleZipExport = async (type: ExportFormat) => {
    if (state.selectedFormatIds.length === 0) return;
    setZipBusy(true);
    try {
      await exportAllAsZip(state, state.textFields, type);
      toast.success(`${state.selectedFormatIds.length} Banner als ZIP exportiert`);
    } catch (e) {
      console.error(e);
      toast.error("ZIP-Export fehlgeschlagen.");
    } finally {
      setZipBusy(false);
    }
  };

  const handleAiSuggest = async () => {
    const url = activeComposition.backgroundImageUrl;
    if (!url || !url.startsWith("data:")) {
      toast.error("Lade zuerst ein Hintergrundbild hoch.");
      return;
    }
    setAiBusy(true);
    try {
      const s = await suggestLayoutFromImage(url);
      // Apply overlay
      actions.setOverlay(s.recommendedOverlay, activeComposition.overlayStrength || 50);
      // Map positions for headline/price/cta/logo using estimated sizes
      const f = activeFormat;
      const layerById = (id: string) => activeComposition.layers.find((l) => l.id === id);
      const map: Record<string, { id: string; w: number; h: number }> = {
        headline: { id: "headline", w: Math.round(f.width * 0.7), h: Math.round((layerById("headline")?.fontSize ?? 40) * 1.4) },
        price: { id: "price", w: Math.round(f.width * 0.55), h: Math.round((layerById("price")?.fontSize ?? 40) * 1.4) },
        cta: { id: "cta", w: Math.round(f.width * 0.45), h: Math.round((layerById("cta")?.fontSize ?? 28) * 1.4) },
        logo: { id: "logo", w: Math.round(f.width * 0.18), h: Math.round(f.width * 0.18 * 0.4) },
      };
      const positions: Record<string, typeof s.headlinePosition> = {
        headline: s.headlinePosition,
        price: s.pricePosition,
        cta: s.ctaPosition,
        logo: s.logoPosition,
      };
      for (const k of Object.keys(map)) {
        const m = map[k];
        const coords = positionToCoords(positions[k], f.width, f.height, m.w, m.h);
        actions.patchLayer(m.id, coords);
      }
      toast.success("KI-Layout angewendet" + (s.reason ? ` · ${s.reason}` : ""));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "KI-Vorschlag fehlgeschlagen");
    } finally {
      setAiBusy(false);
    }
  };

  const isSmall = SMALL_FORMATS.has(activeFormat.id);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/generator")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-xs uppercase tracking-wider text-accent font-semibold">Canvas Banner Studio</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">NEU</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Banner mit exaktem Format & echten Textebenen
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              KI erzeugt nur das Hintergrundbild. Texte, Logos, Preise, CTA und Pflichtangaben werden präzise per
              Canvas gerendert – immer in der exakten Zielgröße.
            </p>
          </div>
        </div>

        {/* Step nav */}
        <div className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1">
          {STEPS.map((s) => {
            const active = step === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg border text-left min-w-[110px] ${
                  active ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent/40"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Schritt {s.id}</div>
                <div className="text-sm font-semibold text-foreground">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.subtitle}</div>
              </button>
            );
          })}
        </div>

        {/* Mobile preview toggle */}
        <div className="lg:hidden">
          <Button variant="outline" size="sm" onClick={() => setPreviewMobileOpen((v) => !v)}>
            {previewMobileOpen ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            Vorschau {previewMobileOpen ? "ausblenden" : "anzeigen"}
          </Button>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          {/* Controls */}
          <div className="space-y-4 order-2 lg:order-1">
            {step === 1 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-foreground">Formate auswählen</h2>
                <p className="text-sm text-muted-foreground">
                  Wähle ein oder mehrere Zielformate. Aktives Format wird unten in der Vorschau gezeigt.
                </p>
                <FormatPicker
                  selectedIds={state.selectedFormatIds}
                  activeId={state.activeFormatId}
                  onToggle={actions.toggleFormat}
                  onSetActive={actions.setActiveFormat}
                />
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Aktives Format: <strong className="text-foreground">{activeFormat.name}</strong> ·
                  {" "}{activeFormat.width}×{activeFormat.height}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
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

                {activeComposition.backgroundImageUrl && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-3.5 h-3.5 text-accent" />
                      <h3 className="text-sm font-semibold">4) Auf Zielformate reframen</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">AI</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Erst Masterbild freigeben, dann generativ auf das aktive Format oder alle gewählten Formate erweitern.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" onClick={handleReframeActive} disabled={reframeBusy}>
                            Aktives Format
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Erweitert das Bild generativ auf das aktuell gewählte Zielformat.</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleReframeAll}
                            disabled={reframeBusy || state.selectedFormatIds.length < 2}
                          >
                            Alle ({state.selectedFormatIds.length})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reframet das Bild für alle ausgewählten Formate nacheinander.</TooltipContent>
                      </Tooltip>
                    </div>
                    {reframeBusy && (
                      <p className="text-[11px] text-muted-foreground">Reframe läuft… kann bis zu 30 s pro Format dauern.</p>
                    )}
                  </div>
                )}

                <OverlayControls
                  fit={activeComposition.backgroundFit}
                  direction={activeComposition.overlayDirection}
                  strength={activeComposition.overlayStrength}
                  onFit={(f) => actions.setBgFit(f)}
                  onOverlay={(d, s) => actions.setOverlay(d, s)}
                />
                <div className="pt-2 border-t border-border">
                  <h3 className="text-sm font-semibold mb-2">Logo (optional)</h3>
                  <LogoPanel logoUrl={activeComposition.logoUrl} onChange={(url) => actions.setLogo(url)} />
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-foreground">Texte</h2>
                <p className="text-sm text-muted-foreground">
                  Alle Texte sind echte, nachträglich editierbare Ebenen – nicht ins Bild „eingebrannt".
                </p>
                <TextFieldsPanel
                  textFields={state.textFields}
                  composition={activeComposition}
                  onChangeText={actions.setText}
                  onPatchLayer={actions.patchLayer}
                />
              </section>
            )}

            {step === 4 && (
              <section className="space-y-4">
                <h2 className="font-semibold text-foreground">Layout-Vorlage</h2>
                <LayoutTemplatePicker
                  selectedId={activeComposition.selectedTemplateId}
                  onSelect={(id) => actions.setTemplate(id)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={state.showSafeArea ? "default" : "outline"}
                    onClick={actions.toggleSafeArea}
                  >
                    Sicherheitsbereich {state.showSafeArea ? "ausblenden" : "anzeigen"}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAiSuggest}
                          disabled={aiBusy || !activeComposition.backgroundImageUrl}
                        >
                          <Wand2 className="w-3.5 h-3.5 mr-1" />
                          {aiBusy ? "Analysiere…" : "KI-Layout-Vorschlag"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!activeComposition.backgroundImageUrl
                        ? "Bitte zuerst Hintergrundbild hochladen."
                        : "Analysiert das Bild und schlägt eine passende Anordnung von Headline, Preis, CTA und Logo vor."}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <LayerOrderControls
                  selectedLayerId={state.selectedLayerId}
                  composition={activeComposition}
                  format={activeFormat}
                  onReorder={(id, dir) => actions.reorderLayer(id, dir)}
                  onCenter={(id) => {
                    const l = activeComposition.layers.find((x) => x.id === id);
                    if (!l) return;
                    const w = l.width ?? activeFormat.width * 0.5;
                    actions.patchLayer(id, { x: Math.round((activeFormat.width - w) / 2) });
                  }}
                  onReset={actions.resetLayout}
                />
              </section>
            )}

            {step === 5 && (
              <section className="space-y-4">
                <h2 className="font-semibold text-foreground">Export</h2>
                <p className="text-sm text-muted-foreground">
                  Lade das aktive Format in exakter Zielgröße herunter.
                </p>
                {isSmall && (
                  <div className="p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-300">
                    Hinweis: Dieses Display-Format kann zu klein für vollständige Pflichtangaben sein.
                    Bitte rechtliche Anforderungen für die Platzierung prüfen.
                  </div>
                )}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Compliance-Check</h3>
                  <LegalCheck format={activeFormat} composition={activeComposition} textFields={state.textFields} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => handleExport("png")}><Download className="w-4 h-4 mr-1" /> PNG</Button>
                  <Button variant="outline" onClick={() => handleExport("jpg")}><Download className="w-4 h-4 mr-1" /> JPG</Button>
                  <Button variant="outline" onClick={() => handleExport("webp")}><Download className="w-4 h-4 mr-1" /> WebP</Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Dateiname: <code className="bg-muted px-1 py-0.5 rounded">{buildFilename(activeFormat, "png")}</code>
                </div>

                {state.selectedFormatIds.length > 1 && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Alle Formate exportieren</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Erzeugt für jedes ausgewählte Format einen Banner in exakter Zielgröße und packt sie als ZIP.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Button onClick={() => handleZipExport("png")} disabled={zipBusy}>
                          <Package className="w-4 h-4 mr-1" /> ZIP · PNG
                        </Button>
                        <Button variant="outline" onClick={() => handleZipExport("jpg")} disabled={zipBusy}>
                          <Package className="w-4 h-4 mr-1" /> ZIP · JPG
                        </Button>
                        <Button variant="outline" onClick={() => handleZipExport("webp")} disabled={zipBusy}>
                          <Package className="w-4 h-4 mr-1" /> ZIP · WebP
                        </Button>
                      </div>
                    </div>
                    <MultiFormatPreview
                      state={state}
                      textFields={state.textFields}
                      onActivate={actions.setActiveFormat}
                    />
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Preview */}
          <div className={`order-1 lg:order-2 ${previewMobileOpen ? "" : "hidden lg:block"}`}>
            <div className="sticky top-4 space-y-2">
              {state.selectedFormatIds.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {state.selectedFormatIds.map((fid) => {
                    const f = getFormatById(fid);
                    const active = fid === state.activeFormatId;
                    return (
                      <button
                        key={fid}
                        onClick={() => actions.setActiveFormat(fid)}
                        title={`${f.name} · ${f.width}×${f.height}`}
                        className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[11px] leading-tight whitespace-nowrap transition ${
                          active
                            ? "border-accent bg-accent/10 text-foreground font-semibold"
                            : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
                        }`}
                      >
                        <span>{f.name}</span>
                        <span className="ml-1.5 tabular-nums opacity-70">
                          {f.width}×{f.height}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{activeFormat.name}</span>
                <span className="tabular-nums">
                  {activeFormat.width} × {activeFormat.height} px
                </span>
              </div>
              <div
                className="w-full aspect-square lg:aspect-auto lg:h-[calc(100vh-220px)] min-h-[320px] rounded-xl border border-border overflow-hidden bg-card"
              >
                <BannerCanvas
                  format={activeFormat}
                  composition={activeComposition}
                  textFields={state.textFields}
                  showSafeArea={state.showSafeArea}
                  selectedLayerId={state.selectedLayerId}
                  resolveColor={resolveColor}
                  onSelectLayer={actions.selectLayer}
                  onLayerDrag={(id, x, y) => actions.patchLayer(id, { x, y })}
                  stageRef={stageRef}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default CanvasBannerStudioShell;
