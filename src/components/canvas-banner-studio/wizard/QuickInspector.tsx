/**
 * Schlanker Inspector für den Quick-Editor.
 *
 * Aufbau (so wie der Nutzer ihn vor der letzten Iteration kannte):
 *  - Hinzufügen-Toolbar: Text · Form · Bild · Logo
 *  - LayerOrderControls (Zentrieren / Vorne / Hinten / Layout zurücksetzen)
 *  - Eigenschaften-Panel für die ausgewählte Ebene (Farbe inkl. CI-Palette,
 *    Größe, Position, Ausrichtung, SVG-Einfärbung)
 *  - Logo-Picker-Dialog (Händler / Hersteller-DB / Upload)
 */
import React, { useMemo, useRef, useState } from "react";
import { Type, Square, Image as ImageIcon, BadgeCheck, Eye, EyeOff, Trash2, Upload, Search, ArrowDownToLine, Sparkles, Loader2 } from "lucide-react";
import { MARKETING_PROMPTS } from "../data/marketingPrompts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

import LayerOrderControls from "../controls/LayerOrderControls";
import { useVehicleMakes } from "@/hooks/useVehicleMakes";
import { supabase } from "@/integrations/supabase/client";
import { recolorSvg, recolorRaster, isSvgUrlSync, detectIsSvg } from "../ci/svgRecolor";
import type { DealerProfile } from "../ci/profileSources";
import type {
  BannerComposition, BannerFormat, BannerLayer, CiState, TextAlign,
} from "../state/types";

const STANDARD_IDS = new Set([
  "headline", "subline", "price", "cta", "smallInfo", "legal",
  "logo", "logo-dealer", "logo-custom", "background", "overlay",
]);

const isCustomLayer = (l: BannerLayer) => !STANDARD_IDS.has(l.id);

const COLOR_TOKENS: { token: string; label: string }[] = [
  { token: "background", label: "Hell" },
  { token: "foreground", label: "Dunkel" },
  { token: "accent", label: "Akzent" },
  { token: "primary", label: "Primary" },
];

interface Props {
  composition: BannerComposition;
  format: BannerFormat;
  selectedLayerId?: string;
  ci?: CiState;
  dealerProfile: DealerProfile | null;
  onAddLayer: (layer: BannerLayer) => void;
  onPatchLayer: (id: string, patch: Partial<BannerLayer>) => void;
  onRemoveLayer: (id: string) => void;
  onSelectLayer: (id?: string) => void;
  onReorderLayer: (id: string, direction: "forward" | "backward") => void;
  onResetLayout: () => void;
  canRegenerateBackground?: boolean;
  backgroundRegenerating?: boolean;
  onRegenerateBackground?: (presetId: string, extraInstruction: string) => void | Promise<void>;
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const QuickInspector: React.FC<Props> = ({
  composition, format, selectedLayerId, ci, dealerProfile,
  onAddLayer, onPatchLayer, onRemoveLayer, onSelectLayer, onReorderLayer, onResetLayout,
  canRegenerateBackground, backgroundRegenerating, onRegenerateBackground,
}) => {
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const logoUploadRef = useRef<HTMLInputElement | null>(null);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [logoQuery, setLogoQuery] = useState("");
  const [bgPresetId, setBgPresetId] = useState<string>(MARKETING_PROMPTS[0]?.id ?? "");
  const [bgExtra, setBgExtra] = useState<string>("");

  const ciSwatches = useMemo(() => {
    const c = ci?.colors;
    if (!c) return [];
    return [
      { value: c.primary, label: "CI Primary" },
      { value: c.secondary, label: "CI Secondary" },
      { value: c.text, label: "CI Text" },
      { value: c.bg, label: "CI Hintergrund" },
    ].filter((x) => !!x.value);
  }, [ci?.colors]);

  const { makes, filterMakes, getLogoForMake } = useVehicleMakes();
  const filteredMakes = useMemo(
    () =>
      (logoQuery ? filterMakes(logoQuery) : makes)
        .map((m) => ({ key: m.key, url: getLogoForMake(m.key) }))
        .filter((m) => !!m.url)
        .slice(0, 60),
    [logoQuery, makes, filterMakes, getLogoForMake],
  );

  const selected = composition.layers.find((l) => l.id === selectedLayerId);
  const isBackgroundSelected = selectedLayerId === "__background__";
  const editable = selected; // alle Layer dürfen Farbe/Position/Ausrichtung haben

  const cx = Math.round(format.width / 2);
  const cy = Math.round(format.height / 2);

  // ---------- Add: Text / Form / Bild ----------
  const addText = () => {
    const w = Math.round(format.width * 0.5);
    const layer: BannerLayer = {
      id: newId("text"), type: "text", content: "Neuer Text",
      x: cx - w / 2, y: cy - 40, width: w,
      fontSize: Math.round(format.width * 0.045), fontWeight: 600,
      align: "center", color: "foreground", visible: true, draggable: true,
    };
    onAddLayer(layer); onSelectLayer(layer.id);
  };

  const addShape = () => {
    const w = Math.round(format.width * 0.4);
    const h = Math.round(format.height * 0.15);
    const layer: BannerLayer = {
      id: newId("shape"), type: "shape",
      x: cx - w / 2, y: cy - h / 2, width: w, height: h,
      backgroundColor: ci?.colors?.primary || "#000000", opacity: 0.4,
      borderRadius: 8, visible: true, draggable: true,
    };
    onAddLayer(layer); onSelectLayer(layer.id);
  };

  const addGradient = () => {
    const w = format.width;
    const h = Math.round(format.height * 0.45);
    const layer: BannerLayer = {
      id: newId("gradient"), type: "shape",
      x: 0, y: 0, width: w, height: h,
      backgroundColor: "#000000", opacity: 0.7, borderRadius: 0,
      visible: true, draggable: true,
      gradient: { direction: "bottom-top", color: "#000000" },
    };
    const stepsToBack = composition.layers.length;
    onAddLayer(layer);
    onSelectLayer(layer.id);
    // Move newly added gradient to the very back so text stays readable
    for (let i = 0; i < stepsToBack; i++) onReorderLayer(layer.id, "backward");
  };


  const uploadImage = async (file: File, asLogo = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Bitte einloggen"); return; }
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/banner-layers/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("vehicle-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
      placeImageLayer(data.publicUrl, asLogo);
    } catch (e: any) {
      console.error(e); toast.error(e?.message ?? "Upload fehlgeschlagen");
    }
  };

  const placeImageLayer = (url: string, asLogo = false) => {
    const w = Math.round(format.width * (asLogo ? 0.22 : 0.3));
    const h = Math.round(format.height * (asLogo ? 0.12 : 0.3));
    const layer: BannerLayer = {
      id: newId(asLogo ? "logo" : "image"), type: "image",
      x: cx - w / 2, y: cy - h / 2, width: w, height: h,
      opacity: 1, visible: true, draggable: true, imageUrl: url,
    };
    onAddLayer(layer); onSelectLayer(layer.id);
    setLogoPickerOpen(false);
  };

  // ---------- Recoloring für Bild-/Logo-Layer (SVG bevorzugt, PNG/WEBP als Fallback) ----------
  const resolveLayerSourceUrl = (layer: BannerLayer): string | undefined => {
    if (layer.imageUrl) return layer.imageUrl;
    if (layer.type === "logo") {
      if (layer.id === "logo-dealer") return composition.dealerLogoUrl;
      if (layer.id === "logo-custom") return composition.customLogoUrl;
      return composition.logoUrl;
    }
    return undefined;
  };

  const applyTint = async (layer: BannerLayer, color: string) => {
    const url = resolveLayerSourceUrl(layer);
    if (!url) {
      toast.error("Kein Logo-Bild gefunden.");
      return;
    }
    try {
      const looksSvg = isSvgUrlSync(url) || (await detectIsSvg(url));
      const tinted = looksSvg
        ? await recolorSvg(url, "custom", color)
        : await recolorRaster(url, color);
      if (tinted === url) {
        toast.error("Logo konnte nicht eingefärbt werden.");
        return;
      }
      onPatchLayer(layer.id, { imageUrl: tinted });
    } catch {
      toast.error("Einfärben fehlgeschlagen");
    }
  };

  return (
    <div className="space-y-3">
      {/* Hinzufügen */}
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Ebene hinzufügen</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={addText}>
            <Type className="w-3.5 h-3.5 mr-1.5" /> Text
          </Button>
          <Button size="sm" variant="outline" onClick={addShape}>
            <Square className="w-3.5 h-3.5 mr-1.5" /> Form
          </Button>
          <Button size="sm" variant="outline" onClick={addGradient}>
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" /> Verlauf
          </Button>
          <Button size="sm" variant="outline" onClick={() => imgInputRef.current?.click()}>
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Bild
          </Button>
          <Dialog open={logoPickerOpen} onOpenChange={setLogoPickerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <BadgeCheck className="w-3.5 h-3.5 mr-1.5" /> Logo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Logo hinzufügen</DialogTitle>
                <DialogDescription>
                  Wähle ein Händler-Logo, ein Hersteller-Logo aus der Datenbank oder lade dein eigenes hoch.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {dealerProfile?.logo_url && (
                  <div>
                    <Label className="text-xs">Händler-Logo</Label>
                    <button
                      type="button"
                      onClick={() => placeImageLayer(dealerProfile.logo_url!, true)}
                      className="mt-1 flex items-center gap-3 w-full rounded-md border border-border p-2 hover:border-accent"
                    >
                      <img src={dealerProfile.logo_url} alt="" className="h-10 w-auto object-contain" />
                      <span className="text-sm text-foreground truncate">{dealerProfile.company_name || "Mein Händler"}</span>
                    </button>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Hersteller-Logo (Datenbank)</Label>
                  <div className="relative mt-1">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                    <Input
                      value={logoQuery}
                      onChange={(e) => setLogoQuery(e.target.value)}
                      placeholder="Marke suchen…"
                      className="pl-8 h-9"
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                    {filteredMakes.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => placeImageLayer(m.url!, true)}
                        className="flex flex-col items-center gap-1 rounded border border-border p-2 hover:border-accent"
                        title={m.key}
                      >
                        <img src={m.url!} alt={m.key} className="h-8 w-auto object-contain" />
                        <span className="text-[10px] text-muted-foreground truncate w-full text-center">{m.key}</span>
                      </button>
                    ))}
                    {filteredMakes.length === 0 && (
                      <p className="col-span-4 text-[11px] text-muted-foreground py-3 text-center">
                        Keine Marke gefunden.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Eigenes Logo hochladen</Label>
                  <Button
                    size="sm" variant="outline" className="mt-1 w-full"
                    onClick={() => logoUploadRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Datei wählen (PNG, JPG, SVG)
                  </Button>
                  <input
                    ref={logoUploadRef} type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f, true);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <input
            ref={imgInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadImage(f, false);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Reihenfolge / Layout */}
      <LayerOrderControls
        selectedLayerId={selectedLayerId}
        composition={composition}
        format={format}
        onReorder={onReorderLayer}
        onCenter={(id) => {
          const l = composition.layers.find((x) => x.id === id);
          if (!l) return;
          const w = l.width ?? format.width * 0.5;
          onPatchLayer(id, { x: Math.round((format.width - w) / 2) });
        }}
        onReset={onResetLayout}
      />

      {/* Hintergrund-Editor (wenn Hintergrundbild angeklickt wurde) */}
      {isBackgroundSelected && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ImageIcon className="w-3 h-3" />
            <span>Hintergrund</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">X</span>
              <Input type="number" value={Math.round(composition.backgroundX ?? 0)} className="h-7"
                onChange={(e) => onPatchLayer("__background__", { x: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Y</span>
              <Input type="number" value={Math.round(composition.backgroundY ?? 0)} className="h-7"
                onChange={(e) => onPatchLayer("__background__", { y: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Breite</span>
              <Input type="number" value={Math.round(composition.backgroundWidth ?? format.width)} className="h-7"
                onChange={(e) => onPatchLayer("__background__", { width: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Höhe</span>
              <Input type="number" value={Math.round(composition.backgroundHeight ?? format.height)} className="h-7"
                onChange={(e) => onPatchLayer("__background__", { height: Number(e.target.value) })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const w = composition.backgroundWidth ?? format.width;
              const h = composition.backgroundHeight ?? format.height;
              onPatchLayer("__background__", {
                x: Math.round((format.width - w) / 2),
                y: Math.round((format.height - h) / 2),
              });
            }}>Zentrieren</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const w = composition.backgroundWidth ?? format.width;
              const h = composition.backgroundHeight ?? format.height;
              onPatchLayer("__background__", { width: Math.round(w * 1.1), height: Math.round(h * 1.1) });
            }}>Vergrößern +10%</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const w = composition.backgroundWidth ?? format.width;
              const h = composition.backgroundHeight ?? format.height;
              onPatchLayer("__background__", { width: Math.round(w * 0.9), height: Math.round(h * 0.9) });
            }}>Verkleinern −10%</Button>
            <Button size="sm" variant="ghost" onClick={() => {
              // Reset to auto-fit by clearing overrides.
              onPatchLayer("__background__", { x: undefined as any, y: undefined as any, width: undefined as any, height: undefined as any });
            }}>Auto-Fit</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Tipp: Klicke das Hintergrundbild im Canvas an und ziehe an den Ecken zum Skalieren.
          </p>

          {/* Hintergrund neu generieren (nur für dieses Banner) */}
          {canRegenerateBackground && onRegenerateBackground && (
            <div className="mt-2 border-t border-border pt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="w-3 h-3" />
                <span>Hintergrund nur für dieses Banner neu generieren</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Verwendet dein hochgeladenes Original-Fahrzeugbild. Andere Formate bleiben unverändert.
              </p>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Szene</span>
                <select
                  value={bgPresetId}
                  onChange={(e) => setBgPresetId(e.target.value)}
                  className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  disabled={backgroundRegenerating}
                >
                  {MARKETING_PROMPTS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                {(() => {
                  const p = MARKETING_PROMPTS.find((x) => x.id === bgPresetId);
                  return p ? (
                    <span className="block mt-1 text-[10px] text-muted-foreground leading-tight">{p.description}</span>
                  ) : null;
                })()}
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Zusätzliche Anweisungen (optional)
                </span>
                <Textarea
                  value={bgExtra}
                  onChange={(e) => setBgExtra(e.target.value)}
                  placeholder="z.B. Winterstimmung mit Schnee, Black-Friday-Akzente, Sommer am Strand …"
                  className="mt-1 min-h-[60px] text-xs"
                  maxLength={600}
                  disabled={backgroundRegenerating}
                />
              </label>
              <Button
                size="sm"
                className="w-full"
                disabled={backgroundRegenerating || !bgPresetId}
                onClick={() => onRegenerateBackground(bgPresetId, bgExtra)}
              >
                {backgroundRegenerating ? (
                  <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Hintergrund wird neu generiert…</>
                ) : (
                  <><Sparkles className="w-3 h-3 mr-2" /> Hintergrund neu generieren</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}



      {/* Eigenschaften der ausgewählten Ebene */}
      {editable && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              {selected!.type === "text" && <Type className="w-3 h-3" />}
              {selected!.type === "shape" && <Square className="w-3 h-3" />}
              {selected!.type === "image" && <ImageIcon className="w-3 h-3" />}
              {selected!.type === "logo" && <BadgeCheck className="w-3 h-3" />}
              <span className="truncate">{selected!.id}</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button" className="p-1 text-muted-foreground hover:text-foreground"
                onClick={() => onPatchLayer(selected!.id, { visible: !selected!.visible })}
                title="Sichtbarkeit"
              >
                {selected!.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              {isCustomLayer(selected!) && (
                <button
                  type="button" className="p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveLayer(selected!.id)}
                  title="Löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Position & Größe */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">X</span>
              <Input type="number" value={Math.round(selected!.x)} className="h-7"
                onChange={(e) => onPatchLayer(selected!.id, { x: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Y</span>
              <Input type="number" value={Math.round(selected!.y)} className="h-7"
                onChange={(e) => onPatchLayer(selected!.id, { y: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Breite</span>
              <Input type="number" value={selected!.width ?? 0} className="h-7"
                onChange={(e) => onPatchLayer(selected!.id, { width: Number(e.target.value) })} />
            </label>
            {(selected!.type === "shape" || selected!.type === "image") && (
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Höhe</span>
                <Input type="number" value={selected!.height ?? 0} className="h-7"
                  onChange={(e) => onPatchLayer(selected!.id, { height: Number(e.target.value) })} />
              </label>
            )}
          </div>

          {/* Text-spezifisch */}
          {selected!.type === "text" && (
            <>
              {!selected!.field && (
                <Textarea
                  rows={2} value={selected!.content ?? ""}
                  onChange={(e) => onPatchLayer(selected!.id, { content: e.target.value })}
                />
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-1 text-muted-foreground">
                  Größe
                  <input
                    type="range" min={10} max={Math.max(80, (selected!.fontSize ?? 24) * 2)}
                    value={selected!.fontSize ?? 24}
                    onChange={(e) => onPatchLayer(selected!.id, { fontSize: Number(e.target.value) })}
                    className="accent-[hsl(var(--accent))]"
                  />
                  <span className="tabular-nums w-7 text-right">{selected!.fontSize}</span>
                </label>
                <select
                  value={selected!.align ?? "left"}
                  onChange={(e) => onPatchLayer(selected!.id, { align: e.target.value as TextAlign })}
                  className="text-xs rounded border border-border bg-background px-1.5 py-1"
                >
                  <option value="left">links</option>
                  <option value="center">mitte</option>
                  <option value="right">rechts</option>
                </select>
                <button
                  type="button"
                  onClick={() => onPatchLayer(selected!.id, { fontWeight: (selected!.fontWeight ?? 400) >= 600 ? 400 : 800 })}
                  className={`px-2 py-1 rounded border text-[11px] ${
                    (selected!.fontWeight ?? 400) >= 600 ? "border-accent bg-accent/10" : "border-border"
                  }`}
                >B</button>
              </div>
              <ColorRow
                label="Farbe"
                value={selected!.color}
                tokens={COLOR_TOKENS}
                ciSwatches={ciSwatches}
                onPick={(c) => onPatchLayer(selected!.id, { color: c })}
              />
            </>
          )}

          {/* Form-spezifisch */}
          {selected!.type === "shape" && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <Label className="text-xs">Farbe</Label>
                <input
                  type="color"
                  value={selected!.backgroundColor?.startsWith("#") ? selected!.backgroundColor : "#000000"}
                  onChange={(e) => onPatchLayer(selected!.id, { backgroundColor: e.target.value })}
                  className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                />
                <label className="flex items-center gap-1 text-muted-foreground flex-1">
                  Deckkraft
                  <input
                    type="range" min={0} max={100}
                    value={Math.round((selected!.opacity ?? 1) * 100)}
                    onChange={(e) => onPatchLayer(selected!.id, { opacity: Number(e.target.value) / 100 })}
                    className="accent-[hsl(var(--accent))] flex-1"
                  />
                  <span className="tabular-nums w-9 text-right">{Math.round((selected!.opacity ?? 1) * 100)}%</span>
                </label>
              </div>
              <ColorRow
                label="CI-Farben"
                value={selected!.backgroundColor}
                ciSwatches={ciSwatches}
                onPick={(c) => onPatchLayer(selected!.id, { backgroundColor: c })}
              />
              <label className="flex flex-col gap-0.5 text-xs">
                <span className="text-muted-foreground">Eckenradius</span>
                <Input type="number" value={selected!.borderRadius ?? 0} className="h-7"
                  onChange={(e) => onPatchLayer(selected!.id, { borderRadius: Number(e.target.value) })} />
              </label>
              {selected!.gradient && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs flex items-center gap-1">
                    <ArrowDownToLine className="w-3 h-3" /> Verlauf (100% → 0%)
                  </Label>
                  <div className="flex items-center gap-2 text-xs">
                    <Label className="text-xs">Farbe</Label>
                    <input
                      type="color"
                      value={selected!.gradient.color}
                      onChange={(e) => onPatchLayer(selected!.id, {
                        gradient: { ...selected!.gradient!, color: e.target.value },
                        backgroundColor: e.target.value,
                      })}
                      className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {ciSwatches.map((c) => (
                        <button
                          key={`grad-${c.value}`} type="button" title={c.label}
                          onClick={() => onPatchLayer(selected!.id, {
                            gradient: { ...selected!.gradient!, color: c.value },
                            backgroundColor: c.value,
                          })}
                          className="w-5 h-5 rounded-full border-2 border-border hover:border-foreground"
                          style={{ background: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Richtung</Label>
                    <div className="grid grid-cols-2 gap-1">
                      {([
                        { v: "bottom-top", l: "↑ unten → oben" },
                        { v: "top-bottom", l: "↓ oben → unten" },
                        { v: "left-right", l: "→ links → rechts" },
                        { v: "right-left", l: "← rechts → links" },
                      ] as const).map((d) => (
                        <button
                          key={d.v} type="button"
                          onClick={() => onPatchLayer(selected!.id, {
                            gradient: { ...selected!.gradient!, direction: d.v },
                          })}
                          className={`text-[11px] px-2 py-1 rounded border ${
                            selected!.gradient?.direction === d.v
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-border text-muted-foreground"
                          }`}
                        >{d.l}</button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Tipp: Höhe und Position über die Felder oben anpassen, um Lesbarkeit von Text zu verbessern.
                  </p>
                </div>
              )}
            </>
          )}


          {/* Bild / Logo */}
          {(selected!.type === "image" || selected!.type === "logo") && (
            <>
              {selected!.imageUrl && (
                <img src={selected!.imageUrl} alt="" className="max-h-20 rounded border border-border object-contain bg-muted" />
              )}
              <label className="flex items-center gap-1 text-muted-foreground text-xs">
                Deckkraft
                <input
                  type="range" min={0} max={100}
                  value={Math.round((selected!.opacity ?? 1) * 100)}
                  onChange={(e) => onPatchLayer(selected!.id, { opacity: Number(e.target.value) / 100 })}
                  className="accent-[hsl(var(--accent))] flex-1"
                />
                <span className="tabular-nums w-9 text-right">{Math.round((selected!.opacity ?? 1) * 100)}%</span>
              </label>
              <div>
                <Label className="text-xs">Logo einfärben</Label>
                <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                  {ciSwatches.map((c) => (
                    <button
                      key={`tint-${c.value}`} type="button" title={c.label}
                      onClick={() => applyTint(selected!, c.value)}
                      className="w-5 h-5 rounded-full border-2 border-border hover:border-foreground"
                      style={{ background: c.value }}
                    />
                  ))}
                  <label
                    className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border cursor-pointer"
                    title="Eigene Farbe"
                  >
                    <span className="w-3 h-3 rounded-sm border border-border bg-foreground" />
                    Custom
                    <input
                      type="color" className="sr-only"
                      onChange={(e) => applyTint(selected!, e.target.value)}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Funktioniert für SVG-Logos und transparente PNG/WEBP (Silhouetten-Einfärbung).
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface ColorRowProps {
  label: string;
  value?: string;
  tokens?: { token: string; label: string }[];
  ciSwatches: { value: string; label: string }[];
  onPick: (color: string) => void;
}

const ColorRow: React.FC<ColorRowProps> = ({ label, value, tokens, ciSwatches, onPick }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <div className="flex gap-1 flex-wrap">
      {tokens?.map((c) => (
        <button
          key={c.token} type="button" title={c.label}
          onClick={() => onPick(c.token)}
          className={`w-5 h-5 rounded-full border-2 ${value === c.token ? "border-foreground" : "border-border"}`}
          style={{ background: `hsl(var(--${c.token}))` }}
        />
      ))}
      {ciSwatches.map((c) => (
        <button
          key={`ci-${c.value}`} type="button" title={c.label}
          onClick={() => onPick(c.value)}
          className={`w-5 h-5 rounded-full border-2 ${(value ?? "").toLowerCase() === c.value.toLowerCase() ? "border-foreground" : "border-border"}`}
          style={{ background: c.value }}
        />
      ))}
    </div>
  </div>
);

export default QuickInspector;
