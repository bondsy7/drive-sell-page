import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Trash2, Type, Square, ImageIcon, ArrowUp, ArrowDown, GripVertical, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { BannerComposition, BannerFormat, BannerLayer, CiState, TextAlign } from "../state/types";

const STANDARD_IDS = new Set(["headline", "subline", "price", "cta", "smallInfo", "legal", "logo", "background", "overlay"]);

const TYPE_LABELS: Record<BannerLayer["type"], string> = {
  image: "image",
  overlay: "overlay",
  text: "text",
  legal: "legal",
  logo: "logo",
  shape: "shape",
};

const isCustomLayer = (layer: BannerLayer) => !STANDARD_IDS.has(layer.id);

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
  onAddLayer: (layer: BannerLayer) => void;
  onPatchLayer: (id: string, patch: Partial<BannerLayer>) => void;
  onRemoveLayer: (id: string) => void;
  onSelectLayer: (id?: string) => void;
  onReorderLayer?: (id: string, direction: "forward" | "backward") => void;
  onMoveLayerToIndex?: (id: string, toIndex: number) => void;
  /** Zusätzliche CI/Template-Farben als Swatches in Text/Shape-Inspector. */
  ciColors?: CiState["colors"];
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const CustomLayersPanel: React.FC<Props> = ({
  composition,
  format,
  selectedLayerId,
  onAddLayer,
  onPatchLayer,
  onRemoveLayer,
  onSelectLayer,
  onReorderLayer,
  onMoveLayerToIndex,
  ciColors,
}) => {
  const ciSwatches = ciColors
    ? [
        { value: ciColors.primary, label: "CI Primary" },
        { value: ciColors.secondary, label: "CI Secondary" },
        { value: ciColors.text, label: "CI Text" },
        { value: ciColors.bg, label: "CI Hintergrund" },
      ].filter((c) => !!c.value)
    : [];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const selectedLayer = composition.layers.find((l) => l.id === selectedLayerId);
  const selectedCustomLayer = selectedLayer && isCustomLayer(selectedLayer) ? selectedLayer : undefined;

  // Same convention as the admin editor: array order is back→front, so the top
  // list entry is the background and the bottom entry is the foreground.
  const orderedForDisplay = composition.layers;

  const handleDrop = (sourceId: string | null, targetId: string) => {
    if (!sourceId || !onMoveLayerToIndex || sourceId === targetId) {
      setDragId(null); setDragOverId(null); return;
    }
    const targetDisplayIdx = orderedForDisplay.findIndex((l) => l.id === targetId);
    if (targetDisplayIdx < 0) { setDragId(null); setDragOverId(null); return; }
    onMoveLayerToIndex(sourceId, targetDisplayIdx);
    setDragId(null); setDragOverId(null);
  };

  const cx = Math.round(format.width / 2);
  const cy = Math.round(format.height / 2);

  const addText = () => {
    const w = Math.round(format.width * 0.5);
    const h = 80;
    const layer: BannerLayer = {
      id: newId("text"),
      type: "text",
      content: "Neuer Text",
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      fontSize: Math.round(format.width * 0.045),
      fontWeight: 600,
      align: "center",
      color: "foreground",
      visible: true,
      draggable: true,
    };
    onAddLayer(layer);
    onSelectLayer(layer.id);
  };

  const addShape = () => {
    const w = Math.round(format.width * 0.4);
    const h = Math.round(format.height * 0.15);
    const layer: BannerLayer = {
      id: newId("shape"),
      type: "shape",
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      backgroundColor: "#000000",
      opacity: 0.4,
      borderRadius: 8,
      visible: true,
      draggable: true,
    };
    onAddLayer(layer);
    onSelectLayer(layer.id);
  };

  const addGradient = () => {
    const w = format.width;
    const h = Math.round(format.height * 0.4);
    const layer: BannerLayer = {
      id: newId("gradient"),
      type: "shape",
      x: 0,
      y: 0,
      width: w,
      height: h,
      backgroundColor: "#000000",
      opacity: 0.8,
      borderRadius: 0,
      visible: true,
      draggable: true,
      gradient: { direction: "top-bottom", color: "#000000" },
    };
    const stepsToBack = composition.layers.length;
    onAddLayer(layer);
    onSelectLayer(layer.id);
    if (onReorderLayer) {
      for (let i = 0; i < stepsToBack; i++) onReorderLayer(layer.id, "backward");
    }
  };

  const handleImagePick = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Bitte einloggen");
        return;
      }
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/banner-layers/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("vehicle-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
      const w = Math.round(format.width * 0.3);
      const h = Math.round(format.height * 0.3);
      const layer: BannerLayer = {
        id: newId("image"),
        type: "image",
        imageUrl: data.publicUrl,
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        opacity: 1,
        visible: true,
        draggable: true,
      };
      onAddLayer(layer);
      onSelectLayer(layer.id);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Eigene Ebenen hinzufügen</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Text, Form (z.B. halbtransparente Box hinter Text) oder zusätzliches Bild.
        </p>
      </div>
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
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Bild
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImagePick(f);
            e.target.value = "";
          }}
        />
      </div>

      {orderedForDisplay.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Ebenen</h3>
            <p className="text-[10px] text-muted-foreground">Oben = Hintergrund · Unten = Vordergrund</p>
          </div>
          {orderedForDisplay.map((l) => {
            const selected = l.id === selectedLayerId;
            const custom = isCustomLayer(l);
            const isDragging = dragId === l.id;
            const isDragOver = dragOverId === l.id && dragId && dragId !== l.id;
            return (
              <div
                key={l.id}
                draggable={!!onMoveLayerToIndex}
                onDragStart={(e) => {
                  setDragId(l.id);
                  e.dataTransfer.setData("text/plain", l.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(l.id); }}
                onDragLeave={() => setDragOverId((cur) => (cur === l.id ? null : cur))}
                onDrop={(e) => { e.preventDefault(); handleDrop(e.dataTransfer.getData("text/plain") || dragId, l.id); }}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                className={`rounded-md border p-2.5 space-y-2 bg-card transition-opacity ${
                  selected ? "border-accent" : "border-border"
                } ${isDragging ? "opacity-50" : ""} ${
                  isDragOver ? "ring-2 ring-accent" : ""
                }`}
                onClick={() => onSelectLayer(l.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    {onMoveLayerToIndex && (
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    )}
                    {l.type === "text" && <Type className="w-3 h-3" />}
                    {l.type === "shape" && <Square className="w-3 h-3" />}
                    {l.type === "image" && <ImageIcon className="w-3 h-3" />}
                    <span className="truncate">{l.id}</span>
                  </div>
                  <div className="flex gap-0.5">
                    <span className="px-1.5 py-1 text-[11px] text-muted-foreground">{TYPE_LABELS[l.type]}</span>
                    {onReorderLayer && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, "backward"); }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Eine Ebene nach hinten"
                          aria-label="Eine Ebene nach hinten"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, "forward"); }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Eine Ebene nach vorne"
                          aria-label="Eine Ebene nach vorne"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onPatchLayer(l.id, { visible: !l.visible }); }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    {custom && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemoveLayer(l.id); }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCustomLayer && (
        <div className="rounded-md border border-border bg-card p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {selectedCustomLayer.type === "text" && <Type className="w-3 h-3" />}
            {selectedCustomLayer.type === "shape" && <Square className="w-3 h-3" />}
            {selectedCustomLayer.type === "image" && <ImageIcon className="w-3 h-3" />}
            <span>{selectedCustomLayer.id}</span>
          </div>

          {(() => {
            const l = selectedCustomLayer;
            return (
              <>
                {l.type === "text" && (
                  <>
                    <Textarea
                      rows={2}
                      value={l.content ?? ""}
                      placeholder="Text"
                      onChange={(e) => onPatchLayer(l.id, { content: e.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <label className="flex items-center gap-1 text-muted-foreground">
                        Größe
                        <input
                          type="range"
                          min={10}
                          max={Math.max(80, (l.fontSize ?? 24) * 2)}
                          value={l.fontSize ?? 24}
                          onChange={(e) => onPatchLayer(l.id, { fontSize: Number(e.target.value) })}
                          className="accent-[hsl(var(--accent))]"
                        />
                        <span className="tabular-nums w-7 text-right">{l.fontSize}</span>
                      </label>
                      <select
                        value={l.align ?? "left"}
                        onChange={(e) => onPatchLayer(l.id, { align: e.target.value as TextAlign })}
                        className="text-xs rounded border border-border bg-background px-1.5 py-1"
                      >
                        <option value="left">links</option>
                        <option value="center">mitte</option>
                        <option value="right">rechts</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onPatchLayer(l.id, { fontWeight: (l.fontWeight ?? 400) >= 600 ? 400 : 800 })}
                        className={`px-2 py-1 rounded border text-[11px] ${
                          (l.fontWeight ?? 400) >= 600 ? "border-accent bg-accent/10" : "border-border"
                        }`}
                      >
                        B
                      </button>
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_TOKENS.map((c) => (
                          <button
                            key={c.token}
                            type="button"
                            onClick={() => onPatchLayer(l.id, { color: c.token })}
                            title={c.label}
                            className={`w-5 h-5 rounded-full border-2 ${
                              l.color === c.token ? "border-foreground" : "border-border"
                            }`}
                            style={{ background: `hsl(var(--${c.token}))` }}
                          />
                        ))}
                        {ciSwatches.map((c) => (
                          <button
                            key={`ci-${c.value}`}
                            type="button"
                            onClick={() => onPatchLayer(l.id, { color: c.value })}
                            title={c.label}
                            className={`w-5 h-5 rounded-full border-2 ${
                              (l.color ?? "").toLowerCase() === c.value.toLowerCase() ? "border-foreground" : "border-border"
                            }`}
                            style={{ background: c.value }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {l.type === "shape" && l.gradient && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Label className="text-xs">Farbe</Label>
                      <input
                        type="color"
                        value={l.gradient.color?.startsWith("#") ? l.gradient.color : "#000000"}
                        onChange={(e) => onPatchLayer(l.id, { gradient: { ...l.gradient!, color: e.target.value } })}
                        className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                      />
                      <label className="flex items-center gap-1 text-muted-foreground flex-1">
                        Deckkraft
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((l.opacity ?? 1) * 100)}
                          onChange={(e) => onPatchLayer(l.id, { opacity: Number(e.target.value) / 100 })}
                          className="accent-[hsl(var(--accent))] flex-1"
                        />
                        <span className="tabular-nums w-9 text-right">{Math.round((l.opacity ?? 1) * 100)}%</span>
                      </label>
                    </div>
                    {ciSwatches.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {ciSwatches.map((c) => (
                          <button
                            key={`grad-${c.value}`}
                            type="button"
                            onClick={() => onPatchLayer(l.id, { gradient: { ...l.gradient!, color: c.value } })}
                            title={c.label}
                            className={`w-5 h-5 rounded-full border-2 ${
                              (l.gradient!.color ?? "").toLowerCase() === c.value.toLowerCase() ? "border-foreground" : "border-border"
                            }`}
                            style={{ background: c.value }}
                          />
                        ))}
                      </div>
                    )}
                    <div>
                      <Label className="text-xs mb-1 block">Verlaufsrichtung</Label>
                      <div className="grid grid-cols-2 gap-1">
                        {([
                          { v: "bottom-top", lbl: "Unten → Oben" },
                          { v: "top-bottom", lbl: "Oben → Unten" },
                          { v: "left-right", lbl: "Links → Rechts" },
                          { v: "right-left", lbl: "Rechts → Links" },
                        ] as const).map((d) => (
                          <button
                            key={d.v}
                            type="button"
                            onClick={() => onPatchLayer(l.id, { gradient: { ...l.gradient!, direction: d.v } })}
                            className={`px-2 py-1 text-[11px] rounded border ${
                              l.gradient!.direction === d.v
                                ? "border-accent bg-accent/10 text-foreground"
                                : "border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {d.lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Breite</span>
                        <Input type="number" value={l.width ?? 0} onChange={(e) => onPatchLayer(l.id, { width: Number(e.target.value) })} className="h-7" />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Höhe</span>
                        <Input type="number" value={l.height ?? 0} onChange={(e) => onPatchLayer(l.id, { height: Number(e.target.value) })} className="h-7" />
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Verlauf von 100 % zu 0 % Deckkraft in gewählter Richtung. Macht Text vor unruhigen Bildern besser lesbar.
                    </p>
                  </div>
                )}

                {l.type === "shape" && !l.gradient && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Label className="text-xs">Farbe</Label>
                      <input
                        type="color"
                        value={l.backgroundColor?.startsWith("#") ? l.backgroundColor : "#000000"}
                        onChange={(e) => onPatchLayer(l.id, { backgroundColor: e.target.value })}
                        className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                      />
                      <label className="flex items-center gap-1 text-muted-foreground flex-1">
                        Deckkraft
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((l.opacity ?? 1) * 100)}
                          onChange={(e) => onPatchLayer(l.id, { opacity: Number(e.target.value) / 100 })}
                          className="accent-[hsl(var(--accent))] flex-1"
                        />
                        <span className="tabular-nums w-9 text-right">{Math.round((l.opacity ?? 1) * 100)}%</span>
                      </label>
                    </div>
                    {ciSwatches.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {ciSwatches.map((c) => (
                          <button
                            key={`ci-fill-${c.value}`}
                            type="button"
                            onClick={() => onPatchLayer(l.id, { backgroundColor: c.value })}
                            title={c.label}
                            className={`w-5 h-5 rounded-full border-2 ${
                              (l.backgroundColor ?? "").toLowerCase() === c.value.toLowerCase() ? "border-foreground" : "border-border"
                            }`}
                            style={{ background: c.value }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Breite</span>
                        <Input type="number" value={l.width ?? 0} onChange={(e) => onPatchLayer(l.id, { width: Number(e.target.value) })} className="h-7" />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Höhe</span>
                        <Input type="number" value={l.height ?? 0} onChange={(e) => onPatchLayer(l.id, { height: Number(e.target.value) })} className="h-7" />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Radius</span>
                        <Input type="number" value={l.borderRadius ?? 0} onChange={(e) => onPatchLayer(l.id, { borderRadius: Number(e.target.value) })} className="h-7" />
                      </label>
                    </div>
                  </div>
                )}


                {l.type === "image" && (
                  <div className="space-y-2">
                    {l.imageUrl && <img src={l.imageUrl} alt="" className="max-h-20 rounded border border-border object-contain bg-muted" />}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Breite</span>
                        <Input type="number" value={l.width ?? 0} onChange={(e) => onPatchLayer(l.id, { width: Number(e.target.value) })} className="h-7" />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Höhe</span>
                        <Input type="number" value={l.height ?? 0} onChange={(e) => onPatchLayer(l.id, { height: Number(e.target.value) })} className="h-7" />
                      </label>
                      <label className="flex flex-col gap-0.5 col-span-1">
                        <span className="text-muted-foreground">Deckkraft</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((l.opacity ?? 1) * 100)}
                          onChange={(e) => onPatchLayer(l.id, { opacity: Number(e.target.value) / 100 })}
                          className="accent-[hsl(var(--accent))] mt-2"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Tipp: Position & Größe lassen sich auch direkt in der Vorschau per Drag & Drop ändern.
      </p>
    </div>
  );
};

export default CustomLayersPanel;
