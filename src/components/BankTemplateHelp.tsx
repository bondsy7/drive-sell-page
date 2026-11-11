import { Button } from '@/components/ui/button';
import { BANK_SHORTCODES, bankTemplate, ADDRESS_PLACEHOLDER, CREDIT_WARNING } from '@/lib/bank-legal-template';

interface Props { type: 'leasing' | 'financing'; text: string; onInsert: (v: string) => void }

/** Shortcode help + safe-template button under a profile bank text. */
export function BankTemplateHelp({ type, text, onInsert }: Props) {
  const hasCodes = /\{[a-z_]+\}/.test(text || '');
  const needsAddress = (text || '').includes(ADDRESS_PLACEHOLDER);
  return (
    <div className="space-y-1.5 text-xs">
      {!hasCodes && (
        <p className="text-destructive">Dieser Text enthält keine Angebotswerte (z. B. Laufzeit, Rate, Zinsen) und ist so nicht zulässig. Bitte rechtssichere Vorlage einfügen.</p>
      )}
      {needsAddress && <p className="text-destructive">Bitte die Anschrift der Bank anstelle von „{ADDRESS_PLACEHOLDER}“ eintragen.</p>}
      {type === 'financing' && <p className="text-muted-foreground">Ab 20.11.2026 wird bei Finanzierungen für Privatkunden automatisch „{CREDIT_WARNING}“ gut sichtbar ergänzt.</p>}
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => {
          if (hasCodes && !window.confirm('Bestehenden Text durch die rechtssichere Vorlage ersetzen?')) return;
          onInsert(bankTemplate(type));
        }}>Rechtssichere Vorlage einfügen</Button>
        {BANK_SHORTCODES.map(s => (
          <button key={s.code} type="button" title={s.label} onClick={() => onInsert(`${text || ''}${text ? ' ' : ''}${s.code}`)}
            className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground">{s.code}</button>
        ))}
      </div>
    </div>
  );
}
