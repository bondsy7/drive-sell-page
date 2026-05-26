/**
 * Quick-Modus „Letzter Schritt": schlanker Editor.
 *
 * Zeigt nur was im Quick-Flow noch relevant ist:
 *  - Format-Tabs (zwischen den generierten Bannern wechseln)
 *  - Canvas mit Drag/Resize, Klick-Selektion
 *  - Texte bearbeiten, Layer-Reihenfolge (Vorne/Hinten), Sichtbarkeit, Font-Größe/Weight/Align/Farbtoken
 *  - Undo/Redo, Layout zurücksetzen
 *  - Download (einzeln & ZIP) + Zurück zur Vorschau
 *
 * Bewusst NICHT enthalten: Format-/CI-/Logo-/Szenen-Auswahl, Steps 1-5, AI-Reframe, Persistence-Sidebar.
 * Diese wurden vorher im Quick-Flow konfiguriert.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import JSZip from "jszip";
import { ArrowLeft, Check, Download, Loader2, Package, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useCanvasBannerStore } from "../state/useCanvasBannerStore";
import BannerCanvas from "../canvas/BannerCanvas";
import TextFieldsPanel from "../controls/TextFieldsPanel";
import QuickInspector from "./QuickInspector";
import FloatingToolbar from "../controls/FloatingToolbar";
import { getFormatById, slugifyFormat } from "../data/formats";
import { renderCompositionToBlob, renderCompositionToDataURL } from "../export/renderComposition";
import type { BannerComposition, BannerTextFields, CiState } from "../state/types";
import { buildCiContext, type DealerProfile } from "../ci/profileSources";
import { isLayerOverridden, isCompositionOverridden } from "../state/overrideDetection";
import { generateMasterBannerImage } from "../ai/masterImageClient";
import { reframeImageForFormat } from "../ai/reframeClient";
import { getMarketingPromptById } from "../data/marketingPrompts";
import { useBannerProject } from "../persistence/useBannerProject";
import VehicleBannerPicker from "../persistence/VehicleBannerPicker";

interface Props {
  initialFormatIds: string[];
  initialActiveFormatId: string;
  initialTextFields: BannerTextFields;
  initialCompositions: Record<string, BannerComposition>;
  ci?: Partial<CiState>;
  dealerProfile: DealerProfile | null;
  vehicleImageDataUrl?: string;
  /** Optional pre-linked vehicle for persistence (null = "no VIN", undefined = not chosen). */
  initialVehicleId?: string | null;
  initialProjectTitle?: string;
  /** Pass an existing banner_projects.id to keep autosaving into that row (resume). */
  initialBannerProjectId?: string;
  onBack: () => void;
  onApply?: (compositions: Record<string, BannerComposition>, textFields: BannerTextFields) => void;
}

const QuickEditView: React.FC<Props> = ({
  initialFormatIds,
  initialActiveFormatId,
  initialTextFields,
  initialCompositions,
  ci,
  dealerProfile,
  vehicleImageDataUrl,
  initialVehicleId,
  initialProjectTitle,
  initialBannerProjectId,
  onBack,
  onApply,
}) => {
  const { state, actions, activeComposition, activeFormat, resolveColor, canUndo, canRedo } = useCanvasBannerStore();
  const stageRef = useRef<Konva.Stage | null>(null);
  const hydratedRef = useRef(false);
  const [selectedScreen, setSelectedScreen] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [bgRegenerating, setBgRegenerating] = useState(false);

  const handleRegenerateBackground = useCallback(
    async (presetId: string, extraInstruction: string) => {
      if (!vehicleImageDataUrl) {
        toast.error("Original-Fahrzeugbild nicht verfügbar.");
        return;
      }
      const preset = getMarketingPromptById(presetId);
      if (!preset) {
        toast.error("Szene nicht gefunden.");
        return;
      }
      const formatId = activeFormat.id;
      setBgRegenerating(true);
      const tId = toast.loading("Hintergrund wird neu generiert…");
      try {
        const { imageDataUrl: masterUrl } = await generateMasterBannerImage({
          sourceImageUrl: vehicleImageDataUrl,
          promptText: preset.prompt,
          extraInstruction: extraInstruction.trim() || undefined,
        });
        toast.loading("Hintergrund wird auf Format zugeschnitten…", { id: tId });
        const reframed = await reframeImageForFormat(masterUrl, activeFormat.width, activeFormat.height);
        const currentBg = activeComposition.backgroundImageUrl;
        if (currentBg) actions.pushReframeHistory(currentBg, formatId);
        actions.setMasterImage(masterUrl, formatId);
        actions.setBackground(reframed.imageDataUrl, formatId);
        // Auto-Fit überschreibungen zurücksetzen, damit neuer Hintergrund sauber sitzt
        actions.patchLayer("__background__", {
          x: undefined as any, y: undefined as any,
          width: undefined as any, height: undefined as any,
        }, formatId);
        toast.success("Hintergrund neu generiert.", { id: tId });
      } catch (e: any) {
        console.error("regenerate background failed", e);
        toast.error(e?.message ?? "Hintergrund konnte nicht generiert werden.", { id: tId });
      } finally {
        setBgRegenerating(false);
      }
    },
    [vehicleImageDataUrl, activeFormat, activeComposition.backgroundImageUrl, actions],
  );

  // Einmalige Hydration aus den Quick-Generate Ergebnissen (oder gespeichertem Projekt).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    actions.hydrate({
      selectedFormatIds: initialFormatIds,
      activeFormatId: initialActiveFormatId,
      textFields: initialTextFields,
      compositions: initialCompositions,
      showSafeArea: false,
      ci: ci as CiState | undefined,
      vehicleId: initialVehicleId,
      projectTitle: initialProjectTitle,
      bannerProjectId: initialBannerProjectId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistente Speicherung als Canvas-Projekt im Dashboard.
  // - Ohne Fahrzeug: vehicleId = null  → wird als "No-VIN" Eintrag gelistet
  // - Mit Fahrzeug:  vehicleId = uuid  → an bestehende VIN gebunden
  const { saveNow } = useBannerProject({
    state,
    onProjectIdAssigned: (id) => actions.setBannerProjectId(id),
  });
  const [saving, setSaving] = useState(false);
  const handleManualSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveNow();
      toast.success("Canvas-Projekt gespeichert");
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [saveNow]);

  const ciContext = useMemo(() => buildCiContext(dealerProfile, null), [dealerProfile]);

  const selectedLayer = useMemo(
    () => activeComposition.layers.find((l) => l.id === state.selectedLayerId),
    [activeComposition.layers, state.selectedLayerId],
  );
  const selectedOverridden = useMemo(
    () => (selectedLayer ? isLayerOverridden(selectedLayer, activeComposition, activeFormat) : false),
    [selectedLayer, activeComposition, activeFormat],
  );
  const formatOverridden = useMemo(
    () => isCompositionOverridden(activeComposition, activeFormat),
    [activeComposition, activeFormat],
  );

  // Tastatur: Pfeile, Delete, Esc, Undo/Redo (identisch zum Pro-Editor, aber lokal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const editable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t?.isContentEditable ?? false);
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) actions.redo(); else actions.undo();
        return;
      }
      if (meta && e.key === "y") { e.preventDefault(); actions.redo(); return; }
      if (editable) return;
      const id = state.selectedLayerId;
      if (!id) return;
      const l = activeComposition.layers.find((x) => x.id === id);
      if (!l) return;
      const stp = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") { e.preventDefault(); actions.patchLayer(id, { x: l.x - stp }); }
      else if (e.key === "ArrowRight") { e.preventDefault(); actions.patchLayer(id, { x: l.x + stp }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); actions.patchLayer(id, { y: l.y - stp }); }
      else if (e.key === "ArrowDown") { e.preventDefault(); actions.patchLayer(id, { y: l.y + stp }); }
      else if (e.key === "Escape") { e.preventDefault(); actions.selectLayer(undefined); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.patchLayer(id, { visible: false });
        actions.selectLayer(undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, state.selectedLayerId, activeComposition.layers]);


  const downloadSingle = useCallback(async () => {
    const dataUrl = await renderCompositionToDataURL(
      activeFormat, activeComposition, state.textFields, "png", state.ci, ciContext,
    );
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${slugifyFormat(activeFormat)}-${activeFormat.width}x${activeFormat.height}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [activeFormat, activeComposition, state.textFields, state.ci, ciContext]);

  const downloadZip = useCallback(async () => {
    setZipBusy(true);
    try {
      const zip = new JSZip();
      for (const id of state.selectedFormatIds) {
        const f = getFormatById(id);
        const comp = state.compositions[id];
        if (!comp) continue;
        const blob = await renderCompositionToBlob(f, comp, state.textFields, "png", state.ci, ciContext);
        zip.file(`${slugifyFormat(f)}-${f.width}x${f.height}.png`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `banner-quick-${state.selectedFormatIds.length}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("ZIP heruntergeladen.");
    } catch (e: any) {
      toast.error(e?.message ?? "ZIP-Export fehlgeschlagen");
    } finally {
      setZipBusy(false);
    }
  }, [state.selectedFormatIds, state.compositions, state.textFields, state.ci, ciContext]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-3 py-2 max-w-6xl flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => {
              onApply?.(state.compositions, state.textFields);
              onBack();
            }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Vorschau
            </Button>
            <h2 className="text-sm font-semibold text-foreground truncate">Bearbeiten</h2>
            <Badge variant="secondary" className="text-[10px]">Quick</Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Rückgängig (Cmd/Ctrl+Z)"
              disabled={!canUndo}
              onClick={actions.undo}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Wiederherstellen (Shift+Cmd/Ctrl+Z)"
              disabled={!canRedo}
              onClick={actions.redo}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            {formatOverridden && (
              <button
                type="button"
                title="Layout zurücksetzen"
                onClick={() => { actions.resetLayout(); toast.success("Layout zurückgesetzt"); }}
                className="p-1.5 rounded hover:bg-muted text-amber-600"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <Button size="sm" variant="ghost" onClick={handleManualSave} disabled={saving} title="Als Canvas-Projekt speichern">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : state.bannerProjectId ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              {state.bannerProjectId ? "Gespeichert" : "Speichern"}
            </Button>
            <Button size="sm" variant="outline" onClick={downloadSingle}>
              <Download className="w-3.5 h-3.5 mr-1" /> PNG
            </Button>
            <Button size="sm" disabled={zipBusy} onClick={downloadZip}>
              <Package className="w-3.5 h-3.5 mr-1" /> ZIP
            </Button>
          </div>
        </div>

        {/* Canvas-Projekt: Titel + Fahrzeug verknüpfen (Auto-Save im Dashboard) */}
        <div className="container mx-auto px-3 pb-2 max-w-6xl">
          <VehicleBannerPicker
            vehicleId={state.vehicleId}
            projectTitle={state.projectTitle}
            onChangeVehicle={(v) => actions.setVehicle(v)}
            onChangeTitle={(t) => actions.setProjectTitle(t)}
            bannerProjectId={state.bannerProjectId}
          />
        </div>

        {/* Format-Tabs */}
        <div className="container mx-auto px-3 pb-2 max-w-6xl">
          <div className="flex gap-1.5 overflow-x-auto">
            {state.selectedFormatIds.map((id) => {
              const f = getFormatById(id);
              const active = id === state.activeFormatId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => actions.setActiveFormat(id)}
                  className={`shrink-0 px-2.5 py-1 rounded text-[11px] border transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-background text-foreground border-border hover:border-accent/50"
                  }`}
                >
                  {f.name} <span className="opacity-60">{f.width}×{f.height}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-3 py-3 max-w-6xl grid gap-3 lg:grid-cols-[1fr_360px]">
        {/* Canvas */}
        <div className="relative w-full aspect-square lg:aspect-auto lg:h-[calc(100vh-180px)] min-h-[300px] rounded-xl border border-border overflow-hidden bg-card">
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
            onSelectedLayerScreenChange={setSelectedScreen}
          />
          {selectedLayer && selectedScreen && (
            <FloatingToolbar
              layer={selectedLayer}
              composition={activeComposition}
              format={activeFormat}
              screen={selectedScreen}
              resolveColor={resolveColor}
              getStageCanvas={() => stageRef.current?.toCanvas({ pixelRatio: 1 }) ?? null}
              onPatch={(patch) => actions.patchLayer(selectedLayer.id, patch)}
              onResetLayer={() => { actions.resetLayer(selectedLayer.id); toast.success("Layer zurückgesetzt"); }}
              isOverridden={selectedOverridden}
            />
          )}
        </div>

        {/* Inspector — Texte, Ebenen (mit Form/Bild/Logo-Editor) */}
        <div className="space-y-3">
          <QuickInspector
            composition={activeComposition}
            format={activeFormat}
            selectedLayerId={state.selectedLayerId}
            ci={state.ci}
            dealerProfile={dealerProfile}
            onAddLayer={actions.addLayer}
            onPatchLayer={actions.patchLayer}
            onRemoveLayer={actions.removeLayer}
            onSelectLayer={actions.selectLayer}
            onReorderLayer={actions.reorderLayer}
            onResetLayout={actions.resetLayout}
            canRegenerateBackground={!!vehicleImageDataUrl}
            backgroundRegenerating={bgRegenerating}
            onRegenerateBackground={handleRegenerateBackground}
          />
          <TextFieldsPanel
            textFields={state.textFields}
            composition={activeComposition}
            onChangeText={actions.setText}
            onPatchLayer={actions.patchLayer}
            onReorderLayer={actions.reorderLayer}
            ciContext={ciContext}
            ciColors={state.ci?.colors}
            selectedLayerId={state.selectedLayerId}
            onSelectLayer={actions.selectLayer}
          />
        </div>
      </div>
    </div>
  );
};

export default QuickEditView;
