import { Check, AlertCircle, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { V2Reference } from '@/prompts/nb21/v2';
import type { V2PreflightResult } from '@/lib/nb21-v2-preflight';

const LABELS: Record<string, string> = {
  front: 'Front', '34front': '3/4 Front links', frontpanel: 'Frontpanel / Grill', headlight: 'Scheinwerfer',
  rear: 'Heck', cargo: 'Kofferraum / Laderaum', steering: 'Lenkrad', cluster: 'Instrumente',
  screen: 'Center Screen', dashboard: 'Dashboard', 'rear-seats': 'Rücksitze',
  'interior-front': 'Innenraum vorne', 'interior-rear': 'Innenraum hinten',
  'side-left': 'Linke Fahrzeugseite', 'side-left-full': 'Linke Fahrzeugseite', 'side-right-full': 'Rechte Fahrzeugseite',
  side: 'Seite links', 'side-right': 'Seite rechts',
};

export default function Nb21V2ReferenceCheck({ results, sources, onAssign, onSkip, version }: {
  results: V2PreflightResult[];
  sources: V2Reference[];
  onAssign: (sourceId: string, role: string) => void;
  onSkip: (key: string) => void;
  version?: 'nb21-v2' | 'nb21-v3';
}) {
  const details = sources.filter(s => s.sourceType === 'original' && (s.sourceId.startsWith('detail:') || s.sourceRole.startsWith('unassigned')));
  const options = [...new Set([...Object.keys(LABELS), ...results.flatMap(r => r.missing.flatMap(m => m.slots))])];
  return <section aria-label="Referenzprüfung" className="space-y-3 border-y border-border py-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">Referenzprüfung</h3><span className="text-xs text-muted-foreground">{results.filter(r => r.ready).length} vorhanden · {results.filter(r => !r.ready).length} fehlend</span></div>
    {version === 'nb21-v3' && <div className="text-xs text-muted-foreground">{['left', 'right'].map(side => {
      const roles = side === 'left' ? ['side','side-left','side-left-full','truck-cab-side-left'] : ['side-right','side-right-full','truck-cab-side-right'];
      const present = sources.some(s => s.sourceType === 'original' && !!s.image && roles.includes(s.sourceRole));
      return <p key={side}>{side === 'left' ? 'Linke' : 'Rechte'} Fahrzeugseite {present ? 'vorhanden' : 'fehlt als Originalbeleg'}</p>;
    })}</div>}
    {results.some(r => !r.ready) && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
      <span className="text-destructive">Generieren ist gesperrt: {results.filter(r => !r.ready).length} Ansicht(en) ohne Pflichtoriginal. Original ergänzen/zuordnen oder überspringen.</span>
      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => results.filter(r => !r.ready).forEach(r => onSkip(r.job.key))}><SkipForward className="h-3.5 w-3.5" />Alle fehlenden überspringen</Button>
    </div>}
    <div className="max-h-64 overflow-y-auto divide-y divide-border">
      {[...results].sort((a, b) => Number(a.ready) - Number(b.ready)).map(({ job, ready, missing, error }) => <div key={job.key} className="flex flex-wrap items-center gap-2 py-2 text-xs">
        {ready ? <Check className="h-4 w-4 text-primary" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
        <span className="min-w-0 flex-1 text-foreground">{job.labelDe ?? job.key}</span>
        <span className={ready ? 'text-muted-foreground' : 'text-destructive'}>{ready ? 'Vorhanden' : version === 'nb21-v3' ? (missing.length ? `Fehlt als Originalbeleg: ${missing.map(m => ({ front_original: 'Front', rear_original: 'Heck', left_original: 'Linke Fahrzeugseite', right_original: 'Rechte Fahrzeugseite' }[m.role] ?? m.slots.map(s => LABELS[s] ?? s).join(' / '))).join('; ')}` : error) : `Fehlt: ${missing.map(m => m.slots.map(s => LABELS[s] ?? s).join(' / ')).join('; ')}`}</span>
        {!ready && <Button variant="ghost" size="sm" onClick={() => onSkip(job.key)} aria-label={`${job.labelDe ?? job.key} überspringen`} className="gap-1 text-xs"><SkipForward className="h-3.5 w-3.5" />Überspringen</Button>}
      </div>)}
    </div>
    {details.map((source, i) => <div key={source.sourceId} className="flex items-center gap-3">
      <img src={source.image} alt={`Detailbild ${i + 1}`} className="h-14 w-20 rounded border border-border object-cover" />
      <Select value={options.includes(source.sourceRole) ? source.sourceRole : 'unassigned-detail'} onValueChange={role => onAssign(source.sourceId, role)}>
        <SelectTrigger aria-label={`Detailbild ${i + 1} zuordnen`} className="max-w-sm text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="unassigned-detail">Nicht zugeordnet</SelectItem>{options.map(role => <SelectItem key={role} value={role}>{LABELS[role] ?? role}</SelectItem>)}</SelectContent>
      </Select>
    </div>)}
  </section>;
}