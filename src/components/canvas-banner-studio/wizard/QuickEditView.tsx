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
import { ArrowLeft, Download, Package, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCanvasBannerStore } from "../state/useCanvasBannerStore";
import BannerCanvas from "../canvas/BannerCanvas";
import TextFieldsPanel from "../controls/TextFieldsPanel";
import CustomLayersPanel from "../controls/CustomLayersPanel";
import FloatingToolbar from "../controls/FloatingToolbar";
import { getFormatById, slugifyFormat } from "../data/formats";
import { renderCompositionToBlob, renderCompositionToDataURL } from "../export/renderComposition";
import type { BannerComposition, BannerTextFields, CiState } from "../state/types";
import { buildCiContext, type DealerProfile } from "../ci/profileSources";
import { isLayerOverridden, isCompositionOverridden } from "../state/overrideDetection";

interface Props {
  initialFormatIds: string[];
  initialActiveFormatId: string;
  initialTextFields: BannerTextFields;
  initialCompositions: Record<string, BannerComposition>;
  ci?: Partial<CiState>;
  dealerProfile: DealerProfile | null;
  onBack: () => void;
}

const QuickEditView: React.FC<Props> = ({
  initialFormatIds,
  initialActiveFormatId,
  initialTextFields,
  initialCompositions,
  ci,
  dealerProfile,
  onBack,
}) => {
  const { state, actions, activeComposition, activeFormat, resolveColor, canUndo, canRedo } = useCanvasBannerStore();
  const stageRef = useRef<Konva.Stage | null>(null);
  const hydratedRef = useRef(false);
  const [selectedScreen, setSelectedScreen] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zipBusy, setZipBusy] = useState(false);

  // Einmalige Hydration aus den Quick-Generate Ergebnissen.
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
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const centerLayer = useCallback((id: string) => {
    const l = activeComposition.layers.find((x) => x.id === id);
    if (!l) return;
    const w = l.width ?? Math.round(activeFormat.width * 0.6);
    actions.patchLayer(id, { x: Math.round((activeFormat.width - w) / 2) });
  }, [actions, activeComposition.layers, activeFormat.width]);

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
            <Button variant="ghost" size="sm" onClick={onBack}>
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
            <Button size="sm" variant="outline" onClick={downloadSingle}>
              <Download className="w-3.5 h-3.5 mr-1" /> PNG
            </Button>
            <Button size="sm" disabled={zipBusy} onClick={downloadZip}>
              <Package className="w-3.5 h-3.5 mr-1" /> ZIP
            </Button>
          </div>
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

        {/* Inspector — nur Texte & Layer-Reihenfolge */}
        <div className="space-y-3">
          <LayerOrderControls
            selectedLayerId={state.selectedLayerId}
            composition={activeComposition}
            format={activeFormat}
            onReorder={(id, dir) => actions.reorderLayer(id, dir)}
            onCenter={centerLayer}
            onReset={() => { actions.resetLayout(); toast.success("Layout zurückgesetzt"); }}
          />
          <TextFieldsPanel
            textFields={state.textFields}
            composition={activeComposition}
            onChangeText={actions.setText}
            onPatchLayer={actions.patchLayer}
            onReorderLayer={actions.reorderLayer}
          />
        </div>
      </div>
    </div>
  );
};

export default QuickEditView;
