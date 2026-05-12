import React, { useEffect, useRef, useState } from "react";
import { Crop, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceImageUrl?: string;
  targetWidth: number;
  targetHeight: number;
  onPick: (dataUrl: string) => void;
}

/**
 * Lightweight manual crop fallback.
 * - User drags a crop rectangle that is constrained to the target aspect ratio.
 * - Output is rendered to a target-size canvas → guarantees exact format dimensions.
 * No external dependencies.
 */
const ManualCropDialog: React.FC<Props> = ({
  open, onOpenChange, sourceImageUrl, targetWidth, targetHeight, onPick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  // Crop rect in *display* coords
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const dragRef = useRef<{ startX: number; startY: number; cx: number; cy: number } | null>(null);
  const targetRatio = targetWidth / targetHeight;

  // Load image
  useEffect(() => {
    if (!open || !sourceImageUrl) return;
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = sourceImageUrl;
  }, [open, sourceImageUrl]);

  // Compute display size to fit container
  useEffect(() => {
    if (!img || !wrapRef.current) return;
    const maxW = Math.min(wrapRef.current.clientWidth, 720);
    const maxH = 420;
    const ir = img.naturalWidth / img.naturalHeight;
    let w = maxW;
    let h = w / ir;
    if (h > maxH) { h = maxH; w = h * ir; }
    setDisplaySize({ w, h });

    // Initial crop = largest centered rect in target aspect
    let cw = w;
    let ch = cw / targetRatio;
    if (ch > h) { ch = h; cw = ch * targetRatio; }
    setCrop({ x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch });
  }, [img, targetRatio]);

  // Draw preview (image + dimmed area + crop rect)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !img) return;
    cv.width = displaySize.w;
    cv.height = displaySize.h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    // dim outside
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, cv.width, crop.y);
    ctx.fillRect(0, crop.y + crop.h, cv.width, cv.height - crop.y - crop.h);
    ctx.fillRect(0, crop.y, crop.x, crop.h);
    ctx.fillRect(crop.x + crop.w, crop.y, cv.width - crop.x - crop.w, crop.h);
    // crop border
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x + 1, crop.y + 1, crop.w - 2, crop.h - 2);
  }, [img, displaySize, crop]);

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      cx: crop.x,
      cy: crop.y,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const dx = (e.clientX - rect.left) - dragRef.current.startX;
    const dy = (e.clientY - rect.top) - dragRef.current.startY;
    let nx = dragRef.current.cx + dx;
    let ny = dragRef.current.cy + dy;
    nx = Math.max(0, Math.min(displaySize.w - crop.w, nx));
    ny = Math.max(0, Math.min(displaySize.h - crop.h, ny));
    setCrop((c) => ({ ...c, x: nx, y: ny }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const setCropScale = (pct: number) => {
    // pct: 50..100 — width % of max possible
    const maxW = Math.min(displaySize.w, displaySize.h * targetRatio);
    const w = (maxW * pct) / 100;
    const h = w / targetRatio;
    setCrop({
      x: Math.max(0, Math.min(displaySize.w - w, crop.x + (crop.w - w) / 2)),
      y: Math.max(0, Math.min(displaySize.h - h, crop.y + (crop.h - h) / 2)),
      w, h,
    });
  };

  const handleApply = () => {
    if (!img) return;
    const sx = (crop.x / displaySize.w) * img.naturalWidth;
    const sy = (crop.y / displaySize.h) * img.naturalHeight;
    const sw = (crop.w / displaySize.w) * img.naturalWidth;
    const sh = (crop.h / displaySize.h) * img.naturalHeight;
    const out = document.createElement("canvas");
    out.width = targetWidth;
    out.height = targetHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    const dataUrl = out.toDataURL("image/jpeg", 0.95);
    onPick(dataUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-accent" /> Manueller Crop · {targetWidth}×{targetHeight}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Plan B: Wenn der KI-Reframe nicht passt, wähle hier exakt den Bildausschnitt. Das Verhältnis wird automatisch gehalten.
          </p>
          <div ref={wrapRef} className="w-full flex justify-center bg-muted/30 rounded-lg p-2">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="cursor-move touch-none rounded"
              style={{ width: displaySize.w, height: displaySize.h }}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16">Größe</span>
            <input
              type="range"
              min={40}
              max={100}
              step={2}
              defaultValue={100}
              onChange={(e) => setCropScale(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleApply} disabled={!img}>
            <Check className="w-4 h-4 mr-1" /> Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualCropDialog;
