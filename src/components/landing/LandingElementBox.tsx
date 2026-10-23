import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './landing-editor.css';

export function ElementDeleteButton({ onDelete, label = 'Element löschen' }: { onDelete: () => void; label?: string }) {
  return <Button type="button" variant="ghost" size="icon" className="lp-element-delete" title={label} aria-label={label}
    onMouseDown={event => event.preventDefault()}
    onClick={event => { event.preventDefault(); event.stopPropagation(); onDelete(); }}>
    <X size={16} aria-hidden="true" />
  </Button>;
}

export default function LandingElementBox({ children, editable, onDelete, hidden = false, inline = false, label }: {
  children: ReactNode; editable: boolean; onDelete?: () => void; hidden?: boolean; inline?: boolean; label?: string;
}) {
  if (hidden) return null;
  if (!editable || !onDelete) return <>{children}</>;
  const Tag = inline ? 'span' : 'div';
  return <Tag className={`lp-element-box${inline ? ' lp-element-inline' : ''}`}>
    {children}<ElementDeleteButton onDelete={onDelete} label={label} />
  </Tag>;
}