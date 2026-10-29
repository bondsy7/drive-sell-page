import React, { createContext, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Allows nested inline text to contribute its colour action to the parent menu. */
export const LandingEditActionsContext = createContext<{ setActions: (actions: React.ReactNode) => void } | null>(null);

export default function LandingEditMenu({ label = 'Element bearbeiten', children, className = '' }: {
  label?: string; children: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="icon" className={`lp-edit-trigger ${className}`}
        title={label} aria-label={label}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}>
        <Pencil size={16} />
      </Button>
    </PopoverTrigger>
    <PopoverContent side="bottom" align="center" sideOffset={8} collisionPadding={12}
      className="lp-edit-menu w-64 max-w-[calc(100vw-24px)] p-2"
      onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </PopoverContent>
  </Popover>;
}