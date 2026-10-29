import React, { createContext } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STACK_GAP_PX, STACK_MAIN } from '@/lib/landing-image-stack';

export const LandingImageInsertContext = createContext<React.ReactNode>(null);

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
    <Button variant="ghost"
      type="button"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onInsert(anchor, pos); }}
    >
      <Plus size={16} /> Bild {pos === 'before' ? 'darüber' : 'darunter'} einfügen
    </Button>
  ) : null;
  return (
    <div className="lp-image-stack" style={{ display: 'flex', flexDirection: 'column', gap: STACK_GAP_PX }}>
      {items.map(i => (
        <div key={i.key} className="lp-stack-item" style={{ position: 'relative' }}>
          <LandingImageInsertContext.Provider value={<>{btn(i.key, 'before')}{btn(i.key, 'after')}</>}>
            {i.node}
          </LandingImageInsertContext.Provider>
        </div>
      ))}
    </div>
  );
}
