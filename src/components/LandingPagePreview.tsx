import React, { useState } from 'react';
import { Download, RotateCcw, Pencil, X, Check, Car, Fuel, Gauge, Calendar, Palette, Cog, Zap, MapPin, Phone, Mail, Globe } from 'lucide-react';
import type { VehicleData } from '@/types/vehicle';
import { generateLandingPageHTML, downloadHTML } from '@/lib/html-generator';
import { Button } from '@/components/ui/button';

interface LandingPagePreviewProps {
  vehicleData: VehicleData;
  imageBase64: string | null;
  onReset: () => void;
  onDataChange: (data: VehicleData) => void;
}

const EditableField: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
}> = ({ value, onChange, className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          className="bg-background border border-border rounded px-2 py-0.5 text-sm w-auto min-w-[80px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onChange(draft); setEditing(false); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
        />
        <button onClick={() => { onChange(draft); setEditing(false); }} className="text-accent hover:text-accent/80">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`group cursor-pointer hover:text-accent transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="Klicken zum Bearbeiten"
    >
      {value || '–'}
      <Pencil className="w-3 h-3 ml-1 inline opacity-0 group-hover:opacity-60 transition-opacity" />
    </span>
  );
};

const SpecItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ icon, label, value, onChange }) => (
  <div className="flex items-start gap-2.5 py-2">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <EditableField value={value} onChange={onChange} className="text-sm font-semibold text-foreground" />
    </div>
  </div>
);

const LandingPagePreview: React.FC<LandingPagePreviewProps> = ({ vehicleData, imageBase64, onReset, onDataChange }) => {
  const data = vehicleData;

  const updateVehicle = (key: keyof VehicleData['vehicle'], val: string) => {
    onDataChange({ ...data, vehicle: { ...data.vehicle, [key]: val } });
  };
  const updateFinance = (key: keyof VehicleData['finance'], val: string) => {
    onDataChange({ ...data, finance: { ...data.finance, [key]: val } });
  };
  const updateDealer = (key: keyof VehicleData['dealer'], val: string) => {
    onDataChange({ ...data, dealer: { ...data.dealer, [key]: val } });
  };

  const handleExport = () => {
    const html = generateLandingPageHTML(data, imageBase64);
    const filename = `${data.vehicle.brand}_${data.vehicle.model}_Angebot.html`.replace(/\s+/g, '_');
    downloadHTML(html, filename);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Neues PDF
        </Button>
        <Button onClick={handleExport} className="gap-2 gradient-accent text-accent-foreground font-semibold shadow-glow hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" />
          Als HTML herunterladen
        </Button>
      </div>

      {/* Main two-column layout */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Left: Image */}
          <div className="bg-muted flex items-center justify-center p-4 min-h-[300px]">
            {imageBase64 ? (
              <img
                src={imageBase64}
                alt={`${data.vehicle.brand} ${data.vehicle.model}`}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-2">
                <Car className="w-12 h-12" />
                <span className="text-sm">Kein Bild verfügbar</span>
              </div>
            )}
          </div>

          {/* Right: Vehicle info */}
          <div className="p-6 flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              {data.category || 'Angebot'}
            </span>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground mb-1">
              {data.vehicle.brand} {data.vehicle.model}
            </h1>
            <p className="text-sm text-muted-foreground mb-3">{data.vehicle.variant}</p>

            {/* Price */}
            <div className="font-display text-2xl font-bold text-foreground mb-4">
              <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} />
            </div>

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 border-t border-border pt-3">
              <SpecItem icon={<Car className="w-4 h-4" />} label="Fahrzeugtyp" value={data.category || '–'} onChange={() => {}} />
              <SpecItem icon={<Cog className="w-4 h-4" />} label="Getriebe" value={data.vehicle.transmission} onChange={(v) => updateVehicle('transmission', v)} />
              <SpecItem icon={<Zap className="w-4 h-4" />} label="Leistung" value={data.vehicle.power} onChange={(v) => updateVehicle('power', v)} />
              <SpecItem icon={<Fuel className="w-4 h-4" />} label="Kraftstoff" value={data.vehicle.fuelType} onChange={(v) => updateVehicle('fuelType', v)} />
              <SpecItem icon={<Palette className="w-4 h-4" />} label="Farbe" value={data.vehicle.color} onChange={(v) => updateVehicle('color', v)} />
              <SpecItem icon={<Calendar className="w-4 h-4" />} label="Baujahr" value={String(data.vehicle.year || '–')} onChange={() => {}} />
            </div>
          </div>
        </div>
      </div>

      {/* Finance card */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base">💰</span>
          Finanzierung
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ['Monatliche Rate', data.finance.monthlyRate, (v: string) => updateFinance('monthlyRate', v)],
            ['Anzahlung', data.finance.downPayment, (v: string) => updateFinance('downPayment', v)],
            ['Laufzeit', data.finance.duration, (v: string) => updateFinance('duration', v)],
            ['Jahresfahrleistung', data.finance.annualMileage, (v: string) => updateFinance('annualMileage', v)],
            ['Sonderzahlung', data.finance.specialPayment, (v: string) => updateFinance('specialPayment', v)],
            ['Restwert', data.finance.residualValue, (v: string) => updateFinance('residualValue', v)],
          ].map(([label, value, onChange]) => (
            <div key={label as string} className="bg-muted/50 rounded-xl p-3">
              <div className="text-xs text-muted-foreground mb-0.5">{label as string}</div>
              <EditableField value={value as string} onChange={onChange as (v: string) => void} className="text-sm font-semibold text-foreground" />
            </div>
          ))}
        </div>
      </div>

      {/* Features / Ausstattung */}
      {data.vehicle.features?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-card p-6">
          <h3 className="font-display text-base font-semibold mb-4">Ausstattung</h3>
          <div className="flex flex-wrap gap-2">
            {data.vehicle.features.map((f, i) => (
              <span key={i} className="text-xs border border-border text-foreground px-3 py-1.5 rounded-full hover:bg-muted transition-colors">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dealer / Contact */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base">📍</span>
          Händler & Kontakt
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <EditableField value={data.dealer.name} onChange={(v) => updateDealer('name', v)} className="font-semibold text-foreground block" />
                <EditableField value={data.dealer.address} onChange={(v) => updateDealer('address', v)} className="text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <EditableField value={data.dealer.phone} onChange={(v) => updateDealer('phone', v)} className="text-foreground" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <EditableField value={data.dealer.email} onChange={(v) => updateDealer('email', v)} className="text-foreground" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <EditableField value={data.dealer.website} onChange={(v) => updateDealer('website', v)} className="text-foreground" />
            </div>
          </div>
          <div className="bg-muted/50 rounded-xl p-5 flex flex-col items-center justify-center text-center">
            <div className="gradient-accent text-accent-foreground px-6 py-3 rounded-xl shadow-glow mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Monatliche Rate</div>
              <div className="font-display text-2xl font-bold">{data.finance.monthlyRate || '–'}</div>
              <div className="text-xs font-medium opacity-80">pro Monat</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Alle Angaben ohne Gewähr</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPagePreview;
