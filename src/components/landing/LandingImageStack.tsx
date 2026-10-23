import React from 'react';
import { Plus } from 'lucide-react';
import { STACK_GAP_PX, STACK_MAIN } from '@/lib/landing-image-stack';

interface Props {
  entries: string[];
  main: React.ReactNode | null;
  editable: boolean;
  onInsert?: (anchor: string, pos: 'before' | 'after') => void;
  renderExtra: (key: string) => React.ReactNode;
  hasImage: (key: string) => boolean;
}

/** Vertically stacked image blocks with a fixed minimum gap, so blocks never touch or overlap. */
export default function LandingImageStack({ entries, main, editable, onInsert, renderExtra, hasImage }: Props) {
  const items = entries
    .map(e => ({ key: e, node: e === STACK_MAIN ? main : hasImage(e) ? renderExtra(e) : null }))
    .filter(i => i.node);
  if (!items.length) return null;
  const btn = (anchor: string, pos: 'before' | 'after') => editable && onInsert ? (
    <button
      type="button"
      className={`lp-stack-insert lp-stack-insert-${pos}`}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onInsert(anchor, pos); }}
    >
      <Plus size={13} /> Bild einfügen
    </button>
  ) : null;
  return (
    <div className="lp-image-stack" style={{ display: 'flex', flexDirection: 'column', gap: STACK_GAP_PX }}>
      {items.map(i => (
        <div key={i.key} className="lp-stack-item" style={{ position: 'relative' }}>
          {btn(i.key, 'before')}
          {i.node}
          {btn(i.key, 'after')}
        </div>
      ))}
    </div>
  );
}
