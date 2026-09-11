import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
  children?: React.ReactNode;
}

/**
 * Rechte, mitlaufende Zusammenfassung der Fahrzeugaufnahme.
 * Rein darstellend – die Logik bleibt in ImageCaptureGrid.
 */
const CaptureSummaryPanel: React.FC<CaptureSummaryPanelProps> = ({ complete, completeText, hintText, rows, children }) => (
  <div className="rounded-xl border border-border bg-card p-4 space-y-4">
    <h3 className="text-sm font-semibold text-foreground">Zusammenfassung</h3>

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

    <dl className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
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
  </div>
);

export default CaptureSummaryPanel;
