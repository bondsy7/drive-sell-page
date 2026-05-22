import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, Type, Palette, ImageIcon } from "lucide-react";

import LayoutTemplatePicker from "../controls/LayoutTemplatePicker";
import TextFieldsPanel from "../controls/TextFieldsPanel";
import OverlayControls from "../controls/OverlayControls";
import LogoPanel from "../controls/LogoPanel";
import CiPanel from "../ci/CiPanel";
import Step2Master from "../step2/Step2Master";

import type { CanvasBannerStore } from "../state/useCanvasBannerStore";
import type { DealerProfile, CiContext } from "../ci/profileSources";
import type { BannerTextFieldKey } from "../state/types";

interface Props {
  store: CanvasBannerStore;
  profile: DealerProfile | null;
  ciContext: CiContext;
  detectedBrandKey: string | undefined;
  manufacturerLogoUrl?: string;
  dealerLogoUrl?: string;
  userId?: string;
  applyLogoToAll: boolean;
  onToggleApplyLogoToAll: (v: boolean) => void;
  defaultTab?: string;
}

const InspectorPanel: React.FC<Props> = ({
  store,
  profile,
  ciContext,
  detectedBrandKey,
  manufacturerLogoUrl,
  dealerLogoUrl,
  userId,
  applyLogoToAll,
  onToggleApplyLogoToAll,
  defaultTab = "texts",
}) => {
  const { state, actions, activeComposition } = store;

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="layout"><Layers className="w-3.5 h-3.5 mr-1" /> Layout</TabsTrigger>
        <TabsTrigger value="texts"><Type className="w-3.5 h-3.5 mr-1" /> Texte</TabsTrigger>
        <TabsTrigger value="bg"><ImageIcon className="w-3.5 h-3.5 mr-1" /> Bild</TabsTrigger>
        <TabsTrigger value="ci"><Palette className="w-3.5 h-3.5 mr-1" /> CI</TabsTrigger>
      </TabsList>

      <TabsContent value="layout" className="space-y-4 pt-4">
        <h3 className="text-sm font-semibold text-foreground">Layout-Vorlage</h3>
        <LayoutTemplatePicker
          selectedId={activeComposition.selectedTemplateId}
          onSelect={(id) => actions.setTemplate(id)}
        />
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Skalierung</h4>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round((activeComposition.scale ?? 1) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={160}
            step={5}
            value={Math.round((activeComposition.scale ?? 1) * 100)}
            onChange={(e) => actions.setFormatScale(Number(e.target.value) / 100)}
            className="w-full accent-primary"
          />
        </div>
      </TabsContent>

      <TabsContent value="texts" className="space-y-4 pt-4">
        <TextFieldsPanel
          textFields={state.textFields}
          composition={activeComposition}
          onChangeText={actions.setText}
          onPatchLayer={actions.patchLayer}
          onReorderLayer={actions.reorderLayer}
          selectedLayerId={state.selectedLayerId}
          onSelectLayer={actions.selectLayer}
        />
      </TabsContent>

      <TabsContent value="bg" className="space-y-4 pt-4">
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
        <OverlayControls
          fit={activeComposition.backgroundFit}
          direction={activeComposition.overlayDirection}
          strength={activeComposition.overlayStrength}
          onFit={(f) => actions.setBgFit(f)}
          onOverlay={(d, s) => actions.setOverlay(d, s)}
        />
      </TabsContent>

      <TabsContent value="ci" className="space-y-4 pt-4">
        {state.ci && (
          <CiPanel
            ci={state.ci}
            ciContext={ciContext}
            hasProfile={!!profile}
            detectedBrandKey={detectedBrandKey}
            activeManufacturerLogoUrl={activeComposition.logoUrl}
            activeDealerLogoUrl={activeComposition.dealerLogoUrl}
            activeCustomLogoUrl={activeComposition.customLogoUrl}
            manufacturerLogoUrl={manufacturerLogoUrl}
            dealerLogoUrl={dealerLogoUrl}
            customLogoUrl={state.ci.customLogoUrl}
            userId={userId}
            onApplyBrandPreset={actions.applyBrandPreset}
            onPatchCi={actions.setCi}
            onToggleLogoSlot={(slot, url) =>
              actions.setLogoSlot(slot, url, applyLogoToAll ? "all" : "current")
            }
            onClearAllLogos={() => actions.clearAllLogos(applyLogoToAll ? "all" : "current")}
            selectedFormatsCount={state.selectedFormatIds.length}
            applyLogoToAll={applyLogoToAll}
            onToggleApplyLogoToAll={onToggleApplyLogoToAll}
          />
        )}
        <div className="pt-2 border-t border-border space-y-2">
          <h4 className="text-sm font-semibold">Logo dieses Banners</h4>
          <LogoPanel
            logoUrl={activeComposition.logoUrl}
            onChange={(url) => actions.setLogo(url, applyLogoToAll ? "all" : "current")}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default InspectorPanel;
