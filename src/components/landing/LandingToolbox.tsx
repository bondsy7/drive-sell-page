import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Wrench } from 'lucide-react';

type ToolboxState = {
  selected: string | null;
  label: string;
  select: (key: string, label: string) => void;
  clear: () => void;
  body: HTMLElement | null;
};

/** Floating editor toolbox: clicked elements render their edit actions here instead of a pencil popover. */
export const LandingToolboxContext = createContext<ToolboxState | null>(null);
export const useLandingToolbox = () => useContext(LandingToolboxContext);

const IGNORE = '.lp-toolbox,[data-radix-popper-content-wrapper],[role="dialog"],[role="alertdialog"],[data-radix-portal]';

export function LandingToolboxProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const select = useCallback((key: string, l: string) => { setSelected(key); setLabel(l); setCollapsed(false); }, []);
  const clear = useCallback(() => setSelected(null), []);

  // Default position: top-left edge of the landing page.
  useEffect(() => {
    if (!enabled || pos) return;
    const r = anchorRef.current?.getBoundingClientRect();
    setPos({ x: Math.max(8, (r?.left ?? 16) + 12), y: Math.max(72, (r?.top ?? 80) + 12) });
  }, [enabled, pos]);

  // Clicking anywhere outside an element (and outside the toolbox / its popovers) leaves the element.
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || t.closest?.(IGNORE)) return;
      if ((e as PointerEvent & { __lpSelected?: boolean }).__lpSelected) return;
      setSelected(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [enabled]);

  const value = useMemo(() => ({ selected, label, select, clear, body }), [selected, label, select, clear, body]);
  if (!enabled) return <>{children}</>;

  return <LandingToolboxContext.Provider value={value}>
    <div ref={anchorRef} style={{ height: 0 }} aria-hidden />
    {children}
    <div className="lp-toolbox" role="toolbar" aria-label="Werkzeugkasten"
      style={{ left: pos?.x ?? 16, top: pos?.y ?? 80 }}>
      <div className="lp-toolbox-head"
        onPointerDown={e => {
          if ((e.target as Element).closest('button')) return;
          drag.current = { dx: e.clientX - (pos?.x ?? 0), dy: e.clientY - (pos?.y ?? 0) };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (!drag.current) return;
          const x = Math.min(window.innerWidth - 80, Math.max(0, e.clientX - drag.current.dx));
          const y = Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.current.dy));
          setPos({ x, y });
        }}
        onPointerUp={() => { drag.current = null; }}>
        <GripVertical size={14} className="lp-toolbox-grip" aria-hidden />
        <Wrench size={14} aria-hidden />
        <span className="lp-toolbox-title">{selected ? label : 'Werkzeugkasten'}</span>
        <button type="button" className="lp-toolbox-toggle" onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Werkzeugkasten ausklappen' : 'Werkzeugkasten einklappen'}>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      <div className="lp-toolbox-body lp-edit-menu" hidden={collapsed}>
        {!selected && <p className="lp-toolbox-empty">Klicke auf einen Text, ein Bild, einen Button oder ein Logo, um es hier zu bearbeiten.</p>}
        <div ref={setBody} className="flex flex-col gap-1" />
      </div>
    </div>
  </LandingToolboxContext.Provider>;
}
