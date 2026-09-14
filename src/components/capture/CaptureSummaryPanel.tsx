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
 * Kompakte Zusammenfassung der Fahrzeugaufnahme.
 * Rein darstellend – die Logik bleibt in ImageCaptureGrid.
 */
const CaptureSummaryPanel: React.FC<CaptureSummaryPanelProps> = ({ complete, completeText, hintText, rows, children }) => (
  <div className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">Zusammenfassung</h3>
      <span className="text-[10px] font-medium text-accent">Bearbeiten</span>
    </div>

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
  </div>
);

export default CaptureSummaryPanel;
