import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Trash2, Type, Square, ImageIcon, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { BannerComposition, BannerFormat, BannerLayer, TextAlign } from "../state/types";

const STANDARD_IDS = new Set(["headline", "subline", "price", "cta", "smallInfo", "legal", "logo", "background", "overlay"]);

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
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customLayers = composition.layers.filter((l) => !STANDARD_IDS.has(l.id));

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

      {customLayers.length > 0 && (
        <div className="space-y-2">
          {customLayers.map((l) => {
            const selected = l.id === selectedLayerId;
            return (
              <div
                key={l.id}
                className={`rounded-md border p-2.5 space-y-2 bg-card ${
                  selected ? "border-accent" : "border-border"
                }`}
                onClick={() => onSelectLayer(l.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    {l.type === "text" && <Type className="w-3 h-3" />}
                    {l.type === "shape" && <Square className="w-3 h-3" />}
                    {l.type === "image" && <ImageIcon className="w-3 h-3" />}
                    <span className="capitalize">{l.type}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {onReorderLayer && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, "forward"); }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Eine Ebene nach vorne"
                          aria-label="Eine Ebene nach vorne"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, "backward"); }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Eine Ebene nach hinten"
                          aria-label="Eine Ebene nach hinten"
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
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRemoveLayer(l.id); }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {l.type === "text" && (
                  <>
                    <Textarea
                      rows={2}
                      value={l.content ?? ""}
                      placeholder="Text"
                      onChange={(e) => onPatchLayer(l.id, { content: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[hsl(var(--accent))]"
                        />
                        <span className="tabular-nums w-7 text-right">{l.fontSize}</span>
                      </label>
                      <select
                        value={l.align ?? "left"}
                        onChange={(e) => onPatchLayer(l.id, { align: e.target.value as TextAlign })}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs rounded border border-border bg-background px-1.5 py-1"
                      >
                        <option value="left">links</option>
                        <option value="center">mitte</option>
                        <option value="right">rechts</option>
                      </select>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPatchLayer(l.id, { fontWeight: (l.fontWeight ?? 400) >= 600 ? 400 : 800 });
                        }}
                        className={`px-2 py-1 rounded border text-[11px] ${
                          (l.fontWeight ?? 400) >= 600 ? "border-accent bg-accent/10" : "border-border"
                        }`}
                      >
                        B
                      </button>
                      <div className="flex gap-1">
                        {COLOR_TOKENS.map((c) => (
                          <button
                            key={c.token}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onPatchLayer(l.id, { color: c.token }); }}
                            title={c.label}
                            className={`w-5 h-5 rounded-full border-2 ${
                              l.color === c.token ? "border-foreground" : "border-border"
                            }`}
                            style={{ background: `hsl(var(--${c.token}))` }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {l.type === "shape" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Label className="text-xs">Farbe</Label>
                      <input
                        type="color"
                        value={l.backgroundColor?.startsWith("#") ? l.backgroundColor : "#000000"}
                        onChange={(e) => onPatchLayer(l.id, { backgroundColor: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[hsl(var(--accent))] flex-1"
                        />
                        <span className="tabular-nums w-9 text-right">{Math.round((l.opacity ?? 1) * 100)}%</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Breite</span>
                        <Input
                          type="number"
                          value={l.width ?? 0}
                          onChange={(e) => onPatchLayer(l.id, { width: Number(e.target.value) })}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Höhe</span>
                        <Input
                          type="number"
                          value={l.height ?? 0}
                          onChange={(e) => onPatchLayer(l.id, { height: Number(e.target.value) })}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Radius</span>
                        <Input
                          type="number"
                          value={l.borderRadius ?? 0}
                          onChange={(e) => onPatchLayer(l.id, { borderRadius: Number(e.target.value) })}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {l.type === "image" && (
                  <div className="space-y-2">
                    {l.imageUrl && (
                      <img
                        src={l.imageUrl}
                        alt=""
                        className="max-h-20 rounded border border-border object-contain bg-muted"
                      />
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Breite</span>
                        <Input
                          type="number"
                          value={l.width ?? 0}
                          onChange={(e) => onPatchLayer(l.id, { width: Number(e.target.value) })}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">Höhe</span>
                        <Input
                          type="number"
                          value={l.height ?? 0}
                          onChange={(e) => onPatchLayer(l.id, { height: Number(e.target.value) })}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 col-span-1">
                        <span className="text-muted-foreground">Deckkraft</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((l.opacity ?? 1) * 100)}
                          onChange={(e) => onPatchLayer(l.id, { opacity: Number(e.target.value) / 100 })}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[hsl(var(--accent))] mt-2"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Tipp: Position & Größe lassen sich auch direkt in der Vorschau per Drag & Drop ändern.
      </p>
    </div>
  );
};

export default CustomLayersPanel;
