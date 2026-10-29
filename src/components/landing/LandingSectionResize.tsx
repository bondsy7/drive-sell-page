import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeSectionHeight, resizeSectionHeight, sectionHeightVars } from '@/lib/landing-section-height';
import { editorControlStyle } from '@/lib/landing-theme';

export const LandingSectionSizeContext = createContext<{
  heights?: Record<string, number>;
  onResize?: (id: string, height: number) => void;
}>({});

export default function LandingSectionResize({ id, editable, children, surface }: {
  id: string; editable: boolean; children: React.ReactNode; surface?: string;
}) {
  const { heights, onResize } = useContext(LandingSectionSizeContext);
  const saved = normalizeSectionHeight(heights?.[id]);
  const [draft, setDraft] = useState<number>();
  const ref = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const height = draft ?? saved;

  const start = (edge: 'top' | 'bottom') => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!ref.current || !onResize || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const node = ref.current;
    const startHeight = node.getBoundingClientRect().height;
    const y = event.clientY;
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    let latest = saved ?? startHeight;
    let moved = false;
    target.setPointerCapture(pointerId);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      moved = true;
      latest = resizeSectionHeight(startHeight, e.clientY - y, edge);
      setDraft(latest);
    };
    const clear = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      cleanup.current = null;
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      clear();
      // Persist only once, and keep the natural content floor in the saved height.
      if (moved) onResize(id, Math.round(node.getBoundingClientRect().height));
      setDraft(undefined);
    };
    const cancel = () => { clear(); setDraft(undefined); };
    cleanup.current = clear;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
  };

  return <div ref={ref} className={`lp-section-resize${editable ? ' lp-resize-editable' : ''}${height !== undefined ? ' lp-sized-section' : ''}${draft !== undefined ? ' lp-resizing' : ''}`} style={{ ...editorControlStyle(surface), ...sectionHeightVars(height) } as React.CSSProperties}>
    {children}
    {editable && onResize && (['top', 'bottom'] as const).map(edge => <Button
      key={edge} type="button" variant="ghost" size="icon"
      className={`lp-section-resize-handle lp-section-resize-${edge}`}
      aria-label={`Abschnittshöhe ${edge === 'top' ? 'oben' : 'unten'} ändern`}
      title="Abschnittshöhe ändern"
      onPointerDown={start(edge)}
      onKeyDown={e => {
        if (!['ArrowUp', 'ArrowDown'].includes(e.key) || !ref.current) return;
        e.preventDefault();
        const current = ref.current.getBoundingClientRect().height;
        onResize(id, resizeSectionHeight(current, e.key === 'ArrowDown' ? 16 : -16, edge));
      }}
    ><ChevronsUpDown size={16} /></Button>)}
  </div>;
}