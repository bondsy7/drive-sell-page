import React, { useEffect, useState } from "react";
import { Bold, AlignLeft, AlignCenter, AlignRight, Minus, Plus, RotateCcw } from "lucide-react";
import type { BannerLayer, BannerComposition, BannerFormat } from "../state/types";
import { contrastRatio, contrastVerdict, sampleAverageColor } from "../canvas/contrast";

interface FloatingToolbarProps {
  layer: BannerLayer;
  composition: BannerComposition;
  format: BannerFormat;
  /** Bildschirm-Position des Layers (px relativ zum Viewport-Container). */
  screen: { x: number; y: number; w: number; h: number };
  resolveColor: (token?: string) => string;
  /** Liefert ein Off-Screen-Canvas der gesamten aktuellen Stage (gleicher Pixel-Maßstab wie Format). */
  getStageCanvas: () => HTMLCanvasElement | null;
  onPatch: (patch: Partial<BannerLayer>) => void;
  onResetLayer: () => void;
  /** Indikator: Layer weicht vom Template-Default ab. */
  isOverridden: boolean;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  layer, composition, format, screen, resolveColor, getStageCanvas, onPatch, onResetLayer, isOverridden,
}) => {
  const [contrast, setContrast] = useState<{ ratio: number; bg: string } | null>(null);

  // Toolbar oberhalb der Layer-Box positionieren, mit Clamp am Container.
  const top = Math.max(8, screen.y - 44);
  const left = Math.max(8, screen.x);

  useEffect(() => {
    if (layer.type === "logo") { setContrast(null); return; }
    const stage = getStageCanvas();
    if (!stage) { setContrast(null); return; }
    // Layer-Koordinaten sind in Format-Pixeln; Stage-Canvas hat Format-Pixel-Maßstab.
    const w = layer.width ?? format.width * 0.5;
    const h = (layer.fontSize ?? 24) * 1.4 * (composition.scale ?? 1);
    const bg = sampleAverageColor(stage, layer.x, layer.y, w, h);
    const fg = resolveColor(layer.color);
    setContrast({ ratio: contrastRatio(fg, bg), bg });
  }, [layer, format, composition.scale, getStageCanvas, resolveColor]);

  const isText = layer.type !== "logo";
  const fontSize = layer.fontSize ?? 24;
  const verdict = contrast ? contrastVerdict(contrast.ratio, fontSize >= 24) : null;

  const verdictBadge = (() => {
    if (!verdict) return null;
    const map = {
      "AAA": { label: "AAA", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
      "AA": { label: "AA", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
      "AA-large": { label: "AA*", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
      "fail": { label: "Kontrast", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    } as const;
    const v = map[verdict];
    return (
      <span
        title={`WCAG-Kontrast ${contrast!.ratio.toFixed(2)}:1 vs. ${contrast!.bg}`}
        className={`text-[10px] px-1.5 py-0.5 rounded border tabular-nums ${v.cls}`}
      >
        {v.label} {contrast!.ratio.toFixed(1)}
      </span>
    );
  })();

  return (
    <div
      className="absolute z-30 pointer-events-auto flex items-center gap-1 rounded-md border border-border bg-background/95 backdrop-blur-sm shadow-lg px-1.5 py-1"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isText && (
        <>
          <button
            type="button"
            className="p-1 rounded hover:bg-muted text-foreground"
            title="Schrift kleiner"
            onClick={() => onPatch({ fontSize: Math.max(8, fontSize - 2) })}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] tabular-nums px-1 text-muted-foreground min-w-[28px] text-center">
            {fontSize}
          </span>
          <button
            type="button"
            className="p-1 rounded hover:bg-muted text-foreground"
            title="Schrift größer"
            onClick={() => onPatch({ fontSize: fontSize + 2 })}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="w-px h-4 bg-border mx-0.5" />
          <button
            type="button"
            className={`p-1 rounded hover:bg-muted ${(layer.fontWeight ?? 400) >= 600 ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            title="Fett"
            onClick={() => onPatch({ fontWeight: (layer.fontWeight ?? 400) >= 600 ? 400 : 700 })}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <span className="w-px h-4 bg-border mx-0.5" />
          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
            const active = (layer.align ?? "left") === a;
            return (
              <button
                key={a}
                type="button"
                className={`p-1 rounded hover:bg-muted ${active ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                title={`Ausrichtung ${a}`}
                onClick={() => onPatch({ align: a })}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
          <span className="w-px h-4 bg-border mx-0.5" />
          <label
            className="p-1 rounded hover:bg-muted cursor-pointer flex items-center"
            title="Textfarbe"
          >
            <span
              className="w-3.5 h-3.5 rounded-sm border border-border"
              style={{ backgroundColor: resolveColor(layer.color) }}
            />
            <input
              type="color"
              className="sr-only"
              value={resolveColor(layer.color)}
              onChange={(e) => onPatch({ color: e.target.value })}
            />
          </label>
          {verdictBadge}
        </>
      )}
      {!isText && (
        <span className="text-[11px] text-muted-foreground px-1">Logo</span>
      )}
      <span className="w-px h-4 bg-border mx-0.5" />
      <button
        type="button"
        className={`p-1 rounded hover:bg-muted ${isOverridden ? "text-amber-600" : "text-muted-foreground/50"}`}
        title={isOverridden ? "Layer auf Template-Standard zurücksetzen" : "Keine Änderungen ggü. Template"}
        disabled={!isOverridden}
        onClick={onResetLayer}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default FloatingToolbar;
