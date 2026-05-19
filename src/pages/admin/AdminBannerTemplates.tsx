import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BANNER_FORMATS } from "@/components/canvas-banner-studio/data/formats";
import { LAYOUT_TEMPLATES } from "@/components/canvas-banner-studio/data/layoutTemplates";
import { getBundledSpec } from "@/components/canvas-banner-studio/data/bundledTemplates";
import { invalidateTemplateCache } from "@/components/canvas-banner-studio/data/templateRegistry";
import type { TemplateSpec, LayerSpec } from "@/components/canvas-banner-studio/data/templateSchema";
import { BRAND_PRESETS } from "@/components/canvas-banner-studio/ci/brandPresets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
  Code2,
  MousePointer2,
  Copy as CopyIcon,
} from "lucide-react";

type Row = {
  id: string;
  template_id: string;
  format_id: string;
  name: string;
  spec: TemplateSpec;
  is_global: boolean;
  user_id: string | null;
  brand_key: string | null;
  updated_at: string;
};

const DUMMY_TEXT: Record<string, string> = {
  headline: "DER NEUE GOLF",
  subline: "Jetzt Probefahrt sichern",
  price: "ab 249 € mtl.",
  cta: "Angebot anfragen",
  smallInfo: "Limitiert",
  legalText: "Verbrauch komb.: 5,8 l/100 km · CO₂: 132 g/km · Klasse D.",
};

type DragMode =
  | { kind: "move"; layerId: string; startX: number; startY: number; origX: number; origY: number }
  | {
      kind: "resize";
      layerId: string;
      handle: "se" | "sw" | "ne" | "nw" | "e" | "w" | "s" | "n";
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    }
  | null;

function VisualEditor({
  spec,
  selectedId,
  brandLogoUrl,
  onSelect,
  onUpdate,
}: {
  spec: TemplateSpec;
  selectedId: string | null;
  brandLogoUrl?: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<LayerSpec>) => void;
}) {

  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(720);
  const dragRef = useRef<DragMode>(null);

  useEffect(() => {
    const onResize = () => {
      if (wrapRef.current) setContainerW(wrapRef.current.clientWidth);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { width, height } = spec.format;
  const maxH = 700;
  const scale = Math.min(containerW / width, maxH / height, 1);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / scale;
      const dy = (e.clientY - d.startY) / scale;
      const layer = spec.layers.find((l) => l.id === d.layerId);
      if (!layer) return;
      // force absolute anchor while editing for predictable behaviour
      const patch: Partial<LayerSpec> = { anchor: "absolute" };
      if (d.kind === "move") {
        patch.x = Math.round(d.origX + dx);
        patch.y = Math.round(d.origY + dy);
      } else {
        let nx = d.origX;
        let ny = d.origY;
        let nw = d.origW;
        let nh = d.origH;
        if (d.handle.includes("e")) nw = Math.max(20, d.origW + dx);
        if (d.handle.includes("s")) nh = Math.max(20, d.origH + dy);
        if (d.handle.includes("w")) {
          nw = Math.max(20, d.origW - dx);
          nx = d.origX + (d.origW - nw);
        }
        if (d.handle.includes("n")) {
          nh = Math.max(20, d.origH - dy);
          ny = d.origY + (d.origH - nh);
        }
        patch.x = Math.round(nx);
        patch.y = Math.round(ny);
        patch.width = Math.round(nw);
        patch.height = Math.round(nh);
      }
      onUpdate(d.layerId, patch);
    },
    [scale, spec.layers, onUpdate],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const startDrag = (e: React.PointerEvent, layer: LayerSpec, handle?: DragMode extends infer T ? T : never) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(layer.id);
    const baseW = layer.width ?? 100;
    const baseH = layer.height ?? (layer.fontSize ?? 24) * 1.4;
    if (handle && typeof handle === "string") {
      dragRef.current = {
        kind: "resize",
        layerId: layer.id,
        handle: handle as never,
        startX: e.clientX,
        startY: e.clientY,
        origX: layer.x,
        origY: layer.y,
        origW: baseW,
        origH: baseH,
      };
    } else {
      dragRef.current = {
        kind: "move",
        layerId: layer.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: layer.x,
        origY: layer.y,
      };
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div ref={wrapRef} className="w-full">
      <div
        className="relative mx-auto rounded-md border border-border overflow-hidden bg-muted shadow-sm"
        style={{
          width: width * scale,
          height: height * scale,
          backgroundImage:
            "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--accent) / 0.18))",
        }}
        onPointerDown={() => onSelect(null)}
      >
        {/* safe area */}
        <div
          className="absolute border border-dashed border-accent/50 pointer-events-none"
          style={{
            left: spec.safeArea.left * scale,
            top: spec.safeArea.top * scale,
            right: spec.safeArea.right * scale,
            bottom: spec.safeArea.bottom * scale,
          }}
        />
        {spec.layers.map((l) => {
          if (l.visible === false) return null;
          if (l.type === "overlay") return null;
          const w = (l.width ?? 200) * scale;
          const h = (l.height ?? (l.fontSize ?? 24) * 1.4) * scale;
          const isSel = l.id === selectedId;
          const isLogo = l.type === "logo";
          const isShape = l.type === "shape";
          const isImage = l.type === "image";
          const txt = isShape || isImage
            ? ""
            : l.field
              ? DUMMY_TEXT[l.field] ?? l.id
              : (l.content ?? l.id);
          const bg = isShape
            ? l.backgroundColor || "#3b82f6"
            : isLogo
              ? (brandLogoUrl ? "transparent" : "rgba(255,255,255,0.85)")
              : isImage
                ? "rgba(0,0,0,0.15)"
                : "transparent";

          return (
            <div
              key={l.id}
              className="absolute group"
              style={{
                left: l.x * scale,
                top: l.y * scale,
                width: w,
                height: h,
                cursor: "move",
                outline: isSel
                  ? "2px solid hsl(var(--primary))"
                  : "1px dashed rgba(255,255,255,0.4)",
                outlineOffset: 0,
                backgroundColor: bg,
                opacity: isShape || isImage ? (l.opacity ?? 1) : 1,
                borderRadius: l.borderRadius ?? 0,
                backgroundImage: isImage && l.imageUrl
                  ? `url("${l.imageUrl}")`
                  : isLogo && brandLogoUrl
                    ? `url("${brandLogoUrl}")`
                    : undefined,
                backgroundSize: isLogo ? "contain" : "cover",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
              onPointerDown={(e) => startDrag(e, l)}
            >
              {!isShape && !isImage && !(isLogo && brandLogoUrl) && (
                <div
                  className="w-full h-full flex items-center"
                  style={{
                    fontSize: (l.fontSize ?? 16) * scale,
                    fontWeight: l.fontWeight ?? 400,
                    textAlign: l.align ?? "left",
                    justifyContent:
                      l.align === "center"
                        ? "center"
                        : l.align === "right"
                          ? "flex-end"
                          : "flex-start",
                    color: isLogo ? "#333" : "white",
                    textShadow: isLogo ? "none" : "0 1px 2px rgba(0,0,0,0.6)",
                    lineHeight: 1.15,
                    padding: isLogo ? "0 4px" : 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isLogo ? "LOGO" : txt}
                </div>
              )}
              {isImage && !l.imageUrl && (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-white/70">
                  Bild-URL setzen
                </div>
              )}

              {isSel && (
                <>
                  {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as const).map((h) => {
                    const pos: React.CSSProperties = { position: "absolute" };
                    const sz = 10;
                    if (h.includes("n")) pos.top = -sz / 2;
                    if (h.includes("s")) pos.bottom = -sz / 2;
                    if (h.includes("w")) pos.left = -sz / 2;
                    if (h.includes("e")) pos.right = -sz / 2;
                    if (h === "n" || h === "s") {
                      pos.left = "50%";
                      pos.transform = "translateX(-50%)";
                    }
                    if (h === "e" || h === "w") {
                      pos.top = "50%";
                      pos.transform = "translateY(-50%)";
                    }
                    return (
                      <div
                        key={h}
                        onPointerDown={(e) => startDrag(e, l, h as never)}
                        style={{
                          ...pos,
                          width: sz,
                          height: sz,
                          background: "hsl(var(--primary))",
                          border: "1px solid white",
                          cursor: `${h}-resize`,
                          zIndex: 10,
                        }}
                      />
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        {width}×{height}px · {spec.layers.length} Ebenen · Skala {(scale * 100).toFixed(0)}%
      </p>
    </div>
  );
}

function PropertyPanel({
  layer,
  onChange,
  onDelete,
  onDuplicate,
}: {
  layer: LayerSpec;
  onChange: (patch: Partial<LayerSpec>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const num = (v: string) => (v === "" ? undefined : Number(v));
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{layer.id}</div>
          <div className="text-xs text-muted-foreground">{layer.type}{layer.field ? ` · ${layer.field}` : ""}</div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onDuplicate} title="Duplizieren">
            <CopyIcon className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Löschen">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Sichtbar</Label>
        <Switch
          checked={layer.visible !== false}
          onCheckedChange={(v) => onChange({ visible: v })}
        />
      </div>

      <div>
        <Label className="text-xs">Anker</Label>
        <Select
          value={layer.anchor ?? "absolute"}
          onValueChange={(v) => onChange({ anchor: v as LayerSpec["anchor"] })}
        >
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["absolute", "top-left", "top-right", "bottom-left", "bottom-right", "center"].map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">X</Label>
          <Input className="h-8" type="number" value={layer.x} onChange={(e) => onChange({ x: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Y</Label>
          <Input className="h-8" type="number" value={layer.y} onChange={(e) => onChange({ y: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Breite</Label>
          <Input className="h-8" type="number" value={layer.width ?? ""} onChange={(e) => onChange({ width: num(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Höhe</Label>
          <Input className="h-8" type="number" value={layer.height ?? ""} onChange={(e) => onChange({ height: num(e.target.value) })} />
        </div>
      </div>

      {(layer.type === "text" || layer.type === "legal") && (
        <>
          {!layer.field && (
            <div>
              <Label className="text-xs">Text-Inhalt</Label>
              <Textarea
                rows={2}
                className="text-xs"
                value={layer.content ?? ""}
                onChange={(e) => onChange({ content: e.target.value })}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Schriftgröße</Label>
              <Input className="h-8" type="number" value={layer.fontSize ?? ""} onChange={(e) => onChange({ fontSize: num(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Gewicht</Label>
              <Input className="h-8" type="number" value={layer.fontWeight ?? ""} onChange={(e) => onChange({ fontWeight: num(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Ausrichtung</Label>
            <Select
              value={layer.align ?? "left"}
              onValueChange={(v) => onChange({ align: v as LayerSpec["align"] })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">links</SelectItem>
                <SelectItem value="center">zentriert</SelectItem>
                <SelectItem value="right">rechts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Min. Schrift</Label>
              <Input className="h-8" type="number" value={layer.minFontSize ?? ""} onChange={(e) => onChange({ minFontSize: num(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Max. Zeilen</Label>
              <Input className="h-8" type="number" value={layer.maxLines ?? ""} onChange={(e) => onChange({ maxLines: num(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Farbe</Label>
            <Input className="h-8" value={layer.color ?? ""} placeholder="#ffffff oder hsl(...)" onChange={(e) => onChange({ color: e.target.value || undefined })} />
          </div>
        </>
      )}

      {layer.type === "shape" && (
        <>
          <div>
            <Label className="text-xs">Füllfarbe</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                className="h-8 w-14 p-1"
                value={layer.backgroundColor || "#000000"}
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
              />
              <Input
                className="h-8 flex-1"
                value={layer.backgroundColor ?? ""}
                placeholder="#000000"
                onChange={(e) => onChange({ backgroundColor: e.target.value || undefined })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Deckkraft ({Math.round((layer.opacity ?? 1) * 100)}%)</Label>
            <Input
              type="range"
              min={0}
              max={100}
              value={Math.round((layer.opacity ?? 1) * 100)}
              onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
            />
          </div>
          <div>
            <Label className="text-xs">Eckenradius</Label>
            <Input
              className="h-8"
              type="number"
              value={layer.borderRadius ?? 0}
              onChange={(e) => onChange({ borderRadius: num(e.target.value) ?? 0 })}
            />
          </div>
        </>
      )}

      {layer.type === "image" && (
        <>
          <div>
            <Label className="text-xs">Bild-URL</Label>
            <Input
              className="h-8"
              value={layer.imageUrl ?? ""}
              placeholder="https://..."
              onChange={(e) => onChange({ imageUrl: e.target.value || undefined })}
            />
          </div>
          <div>
            <Label className="text-xs">Deckkraft ({Math.round((layer.opacity ?? 1) * 100)}%)</Label>
            <Input
              type="range"
              min={0}
              max={100}
              value={Math.round((layer.opacity ?? 1) * 100)}
              onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
            />
          </div>
          <div>
            <Label className="text-xs">Eckenradius</Label>
            <Input
              className="h-8"
              type="number"
              value={layer.borderRadius ?? 0}
              onChange={(e) => onChange({ borderRadius: num(e.target.value) ?? 0 })}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminBannerTemplates() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTpl, setFilterTpl] = useState<string>("classic-offer");
  const [filterFmt, setFilterFmt] = useState<string>(BANNER_FORMATS[0].id);
  const [filterBrand, setFilterBrand] = useState<string>("__none__");

  const [draft, setDraft] = useState<TemplateSpec | null>(null);
  const [draftRow, setDraftRow] = useState<Row | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banner_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Fehler beim Laden", description: error.message });
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const currentRow = useMemo(
    () =>
      rows.find(
        (r) =>
          r.template_id === filterTpl &&
          r.format_id === filterFmt &&
          (filterBrand === "__none__" ? !r.brand_key : r.brand_key === filterBrand) &&
          r.is_global,
      ),
    [rows, filterTpl, filterFmt, filterBrand],
  );

  // auto-load draft whenever selection changes
  useEffect(() => {
    const base =
      (currentRow?.spec as TemplateSpec | undefined) ??
      getBundledSpec(filterFmt, filterTpl) ??
      null;
    setDraft(base ? JSON.parse(JSON.stringify(base)) : null);
    setDraftRow(currentRow ?? null);
    setSelectedId(null);
    setJsonError(null);
  }, [filterTpl, filterFmt, filterBrand, currentRow?.id]);

  useEffect(() => {
    if (showJson && draft) setJsonText(JSON.stringify(draft, null, 2));
  }, [showJson, draft]);

  const updateLayer = useCallback(
    (id: string, patch: Partial<LayerSpec>) => {
      setDraft((d) =>
        d
          ? {
              ...d,
              layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
            }
          : d,
      );
    },
    [],
  );

  const deleteLayer = (id: string) => {
    setDraft((d) => (d ? { ...d, layers: d.layers.filter((l) => l.id !== id) } : d));
    setSelectedId(null);
  };

  const duplicateLayer = (id: string) => {
    setDraft((d) => {
      if (!d) return d;
      const l = d.layers.find((x) => x.id === id);
      if (!l) return d;
      const newId = `${l.id}-copy-${Date.now().toString(36)}`;
      return { ...d, layers: [...d.layers, { ...l, id: newId, x: l.x + 20, y: l.y + 20 }] };
    });
  };

  const addLayer = (kind: "text" | "shape" | "image") => {
    setDraft((d) => {
      if (!d) return d;
      const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
      const cx = Math.round(d.format.width / 2);
      const cy = Math.round(d.format.height / 2);
      let layer: LayerSpec;
      if (kind === "text") {
        layer = {
          id, type: "text", anchor: "absolute",
          x: cx - 200, y: cy - 20,
          width: 400, fontSize: 36, fontWeight: 700, align: "left",
          color: "#ffffff", content: "Neuer Text",
          visible: true, draggable: true,
        };
      } else if (kind === "shape") {
        layer = {
          id, type: "shape", anchor: "absolute",
          x: cx - 150, y: cy - 50,
          width: 300, height: 100,
          backgroundColor: "#000000", opacity: 0.5, borderRadius: 0,
          visible: true, draggable: true,
        };
      } else {
        layer = {
          id, type: "image", anchor: "absolute",
          x: cx - 100, y: cy - 75,
          width: 200, height: 150,
          opacity: 1, borderRadius: 0,
          visible: true, draggable: true,
        };
      }
      return { ...d, layers: [...d.layers, layer] };
    });
    setTimeout(() => {
      // select the just-added layer
      setDraft((d) => {
        if (d && d.layers.length) setSelectedId(d.layers[d.layers.length - 1].id);
        return d;
      });
    }, 0);
  };

  const updateSafeArea = (key: keyof TemplateSpec["safeArea"], val: number) => {
    setDraft((d) => (d ? { ...d, safeArea: { ...d.safeArea, [key]: val } } : d));
  };

  const onJsonApply = () => {
    try {
      const parsed = JSON.parse(jsonText) as TemplateSpec;
      if (!parsed.layers || !parsed.format) throw new Error("Spec braucht 'format' und 'layers'.");
      setDraft(parsed);
      setJsonError(null);
      toast({ title: "JSON übernommen" });
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const payload = {
      template_id: filterTpl,
      format_id: filterFmt,
      name: draft.name || `${filterTpl} – ${filterFmt}`,
      spec: draft as never,
      is_global: true,
      brand_key: filterBrand === "__none__" ? null : filterBrand,
    };
    const op = draftRow
      ? supabase.from("banner_templates").update(payload).eq("id", draftRow.id)
      : supabase.from("banner_templates").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) {
      toast({ title: "Speichern fehlgeschlagen", description: error.message });
      return;
    }
    invalidateTemplateCache();
    toast({ title: "Template gespeichert" });
    fetchRows();
  };

  const resetToBundle = async () => {
    if (!currentRow) {
      const base = getBundledSpec(filterFmt, filterTpl);
      setDraft(base ? JSON.parse(JSON.stringify(base)) : null);
      return;
    }
    if (!confirm("Diese DB-Variante löschen und auf Bundle-Default zurücksetzen?")) return;
    const { error } = await supabase.from("banner_templates").delete().eq("id", currentRow.id);
    if (error) {
      toast({ title: "Fehler", description: error.message });
      return;
    }
    invalidateTemplateCache();
    toast({ title: "Auf Bundle zurückgesetzt" });
    fetchRows();
  };

  const selectedLayer = draft?.layers.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Banner-Templates</h1>
        <p className="text-sm text-muted-foreground">
          Visuell editieren — Ebenen direkt im Vorschaubereich verschieben und in der Größe ändern.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Template</Label>
          <Select value={filterTpl} onValueChange={setFilterTpl}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LAYOUT_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Format</Label>
          <Select value={filterFmt} onValueChange={setFilterFmt}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BANNER_FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name} ({f.width}×{f.height})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>CI-Variante</Label>
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Globaler Default (alle Marken)</SelectItem>
              {BRAND_PRESETS.filter((b) => b.key !== "custom").map((b) => (
                <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={currentRow ? "default" : "secondary"}>
          {currentRow ? "DB-Variante aktiv" : "Bundle-Default"}
        </Badge>
        {currentRow && (
          <span className="text-xs text-muted-foreground">
            zuletzt geändert: {new Date(currentRow.updated_at).toLocaleString()}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowJson((v) => !v)}>
            {showJson ? <MousePointer2 className="w-4 h-4 mr-1" /> : <Code2 className="w-4 h-4 mr-1" />}
            {showJson ? "Visuell" : "JSON"}
          </Button>
          <Button variant="outline" size="sm" onClick={resetToBundle}>
            <RotateCcw className="w-4 h-4 mr-1" />
            {currentRow ? "DB löschen" : "Bundle laden"}
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !draft}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Speichern
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="border border-border rounded-lg p-4 bg-card min-h-[400px]">
          {!draft ? (
            <p className="text-sm text-muted-foreground">Kein Template geladen.</p>
          ) : showJson ? (
            <div className="space-y-2">
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={28}
                className="font-mono text-xs"
              />
              {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
              <Button size="sm" onClick={onJsonApply}>JSON übernehmen</Button>
            </div>
          ) : (
            <VisualEditor
              spec={draft}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={updateLayer}
            />
          )}
        </div>

        <div className="space-y-4">
          {draft && (
            <>
              <div className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">Ebenen</div>
                </div>
                <div className="flex gap-1 mb-2">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => addLayer("text")}>+ Text</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => addLayer("shape")}>+ Form</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => addLayer("image")}>+ Bild</Button>
                </div>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {draft.layers.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-2 ${
                        selectedId === l.id ? "bg-primary/15 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateLayer(l.id, { visible: l.visible === false });
                        }}
                        className="opacity-60 hover:opacity-100"
                        title={l.visible === false ? "Einblenden" : "Ausblenden"}
                      >
                        {l.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <span className="flex-1 truncate">{l.id}</span>
                      <span className="text-muted-foreground">{l.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-border rounded-lg p-3 bg-card">
                <div className="font-semibold text-sm mb-2">
                  {selectedLayer ? "Eigenschaften" : "Safe Area"}
                </div>
                {selectedLayer ? (
                  <PropertyPanel
                    layer={selectedLayer}
                    onChange={(p) => updateLayer(selectedLayer.id, p)}
                    onDelete={() => deleteLayer(selectedLayer.id)}
                    onDuplicate={() => duplicateLayer(selectedLayer.id)}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(["top", "right", "bottom", "left"] as const).map((k) => (
                      <div key={k}>
                        <Label className="text-xs capitalize">{k}</Label>
                        <Input
                          className="h-8"
                          type="number"
                          value={draft.safeArea[k]}
                          onChange={(e) => updateSafeArea(k, Number(e.target.value))}
                        />
                      </div>
                    ))}
                    <p className="col-span-2 text-xs text-muted-foreground mt-2">
                      Eine Ebene auswählen, um deren Eigenschaften zu bearbeiten.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mt-4 mb-2">
          Alle DB-Varianten ({rows.length})
        </h2>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-2">Template</th>
                  <th className="p-2">Format</th>
                  <th className="p-2">Brand</th>
                  <th className="p-2">Scope</th>
                  <th className="p-2">Geändert</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setFilterTpl(r.template_id);
                      setFilterFmt(r.format_id);
                      setFilterBrand(r.brand_key ?? "__none__");
                    }}
                  >
                    <td className="p-2">{r.template_id}</td>
                    <td className="p-2">{r.format_id}</td>
                    <td className="p-2">{r.brand_key ?? "—"}</td>
                    <td className="p-2">{r.is_global ? "global" : "user"}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Noch keine DB-Varianten – alle Templates kommen aus dem Code-Bundle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
