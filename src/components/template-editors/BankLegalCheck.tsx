import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import type { VehicleData } from '@/types/vehicle';
import { checkBankLegal, type ProfileBank } from '@/lib/bank-legal-check';

interface Props { text: string; bankName: string; banks: ProfileBank[]; data: VehicleData; editVersion: number }

export function BankLegalCheck({ text, bankName, banks, data, editVersion }: Props) {
  const [showNotice, setShowNotice] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // Show after the user pauses editing, so the notice does not flicker on each keystroke.
  useEffect(() => {
    if (editVersion <= 0) return;
    const t = setTimeout(() => setShowNotice(true), 800);
    return () => clearTimeout(t);
  }, [editVersion]);
  // Every new edit re-opens the notice and drops the previous confirmation.
  useEffect(() => { setConfirmed(false); }, [editVersion]);
  const items = checkBankLegal(text, bankName, banks, data);
  const hasErrors = items.some(i => i.level === 'error');
  return (
    <div className="mt-3 space-y-2">
      {showNotice && !confirmed && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1">Bitte stelle sicher, dass alle Bankangaben (Bank, Anschrift und Pflichtwerte) korrekt eingetragen sind.</span>
            <button type="button" aria-label="Hinweis schließen" onClick={() => setShowNotice(false)} className="shrink-0 rounded p-0.5 hover:bg-amber-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className={`mt-2 flex items-start gap-2 border-t border-amber-200 pt-2 ${hasErrors ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber-600"
              checked={confirmed}
              disabled={hasErrors}
              onChange={() => { if (hasErrors) return; setConfirmed(true); setShowNotice(false); }}
            />
            <span>
              Ich habe geprüft: Alle Bankangaben (Bank, Anschrift und Pflichtwerte) sind korrekt eingetragen.
              {hasErrors && <span className="block text-[11px]">Erst die Fehler unten beheben, dann bestätigen.</span>}
            </span>
          </label>
        </div>
      )}
      {confirmed && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Bankangaben bestätigt – bei jeder Änderung erscheint die Prüfung erneut.
        </p>
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
