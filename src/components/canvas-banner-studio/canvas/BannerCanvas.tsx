import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Image as KImage, Text as KText, Group } from "react-konva";
import type Konva from "konva";
import type { BannerComposition, BannerLayer, OverlayDirection } from "../state/types";
import type { BannerFormat, BannerTextFields } from "../state/types";

interface BannerCanvasProps {
  format: BannerFormat;
  composition: BannerComposition;
  textFields: BannerTextFields;
  showSafeArea: boolean;
  selectedLayerId?: string;
  resolveColor: (token?: string) => string;
  onSelectLayer?: (id?: string) => void;
  onLayerDrag?: (id: string, x: number, y: number) => void;
  stageRef?: React.MutableRefObject<Konva.Stage | null>;
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
  resolveColor, onSelectLayer, onLayerDrag, stageRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const internalStageRef = useRef<Konva.Stage | null>(null);
  const [scale, setScale] = useState(1);

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
  const logo = useImage(composition.logoUrl);

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
                  const w = l.width ?? format.width * 0.18;
                  const ratio = logo.naturalHeight / logo.naturalWidth || 0.4;
                  const h = w * ratio;
                  return (
                    <Group
                      key={l.id}
                      x={l.x}
                      y={l.y}
                      draggable={l.draggable}
                      onClick={() => onSelectLayer?.(l.id)}
                      onTap={() => onSelectLayer?.(l.id)}
                      onDragEnd={(e) => onLayerDrag?.(l.id, e.target.x(), e.target.y())}
                    >
                      <KImage image={logo} width={w} height={h} />
                      {isSelected && <Rect width={w} height={h} stroke="#22d3ee" strokeWidth={2 / scale} dash={[6 / scale, 4 / scale]} />}
                    </Group>
                  );
                }
                const text = l.field ? textFields[l.field] : "";
                if (!text) return null;
                const color = resolveColor(l.color);
                return (
                  <Group
                    key={l.id}
                    x={l.x}
                    y={l.y}
                    draggable={l.draggable}
                    onClick={() => onSelectLayer?.(l.id)}
                    onTap={() => onSelectLayer?.(l.id)}
                    onDragEnd={(e) => onLayerDrag?.(l.id, e.target.x(), e.target.y())}
                  >
                    <KText
                      text={text}
                      width={l.width}
                      fontSize={l.fontSize}
                      fontStyle={l.fontWeight && l.fontWeight >= 600 ? "bold" : "normal"}
                      fontFamily="Inter, Manrope, system-ui, sans-serif"
                      fill={color}
                      align={l.align ?? "left"}
                      lineHeight={1.2}
                      shadowColor="rgba(0,0,0,0.45)"
                      shadowBlur={l.type === "legal" ? 0 : 8}
                      shadowOpacity={l.type === "legal" ? 0 : 1}
                    />
                    {isSelected && (
                      <Rect
                        width={l.width}
                        height={(l.fontSize ?? 16) * 1.4}
                        stroke="#22d3ee"
                        strokeWidth={2 / scale}
                        dash={[6 / scale, 4 / scale]}
                      />
                    )}
                  </Group>
                );
              })}
          </Layer>

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
    </div>
  );
};

export default BannerCanvas;
