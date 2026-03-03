import React, { useState } from 'react';
import { Download, RotateCcw, Pencil, X, Check } from 'lucide-react';
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

const DetailRow: React.FC<{ label: string; value: string; onChange: (val: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border last:border-b-0 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <EditableField value={value} onChange={onChange} className="font-semibold text-foreground" />
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
    <div className="w-full max-w-4xl mx-auto space-y-6">
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

      {/* Hero */}
      <div className="gradient-hero rounded-2xl overflow-hidden relative">
        <div className="text-center pt-10 pb-4 px-6">
          <span className="inline-block text-xs font-medium uppercase tracking-wider text-primary-foreground/60 bg-primary-foreground/10 px-4 py-1.5 rounded-full border border-primary-foreground/10 mb-3">
            {data.category || 'Angebot'}
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground">
            {data.vehicle.brand} {data.vehicle.model}
          </h1>
          <p className="text-primary-foreground/50 mt-1">{data.vehicle.variant}</p>
        </div>
        {imageBase64 && (
          <div className="relative px-6 pb-0 max-w-2xl mx-auto">
            <img
              src={imageBase64}
              alt={`${data.vehicle.brand} ${data.vehicle.model}`}
              className="w-full rounded-t-2xl shadow-elevated"
            />
            <div className="absolute bottom-4 right-10 gradient-accent text-accent-foreground px-5 py-3 rounded-xl shadow-glow">
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Monatliche Rate</div>
              <div className="font-display text-2xl font-bold">{data.finance.monthlyRate || '–'}</div>
              <div className="text-xs font-medium opacity-80">pro Monat</div>
            </div>
          </div>
        )}
      </div>

      {/* Data cards */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-card rounded-2xl p-6 shadow-card border border-border">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base">🚗</span>
            Fahrzeugdaten
          </h3>
          <DetailRow label="Marke" value={data.vehicle.brand} onChange={(v) => updateVehicle('brand', v)} />
          <DetailRow label="Modell" value={data.vehicle.model} onChange={(v) => updateVehicle('model', v)} />
          <DetailRow label="Farbe" value={data.vehicle.color} onChange={(v) => updateVehicle('color', v)} />
          <DetailRow label="Antrieb" value={data.vehicle.fuelType} onChange={(v) => updateVehicle('fuelType', v)} />
          <DetailRow label="Getriebe" value={data.vehicle.transmission} onChange={(v) => updateVehicle('transmission', v)} />
          <DetailRow label="Leistung" value={data.vehicle.power} onChange={(v) => updateVehicle('power', v)} />
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-card border border-border">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base">💰</span>
            Finanzierung
          </h3>
          <DetailRow label="Monatliche Rate" value={data.finance.monthlyRate} onChange={(v) => updateFinance('monthlyRate', v)} />
          <DetailRow label="Anzahlung" value={data.finance.downPayment} onChange={(v) => updateFinance('downPayment', v)} />
          <DetailRow label="Laufzeit" value={data.finance.duration} onChange={(v) => updateFinance('duration', v)} />
          <DetailRow label="Gesamtpreis" value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} />
          <DetailRow label="Jahresfahrleistung" value={data.finance.annualMileage} onChange={(v) => updateFinance('annualMileage', v)} />
          <DetailRow label="Sonderzahlung" value={data.finance.specialPayment} onChange={(v) => updateFinance('specialPayment', v)} />
        </div>
      </div>

      {/* Features */}
      {data.vehicle.features?.length > 0 && (
        <div className="bg-card rounded-2xl p-6 shadow-card border border-border">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base">✨</span>
            Ausstattung
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.vehicle.features.map((f, i) => (
              <span key={i} className="text-xs bg-muted text-foreground px-3 py-1.5 rounded-lg">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dealer */}
      <div className="gradient-hero rounded-2xl p-6 text-primary-foreground">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center text-base">📍</span>
          Ihr Ansprechpartner
        </h3>
        <div className="space-y-0">
          {[
            ['Autohaus', data.dealer.name, (v: string) => updateDealer('name', v)],
            ['Adresse', data.dealer.address, (v: string) => updateDealer('address', v)],
            ['Telefon', data.dealer.phone, (v: string) => updateDealer('phone', v)],
            ['E-Mail', data.dealer.email, (v: string) => updateDealer('email', v)],
            ['Website', data.dealer.website, (v: string) => updateDealer('website', v)],
          ].map(([label, value, onChange]) => (
            <div key={label as string} className="flex justify-between items-center py-2.5 border-b border-primary-foreground/10 last:border-b-0 text-sm">
              <span className="text-primary-foreground/60">{label as string}</span>
              <EditableField value={value as string} onChange={onChange as (v: string) => void} className="font-semibold text-primary-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingPagePreview;
