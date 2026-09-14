import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SummaryRow {
  label: string;
  value: string;
  ok?: boolean;
}

interface CaptureSummaryPanelProps {
  complete: boolean;
  completeText: string;
  hintText: string;
  rows: SummaryRow[];
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

/**
 * Kompakte Zusammenfassung der Fahrzeugaufnahme.
 * Rein darstellend – die Logik bleibt in ImageCaptureGrid.
 */
const CaptureSummaryPanel: React.FC<CaptureSummaryPanelProps> = ({
  complete,
  completeText,
  hintText,
  rows,
  collapsible = false,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  return (
  <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
    {collapsible ? (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={isOpen}
        className="h-auto w-full justify-between gap-3 p-0 hover:bg-transparent"
      >
        <span className="text-sm font-semibold text-foreground">Zusammenfassung</span>
        <span className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${complete ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {complete ? 'Vollständig' : 'Offen'}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </Button>
    ) : (
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Zusammenfassung</h3>
        <span className="text-[10px] font-medium text-accent">Bearbeiten</span>
      </div>
    )}

    {isOpen && <div className="mt-3 space-y-3">
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2.5 ${
        complete ? 'bg-green-500/10' : 'bg-muted'
      }`}
    >
      {complete ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${complete ? 'text-green-700' : 'text-foreground'}`}>{completeText}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{hintText}</p>
      </div>
    </div>

    <dl className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
          <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
          <dd
            className={`truncate text-right text-[11px] font-semibold ${
              row.ok ? 'text-green-700' : 'text-foreground'
            }`}
            title={row.value}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>

    {children && <div className="space-y-2 border-t border-border pt-3">{children}</div>}
    </div>}
  </div>
  );
};

export default CaptureSummaryPanel;
