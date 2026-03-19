import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Maximize2, Minimize2, Play, Pause, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Spin360ViewerProps {
  frames: string[];
  className?: string;
  autoplay?: boolean;
  autoplaySpeed?: number; // ms per frame
  showControls?: boolean;
}

const Spin360Viewer: React.FC<Spin360ViewerProps> = ({
  frames,
  className,
  autoplay = false,
  autoplaySpeed = 80,
  showControls = true,
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoplay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedFrames, setLoadedFrames] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartFrame = useRef(0);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);

  const totalFrames = frames.length;
  if (totalFrames === 0) return null;

  // Preload frames near current
  useEffect(() => {
    const preloadRange = 5;
    for (let i = -preloadRange; i <= preloadRange; i++) {
      const idx = ((currentFrame + i) % totalFrames + totalFrames) % totalFrames;
      if (!loadedFrames.has(idx)) {
        const img = new Image();
        img.src = frames[idx];
        img.onload = () => setLoadedFrames(prev => new Set(prev).add(idx));
      }
    }
  }, [currentFrame, frames, totalFrames, loadedFrames]);

  // Autoplay
  useEffect(() => {
    if (isAutoPlaying && totalFrames > 1) {
      autoplayRef.current = setInterval(() => {
        setCurrentFrame(prev => (prev + 1) % totalFrames);
      }, autoplaySpeed);
    }
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [isAutoPlaying, totalFrames, autoplaySpeed]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    setIsAutoPlaying(false);
    dragStartX.current = e.clientX;
    dragStartFrame.current = currentFrame;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [currentFrame]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || totalFrames <= 1) return;
    const containerWidth = containerRef.current?.offsetWidth || 400;
    const dx = e.clientX - dragStartX.current;
    const frameSensitivity = containerWidth / totalFrames;
    const frameDelta = Math.round(dx / frameSensitivity);
    const newFrame = ((dragStartFrame.current + frameDelta) % totalFrames + totalFrames) % totalFrames;
    setCurrentFrame(newFrame);
  }, [isDragging, totalFrames]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsAutoPlaying(false);
    dragStartX.current = e.touches[0].clientX;
    dragStartFrame.current = currentFrame;
  }, [currentFrame]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (totalFrames <= 1) return;
    e.preventDefault();
    const containerWidth = containerRef.current?.offsetWidth || 400;
    const dx = e.touches[0].clientX - dragStartX.current;
    const frameSensitivity = containerWidth / totalFrames;
    const frameDelta = Math.round(dx / frameSensitivity);
    const newFrame = ((dragStartFrame.current + frameDelta) % totalFrames + totalFrames) % totalFrames;
    setCurrentFrame(newFrame);
  }, [totalFrames]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative select-none overflow-hidden rounded-xl bg-muted/30 border border-border group',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        isFullscreen && 'bg-background',
        className
      )}
    >
      {/* Main frame display */}
      <div
        className="relative w-full aspect-[16/10] flex items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <img
          src={frames[currentFrame]}
          alt={`360° Ansicht Frame ${currentFrame + 1}`}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* Drag hint overlay */}
        {!isDragging && !isAutoPlaying && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground text-sm font-medium shadow-lg">
              <RotateCw className="w-4 h-4" />
              Ziehen zum Drehen
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            >
              {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-[11px] font-medium text-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
              {currentFrame + 1} / {totalFrames}
            </span>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      )}

      {/* Frame strip (thin progress bar) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
        <div
          className="h-full bg-accent transition-all duration-75"
          style={{ width: `${((currentFrame + 1) / totalFrames) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default Spin360Viewer;
