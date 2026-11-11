import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bankTemplate, BANK_SHORTCODES, CREDIT_WARNING } from '@/lib/bank-legal-template';

/** Universal copyable legal-text templates for leasing / financing banks. */
export function BankTemplateLibrary() {
  const [type, setType] = useState<'leasing' | 'financing'>('financing');
  const [copied, setCopied] = useState(false);
  const text = bankTemplate(type);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Universelle Vorlage für rechtssichere Banktexte</span>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(v) => setType(v as 'leasing' | 'financing')}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="leasing">Leasing</SelectItem>
              <SelectItem value="financing">Finanzierung</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={copy}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        </div>
      </div>
      <p className="rounded border border-border bg-background p-2 text-xs leading-relaxed whitespace-pre-line select-all">{text}</p>
      <p className="text-[11px] text-muted-foreground">
        Bankname und Anschrift anpassen, Platzhalter unverändert lassen – sie werden auf jeder Angebotsseite automatisch mit den Angebotswerten gefüllt.
        {type === 'financing' && ` Bei Privatkunden-Finanzierungen wird „${CREDIT_WARNING}“ automatisch ergänzt.`}
      </p>
      <div className="flex flex-wrap gap-1">
        {BANK_SHORTCODES.map(s => (
          <span key={s.code} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"><span className="font-mono">{s.code}</span> <span className="text-muted-foreground">= {s.label}</span></span>
        ))}
      </div>
    </div>
  );
}
