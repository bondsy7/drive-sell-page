import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Image as KImage, Text as KText, Group, Transformer, Line } from "react-konva";
import type Konva from "konva";
import type { BannerComposition, BannerLayer, CiState, OverlayDirection } from "../state/types";
import type { BannerFormat, BannerTextFields } from "../state/types";
import { effectiveFontSize, FONT_FAMILY as DEFAULT_FONT_FAMILY } from "./textFit";
import { resolveShortcodes } from "../ci/shortcodes";
import type { CiContext } from "../ci/profileSources";
import { recolorSvg } from "../ci/svgRecolor";
import { ensureBrandFonts } from "../ci/fontLoader";

interface BannerCanvasProps {
  format: BannerFormat;
  composition: BannerComposition;
  textFields: BannerTextFields;
  showSafeArea: boolean;
  selectedLayerId?: string;
  resolveColor: (token?: string) => string;
  ci?: CiState;
  ciContext?: CiContext | null;
  onSelectLayer?: (id?: string) => void;
  onLayerDrag?: (id: string, x: number, y: number) => void;
  onLayerResize?: (id: string, patch: { width?: number; height?: number; fontSize?: number }) => void;
  stageRef?: React.MutableRefObject<Konva.Stage | null>;
  /** Wird bei Selection-Änderung mit der Bildschirmposition (px relativ zum Container) aufgerufen. */
  onSelectedLayerScreenChange?: (info: { x: number; y: number; w: number; h: number } | null) => void;
}

function useImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.onerror = () => setImg(null);
    i.src = src;
  }, [src]);
  return img;
}

function fitRect(
  iw: number, ih: number, cw: number, ch: number, mode: "cover" | "contain",
): { x: number; y: number; w: number; h: number } {
  if (!iw || !ih) return { x: 0, y: 0, w: cw, h: ch };
  const ir = iw / ih;
  const cr = cw / ch;
  if (mode === "cover") {
    if (ir > cr) {
      const h = ch; const w = h * ir;
      return { x: (cw - w) / 2, y: 0, w, h };
    }
    const w = cw; const h = w / ir;
    return { x: 0, y: (ch - h) / 2, w, h };
  }
  if (ir > cr) {
    const w = cw; const h = w / ir;
    return { x: 0, y: (ch - h) / 2, w, h };
  }
  const h = ch; const w = h * ir;
  return { x: (cw - w) / 2, y: 0, w, h };
}

function overlayRects(
  dir: OverlayDirection, strength: number, w: number, h: number,
): Array<{ x: number; y: number; w: number; h: number; fill: string }> {
  const a = Math.max(0, Math.min(1, strength / 100));
  if (dir === "none" || a === 0) return [];
  const black = (alpha: number) => `rgba(0,0,0,${alpha.toFixed(3)})`;
  switch (dir) {
    case "full-soft":
      return [{ x: 0, y: 0, w, h, fill: black(a * 0.6) }];
    case "left":
      return [{ x: 0, y: 0, w: w * 0.6, h, fill: black(a * 0.75) }];
    case "right":
      return [{ x: w * 0.4, y: 0, w: w * 0.6, h, fill: black(a * 0.75) }];
    case "top":
      return [{ x: 0, y: 0, w, h: h * 0.5, fill: black(a * 0.75) }];
    case "bottom":
      return [{ x: 0, y: h * 0.5, w, h: h * 0.5, fill: black(a * 0.75) }];
    default:
      return [];
  }
}

const BannerCanvas: React.FC<BannerCanvasProps> = ({
  format, composition, textFields, showSafeArea, selectedLayerId,
  resolveColor, ci, ciContext, onSelectLayer, onLayerDrag, onLayerResize, stageRef, onSelectedLayerScreenChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const internalStageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const [scale, setScale] = useState(1);
  const [snapGuides, setSnapGuides] = useState<{ vCenter: boolean; hCenter: boolean }>({ vCenter: false, hCenter: false });
  const [logoSrc, setLogoSrc] = useState<string | undefined>(composition.logoUrl);

  const formatScale = composition.scale ?? 1;
  const FONT_DISPLAY = ci?.fontDisplay ? `"${ci.fontDisplay}", ${DEFAULT_FONT_FAMILY}` : DEFAULT_FONT_FAMILY;
  const FONT_BODY = ci?.fontBody ? `"${ci.fontBody}", ${DEFAULT_FONT_FAMILY}` : DEFAULT_FONT_FAMILY;
  const FONT_FAMILY = FONT_BODY;

  useEffect(() => { ensureBrandFonts(ci?.googleFonts); }, [ci?.googleFonts]);

  // Recolor SVG logo when CI logo mode changes.
  useEffect(() => {
    let cancelled = false;
    const url = composition.logoUrl;
    if (!url || !ci || ci.logoMode === "original") {
      setLogoSrc(url);
      return;
    }
    recolorSvg(url, ci.logoMode, ci.logoCustomColor).then((out) => {
      if (!cancelled) setLogoSrc(out);
    });
    return () => { cancelled = true; };
  }, [composition.logoUrl, ci?.logoMode, ci?.logoCustomColor, ci]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const s = Math.min(cw / format.width, ch / format.height);
      setScale(s > 0 ? s : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [format.width, format.height]);

  const bg = useImage(composition.backgroundImageUrl);
  const logo = useImage(logoSrc);

  const bgFit = useMemo(() => {
    if (!bg) return null;
    return fitRect(bg.naturalWidth, bg.naturalHeight, format.width, format.height, composition.backgroundFit);
  }, [bg, format.width, format.height, composition.backgroundFit]);

  const overlays = useMemo(
    () => overlayRects(composition.overlayDirection, composition.overlayStrength, format.width, format.height),
    [composition.overlayDirection, composition.overlayStrength, format.width, format.height],
  );

  const safePad = Math.round(Math.min(format.width, format.height) * 0.05);

  const refSetter = (s: Konva.Stage | null) => {
    internalStageRef.current = s;
    if (stageRef) stageRef.current = s;
  };

  // Attach Transformer to the currently selected layer node.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (!selectedLayerId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = nodeRefs.current[selectedLayerId];
    if (node) {
      const layer = composition.layers.find((l) => l.id === selectedLayerId);
      if (layer?.type === "logo") {
        tr.enabledAnchors(["top-left", "top-right", "bottom-left", "bottom-right"]);
        tr.keepRatio(true);
        tr.rotateEnabled(false);
      } else {
        tr.enabledAnchors(["middle-left", "middle-right"]);
        tr.keepRatio(false);
        tr.rotateEnabled(false);
      }
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedLayerId, composition.layers]);

  // Snap helpers
  const SNAP_TOL = 8; // px in stage coords
  const handleDragMove = (l: BannerLayer, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    let x = node.x();
    let y = node.y();
    const w = (l.width ?? 0);
    const cx = format.width / 2 - w / 2;
    const showV = Math.abs(x - cx) < SNAP_TOL;
    if (showV) { x = cx; node.x(x); }
    // horizontal center for whole banner irrelevant; we only snap layer center to safe area edges
    const showH = false;
    setSnapGuides((g) => (g.vCenter === showV && g.hCenter === showH ? g : { vCenter: showV, hCenter: showH }));
  };
  const handleDragEndCommon = () => {
    setSnapGuides({ vCenter: false, hCenter: false });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectLayer?.(undefined);
      }}
    >
      <div style={{ width: format.width * scale, height: format.height * scale }}>
        <Stage
          ref={refSetter}
          width={format.width * scale}
          height={format.height * scale}
          scaleX={scale}
          scaleY={scale}
        >
          <Layer listening={false}>
            <Rect x={0} y={0} width={format.width} height={format.height} fill="#1a1a1a" />
            {bg && bgFit && (
              <KImage image={bg} x={bgFit.x} y={bgFit.y} width={bgFit.w} height={bgFit.h} />
            )}
            {overlays.map((o, i) => (
              <Rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill={o.fill} />
            ))}
          </Layer>

          <Layer>
            {composition.layers
              .filter((l) => l.visible && l.type !== "image" && l.type !== "overlay")
              .map((l) => {
                const isSelected = l.id === selectedLayerId;
                if (l.type === "logo") {
                  if (!logo) return null;
                  const baseW = l.width ?? format.width * 0.18;
                  const w = baseW * formatScale;
                  const ratio = logo.naturalHeight / logo.naturalWidth || 0.4;
                  const h = w * ratio;
                  return (
                    <KImage
                      key={l.id}
                      ref={(n) => { nodeRefs.current[l.id] = n; }}
                      image={logo}
                      x={l.x}
                      y={l.y}
                      width={w}
                      height={h}
                      draggable={l.draggable}
                      onClick={() => onSelectLayer?.(l.id)}
                      onTap={() => onSelectLayer?.(l.id)}
                      onDragMove={(e) => handleDragMove(l, e)}
                      onDragEnd={(e) => { handleDragEndCommon(); onLayerDrag?.(l.id, e.target.x(), e.target.y()); }}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Image;
                        const sx = node.scaleX();
                        const newWBase = Math.max(20, (baseW * sx));
                        node.scaleX(1); node.scaleY(1);
                        onLayerResize?.(l.id, { width: Math.round(newWBase) });
                      }}
                    />
                  );
                }
                const rawText = l.field ? textFields[l.field] : "";
                const text = resolveShortcodes(rawText, ciContext);
                if (!text) return null;
                const color = resolveColor(l.color);
                const effFont = effectiveFontSize(l, text, formatScale);
                const isShrunk = effFont < (l.fontSize ?? 24) * formatScale - 0.5;
                const layerFont = (l.id === "headline" || l.id === "subline") ? FONT_DISPLAY : FONT_BODY;
                return (
                  <Group
                    key={l.id}
                    x={l.x}
                    y={l.y}
                    draggable={l.draggable}
                    onClick={() => onSelectLayer?.(l.id)}
                    onTap={() => onSelectLayer?.(l.id)}
                    onDragMove={(e) => handleDragMove(l, e)}
                    onDragEnd={(e) => { handleDragEndCommon(); onLayerDrag?.(l.id, e.target.x(), e.target.y()); }}
                  >
                    <KText
                      ref={(n) => { nodeRefs.current[l.id] = n; }}
                      text={text}
                      width={l.width}
                      fontSize={effFont}
                      fontStyle={l.fontWeight && l.fontWeight >= 600 ? "bold" : "normal"}
                      fontFamily={layerFont}
                      fill={color}
                      align={l.align ?? "left"}
                      lineHeight={1.2}
                      shadowColor="rgba(0,0,0,0.45)"
                      shadowBlur={l.type === "legal" ? 0 : 8}
                      shadowOpacity={l.type === "legal" ? 0 : 1}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Text;
                        const sx = node.scaleX();
                        const newWidth = Math.max(40, (l.width ?? 100) * sx);
                        node.scaleX(1); node.scaleY(1);
                        node.width(newWidth);
                        onLayerResize?.(l.id, { width: Math.round(newWidth) });
                      }}
                    />
                    {isSelected && isShrunk && (
                      <KText
                        text={`auto: ${effFont}px`}
                        x={0}
                        y={-14}
                        fontSize={11}
                        fontFamily={FONT_FAMILY}
                        fill="#22d3ee"
                      />
                    )}
                  </Group>
                );
              })}

            <Transformer
              ref={transformerRef}
              borderStroke="#22d3ee"
              anchorStroke="#22d3ee"
              anchorFill="#0b1220"
              anchorSize={10}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 30 || newBox.height < 16) return oldBox;
                return newBox;
              }}
            />
          </Layer>

          {(snapGuides.vCenter) && (
            <Layer listening={false}>
              <Line
                points={[format.width / 2, 0, format.width / 2, format.height]}
                stroke="#22d3ee"
                strokeWidth={1 / scale}
                dash={[6 / scale, 4 / scale]}
              />
            </Layer>
          )}

          {showSafeArea && (
            <Layer listening={false}>
              <Rect
                x={safePad}
                y={safePad}
                width={format.width - 2 * safePad}
                height={format.height - 2 * safePad}
                stroke="#22d3ee"
                strokeWidth={3 / scale}
                dash={[12 / scale, 8 / scale]}
              />
            </Layer>
          )}
        </Stage>
      </div>
      {!bg && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center px-6 py-4 rounded-lg bg-background/70 backdrop-blur-sm border border-dashed border-border max-w-[80%]">
            <div className="text-sm font-semibold text-foreground">Noch kein Hintergrundbild</div>
            <div className="text-xs text-muted-foreground mt-1">
              Wechsle zu Schritt 2 „Bild" und lade ein Foto hoch oder lasse es per KI reframen.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannerCanvas;
