import { useState } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeSectionColor } from '@/lib/landing-section-colors';

export default function SectionBackgroundPicker({ value, colors, onChange }: {
  value?: string; colors: { label: string; value: string }[]; onChange: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || colors[0]?.value || '');
  const valid = normalizeSectionColor(draft);
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setDraft(value || colors[0]?.value || ''); }}>
    <PopoverTrigger asChild>
      <Button size="sm" variant="outline" className="lp-section-color-button" aria-label="Hintergrundfarbe ändern">
        <Palette size={14} /> Hintergrundfarbe
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="space-y-4" onClick={event => event.stopPropagation()}>
      <p className="text-sm font-semibold">Abschnittshintergrund</p>
      <div className="space-y-2">
        <Label>Profilfarben</Label>
        {colors.length === 0 && <p className="text-xs text-muted-foreground">Keine Profilfarben gespeichert.</p>}
        <div className="flex flex-wrap gap-2">
          {colors.map(color => <Button key={color.label} size="sm" variant="outline" aria-pressed={draft === color.value} onClick={() => setDraft(color.value)}>
            <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: color.value }} />{color.label}
          </Button>)}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="lp-section-custom-color">Freie Farbwahl</Label>
        <div className="flex items-center gap-2">
          <Input type="color" aria-label="Farbe auswählen" value={valid || normalizeSectionColor(colors[0]?.value) || '#ffffff'} onChange={event => setDraft(event.target.value)} className="h-10 w-12 shrink-0 p-1" />
          <Input id="lp-section-custom-color" value={draft} onChange={event => setDraft(event.target.value)} placeholder="#RRGGBB" maxLength={7} />
        </div>
      </div>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => { onChange(null); setOpen(false); }}>Zurücksetzen</Button>
        <Button size="sm" disabled={!valid} onClick={() => { if (valid) { onChange(valid); setOpen(false); } }}>Übernehmen</Button>
      </div>
    </PopoverContent>
  </Popover>;
}