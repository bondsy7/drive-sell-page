import React, { useState, useMemo, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { VehicleData } from '@/types/vehicle';

function blockCalculation(entry: number, divisor: number, taxRate: number): number {
  return Math.ceil(entry / divisor) * taxRate;
}

function getTaxForCo2(co2: number, rate: number, free: number): number {
  return co2 > free ? (co2 - free) * rate / 100 : 0;
}

function berechne(hubraum: number, co2: number, antrieb: 'benzin' | 'diesel', jahr: number): number {
  if (hubraum <= 0 && co2 <= 0) return 0;
  const baseRate = antrieb === 'diesel' ? 950 : 200;
  const hubraumAnteil = blockCalculation(hubraum, 100, baseRate) / 100;

  if (jahr >= 2021) {
    const stufen = [
      { rate: 200, free: 95 }, { rate: 20, free: 115 }, { rate: 30, free: 135 },
      { rate: 40, free: 155 }, { rate: 50, free: 175 }, { rate: 60, free: 195 },
    ];
    let co2Anteil = 0;
    for (const s of stufen) co2Anteil += getTaxForCo2(co2, s.rate, s.free);
    return Math.floor(hubraumAnteil + co2Anteil);
  }
  if (jahr >= 2014) return Math.floor(hubraumAnteil + getTaxForCo2(co2, 200, 95));
  if (jahr >= 2012) return Math.floor(hubraumAnteil + getTaxForCo2(co2, 200, 110));
  if (jahr >= 2009) return Math.floor(hubraumAnteil + getTaxForCo2(co2, 200, 120));
  return Math.floor(hubraumAnteil);
}

interface Props {
  vehicleData: VehicleData | null;
}

const KfzSteuerPanel: React.FC<Props> = ({ vehicleData }) => {
  const [open, setOpen] = useState(false);
  const [hubraum, setHubraum] = useState('');
  const [co2, setCo2] = useState('');
  const [antrieb, setAntrieb] = useState<'benzin' | 'diesel'>('benzin');
  const [jahr, setJahr] = useState('2024');

  useEffect(() => {
    if (!vehicleData) return;
    const c = vehicleData.consumption;
    if (c.displacement) {
      const h = parseInt(c.displacement.replace(/[^\d]/g, ''));
      if (h > 0) setHubraum(String(h));
    }
    if (c.co2Emissions) {
      const v = parseInt(c.co2Emissions.replace(/[^\d]/g, ''));
      if (v > 0) setCo2(String(v));
    }
    const ft = (c.fuelType || vehicleData.vehicle.fuelType || '').toLowerCase();
    if (ft.includes('diesel')) setAntrieb('diesel');
    else setAntrieb('benzin');
    if (vehicleData.vehicle.year) setJahr(String(vehicleData.vehicle.year));
  }, [vehicleData]);

  const result = useMemo(() => {
    const h = parseInt(hubraum) || 0;
    const c = parseInt(co2) || 0;
    const j = parseInt(jahr) || 2024;
    return berechne(h, c, antrieb, j);
  }, [hubraum, co2, antrieb, jahr]);

  return (
    <div className="mt-4 border-t border-sidebar-border pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-xs font-semibold text-sidebar-foreground hover:text-sidebar-primary transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Kfz-Steuer
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <Field label="Hubraum" value={hubraum} onChange={setHubraum} suffix="cm³" numeric />
          <Field label="CO₂ (WLTP)" value={co2} onChange={setCo2} suffix="g/km" numeric />
          <div className="space-y-1">
            <Label className="text-[10px] text-sidebar-foreground/60">Kraftstoff</Label>
            <Select value={antrieb} onValueChange={(v) => setAntrieb(v as 'benzin' | 'diesel')}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="benzin">Benzin</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Erstzulassung (Jahr)" value={jahr} onChange={setJahr} suffix="" numeric />
          {result > 0 && (
            <div className="bg-sidebar-accent rounded-lg p-2.5 mt-2">
              <div className="text-[10px] text-sidebar-foreground/60">Kfz-Steuer / Jahr</div>
              <div className="text-sm font-bold text-sidebar-foreground">{Math.floor(result).toLocaleString('de-DE')} €</div>
              <div className="text-[10px] text-sidebar-foreground/50 mt-0.5">
                {(result / 12).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/Monat
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; suffix: string; numeric?: boolean }> = ({ label, value, onChange, suffix, numeric }) => (
  <div className="space-y-1">
    <Label className="text-[10px] text-sidebar-foreground/60">{label}</Label>
    <div className="relative">
      <Input
        value={value}
        onChange={e => onChange(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
        className="h-7 text-xs pr-12"
      />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

export default KfzSteuerPanel;
