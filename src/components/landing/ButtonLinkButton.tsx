import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeButtonLink } from '@/lib/landing-button-links';

/** Pencil-menu action that sets the link target of a landing page button. */
export default function ButtonLinkButton({ value, fallbackLabel, onChange, heading = 'Button-Link' }: {
  value?: string; fallbackLabel: string; onChange: (link: string | null) => void; heading?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const normalized = normalizeButtonLink(draft);
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setDraft(value || ''); }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" size="sm" className="lp-element-color" title="Link ändern" aria-label="Link ändern">
        <span className="lp-delete-icon"><Link2 size={16} aria-hidden="true" /></span>
        <span className="lp-delete-label">Link</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72 space-y-3" onOpenAutoFocus={event => event.preventDefault()} onClick={event => event.stopPropagation()}>
      <p className="text-sm font-semibold">{heading}</p>
      <Input value={draft} onChange={event => setDraft(event.target.value)} placeholder="https://… , #kontakt, tel:…, mailto:…" aria-label="Link-Adresse" />
      <p className="text-xs text-muted-foreground">
        {draft.trim() && !normalized ? 'Ungültiger Link.' : `Leer lassen für Standard: ${fallbackLabel}`}
      </p>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => { onChange(null); setOpen(false); }}>Zurücksetzen</Button>
        <Button size="sm" disabled={!!draft.trim() && !normalized} onClick={() => { onChange(normalized); setOpen(false); }}>Übernehmen</Button>
      </div>
    </PopoverContent>
  </Popover>;
}
