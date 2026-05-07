import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

const BeforeAfterSlider: React.FC<Props> = ({
  beforeSrc, afterSrc, beforeLabel = 'Vorher', afterLabel = 'Nachher', className,
}) => {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const handleDown = (e: React.PointerEvent) => {
    dragging.current = true;
    ref.current?.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const handleMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  };
  const handleUp = () => { dragging.current = false; };

  return (
    <div className={cn('relative w-full overflow-hidden rounded-xl bg-muted', className)}>
      <div
        ref={ref}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        onPointerCancel={handleUp}
        className="relative aspect-[4/3] max-h-[inherit] w-full select-none touch-none cursor-ew-resize"
      >
        <img src={afterSrc} alt={afterLabel} className="absolute inset-0 h-full w-full object-contain pointer-events-none" draggable={false} />
        <div
          className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
          style={{ width: `${pos}%` }}
        >
          <img
            src={beforeSrc}
            alt={beforeLabel}
            className="absolute inset-0 h-full w-full max-w-none object-contain"
            style={{ width: ref.current?.clientWidth || '100%' }}
            draggable={false}
          />
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.3)] pointer-events-none"
          style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background shadow-lg flex items-center justify-center border border-border">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground -ml-1">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </div>
        </div>

        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-background/85 backdrop-blur text-[11px] font-semibold text-foreground pointer-events-none">
          {beforeLabel}
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-background/85 backdrop-blur text-[11px] font-semibold text-foreground pointer-events-none">
          {afterLabel}
        </div>
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
