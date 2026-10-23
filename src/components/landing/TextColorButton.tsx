import { useState } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeSectionColor } from '@/lib/landing-section-colors';

/** Hover-revealed companion to the delete button: changes the text colour of a text element. */
export default function TextColorButton({ value, colors, onChange, label = 'Textfarbe ändern' }: {
  value?: string; colors: { label: string; value: string }[]; onChange: (color: string | null) => void; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || colors[0]?.value || '');
  const valid = normalizeSectionColor(draft);
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setDraft(value || colors[0]?.value || ''); }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" size="sm" className="lp-element-color" title={label} aria-label={label}
        onMouseDown={event => event.preventDefault()}
        onClick={event => { event.preventDefault(); event.stopPropagation(); }}>
        <span className="lp-delete-icon"><Palette size={16} aria-hidden="true" /></span>
        <span className="lp-delete-label">Textfarbe</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-64 space-y-3" onClick={event => event.stopPropagation()}>
      <p className="text-sm font-semibold">Textfarbe</p>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Profilfarben</p>
        {colors.length === 0 && <p className="text-xs text-muted-foreground">Keine Profilfarben gespeichert.</p>}
        <div className="flex flex-wrap gap-2">
          {colors.map(color => <Button key={color.label} size="sm" variant="outline" aria-pressed={draft === color.value} onClick={() => setDraft(color.value)}>
            <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: color.value }} />{color.label}
          </Button>)}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Freie Farbwahl</p>
        <div className="flex items-center gap-2">
          <Input type="color" aria-label="Farbe auswählen" value={valid || normalizeSectionColor(colors[0]?.value) || '#0f172a'} onChange={event => setDraft(event.target.value)} className="h-10 w-12 shrink-0 p-1" />
          <Input value={draft} onChange={event => setDraft(event.target.value)} placeholder="#RRGGBB" maxLength={7} aria-label="Hex-Wert" />
        </div>
      </div>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => { onChange(null); setOpen(false); }}>Zurücksetzen</Button>
        <Button size="sm" disabled={!valid} onClick={() => { if (valid) { onChange(valid); setOpen(false); } }}>Übernehmen</Button>
      </div>
    </PopoverContent>
  </Popover>;
}
