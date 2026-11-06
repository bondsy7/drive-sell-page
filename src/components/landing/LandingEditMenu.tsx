import React, { createContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLandingToolbox } from '@/components/landing/LandingToolbox';

/** Allows nested inline text to contribute its colour action to the parent menu. */
export const LandingEditActionsContext = createContext<{ setActions: (actions: React.ReactNode) => void } | null>(null);

/**
 * Element edit actions. Inside the editor toolbox, clicking the parent element selects it and the
 * actions render live in the floating toolbox. `section` menus keep their pencil popover.
 */
export default function LandingEditMenu({ label = 'Element bearbeiten', children, className = '', side = 'bottom', section = false }: {
  label?: string; children: React.ReactNode; className?: string; side?: 'top' | 'right' | 'bottom' | 'left'; section?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toolbox = useLandingToolbox();
  const key = useId();
  const markerRef = useRef<HTMLSpanElement>(null);
  const useToolbox = !!toolbox && !section;
  const select = toolbox?.select;
  const isSelected = useToolbox && toolbox.selected === key;

  useEffect(() => {
    if (!useToolbox || !select) return;
    const host = markerRef.current?.parentElement;
    if (!host) return;
    const onDown = (e: PointerEvent) => {
      const ev = e as PointerEvent & { __lpSelected?: boolean };
      if (ev.__lpSelected) return; // innermost element wins
      ev.__lpSelected = true;
      select(key, label);
    };
    host.addEventListener('pointerdown', onDown);
    return () => host.removeEventListener('pointerdown', onDown);
  }, [useToolbox, select, key, label]);

  useEffect(() => {
    const host = markerRef.current?.parentElement;
    if (!host) return;
    host.classList.toggle('lp-tool-selected', isSelected);
    return () => host.classList.remove('lp-tool-selected');
  }, [isSelected]);

  if (useToolbox) {
    return <>
      <span ref={markerRef} hidden />
      {isSelected && toolbox.body && createPortal(children, toolbox.body)}
    </>;
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="icon" className={`lp-edit-trigger ${className}`}
        title={label} aria-label={label}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}>
        <Pencil size={16} />
      </Button>
    </PopoverTrigger>
    <PopoverContent side={side} align="center" sideOffset={8} collisionPadding={12}
      className="lp-edit-menu w-64 max-w-[calc(100vw-24px)] p-2"
      onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </PopoverContent>
  </Popover>;
}
