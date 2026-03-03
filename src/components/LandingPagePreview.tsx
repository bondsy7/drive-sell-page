import React, { useState, useMemo } from 'react';
import { Download, RotateCcw, Car, Fuel, Gauge, Calendar, Palette, Cog, Zap, MapPin, Phone, Mail, Globe, Plus, Trash2, ChevronLeft, ChevronRight, Eye, Pencil } from 'lucide-react';
import type { VehicleData, ConsumptionData, DealerData } from '@/types/vehicle';
import { isPluginHybrid } from '@/lib/co2-utils';
import type { TemplateId } from '@/types/template';
import { generateHTML, downloadHTML } from '@/lib/templates';
import { Button } from '@/components/ui/button';
import EditableField from '@/components/EditableField';
import CO2LabelSelector from '@/components/CO2LabelSelector';

interface LandingPagePreviewProps {
  vehicleData: VehicleData;
  imageBase64: string | null;
  galleryImages?: string[];
  onReset: () => void;
  onDataChange: (data: VehicleData) => void;
  selectedTemplate: TemplateId;
}

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

const ConsumptionRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <EditableField value={value} onChange={onChange} className="text-xs font-semibold text-foreground" />
  </div>
);

const LandingPagePreview: React.FC<LandingPagePreviewProps> = ({ vehicleData, imageBase64, galleryImages = [], onReset, onDataChange, selectedTemplate }) => {
  const data = vehicleData;
  const [selectedImage, setSelectedImage] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');

  const liveHTML = useMemo(
    () => generateHTML(selectedTemplate, data, imageBase64, galleryImages),
    [selectedTemplate, data, imageBase64, galleryImages]
  );

  // Ensure consumption exists with defaults
  const consumption: ConsumptionData = data.consumption || {
    origin: '', mileage: '', displacement: '', power: '', driveType: '',
    fuelType: '', consumptionCombined: '', co2Emissions: '', co2Class: '',
    consumptionCity: '', consumptionSuburban: '', consumptionRural: '',
    consumptionHighway: '', energyCostPerYear: '', fuelPrice: '',
    co2CostMedium: '', co2CostLow: '', co2CostHigh: '', vehicleTax: '',
    isPluginHybrid: false, co2EmissionsDischarged: '', co2ClassDischarged: '',
    consumptionCombinedDischarged: '', electricRange: '', consumptionElectric: '',
  };

  const allImages = [imageBase64, ...galleryImages].filter(Boolean) as string[];

  const updateVehicle = (key: keyof VehicleData['vehicle'], val: string) => {
    onDataChange({ ...data, vehicle: { ...data.vehicle, [key]: val } });
  };
  const updateFinance = (key: keyof VehicleData['finance'], val: string) => {
    onDataChange({ ...data, finance: { ...data.finance, [key]: val } });
  };
  const updateDealer = (key: keyof DealerData, val: string) => {
    onDataChange({ ...data, dealer: { ...data.dealer, [key]: val } });
  };
  const updateConsumption = (key: keyof ConsumptionData, val: string) => {
    onDataChange({ ...data, consumption: { ...consumption, [key]: val } });
  };

  const addFeature = () => {
    const features = [...(data.vehicle.features || []), 'Neue Ausstattung'];
    onDataChange({ ...data, vehicle: { ...data.vehicle, features } });
  };
  const updateFeature = (index: number, val: string) => {
    const features = [...(data.vehicle.features || [])];
    features[index] = val;
    onDataChange({ ...data, vehicle: { ...data.vehicle, features } });
  };
  const removeFeature = (index: number) => {
    const features = (data.vehicle.features || []).filter((_, i) => i !== index);
    onDataChange({ ...data, vehicle: { ...data.vehicle, features } });
  };

  const handleExport = () => {
    const html = generateHTML(selectedTemplate, data, imageBase64, galleryImages);
    const filename = `${data.vehicle.brand}_${data.vehicle.model}_Angebot.html`.replace(/\s+/g, '_');
    downloadHTML(html, filename);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Neues PDF
          </Button>
          <div className="flex items-center bg-muted rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Vorschau
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'edit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" /> Bearbeiten
            </button>
          </div>
        </div>
        <Button onClick={handleExport} className="gap-2 gradient-accent text-accent-foreground font-semibold shadow-glow hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" />
          Als HTML herunterladen
        </Button>
      </div>

      {viewMode === 'preview' ? (
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <iframe
            srcDoc={liveHTML}
            className="w-full border-0 rounded-2xl"
            style={{ minHeight: '80vh' }}
            title="Template-Vorschau"
          />
        </div>
      ) : (
        <>
      {/* Main two-column layout */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Left: Image + Gallery */}
          <div className="bg-muted flex flex-col p-4 min-h-[300px]">
            {/* Main image */}
            <div className="flex-1 flex items-center justify-center relative">
              {allImages.length > 0 ? (
                <>
                  <img
                    src={allImages[selectedImage] || allImages[0]}
                    alt={`${data.vehicle.brand} ${data.vehicle.model}`}
                    className="w-full h-full object-cover rounded-xl max-h-[350px]"
                  />
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1.5 shadow-elevated"
                        disabled={selectedImage === 0}
                      >
                        <ChevronLeft className="w-4 h-4 text-foreground" />
                      </button>
                      <button
                        onClick={() => setSelectedImage(Math.min(allImages.length - 1, selectedImage + 1))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1.5 shadow-elevated"
                        disabled={selectedImage === allImages.length - 1}
                      >
                        <ChevronRight className="w-4 h-4 text-foreground" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <Car className="w-12 h-12" />
                  <span className="text-sm">Kein Bild verfügbar</span>
                </div>
              )}
            </div>
            {/* Thumbnail gallery */}
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === selectedImage ? 'border-accent' : 'border-transparent hover:border-border'
                    }`}
                  >
                    <img src={img} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
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

            <div className="font-display text-2xl font-bold text-foreground mb-4">
              <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} />
            </div>

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
          {([
            ['Monatliche Rate', data.finance.monthlyRate, (v: string) => updateFinance('monthlyRate', v)],
            ['Anzahlung', data.finance.downPayment, (v: string) => updateFinance('downPayment', v)],
            ['Laufzeit', data.finance.duration, (v: string) => updateFinance('duration', v)],
            ['Jahresfahrleistung', data.finance.annualMileage, (v: string) => updateFinance('annualMileage', v)],
            ['Sonderzahlung', data.finance.specialPayment, (v: string) => updateFinance('specialPayment', v)],
            ['Restwert', data.finance.residualValue, (v: string) => updateFinance('residualValue', v)],
          ] as [string, string, (v: string) => void][]).map(([label, value, onChange]) => (
            <div key={label} className="bg-muted/50 rounded-xl p-3">
              <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
              <EditableField value={value} onChange={onChange} className="text-sm font-semibold text-foreground" />
            </div>
          ))}
        </div>
      </div>

      {/* Consumption / Verbrauchswerte */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base">⛽</span>
          Verbrauch & Emissionen
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Data rows */}
          <div className="space-y-0">
            <ConsumptionRow label="Herkunft" value={consumption.origin} onChange={(v) => updateConsumption('origin', v)} />
            <ConsumptionRow label="Kilometerstand" value={consumption.mileage} onChange={(v) => updateConsumption('mileage', v)} />
            <ConsumptionRow label="Hubraum" value={consumption.displacement} onChange={(v) => updateConsumption('displacement', v)} />
            <ConsumptionRow label="Leistung" value={consumption.power} onChange={(v) => updateConsumption('power', v)} />
            <ConsumptionRow label="Antriebsart" value={consumption.driveType} onChange={(v) => updateConsumption('driveType', v)} />
            <ConsumptionRow label="Kraftstoffart" value={consumption.fuelType} onChange={(v) => updateConsumption('fuelType', v)} />
            <ConsumptionRow label="Verbrauch (komb.)" value={consumption.consumptionCombined} onChange={(v) => updateConsumption('consumptionCombined', v)} />
            <ConsumptionRow label="CO₂-Emissionen (komb.)" value={consumption.co2Emissions} onChange={(v) => updateConsumption('co2Emissions', v)} />
            {isPluginHybrid(consumption) && (
              <>
                <ConsumptionRow label="Verbrauch (komb., entladen)" value={consumption.consumptionCombinedDischarged} onChange={(v) => updateConsumption('consumptionCombinedDischarged', v)} />
                <ConsumptionRow label="CO₂-Emissionen (entladen)" value={consumption.co2EmissionsDischarged} onChange={(v) => updateConsumption('co2EmissionsDischarged', v)} />
                <ConsumptionRow label="Stromverbrauch (komb.)" value={consumption.consumptionElectric} onChange={(v) => updateConsumption('consumptionElectric', v)} />
                <ConsumptionRow label="Elektrische Reichweite" value={consumption.electricRange} onChange={(v) => updateConsumption('electricRange', v)} />
              </>
            )}
          </div>

          {/* Right: CO2 Label Selector */}
          <div className="flex flex-col items-center justify-center">
            <CO2LabelSelector
              consumption={consumption}
              onClassChange={(cls) => updateConsumption('co2Class', cls)}
              onDischargedClassChange={isPluginHybrid(consumption) ? (cls) => updateConsumption('co2ClassDischarged', cls) : undefined}
            />
          </div>
        </div>

        {/* Detailed consumption */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs font-semibold text-foreground mb-2">Kraftstoffverbrauch im Detail</div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0">
            <ConsumptionRow label="Kombiniert" value={consumption.consumptionCombined} onChange={(v) => updateConsumption('consumptionCombined', v)} />
            <ConsumptionRow label="Innenstadt" value={consumption.consumptionCity} onChange={(v) => updateConsumption('consumptionCity', v)} />
            <ConsumptionRow label="Stadtrand" value={consumption.consumptionSuburban} onChange={(v) => updateConsumption('consumptionSuburban', v)} />
            <ConsumptionRow label="Landstraße" value={consumption.consumptionRural} onChange={(v) => updateConsumption('consumptionRural', v)} />
            <ConsumptionRow label="Autobahn" value={consumption.consumptionHighway} onChange={(v) => updateConsumption('consumptionHighway', v)} />
          </div>
        </div>

        {/* Cost section */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs font-semibold text-foreground mb-2">Kosten</div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0">
            <ConsumptionRow label="Energiekosten/Jahr" value={consumption.energyCostPerYear} onChange={(v) => updateConsumption('energyCostPerYear', v)} />
            <ConsumptionRow label="Kraftstoffpreis" value={consumption.fuelPrice} onChange={(v) => updateConsumption('fuelPrice', v)} />
            <ConsumptionRow label="CO₂-Kosten (mittel, 10J)" value={consumption.co2CostMedium} onChange={(v) => updateConsumption('co2CostMedium', v)} />
            <ConsumptionRow label="CO₂-Kosten (niedrig, 10J)" value={consumption.co2CostLow} onChange={(v) => updateConsumption('co2CostLow', v)} />
            <ConsumptionRow label="CO₂-Kosten (hoch, 10J)" value={consumption.co2CostHigh} onChange={(v) => updateConsumption('co2CostHigh', v)} />
            <ConsumptionRow label="Kfz-Steuer" value={consumption.vehicleTax} onChange={(v) => updateConsumption('vehicleTax', v)} />
          </div>
        </div>
      </div>

      {/* Features / Ausstattung */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-semibold">Ausstattung</h3>
          <Button variant="outline" size="sm" onClick={addFeature} className="gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Hinzufügen
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data.vehicle.features || []).map((f, i) => (
            <span key={i} className="group text-xs border border-border text-foreground px-3 py-1.5 rounded-full hover:bg-muted transition-colors inline-flex items-center gap-1.5">
              <EditableField value={f} onChange={(v) => updateFeature(i, v)} className="text-foreground" />
              <button onClick={() => removeFeature(i)} className="opacity-0 group-hover:opacity-60 hover:opacity-100 text-destructive transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(!data.vehicle.features || data.vehicle.features.length === 0) && (
            <span className="text-xs text-muted-foreground">Keine Ausstattung vorhanden. Klicke "Hinzufügen" um Merkmale zu ergänzen.</span>
          )}
        </div>
      </div>

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
        </>
      )}
    </div>
  );
};

export default LandingPagePreview;
