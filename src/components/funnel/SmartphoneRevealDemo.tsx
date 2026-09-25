import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import beforeAsset from '@/assets/funnel/before.webp.asset.json';
import after1Asset from '@/assets/funnel/after1.webp.asset.json';
import after2Asset from '@/assets/funnel/after2.webp.asset.json';
import after3Asset from '@/assets/funnel/after3.webp.asset.json';
import after4Asset from '@/assets/funnel/after4.webp.asset.json';
import after5Asset from '@/assets/funnel/after5.webp.asset.json';

// Zum Austauschen eines Zustands nur die jeweilige Bildquelle hier ändern.
const REVEAL_VARIANTS = [
  { label: 'Aufbereitung', image: after1Asset.url },
  { label: 'Showroom', image: after2Asset.url },
  { label: 'Lackierung', image: after3Asset.url },
  { label: 'Felgen', image: after4Asset.url },
  { label: 'Branding', image: after5Asset.url },
] as const;

type Position = { x: number; y: number };

export default function SmartphoneRevealDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const [position, setPosition] = useState<Position | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [intro, setIntro] = useState(true);

  const clampToStage = (x: number, y: number): Position => {
    const stage = stageRef.current;
    const phone = phoneRef.current;
    if (!stage || !phone) return { x, y };
    return {
      x: Math.min(Math.max(0, x), Math.max(0, stage.clientWidth - phone.offsetWidth)),
      y: Math.min(Math.max(0, y), Math.max(0, stage.clientHeight - phone.offsetHeight)),
    };
  };

  useEffect(() => {
    const stage = stageRef.current;
    const phone = phoneRef.current;
    if (!stage || !phone) return;

    const placePhone = () => {
      setPosition((current) => {
        if (current) return clampToStage(current.x, current.y);
        return clampToStage(
          (stage.clientWidth - phone.offsetWidth) * 0.6,
          (stage.clientHeight - phone.offsetHeight) * 0.46,
        );
      });
    };

    placePhone();
    const observer = new ResizeObserver(placePhone);
    observer.observe(stage);
    observer.observe(phone);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!intro) return;
    const timer = window.setTimeout(() => setIntro(false), 2400);
    return () => window.clearTimeout(timer);
  }, [intro]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!position) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) return;
    dragOffsetRef.current = {
      x: event.clientX - stageRect.left - position.x,
      y: event.clientY - stageRect.top - position.y,
    };
    setIntro(false);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) return;
    setPosition(clampToStage(
      event.clientX - stageRect.left - dragOffsetRef.current.x,
      event.clientY - stageRect.top - dragOffsetRef.current.y,
    ));
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-elevated" aria-label="Interaktiver Vorher-Nachher-Vergleich">
      <div
        ref={stageRef}
        className="relative aspect-[1.18] min-h-[310px] select-none overflow-hidden bg-secondary sm:min-h-0"
      >
        <img
          src={beforeAsset.url}
          alt="BMW X7 als unbearbeitetes Bestandsfoto vor dem Autohaus"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          draggable={false}
          loading="eager"
        />

        <span className="absolute left-3 top-3 z-10 rounded-md bg-foreground/85 px-2.5 py-1.5 text-[10px] font-semibold text-background shadow-card sm:text-xs">
          Unbearbeitet
        </span>

        <div
          ref={phoneRef}
          data-testid="reveal-phone"
          className={`absolute z-20 aspect-[9/18.5] w-[clamp(118px,30%,174px)] cursor-grab touch-none rounded-[1.8rem] border-[6px] border-foreground bg-foreground shadow-elevated transition-shadow duration-200 hover:shadow-glow ${dragging ? 'cursor-grabbing shadow-glow' : ''} ${intro ? 'funnel-phone-intro' : ''}`}
          style={position ? { left: position.x, top: position.y } : { left: '60%', top: '46%' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          role="img"
          aria-label={`${REVEAL_VARIANTS[activeIndex].label}: Ziehen Sie das Smartphone über das Bild, um die Bearbeitung zu sehen.`}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.35rem] bg-card">
            {position && REVEAL_VARIANTS.map((variant, index) => (
              <img
                key={variant.label}
                src={variant.image}
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`absolute max-w-none object-cover transition-opacity duration-300 ${activeIndex === index ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  left: -position.x - 6,
                  top: -position.y - 6,
                  width: `${stageRef.current?.clientWidth ?? 0}px`,
                  height: `${stageRef.current?.clientHeight ?? 0}px`,
                }}
              />
            ))}
            <div className="absolute left-1/2 top-1.5 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-foreground/80" />
            <div className="absolute inset-x-0 bottom-2 z-10 mx-auto h-1 w-10 rounded-full bg-foreground/70" />
          </div>
        </div>

        <div className={`pointer-events-none absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-foreground/85 px-3 py-2 text-[10px] font-semibold text-background shadow-card transition-opacity duration-300 sm:text-xs ${dragging ? 'opacity-0' : 'opacity-100'}`}>
          <Move className="h-3.5 w-3.5" aria-hidden="true" />
          Ziehen und Ergebnis entdecken
        </div>
      </div>

      <div className="border-t border-border bg-card p-2.5 sm:p-3">
        <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Bearbeitete Version wählen">
          {REVEAL_VARIANTS.map((variant, index) => (
            <Button
              key={variant.label}
              type="button"
              size="sm"
              variant={activeIndex === index ? 'default' : 'outline'}
              className="h-9 shrink-0 px-3 text-xs"
              role="tab"
              aria-selected={activeIndex === index}
              onClick={() => setActiveIndex(index)}
            >
              {index + 1}. {variant.label}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}