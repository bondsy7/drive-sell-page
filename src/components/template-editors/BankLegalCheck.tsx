import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import type { VehicleData } from '@/types/vehicle';
import { checkBankLegal, type ProfileBank } from '@/lib/bank-legal-check';

interface Props { text: string; bankName: string; banks: ProfileBank[]; data: VehicleData; editVersion: number }

export function BankLegalCheck({ text, bankName, banks, data, editVersion }: Props) {
  const [showNotice, setShowNotice] = useState(false);
  // Show after the user pauses editing, so the notice does not flicker on each keystroke.
  useEffect(() => {
    if (editVersion <= 0) return;
    const t = setTimeout(() => setShowNotice(true), 800);
    return () => clearTimeout(t);
  }, [editVersion]);
  const items = checkBankLegal(text, bankName, banks, data);
  return (
    <div className="mt-3 space-y-2">
      {showNotice && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">Bitte stelle sicher, dass alle Bankangaben (Bank, Anschrift und Pflichtwerte) korrekt eingetragen sind.</span>
          <button type="button" aria-label="Hinweis schließen" onClick={() => setShowNotice(false)} className="shrink-0 rounded p-0.5 hover:bg-amber-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <ul className="space-y-1 text-xs">
        {items.map((it, i) => (
          <li key={i} className={`flex items-start gap-1.5 ${it.level === 'ok' ? 'text-emerald-700' : it.level === 'warn' ? 'text-amber-700' : 'text-destructive'}`}>
            {it.level === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : it.level === 'warn' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Counts bank-field edits via the 'bank-legal-edited' window event so every edit re-opens the notice. */
export function BankLegalCheckBound(props: Omit<Props, 'editVersion'>) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV(n => n + 1);
    window.addEventListener('bank-legal-edited', h);
    return () => window.removeEventListener('bank-legal-edited', h);
  }, []);
  return <BankLegalCheck {...props} editVersion={v} />;
}
