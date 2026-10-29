import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { editorControlStyle } from '@/lib/landing-theme';
import './landing-editor.css';

export function ElementDeleteButton({ onDelete, label = 'Element löschen', on }: {
  onDelete: () => void; label?: string; on?: string;
}) {
  return <Button type="button" variant="ghost" size="sm" className="lp-element-delete" title={label} aria-label={label}
    style={editorControlStyle(on) as CSSProperties | undefined}
    onMouseDown={event => event.preventDefault()}
    onClick={event => { event.preventDefault(); event.stopPropagation(); onDelete(); }}>
    <span className="lp-delete-icon"><X size={16} aria-hidden="true" /></span>
    <span className="lp-delete-label">{label}</span>
  </Button>;
}

export default function LandingElementBox({ children, editable, onDelete, hidden = false, inline = false, cover = false, label, colorControl, controlOn }: {
  children: ReactNode; editable: boolean; onDelete?: () => void; hidden?: boolean; inline?: boolean; cover?: boolean; label?: string; colorControl?: ReactNode; controlOn?: string;
}) {
  // Control colours are resolved per surface: a white pill on a white header is
  // unreadable, so light surfaces get a dark pill instead.
  const controlStyle = editorControlStyle(controlOn) as CSSProperties | undefined;
  if (hidden) return null;
  if (!editable || (!onDelete && !colorControl)) return <>{children}</>;
  const Tag = inline ? 'span' : 'div';
  if (inline) {
    // Inline elements (e.g. CTA buttons) must keep their natural height: the hover
    // controls float in one row above the element instead of reserving padding.
    return <Tag className={`lp-element-box lp-element-inline${colorControl ? ' lp-has-color' : ''}${!onDelete ? ' lp-color-only' : ''}`} style={controlStyle}>
      {children}
      {(colorControl || onDelete) && (
        <span className="lp-controls-row"
          onMouseDown={event => event.preventDefault()}
          onClick={event => { event.preventDefault(); event.stopPropagation(); }}>
          {colorControl}
          {onDelete && <ElementDeleteButton onDelete={onDelete} label={label} />}
        </span>
      )}
    </Tag>;
  }
  // Cover boxes (full-width sections) overlay their controls inside the section
  // instead of reserving space above it – a transparent padding strip would show
  // the page background as a white block between sections.
  return <Tag className={`lp-element-box${cover ? ' lp-element-cover' : ''}${colorControl ? ' lp-has-color' : ''}`} style={controlStyle}>
    {children}
    {colorControl}
    {onDelete && <ElementDeleteButton onDelete={onDelete} label={label} />}
  </Tag>;
}
