import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Wrench } from 'lucide-react';

type ToolboxState = {
  selected: string | null;
  label: string;
  select: (key: string, label: string) => void;
  sectionSelected: string | null;
  sectionLabel: string;
  selectSection: (key: string, label: string) => void;
  clear: () => void;
  body: HTMLElement | null;
  sectionBody: HTMLElement | null;
};

/** Floating editor toolbox with independent section and selected-element actions. */
export const LandingToolboxContext = createContext<ToolboxState | null>(null);
export const useLandingToolbox = () => useContext(LandingToolboxContext);

const IGNORE = '.lp-toolbox,[data-radix-popper-content-wrapper],[role="dialog"],[role="alertdialog"],[data-radix-portal]';

export function LandingToolboxProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [sectionSelected, setSectionSelected] = useState<string | null>(null);
  const [sectionLabel, setSectionLabel] = useState('');
  const [sectionBody, setSectionBody] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const select = useCallback((key: string, nextLabel: string) => { setSelected(key); setLabel(nextLabel); setCollapsed(false); }, []);
  const selectSection = useCallback((key: string, nextLabel: string) => { setSectionSelected(key); setSectionLabel(nextLabel); setCollapsed(false); }, []);
  const clear = useCallback(() => { setSelected(null); setSectionSelected(null); }, []);

  // Default position: top-left edge of the landing page.
  useEffect(() => {
    if (!enabled || pos) return;
    const r = anchorRef.current?.getBoundingClientRect();
    setPos({ x: Math.max(8, (r?.left ?? 16) + 12), y: Math.max(72, (r?.top ?? 80) + 12) });
  }, [enabled, pos]);

  // Outside clicks clear both selections; nested dialogs and popovers stay usable.
  useEffect(() => {
    if (!enabled) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || target.closest?.(IGNORE)) return;
      if ((event as PointerEvent & { __lpSelected?: boolean }).__lpSelected) return;
      clear();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [enabled, clear]);

  const value = useMemo(() => ({
    selected, label, select, sectionSelected, sectionLabel, selectSection, clear, body, sectionBody,
  }), [selected, label, select, sectionSelected, sectionLabel, selectSection, clear, body, sectionBody]);
  if (!enabled) return <>{children}</>;

  return <LandingToolboxContext.Provider value={value}>
    <div ref={anchorRef} style={{ height: 0 }} aria-hidden />
    {children}
    <div className="lp-toolbox" role="toolbar" aria-label="Werkzeugkasten"
      style={{ left: pos?.x ?? 16, top: pos?.y ?? 80 }}>
      <div className="lp-toolbox-head"
        onPointerDown={event => {
          if ((event.target as Element).closest('button')) return;
          drag.current = { dx: event.clientX - (pos?.x ?? 0), dy: event.clientY - (pos?.y ?? 0) };
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          const x = Math.min(window.innerWidth - 80, Math.max(0, event.clientX - drag.current.dx));
          const y = Math.min(window.innerHeight - 40, Math.max(0, event.clientY - drag.current.dy));
          setPos({ x, y });
        }}
        onPointerUp={() => { drag.current = null; }}>
        <GripVertical size={14} className="lp-toolbox-grip" aria-hidden />
        <Wrench size={14} aria-hidden />
        <span className="lp-toolbox-title">{selected ? label : sectionSelected ? sectionLabel : 'Werkzeugkasten'}</span>
        <button type="button" className="lp-toolbox-toggle" onClick={() => setCollapsed(current => !current)}
          aria-label={collapsed ? 'Werkzeugkasten ausklappen' : 'Werkzeugkasten einklappen'}>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      <div className="lp-toolbox-body lp-edit-menu" hidden={collapsed}>
        <section className="lp-toolbox-group" aria-labelledby="lp-toolbox-section-title">
          <div className="lp-toolbox-group-head">
            <p id="lp-toolbox-section-title" className="lp-toolbox-group-title">Abschnittsänderungen</p>
            {sectionSelected && <span className="lp-toolbox-group-selection">{sectionLabel}</span>}
          </div>
          {!sectionSelected && <p className="lp-toolbox-empty">Wähle den Stift eines Abschnitts.</p>}
          <div ref={setSectionBody} className="flex flex-col gap-1" />
        </section>
        <section className="lp-toolbox-group" aria-labelledby="lp-toolbox-element-title">
          <div className="lp-toolbox-group-head">
            <p id="lp-toolbox-element-title" className="lp-toolbox-group-title">Änderungen am gewählten Element</p>
            {selected && <span className="lp-toolbox-group-selection">{label}</span>}
          </div>
          {!selected && <p className="lp-toolbox-empty">Klicke auf einen Text, ein Bild, einen Button oder ein Logo.</p>}
          <div ref={setBody} className="flex flex-col gap-1" />
        </section>
      </div>
    </div>
  </LandingToolboxContext.Provider>;
}
