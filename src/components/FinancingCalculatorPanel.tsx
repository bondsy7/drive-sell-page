import React, { useState, useMemo, useEffect } from 'react';
import { Banknote, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { VehicleData } from '@/types/vehicle';

function parseGermanNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[€%\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatEuro(num: number): string {
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatEuroInput(str: string): string {
  if (!str.trim()) return '';
  const num = parseGermanNumber(str);
  if (num === 0) return '0,00';
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  vehicleData: VehicleData | null;
}

const FinancingCalculatorPanel: React.FC<Props> = ({ vehicleData }) => {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [finalPayment, setFinalPayment] = useState('');
  const [months, setMonths] = useState('48');
  const [interestRate, setInterestRate] = useState('');

  useEffect(() => {
    if (!vehicleData?.finance) return;
    const f = vehicleData.finance;
    if (f.totalPrice) setPrice(f.totalPrice.replace(/[€\s]/g, ''));
    if (f.downPayment) setDownPayment(f.downPayment.replace(/[€\s]/g, ''));
    if (f.residualValue) setFinalPayment(f.residualValue.replace(/[€\s]/g, ''));
    if (f.duration) {
      const m = f.duration.match(/(\d+)/);
      if (m) setMonths(m[1]);
    }
    if (f.interestRate) setInterestRate(f.interestRate.replace(/[%\s]/g, ''));
  }, [vehicleData]);

  const result = useMemo(() => {
    const p = parseGermanNumber(price);
    const dp = parseGermanNumber(downPayment);
    const fp = parseGermanNumber(finalPayment);
    const n = parseInt(months) || 0;
    const annual = parseGermanNumber(interestRate) / 100;
    if (p <= 0 || n <= 0) return null;

    const credit = p - dp;
    if (credit <= 0) return null;

    const i = annual / 12; // monthly interest rate

    let monthlyRate: number;

    if (fp > 0) {
      // Balloon financing: subtract PV of final payment from credit
      // Rate = (Credit - FinalPayment / (1+i)^n) * i / (1 - (1+i)^-n)
      const pvFinal = fp / Math.pow(1 + i, n);
      const adjustedCredit = credit - pvFinal;
      if (i <= 0) {
        monthlyRate = adjustedCredit / n;
      } else {
        monthlyRate = (adjustedCredit * i) / (1 - Math.pow(1 + i, -n));
      }
    } else {
      // Standard annuity: Rate = Credit * i / (1 - (1+i)^-n)
      if (i <= 0) {
        monthlyRate = credit / n;
      } else {
        monthlyRate = (credit * i) / (1 - Math.pow(1 + i, -n));
      }
    }

    const totalPaid = monthlyRate * n + dp + fp;
    const totalInterest = totalPaid - p;

    return {
      monthlyRate: Math.max(0, monthlyRate),
      totalPaid,
      totalInterest: Math.max(0, totalInterest),
      credit,
    };
  }, [price, downPayment, finalPayment, months, interestRate]);

  return (
    <div className="border-t border-sidebar-border mt-4 pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-sidebar-primary" />
          <span className="font-display font-semibold text-sm text-sidebar-foreground">Finanzierungsrechner</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-sidebar-foreground/50" /> : <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          <Field label="Fahrzeugpreis" value={price} onChange={setPrice} onBlur={() => setPrice(formatEuroInput(price))} suffix="€" />
          <Field label="Anzahlung" value={downPayment} onChange={setDownPayment} onBlur={() => setDownPayment(formatEuroInput(downPayment))} suffix="€" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <Label className="text-[11px] text-sidebar-foreground/60">Schlussrate</Label>
              <Tooltip>
                <TooltipTrigger><Info className="w-3 h-3 text-sidebar-foreground/40" /></TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs">Ballonfinanzierung: Schlussrate am Ende der Laufzeit. Leer lassen für klassische Finanzierung.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="relative">
              <Input
                value={finalPayment}
                onChange={e => setFinalPayment(e.target.value)}
                onBlur={() => setFinalPayment(formatEuroInput(finalPayment))}
                className="h-7 text-xs pr-8 bg-sidebar-accent/50 border-sidebar-border"
                placeholder="optional"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sidebar-foreground/40">€</span>
            </div>
          </div>
          <Field label="Laufzeit" value={months} onChange={setMonths} suffix="Mo." />
          <Field label="Zinssatz (p.a.)" value={interestRate} onChange={setInterestRate} suffix="%" />

          {result && result.monthlyRate > 0 && (
            <div className="bg-sidebar-accent rounded-lg p-3 space-y-2 mt-3">
              <div>
                <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wide">Monatliche Rate</p>
                <p className="text-lg font-bold text-sidebar-foreground font-['Space_Grotesk']">{formatEuro(result.monthlyRate)}</p>
              </div>
              <div className="space-y-1.5 border-t border-sidebar-border pt-2">
                <Row label="Kreditbetrag" value={formatEuro(result.credit)} />
                <Row label="Zinsen gesamt" value={formatEuro(result.totalInterest)} />
                <Row label="Gesamtkosten" value={formatEuro(result.totalPaid)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; suffix: string }> = ({ label, value, onChange, onBlur, suffix }) => (
  <div className="space-y-0.5">
    <Label className="text-[11px] text-sidebar-foreground/60">{label}</Label>
    <div className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-7 text-xs pr-8 bg-sidebar-accent/50 border-sidebar-border"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sidebar-foreground/40">{suffix}</span>
    </div>
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-[11px] text-sidebar-foreground/60">
    <span>{label}</span>
    <span className="font-medium text-sidebar-foreground">{value}</span>
  </div>
);

export default FinancingCalculatorPanel;
