import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Maximize2, Minimize2, Play, Pause, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AiDisclosureBadge from "@/components/AiDisclosureBadge";

interface Spin360ViewerProps {
  frames: string[];
  className?: string;
  /** Einmalige Demo-Rotation nach kurzer Verzögerung (Standard: an). */
  autoplay?: boolean;
  /** ms pro Frame bei der Demo-Rotation. */
  autoplaySpeed?: number;
  showControls?: boolean;
}

const NEAR_RANGE = 4;      // sofort vorgeladene Nachbarframes
const DEMO_DELAY = 900;    // ms bis zur automatischen Demo-Drehung
const FRICTION = 0.94;     // Trägheits-Abbremsung
const MIN_VELOCITY = 0.02;

/**
 * Flipbook-Viewer V2: ein einziges <img>, dessen `src` während der Interaktion
 * imperativ getauscht wird. React rendert dadurch NICHT pro Frame neu; der
 * State wird nur für die Anzeige (Zähler, Buttons) nachgezogen.
 */
const Spin360Viewer: React.FC<Spin360ViewerProps> = ({
  frames,
  className,
  autoplay = true,
  autoplaySpeed = 70,
  showControls = true,
}) => {
  const totalFrames = frames.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragStartX = useRef(0);
  const dragStartFrame = useRef(0);
  const lastMoveX = useRef(0);
  const demoDoneRef = useRef(false);
  const playingRef = useRef(false);
  const framesRef = useRef(frames);
  framesRef.current = frames;

  const [displayFrame, setDisplayFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /** Imperativer Framewechsel — kein Re-Render pro Frame. */
  const showFrame = useCallback((next: number) => {
    const count = framesRef.current.length;
    if (count === 0) return;
    const idx = ((Math.round(next) % count) + count) % count;
    if (idx === frameRef.current && imgRef.current?.src) return;
    frameRef.current = idx;
    if (imgRef.current) imgRef.current.src = framesRef.current[idx];
  }, []);

  /** Zähler nur gelegentlich synchronisieren (nicht in jedem Frame). */
  const syncState = useCallback(() => setDisplayFrame(frameRef.current), []);

  // ── Preloading: erst die Nachbarn, dann der Rest im Idle ──
  useEffect(() => {
    if (totalFrames === 0) return;
    let cancelled = false;

    const preload = (idx: number) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = frames[idx];
    };

    for (let i = -NEAR_RANGE; i <= NEAR_RANGE; i++) {
      preload(((frameRef.current + i) % totalFrames + totalFrames) % totalFrames);
    }

    let i = 0;
    const idle: (cb: () => void) => number =
      (window as any).requestIdleCallback?.bind(window) ?? ((cb: () => void) => window.setTimeout(cb, 40));
    const loadNext = () => {
      if (cancelled || i >= totalFrames) return;
      preload(i++);
      idle(loadNext);
    };
    idle(loadNext);

    return () => { cancelled = true; };
    // Bewusst nur von der Frame-Liste abhängig: kein Re-Run pro angezeigtem Frame.
  }, [frames, totalFrames]);

  // Erstes Bild setzen
  useEffect(() => {
    if (totalFrames > 0 && imgRef.current) imgRef.current.src = frames[frameRef.current] ?? frames[0];
  }, [frames, totalFrames]);

  // ── Animationsschleife: Autoplay + Trägheit ──
  useEffect(() => {
    if (totalFrames <= 1) return;
    let last = performance.now();
    let acc = 0;
    let demoRemaining = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      if (Math.abs(velocityRef.current) > MIN_VELOCITY && !draggingRef.current) {
        showFrame(frameRef.current + velocityRef.current);
        velocityRef.current *= FRICTION;
        syncState();
      } else if (!draggingRef.current && (playingRef.current || demoRemaining > 0)) {
        acc += dt;
        if (acc >= autoplaySpeed) {
          acc = 0;
          showFrame(frameRef.current + 1);
          syncState();
          if (demoRemaining > 0 && --demoRemaining === 0) demoDoneRef.current = true;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const demoTimer = window.setTimeout(() => {
      if (autoplay && !demoDoneRef.current && !draggingRef.current && !playingRef.current) {
        demoRemaining = totalFrames; // genau eine volle Umdrehung
      }
    }, DEMO_DELAY);

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(demoTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [autoplay, autoplaySpeed, totalFrames, showFrame, syncState]);

  const stopMotion = useCallback(() => {
    demoDoneRef.current = true;
    playingRef.current = false;
    velocityRef.current = 0;
    setIsPlaying(false);
  }, []);

  // ── Drag (Pointer + Touch) ──
  const beginDrag = useCallback((clientX: number) => {
    draggingRef.current = true;
    setIsDragging(true);
    stopMotion();
    dragStartX.current = clientX;
    lastMoveX.current = clientX;
    dragStartFrame.current = frameRef.current;
  }, [stopMotion]);

  const moveDrag = useCallback((clientX: number) => {
    if (!draggingRef.current || totalFrames <= 1) return;
    const width = containerRef.current?.offsetWidth || 400;
    const sensitivity = width / totalFrames;
    const delta = (clientX - dragStartX.current) / sensitivity;
    showFrame(dragStartFrame.current + delta);
    velocityRef.current = (clientX - lastMoveX.current) / sensitivity;
    lastMoveX.current = clientX;
    syncState();
  }, [totalFrames, showFrame, syncState]);

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    beginDrag(e.clientX);
  }, [beginDrag]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => moveDrag(e.clientX), [moveDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => beginDrag(e.touches[0].clientX), [beginDrag]);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (draggingRef.current) e.preventDefault();
    moveDrag(e.touches[0].clientX);
  }, [moveDrag]);

  // ── Tastatur ──
  useEffect(() => {
    if (totalFrames <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (document.activeElement !== el && !el.matches(':hover')) return;
      if (e.key === 'ArrowLeft') { stopMotion(); showFrame(frameRef.current - 1); syncState(); }
      else if (e.key === 'ArrowRight') { stopMotion(); showFrame(frameRef.current + 1); syncState(); }
      else if (e.key === ' ') {
        e.preventDefault();
        demoDoneRef.current = true;
        playingRef.current = !playingRef.current;
        setIsPlaying(playingRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalFrames, showFrame, syncState, stopMotion]);

  const togglePlay = useCallback(() => {
    demoDoneRef.current = true;
    velocityRef.current = 0;
    playingRef.current = !playingRef.current;
    setIsPlaying(playingRef.current);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (totalFrames === 0) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label="360-Grad-Ansicht, mit Pfeiltasten drehen"
      className={cn(
        'relative select-none overflow-hidden rounded-xl bg-muted/30 border border-border group outline-none',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        isFullscreen && 'bg-background',
        className,
      )}
    >
      <div
        className="relative w-full aspect-[16/10] flex items-center justify-center touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
      >
        <img
          ref={imgRef}
          alt={`360° Ansicht Frame ${displayFrame + 1} von ${totalFrames}`}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {!isDragging && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground text-sm font-medium shadow-lg">
              <RotateCw className="w-4 h-4" />
              Ziehen zum Drehen
            </div>
          </div>
        )}
      </div>

      <AiDisclosureBadge context="spin" overlay className="bottom-3 left-3" />

      {showControls && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Abspielen'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-[11px] font-medium text-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
              {displayFrame + 1} / {totalFrames}
            </span>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm"
            onClick={toggleFullscreen}
            aria-label="Vollbild"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
        <div
          className="h-full bg-accent"
          style={{ width: `${((displayFrame + 1) / totalFrames) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default Spin360Viewer;
