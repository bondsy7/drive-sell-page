import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './landing-editor.css';

export function ElementDeleteButton({ onDelete, label = 'Element löschen' }: { onDelete: () => void; label?: string }) {
  return <Button type="button" variant="ghost" size="sm" className="lp-element-delete" title={label} aria-label={label}
    onMouseDown={event => event.preventDefault()}
    onClick={event => { event.preventDefault(); event.stopPropagation(); onDelete(); }}>
    <span className="lp-delete-icon"><X size={16} aria-hidden="true" /></span>
    <span className="lp-delete-label">{label}</span>
  </Button>;
}

export default function LandingElementBox({ children, editable, onDelete, hidden = false, inline = false, label, colorControl }: {
  children: ReactNode; editable: boolean; onDelete?: () => void; hidden?: boolean; inline?: boolean; label?: string; colorControl?: ReactNode;
}) {
  if (hidden) return null;
  if (!editable || (!onDelete && !colorControl)) return <>{children}</>;
  const Tag = inline ? 'span' : 'div';
  const hasControls = Boolean(colorControl || onDelete);
  if (inline) {
    // Inline elements (e.g. CTA buttons) must keep their natural height: the hover
    // controls float in one row above the element instead of reserving padding.
    return <Tag className={`lp-element-box lp-element-inline${colorControl ? ' lp-has-color' : ''}${!onDelete ? ' lp-color-only' : ''}`}>
      {children}
      {hasControls && (
        <span className="lp-controls-row">
          {colorControl}
          {onDelete && <ElementDeleteButton onDelete={onDelete} label={label} />}
        </span>
      )}
    </Tag>;
  }
  return <Tag className={`lp-element-box${colorControl ? ' lp-has-color' : ''}`}>
    {children}
    {colorControl}
    {onDelete && <ElementDeleteButton onDelete={onDelete} label={label} />}
  </Tag>;
}
