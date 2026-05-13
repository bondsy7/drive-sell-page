import React, { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Download, Package, Sparkles, Wand2, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";

import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles } from "@/hooks/useVehicles";
import { useVehicleMakes } from "@/hooks/useVehicleMakes";
import { supabase } from "@/integrations/supabase/client";

import { useCanvasBannerStore } from "../state/useCanvasBannerStore";
import { getFormatById } from "../data/formats";
import BannerCanvas from "../canvas/BannerCanvas";
import LegalCheck from "../controls/LegalCheck";
import { useBannerProject, uploadBannerToStorage, dataUrlToBlob } from "../persistence/useBannerProject";
import { renderCompositionToBlob } from "../export/renderComposition";
import { buildFilename, downloadDataUrl, exportStage, type ExportFormat } from "../export/exportCanvas";
import { exportAllAsZip } from "../export/zipExport";
import { positionToCoords, suggestLayoutFromImage } from "../ai/layoutSuggestClient";
import { buildCiContext, type DealerProfile } from "../ci/profileSources";
import { detectBrandKey } from "../ci/brandPresets";
import { useCiPersistence } from "../ci/useCiPersistence";

import SourceStep from "./SourceStep";
import InspectorPanel from "./InspectorPanel";
import type { PrefillPayload } from "./prefillBannerFromSource";
import type { BannerTextFieldKey } from "../state/types";

interface Props {
  onSwitchToPro: () => void;
}

const WIZARD_STEPS = [
  { id: 1 as const, title: "Quelle", subtitle: "Daten holen" },
  { id: 2 as const, title: "Vorschau", subtitle: "Feinschliff" },
  { id: 3 as const, title: "Export", subtitle: "Download" },
];

const WizardShell: React.FC<Props> = ({ onSwitchToPro }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const store = useCanvasBannerStore();
  const { state, actions, activeComposition, activeFormat, resolveColor, canUndo, canRedo } = store;
  const stageRef = useRef<Konva.Stage | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [applyLogoToAll, setApplyLogoToAll] = useState(true);
  const [zipBusy, setZipBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  // Persistence + profile
  useBannerProject({ state, onProjectIdAssigned: (id) => actions.setBannerProjectId(id) });
  const { data: vehicles = [] } = useVehicles();
  const { getLogoForMake } = useVehicleMakes();

  const [profile, setProfile] = useState<DealerProfile | null>(null);
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "company_name, contact_name, email, phone, whatsapp_number, website, address, postal_code, city, logo_url, primary_color, secondary_color, default_legal_text",
        )
        .eq("id", user.id).maybeSingle();
      if (!cancelled) setProfile(data ?? null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useCiPersistence({
    userId: user?.id,
    ci: state.ci,
    onLoaded: (stored) => actions.setCi(stored),
  });

  const activeVehicle = useMemo(
    () => (state.vehicleId ? vehicles.find((v) => v.id === state.vehicleId) ?? null : null),
    [state.vehicleId, vehicles],
  );

  const ciContext = useMemo(() => buildCiContext(profile, activeVehicle), [profile, activeVehicle]);
  const detectedBrandKey = useMemo(() => detectBrandKey(ciContext.marke), [ciContext.marke]);

  /** Apply auto-fill from any source. */
  const applyPrefill = async (p: PrefillPayload) => {
    if (p.vehicleId) actions.setVehicle(p.vehicleId);
    (Object.entries(p.textFields) as [BannerTextFieldKey, string][]).forEach(([k, v]) => {
      if (v) actions.setText(k, v);
    });
    if (p.manufacturerLogoUrl) actions.setLogo(p.manufacturerLogoUrl, "all");
    if (p.brandKey || p.textFields.headline) {
      const bk = detectBrandKey(p.brandKey ?? p.textFields.headline ?? "");
      if (bk && state.ci?.brandKey === "custom") actions.applyBrandPreset(bk);
    }
    if (p.backgroundDataUrl) {
      // Convert remote URLs to data URL for canvas + reframe support.
      try {
        const url = await toDataUrl(p.backgroundDataUrl);
        actions.setBackground(url);
        // Auto AI-layout on first image
        void runAiSuggest(url);
      } catch (e) {
        console.warn("background fetch failed", e);
      }
    }
    setStep(2);
  };

  async function toDataUrl(src: string): Promise<string> {
    if (src.startsWith("data:")) return src;
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(r.error);
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  }

  const runAiSuggest = async (url: string) => {
    setAiBusy(true);
    try {
      const s = await suggestLayoutFromImage(url);
      actions.setOverlay(s.recommendedOverlay, activeComposition.overlayStrength || 50);
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
      toast.success("KI-Layout angewendet");
    } catch (e) {
      console.warn("AI layout failed", e);
    } finally {
      setAiBusy(false);
    }
  };

  const persistExportedBlob = async (blob: Blob, filename: string, contentType: string) => {
    if (!user) return;
    await uploadBannerToStorage({
      userId: user.id,
      vehicleId: state.vehicleId ?? null,
      blob,
      filename,
      contentType,
    });
  };

  const handleExport = async (type: ExportFormat) => {
    const stage = stageRef.current;
    if (!stage) { toast.error("Vorschau noch nicht bereit."); return; }
    try {
      const url = exportStage(stage, activeFormat, type);
      const filename = buildFilename(activeFormat, type);
      downloadDataUrl(url, filename);
      const mime = type === "png" ? "image/png" : type === "jpg" ? "image/jpeg" : "image/webp";
      const blob = await dataUrlToBlob(url);
      void persistExportedBlob(blob, filename, mime);
      toast.success(`Exportiert · ${activeFormat.width}×${activeFormat.height}`);
    } catch (e) {
      console.error(e); toast.error("Export fehlgeschlagen.");
    }
  };

  const handleZipExport = async (type: ExportFormat) => {
    if (state.selectedFormatIds.length === 0) return;
    setZipBusy(true);
    try {
      await exportAllAsZip(state, state.textFields, type, state.ci, ciContext);
      const mime = type === "png" ? "image/png" : type === "jpg" ? "image/jpeg" : "image/webp";
      for (const fid of state.selectedFormatIds) {
        const f = getFormatById(fid);
        const comp = state.compositions[fid];
        if (!comp) continue;
        try {
          const blob = await renderCompositionToBlob(f, comp, state.textFields, type, state.ci, ciContext);
          await persistExportedBlob(blob, buildFilename(f, type), mime);
        } catch (err) { console.warn("persist fail", fid, err); }
      }
      toast.success(`${state.selectedFormatIds.length} Banner als ZIP exportiert`);
    } catch (e) {
      console.error(e); toast.error("ZIP-Export fehlgeschlagen.");
    } finally { setZipBusy(false); }
  };

  const canGoStep2 = !!activeComposition.backgroundImageUrl || !!state.textFields.headline;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Top bar */}
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/generator")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Banner Wizard</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">AI</span>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                In 3 Schritten zum fertigen Banner
              </h1>
            </div>
            <Button variant="ghost" size="sm" onClick={onSwitchToPro}>
              Pro-Modus
            </Button>
          </div>

          {/* Sticky progress */}
          <div className="sticky top-2 z-20 bg-background/85 backdrop-blur-sm rounded-xl border border-border p-2 flex gap-1">
            {WIZARD_STEPS.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              const reachable = s.id === 1 || canGoStep2;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!reachable}
                  onClick={() => setStep(s.id)}
                  className={`flex-1 px-3 py-2 rounded-lg text-left transition border ${
                    active
                      ? "border-accent bg-accent/10"
                      : done
                      ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-accent/40"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[11px] font-bold ${
                      active ? "bg-accent text-accent-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>{s.id}</span>
                    <div>
                      <div className="text-sm font-semibold leading-tight">{s.title}</div>
                      <div className="text-[10px] opacity-70 leading-tight">{s.subtitle}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step body */}
          {step === 1 && (
            <SourceStep
              selectedFormatIds={state.selectedFormatIds}
              activeFormatId={state.activeFormatId}
              onToggleFormat={actions.toggleFormat}
              onSetActiveFormat={actions.setActiveFormat}
              onPrefilled={applyPrefill}
              vehicleId={state.vehicleId}
            />
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
              <div className="space-y-2 order-2 lg:order-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{activeFormat.name} · {activeFormat.width}×{activeFormat.height}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!canUndo} onClick={actions.undo} className="p-1 rounded hover:bg-muted disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /></button>
                    <button type="button" disabled={!canRedo} onClick={actions.redo} className="p-1 rounded hover:bg-muted disabled:opacity-30"><Redo2 className="w-3.5 h-3.5" /></button>
                    {aiBusy && <span className="text-[11px] text-accent inline-flex items-center gap-1"><Wand2 className="w-3 h-3 animate-pulse" /> KI-Layout…</span>}
                  </div>
                </div>
                <div className="relative w-full aspect-square lg:aspect-auto lg:h-[calc(100vh-260px)] min-h-[320px] rounded-xl border border-border overflow-hidden bg-card">
                  <BannerCanvas
                    format={activeFormat}
                    composition={activeComposition}
                    textFields={state.textFields}
                    showSafeArea={state.showSafeArea}
                    selectedLayerId={state.selectedLayerId}
                    resolveColor={resolveColor}
                    ci={state.ci}
                    ciContext={ciContext}
                    onSelectLayer={actions.selectLayer}
                    onLayerDrag={(id, x, y) => actions.patchLayer(id, { x, y })}
                    onLayerResize={(id, patch) => actions.patchLayer(id, patch)}
                    stageRef={stageRef}
                  />
                </div>
                {state.selectedFormatIds.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {state.selectedFormatIds.map((fid) => {
                      const f = getFormatById(fid);
                      const a = fid === state.activeFormatId;
                      return (
                        <button
                          key={fid}
                          onClick={() => actions.setActiveFormat(fid)}
                          className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[11px] ${
                            a ? "border-accent bg-accent/10 text-foreground font-semibold" : "border-border bg-card text-muted-foreground hover:border-accent/40"
                          }`}
                        >
                          {f.name} <span className="opacity-70 ml-1 tabular-nums">{f.width}×{f.height}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="order-1 lg:order-2">
                <InspectorPanel
                  store={store}
                  profile={profile}
                  ciContext={ciContext}
                  detectedBrandKey={detectedBrandKey}
                  manufacturerLogoUrl={
                    activeVehicle?.brand ? getLogoForMake(activeVehicle.brand) ?? undefined : undefined
                  }
                  dealerLogoUrl={profile?.logo_url ?? undefined}
                  userId={user?.id}
                  applyLogoToAll={applyLogoToAll}
                  onToggleApplyLogoToAll={setApplyLogoToAll}
                />
                <div className="flex justify-end mt-4">
                  <Button onClick={() => setStep(3)}>
                    Weiter zu Export <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <section className="space-y-5 max-w-2xl">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Compliance & Export</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Letzter Check der Pflichtangaben, dann Download in der gewünschten Größe.
                </p>
              </div>
              <LegalCheck format={activeFormat} composition={activeComposition} textFields={state.textFields} />
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => handleExport("png")}><Download className="w-4 h-4 mr-1" /> PNG</Button>
                <Button variant="outline" onClick={() => handleExport("jpg")}><Download className="w-4 h-4 mr-1" /> JPG</Button>
                <Button variant="outline" onClick={() => handleExport("webp")}><Download className="w-4 h-4 mr-1" /> WebP</Button>
              </div>
              {state.selectedFormatIds.length > 1 && (
                <div className="pt-3 border-t border-border space-y-2">
                  <h3 className="text-sm font-semibold">Alle {state.selectedFormatIds.length} Formate als ZIP</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={() => handleZipExport("png")} disabled={zipBusy}><Package className="w-4 h-4 mr-1" /> PNG</Button>
                    <Button variant="outline" onClick={() => handleZipExport("jpg")} disabled={zipBusy}><Package className="w-4 h-4 mr-1" /> JPG</Button>
                    <Button variant="outline" onClick={() => handleZipExport("webp")} disabled={zipBusy}><Package className="w-4 h-4 mr-1" /> WebP</Button>
                  </div>
                </div>
              )}
              <div>
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WizardShell;
