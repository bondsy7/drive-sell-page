import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import ImagePlaceholder from './ImagePlaceholder';
import { Button } from '@/components/ui/button';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelAlt, getAiDisclosureLabelVector, getAiDisclosureText, type AiDisclosureContext } from '@/lib/ai-disclosure';

interface HoverZoomImageProps {
  src: string;
  alt: string;
  label: string;
  aiContext?: AiDisclosureContext;
}

export default function HoverZoomImage({ src, alt, label, aiContext }: HoverZoomImageProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const pointRef = useRef({ x: 0.5, y: 0.5 });
  const [zoomActive, setZoomActive] = useState(false);
  const [geometry, setGeometry] = useState({ width: 0, height: 0, left: 0, top: 0 });

  const updateZoom = useCallback(() => {
    const main = mainRef.current;
    const detail = detailRef.current;
    const image = main?.querySelector('img');
    if (!main || !detail || !image?.naturalWidth || !image.naturalHeight) return;
    const bounds = main.getBoundingClientRect();
    const scale = Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const sourceWidth = image.naturalWidth * scale;
    const sourceHeight = image.naturalHeight * scale;
    const magnification = 2.5;
    const width = sourceWidth * magnification;
    const height = sourceHeight * magnification;
    // Account for the main image's centered object-cover crop.
    const x = pointRef.current.x * bounds.width + (sourceWidth - bounds.width) / 2;
    const y = pointRef.current.y * bounds.height + (sourceHeight - bounds.height) / 2;
    setGeometry({
      width, height,
      left: Math.min(0, Math.max(detail.clientWidth - width, detail.clientWidth / 2 - x * magnification)),
      top: Math.min(0, Math.max(detail.clientHeight - height, detail.clientHeight / 2 - y * magnification)),
    });
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(updateZoom);
    if (mainRef.current) observer.observe(mainRef.current);
    if (detailRef.current) observer.observe(detailRef.current);
    updateZoom();
    return () => observer.disconnect();
  }, [updateZoom]);

  const moveZoom = (event: PointerEvent<HTMLDivElement>) => {
    if (!zoomActive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointRef.current = {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
    updateZoom();
  };

  return (
    <div className="relative pb-10 pr-0 sm:pr-20">
      <div ref={mainRef} className="relative" onPointerMove={moveZoom} onLoadCapture={updateZoom}>
        <ImagePlaceholder label={label} ratio="4/3" className="w-full bg-secondary" src={src} alt={alt} aiContext={aiContext} />
        <Button
          type="button"
          variant="ghost"
          aria-label={`Zoom ${zoomActive ? 'stoppen' : 'aktivieren'}: ${label}`}
          aria-pressed={zoomActive}
          className={`absolute inset-0 h-full w-full p-0 hover:bg-transparent ${zoomActive ? 'cursor-crosshair' : 'cursor-zoom-in'}`}
          onClick={() => setZoomActive(active => !active)}
        />
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 hidden w-52 rounded-lg border border-border bg-card p-3 shadow-elevated sm:block">
        <div ref={detailRef} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/70">
          <img src={src} alt={`Vergrößerter Ausschnitt: ${alt}`} className="absolute max-w-none" style={{ width: geometry.width, height: geometry.height, left: geometry.left, top: geometry.top }} />
          {aiContext ? <img src={getAiDisclosureLabelVector(aiContext)} alt={getAiDisclosureLabelAlt(aiContext)} title={getAiDisclosureText(aiContext)} className={AI_DISCLOSURE_OVERLAY_CLASS} /> : null}
        </div>
      </div>
    </div>
  );
}