import React, { useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeSectionHeight, resizeSectionHeight } from '@/lib/landing-section-height';
import { editorControlStyle } from '@/lib/landing-theme';
import { LandingSectionSizeContext } from '@/components/landing/LandingSectionResize';

/**
 * The page header keeps its own height. The saved value is a minimum, so logos
 * and the phone button can never be crushed, and the sticky behaviour stays
 * intact because the component renders the <header> itself instead of adding a
 * wrapper element around it.
 */
export default function LandingHeaderResize({ id = 'header', editable, style, surface = '#ffffff', children }: {
  id?: string; editable: boolean; style?: CSSProperties; surface?: string; children: ReactNode;
}) {
  const { heights, onResize } = useContext(LandingSectionSizeContext);
  const saved = normalizeSectionHeight(heights?.[id]);
  const [draft, setDraft] = useState<number>();
  const ref = useRef<HTMLElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const height = draft ?? saved;

  const start = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!ref.current || !onResize || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const node = ref.current;
    const startHeight = node.getBoundingClientRect().height;
    const y = event.clientY;
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    let moved = false;
    target.setPointerCapture(pointerId);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      moved = true;
      setDraft(resizeSectionHeight(startHeight, e.clientY - y, 'bottom'));
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

  return <header
    ref={ref}
    className={`lp-header-resize${editable ? ' lp-header-resize-editable' : ''}${draft !== undefined ? ' lp-header-resizing' : ''}`}
    style={{ ...style, ...(height !== undefined ? { minHeight: height } : {}), ...editorControlStyle(surface) } as CSSProperties}
  >
    {children}
    {editable && onResize && <Button
      type="button" variant="ghost" size="icon"
      className="lp-header-resize-handle"
      aria-label="Höhe der Kopfzeile ändern"
      title="Höhe der Kopfzeile ändern"
      onPointerDown={start}
      onKeyDown={e => {
        if (!['ArrowUp', 'ArrowDown'].includes(e.key) || !ref.current || !onResize) return;
        e.preventDefault();
        onResize(id, resizeSectionHeight(ref.current.getBoundingClientRect().height, e.key === 'ArrowDown' ? 16 : -16, 'bottom'));
      }}
    ><ChevronsUpDown size={16} /></Button>}
  </header>;
}
