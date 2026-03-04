import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
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

function rateFactor(f: number) {
  if (f <= 0) return { label: '–', color: 'text-muted-foreground', icon: <Minus className="w-3 h-3" /> };
  if (f < 0.7) return { label: 'Sehr gut', color: 'text-green-600', icon: <TrendingDown className="w-3 h-3" /> };
  if (f <= 1.0) return { label: 'Gut', color: 'text-emerald-600', icon: <TrendingDown className="w-3 h-3" /> };
  if (f <= 1.3) return { label: 'OK', color: 'text-yellow-600', icon: <Minus className="w-3 h-3" /> };
  return { label: 'Teuer', color: 'text-red-600', icon: <TrendingUp className="w-3 h-3" /> };
}

interface Props {
  vehicleData: VehicleData | null;
}

const LeasingCalculatorPanel: React.FC<Props> = ({ vehicleData }) => {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [residualValue, setResidualValue] = useState('');
  const [specialPayment, setSpecialPayment] = useState('');
  const [months, setMonths] = useState('48');
  const [interestRate, setInterestRate] = useState('');

  // Auto-populate from vehicle data
  useEffect(() => {
    if (!vehicleData) return;
    const f = vehicleData.finance;
    if (f.totalPrice) setPrice(f.totalPrice.replace(/[€\s]/g, ''));
    if (f.residualValue) setResidualValue(f.residualValue.replace(/[€\s]/g, ''));
    if (f.specialPayment) setSpecialPayment(f.specialPayment.replace(/[€\s]/g, ''));
    if (f.duration) {
      const m = f.duration.match(/(\d+)/);
      if (m) setMonths(m[1]);
    }
    if (f.interestRate) setInterestRate(f.interestRate.replace(/[%\s]/g, ''));
  }, [vehicleData]);

  const result = useMemo(() => {
    const p = parseGermanNumber(price);
    const rv = parseGermanNumber(residualValue);
    const sp = parseGermanNumber(specialPayment);
    const m = parseInt(months) || 0;
    const rate = parseGermanNumber(interestRate) / 100;
    if (p <= 0 || m <= 0) return null;

    const depreciation = (p - rv - sp) / m;
    const interest = ((p + rv) / 2) * (rate / 12);
    const monthlyRate = depreciation + interest;
    const leasingFactor = p > 0 ? (monthlyRate / p) * 100 : 0;

    return { monthlyRate: Math.max(0, monthlyRate), leasingFactor, totalCost: Math.max(0, monthlyRate) * m + sp };
  }, [price, residualValue, specialPayment, months, interestRate]);

  const rating = result ? rateFactor(result.leasingFactor) : null;

  return (
    <div className="border-t border-sidebar-border mt-4 pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-sidebar-primary" />
          <span className="font-display font-semibold text-sm text-sidebar-foreground">Leasing-Rechner</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-sidebar-foreground/50" /> : <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          <Field label="Preis (brutto)" value={price} onChange={setPrice} suffix="€" />
          <Field label="Restwert" value={residualValue} onChange={setResidualValue} suffix="€" />
          <Field label="Sonderzahlung" value={specialPayment} onChange={setSpecialPayment} suffix="€" />
          <Field label="Laufzeit" value={months} onChange={setMonths} suffix="Mo." />
          <Field label="Zinssatz (p.a.)" value={interestRate} onChange={setInterestRate} suffix="%" />

          {result && result.monthlyRate > 0 && (
            <div className="bg-sidebar-accent rounded-lg p-3 space-y-2 mt-3">
              <div>
                <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wide">Monatliche Rate</p>
                <p className="text-lg font-bold text-sidebar-foreground font-['Space_Grotesk']">{formatEuro(result.monthlyRate)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wide">Leasingfaktor</p>
                  <p className="text-sm font-bold text-sidebar-foreground font-['Space_Grotesk']">
                    {result.leasingFactor.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {rating && (
                  <div className={`flex items-center gap-1 ${rating.color}`}>
                    {rating.icon}
                    <span className="text-xs font-semibold">{rating.label}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-sidebar-border pt-2">
                <div className="flex justify-between text-[11px] text-sidebar-foreground/60">
                  <span>Gesamtkosten</span>
                  <span className="font-medium text-sidebar-foreground">{formatEuro(result.totalCost)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; suffix: string }> = ({ label, value, onChange, suffix }) => (
  <div className="space-y-0.5">
    <Label className="text-[11px] text-sidebar-foreground/60">{label}</Label>
    <div className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 text-xs pr-8 bg-sidebar-accent/50 border-sidebar-border"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sidebar-foreground/40">{suffix}</span>
    </div>
  </div>
);

export default LeasingCalculatorPanel;
