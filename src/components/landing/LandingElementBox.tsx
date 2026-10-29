import { useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import LandingEditMenu, { LandingEditActionsContext } from '@/components/landing/LandingEditMenu';
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
  const parentMenu = useContext(LandingEditActionsContext);
  const [nestedActions, setNestedActions] = useState<ReactNode>(null);
  useEffect(() => {
    if (!parentMenu || onDelete) return;
    parentMenu.setActions(colorControl);
    return () => parentMenu.setActions(null);
  }, [parentMenu, colorControl, onDelete]);
  if (hidden) return null;
  if (!editable || (!onDelete && !colorControl)) return <>{children}</>;
  if (parentMenu && !onDelete) return <>{children}</>;
  const Tag = inline ? 'span' : 'div';
  return <Tag className={`lp-element-box${inline ? ' lp-element-inline' : ''}${cover ? ' lp-element-cover' : ''}`} style={controlStyle}>
    <LandingEditActionsContext.Provider value={{ setActions: setNestedActions }}>{children}</LandingEditActionsContext.Provider>
    <LandingEditMenu label={label?.replace('löschen', 'bearbeiten')}>
      {colorControl}{nestedActions}
      {onDelete && <ElementDeleteButton onDelete={onDelete} label={label} />}
    </LandingEditMenu>
  </Tag>;
}
