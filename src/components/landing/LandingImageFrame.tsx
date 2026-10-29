import React, { useContext, useEffect, useRef, useState } from 'react';
import { LandingImageInsertContext } from '@/components/landing/LandingImageStack';
import { RefreshCw, Sparkles, ImageIcon, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelVector, getAiDisclosureLabelAlt, withAiDisclosureAlt } from '@/lib/ai-disclosure';
import { ElementDeleteButton } from '@/components/landing/LandingElementBox';
import LandingEditMenu from '@/components/landing/LandingEditMenu';
import { Button } from '@/components/ui/button';
import { rgba } from '@/lib/landing-theme';
import {
  FRAME_MIN_HEIGHT_PX, FRAME_MIN_WIDTH_PCT, FRAME_ZOOM_MAX, FRAME_ZOOM_MIN,
  frameImageStyle, frameOuterStyle, normalizeImageFrame, parseAspect, snapEdge,
  type LandingImageFrame,
} from '@/lib/landing-image-frame';

type Edge = 'top' | 'left' | 'right' | 'bottom' | 'corner-left' | 'corner-right';

interface Props {
  src?: string;
  alt: string;
  aspect: string;
  editable: boolean;
  loading?: boolean;
  onReplace?: () => void;
  primary: string;
  onDelete?: () => void;
  labelImage?: boolean;
  rounded?: boolean;
  frame?: Partial<LandingImageFrame> | null;
  /** Frame/pan/zoom tools are only offered in the desktop editor. */
  frameEditing?: boolean;
  onFrameChange?: (frame: LandingImageFrame | null) => void;
}

const SNAP_SELECTOR = '.lp-editable, a, button, .lp-image-frame, h1, h2, h3, p';

function collectSnapEdges(self: HTMLElement) {
  const scope = (self.closest('section') as HTMLElement | null) ?? self.parentElement;
  const xs: number[] = []; const ys: number[] = [];
  if (!scope) return { xs, ys };
  scope.querySelectorAll<HTMLElement>(SNAP_SELECTOR).forEach(el => {
    if (el === self || self.contains(el) || el.contains(self) || el.closest('.lp-section-controls')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    xs.push(r.left, r.right); ys.push(r.top, r.bottom);
  });
  return { xs, ys };
}

export default function LandingImageFrame({
  src, alt, aspect, editable, loading, onReplace, primary, onDelete,
  labelImage = true, rounded = true, frame, frameEditing = false, onFrameChange,
}: Props) {
  const insertActions = useContext(LandingImageInsertContext);
  const base = normalizeImageFrame(frame, parseAspect(aspect));
  const [draft, setDraft] = useState<LandingImageFrame>(base);
  const [mode, setMode] = useState<null | 'frame' | 'pan'>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const ref = useRef<HTMLDivElement>(null);
  const baseKey = JSON.stringify(base);
  useEffect(() => { setDraft(base); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [baseKey]);

  const tools = editable && frameEditing && !!onFrameChange;
  useEffect(() => { if (!tools) setMode(null); }, [tools]);
  useEffect(() => {
    if (!mode) return;
    const off = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMode(null); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [mode]);

  const draftRef = useRef(draft); draftRef.current = draft;
  const commitRef = useRef(onFrameChange); commitRef.current = onFrameChange;
  useEffect(() => {
    const el = ref.current;
    if (!el || !tools || !src) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!el.classList.contains('lp-frame-pan')) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const z = Math.min(FRAME_ZOOM_MAX, Math.max(FRAME_ZOOM_MIN, draftRef.current.zoom * Math.exp(-dy * 0.0015)));
      const next = { ...draftRef.current, zoom: z };
      setDraft(next);
      if (t) clearTimeout(t);
      t = setTimeout(() => commitRef.current?.(next), 250);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); if (t) clearTimeout(t); };
  }, [tools, src]);

  const active = tools ? draft : base;
  const framed = !!frame;

  const startResize = (edge: Edge) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = ref.current; const column = el?.parentElement;
    if (!el || !column) return;
    setMode('frame');
    const start = el.getBoundingClientRect();
    const col = column.getBoundingClientRect();
    const { xs, ys } = collectSnapEdges(el);
    xs.push(col.left, col.right);
    let latest = draft;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - e.clientX; const dy = ev.clientY - e.clientY;
      let left = start.left; let right = start.right; let bottom = start.bottom; let top = start.top;
      let gx: number | null = null; let gy: number | null = null;
      if (edge === 'right' || edge === 'corner-right') {
        const s = snapEdge(Math.min(col.right, Math.max(start.left + col.width * FRAME_MIN_WIDTH_PCT / 100, start.right + dx)), xs);
        right = Math.min(col.right, s.value); gx = s.guide;
      }
      if (edge === 'left' || edge === 'corner-left') {
        const s = snapEdge(Math.max(col.left, Math.min(start.right - col.width * FRAME_MIN_WIDTH_PCT / 100, start.left + dx)), xs);
        left = Math.max(col.left, s.value); gx = s.guide;
      }
      if (edge === 'bottom' || edge.startsWith('corner')) {
        const s = snapEdge(Math.max(start.top + FRAME_MIN_HEIGHT_PX, start.bottom + dy), ys);
        bottom = s.value; gy = s.guide;
      }
      if (edge === 'top') {
        const s = snapEdge(Math.min(start.bottom - FRAME_MIN_HEIGHT_PX, start.top + dy), ys);
        top = s.value; gy = s.guide;
      }
      const width = right - left; const height = bottom - top;
      const widthPct = Math.min(100, Math.max(FRAME_MIN_WIDTH_PCT, (width / col.width) * 100));
      const offsetPct = Math.min(100 - widthPct, Math.max(0, ((left - col.left) / col.width) * 100));
      latest = { ...latest, widthPct, offsetPct, aspect: width / height };
      setDraft(latest);
      setGuides({ x: gx, y: gy });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setGuides({ x: null, y: null });
      onFrameChange?.(latest);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const startPan = (e: React.PointerEvent) => {
    if (!tools || !src) return;
    e.preventDefault();
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const startDraft = draft; let latest = draft; let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - e.clientX; const dy = ev.clientY - e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      setMode('pan');
      latest = {
        ...startDraft,
        x: Math.min(100, Math.max(0, startDraft.x - (dx / r.width) * 100)),
        y: Math.min(100, Math.max(0, startDraft.y - (dy / r.height) * 100)),
      };
      setDraft(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (moved) onFrameChange?.(latest); else setMode('pan');
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const handle = (edge: Edge, style: React.CSSProperties, cursor: string) => (
    <div
      key={edge}
      role="presentation"
      className="lp-frame-handle"
      data-edge={edge}
      onPointerDown={startResize(edge)}
      style={{ position: 'absolute', zIndex: 30, cursor, ...style }}
    />
  );

  return (
    <div
      ref={ref}
      className={`lp-image-frame${framed || tools ? ' lp-framed' : ''}${mode ? ` lp-frame-${mode}` : ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: rounded ? 16 : 0,
        background: rgba(primary, 0.06),
        ...(framed || (tools && mode) ? frameOuterStyle(active) : { width: '100%', aspectRatio: aspect }),
        outline: mode ? `2px solid ${primary}` : undefined,
        outlineOffset: mode ? -2 : undefined,
        touchAction: mode === 'pan' ? 'none' : undefined,
        cursor: tools && src ? (mode === 'pan' ? 'grab' : 'pointer') : undefined,
      }}
      onPointerDown={startPan}
    >
      {src ? (
        <img
          src={src}
          alt={labelImage ? withAiDisclosureAlt(alt) : alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', ...frameImageStyle(active) }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: rgba(primary, 0.5), fontSize: 13, fontWeight: 500 }}>
          <ImageIcon size={20} style={{ marginRight: 8 }} /> Kein Bild
        </div>
      )}
      {src && labelImage && <img src={getAiDisclosureLabelVector('landing')} alt={getAiDisclosureLabelAlt('landing')} className={`${AI_DISCLOSURE_OVERLAY_CLASS} z-10`} />}
      {editable && <LandingEditMenu label="Bild bearbeiten" className="lp-image-edit-trigger">
        <Button variant="ghost" onClick={onReplace} disabled={loading}>{loading ? <RefreshCw size={16} className="lp-spin" /> : <Sparkles size={16} />} Bild ändern</Button>
        {tools && src && (
          <div className="lp-menu-zoom" onPointerDown={e => e.stopPropagation()}>
            <span>Zoom</span>
            <Slider aria-label="Bild im Rahmen vergrößern" min={FRAME_ZOOM_MIN} max={FRAME_ZOOM_MAX} step={0.05} value={[draft.zoom]}
              onValueChange={v => { const z = v[0]; if (z !== undefined) setDraft(d => ({ ...d, zoom: z })); }}
              onValueCommit={v => { const z = v[0]; if (z !== undefined) onFrameChange?.({ ...draft, zoom: z }); }} />
            <span>{Math.round(draft.zoom * 100)} %</span>
          </div>
        )}
        {tools && <Button variant="ghost" onClick={() => setMode('pan')}><ImageIcon size={16} /> Ausschnitt bearbeiten</Button>}
        {tools && framed && <Button variant="ghost" onClick={() => { onFrameChange?.(null); setMode(null); }}><RotateCcw size={16} /> Zurücksetzen</Button>}
        {insertActions}
        {onDelete && <ElementDeleteButton onDelete={onDelete} label="Bild löschen" />}
      </LandingEditMenu>}

      {tools && (
        <>
          {handle('top', { left: 14, right: 14, top: 0, height: 10 }, 'ns-resize')}
          {handle('left', { left: 0, top: 14, bottom: 14, width: 10 }, 'ew-resize')}
          {handle('right', { right: 0, top: 14, bottom: 14, width: 10 }, 'ew-resize')}
          {handle('bottom', { left: 14, right: 14, bottom: 0, height: 10 }, 'ns-resize')}
          {handle('corner-left', { left: 0, bottom: 0, width: 14, height: 14 }, 'nesw-resize')}
          {handle('corner-right', { right: 0, bottom: 0, width: 14, height: 14 }, 'nwse-resize')}
        </>
      )}

      {guides.x !== null && <div className="lp-snap-guide" style={{ position: 'fixed', top: 0, bottom: 0, left: guides.x, width: 1 }} />}
      {guides.y !== null && <div className="lp-snap-guide" style={{ position: 'fixed', left: 0, right: 0, top: guides.y, height: 1 }} />}
    </div>
  );
}
