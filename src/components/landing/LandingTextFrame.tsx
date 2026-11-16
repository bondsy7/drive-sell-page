import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { snapEdge } from '@/lib/landing-image-frame';
import {
  normalizeTextFrame,
  resizeTextFrame,
  textFrameOuterStyle,
  type LandingTextFrame as TextFrameValue,
} from '@/lib/landing-text-frame';

interface LandingTextFrameContextValue {
  frames?: Record<string, TextFrameValue>;
  editable: boolean;
  onChange?: (id: string, frame: TextFrameValue) => void;
}

const LandingTextFrameContext = createContext<LandingTextFrameContextValue>({ editable: false });

export function LandingTextFrameProvider({ children, frames, editable, onChange }: {
  children: React.ReactNode;
  frames?: Record<string, TextFrameValue>;
  editable: boolean;
  onChange?: (id: string, frame: TextFrameValue) => void;
}) {
  return <LandingTextFrameContext.Provider value={{ frames, editable, onChange }}>{children}</LandingTextFrameContext.Provider>;
}

function parentContentBox(parent: HTMLElement) {
  const rect = parent.getBoundingClientRect();
  const style = window.getComputedStyle(parent);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
  return {
    left: rect.left + borderLeft + paddingLeft,
    right: rect.right - borderRight - paddingRight,
    width: Math.max(1, parent.clientWidth - paddingLeft - paddingRight - borderLeft - borderRight),
  };
}

/** Adds left/right drag handles around one stable text element and commits once on pointer-up. */
export default function LandingTextFrame({ id, children }: { id?: string; children: React.ReactNode }) {
  const context = useContext(LandingTextFrameContext);
  const raw = id ? context.frames?.[id] : undefined;
  const base = normalizeTextFrame(raw);
  const baseKey = JSON.stringify(base);
  const [draft, setDraft] = useState(base);
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(base); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [baseKey]);
  useEffect(() => { if (!context.editable) setResizing(null); }, [context.editable]);

  if (!id) return <>{children}</>;
  const tools = context.editable && !!context.onChange;
  const active = tools ? draft : base;
  const custom = !!raw || !!resizing;

  const startResize = (edge: 'left' | 'right') => (event: React.PointerEvent) => {
    if (!context.onChange) return;
    event.preventDefault();
    event.stopPropagation();
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const start = element.getBoundingClientRect();
    const column = parentContentBox(parent);
    const initial = normalizeTextFrame(draft);
    let latest = initial;
    setResizing(edge);

    const move = (moveEvent: PointerEvent) => {
      const deltaPx = moveEvent.clientX - event.clientX;
      let deltaPct = (deltaPx / column.width) * 100;
      if (edge === 'right') {
        const snapped = snapEdge(start.right + deltaPx, [column.left, column.right]);
        deltaPct = (snapped.value - start.right) / column.width * 100;
      } else {
        const snapped = snapEdge(start.left + deltaPx, [column.left, column.right]);
        deltaPct = (snapped.value - start.left) / column.width * 100;
      }
      latest = resizeTextFrame(initial, deltaPct, edge);
      setDraft(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setResizing(null);
      context.onChange?.(id, latest);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return <div
    ref={ref}
    className={`lp-text-frame${custom ? ' lp-text-framed' : ''}${resizing ? ' lp-text-frame-resizing' : ''}`}
    style={custom ? textFrameOuterStyle(active) : { width: '100%' }}
    data-text-frame={id}
  >
    {children}
    {tools && <>
      <div role="presentation" aria-hidden className="lp-text-frame-handle lp-text-frame-handle-left" data-text-edge="left" onPointerDown={startResize('left')} />
      <div role="presentation" aria-hidden className="lp-text-frame-handle lp-text-frame-handle-right" data-text-edge="right" onPointerDown={startResize('right')} />
    </>}
  </div>;
}
