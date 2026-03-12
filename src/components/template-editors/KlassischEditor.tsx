import React, { useState } from 'react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import EditableField from '@/components/EditableField';
import CO2LabelSelector from '@/components/CO2LabelSelector';
import FuelTypeDropdown from '@/components/FuelTypeDropdown';
import CategoryDropdown from '@/components/CategoryDropdown';
import LeasingDurationDropdown from '@/components/LeasingDurationDropdown';
import { Button } from '@/components/ui/button';
import {
  MapPin, Phone, Mail, Globe,
  Plus, Trash2, ChevronLeft, ChevronRight,
  Calculator, Loader2, Upload,
} from 'lucide-react';
import { isPluginHybrid } from '@/lib/co2-utils';
import { getFinanceSectionTitle, calculateLeasingFactor } from '@/lib/templates/shared';
import type { TemplateEditorProps } from './types';

const Row: React.FC<{
  label: string; value: string; onChange: (v: string) => void; suffix?: string;
}> = ({ label, value, onChange, suffix }) => (
  <tr className="border-b border-border/30">
    <td className="py-2.5 pr-4 text-sm text-muted-foreground w-[40%]">{label}</td>
    <td className="py-2.5"><EditableField value={value} onChange={onChange} className="text-sm font-semibold text-foreground" suffix={suffix} /></td>
  </tr>
);

const KlassischEditor: React.FC<TemplateEditorProps> = ({
  data, consumption, imageBase64, galleryImages, allImages,
  isBuyCategory, category,
  updateVehicle, updateFinance, updateDealer, updateConsumption,
  updatePower, updateFuelType, onDataChange,
  recalculateRate, calculateCosts, costCalculating, costMissingFields,
  addFeature, updateFeature, removeFeature, vinLookup,
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const cat = category.toLowerCase();
  const isLeasing = cat.includes('leasing');

  return (
    <div className="space-y-5 font-sans">
      {/* Header – centered, elegant */}
      <div className="text-center py-6 border-b border-border">
        <div className="text-[11px] uppercase tracking-[4px] text-muted-foreground mb-2">
          <CategoryDropdown value={data.category || ''} onChange={(v) => onDataChange({ ...data, category: v })} />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          <EditableField value={`${data.vehicle.brand} ${data.vehicle.model}`} onChange={(v) => { const parts = v.split(' '); updateVehicle('brand', parts[0] || ''); updateVehicle('model', parts.slice(1).join(' ') || ''); }} className="font-display text-3xl font-bold text-foreground" />
        </h1>
        <EditableField value={data.vehicle.variant || ''} onChange={(v) => updateVehicle('variant', v)} className="text-sm italic text-muted-foreground mt-1" />
        <div className="mt-3">
          <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} className="font-display text-2xl font-semibold text-primary" suffix="€" />
        </div>
      </div>

      {/* Image */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {allImages.length > 0 ? (
          <div className="relative">
            <img src={allImages[selectedImage] || allImages[0]} alt={`${data.vehicle.brand} ${data.vehicle.model}`} className="w-full max-h-[420px] object-cover" />
            {allImages.length > 1 && (
              <>
                <button onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))} className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md" disabled={selectedImage === 0}><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setSelectedImage(Math.min(allImages.length - 1, selectedImage + 1))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md" disabled={selectedImage === allImages.length - 1}><ChevronRight className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ) : (
          <div className="w-full aspect-[16/9] flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted">
            <Upload className="w-10 h-10 opacity-50" /><span className="text-sm">Kein Bild</span>
          </div>
        )}
        {allImages.length > 1 && (
          <div className="flex gap-2 p-3 justify-center bg-muted/30 border-t border-border/40">
            {allImages.map((img, i) => (
              <button key={i} onClick={() => setSelectedImage(i)} className={`shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${i === selectedImage ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <img src={img} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sections */}
      <Accordion type="multiple" defaultValue={['specs', 'finance', 'consumption', 'features']} className="space-y-3">
        {/* Specs */}
        <AccordionItem value="specs" className="bg-card rounded-xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 font-display text-lg font-semibold hover:no-underline border-b-2 border-primary">Fahrzeugdaten</AccordionTrigger>
          <AccordionContent className="pb-5 pt-3">
            <table className="w-full">
              <tbody>
                <Row label="Getriebe" value={data.vehicle.transmission} onChange={(v) => updateVehicle('transmission', v)} />
                <tr className="border-b border-border/30">
                  <td className="py-2.5 pr-4 text-sm text-muted-foreground w-[40%]">Leistung</td>
                  <td className="py-2.5"><EditableField value={data.vehicle.power || ''} onChange={updatePower} className="text-sm font-semibold" /></td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5 pr-4 text-sm text-muted-foreground w-[40%]">Kraftstoff</td>
                  <td className="py-2.5"><FuelTypeDropdown value={data.vehicle.fuelType} onChange={updateFuelType} /></td>
                </tr>
                <Row label="Farbe" value={data.vehicle.color} onChange={(v) => updateVehicle('color', v)} />
                <Row label="Baujahr" value={String(data.vehicle.year || '–')} onChange={() => {}} />
                {data.vehicle.vin && <Row label="VIN" value={data.vehicle.vin} onChange={(v) => updateVehicle('vin', v)} />}
              </tbody>
            </table>
          </AccordionContent>
        </AccordionItem>

        {/* Finance */}
        <AccordionItem value="finance" className="bg-card rounded-xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 font-display text-lg font-semibold hover:no-underline border-b-2 border-primary">{getFinanceSectionTitle(data)}</AccordionTrigger>
          <AccordionContent className="pb-5 pt-3 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {!isBuyCategory && (
                <>
                  <div className="border border-border rounded-lg bg-muted/30 p-3">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Rate</div>
                    <EditableField value={data.finance.monthlyRate || ''} onChange={(v) => updateFinance('monthlyRate', v)} className="text-sm font-semibold" suffix="€" />
                  </div>
                  <div className="border border-border rounded-lg bg-muted/30 p-3">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Laufzeit</div>
                    <EditableField value={data.finance.duration} onChange={(v) => updateFinance('duration', v)} className="text-sm font-semibold" suffix="Monate" />
                  </div>
                  {isLeasing ? (
                    <div className="border border-border rounded-lg bg-muted/30 p-3">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Sonderzahlung</div>
                      <EditableField value={data.finance.specialPayment || ''} onChange={(v) => updateFinance('specialPayment', v)} className="text-sm font-semibold" suffix="€" />
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg bg-muted/30 p-3">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Anzahlung</div>
                      <EditableField value={data.finance.downPayment || ''} onChange={(v) => updateFinance('downPayment', v)} className="text-sm font-semibold" suffix="€" />
                    </div>
                  )}
                  <div className="border border-border rounded-lg bg-muted/30 p-3">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Eff. Jahreszins</div>
                    <EditableField value={data.finance.interestRate || ''} onChange={(v) => updateFinance('interestRate', v)} className="text-sm font-semibold" suffix="%" />
                  </div>
                </>
              )}
            </div>
            {!isBuyCategory && <Button variant="outline" size="sm" className="gap-2" onClick={recalculateRate}><Calculator className="w-3.5 h-3.5" /> Rate berechnen</Button>}
            {isLeasing && (() => {
              const lf = calculateLeasingFactor(data);
              if (!lf) return null;
              const val = parseFloat(lf.replace(',', '.'));
              const rating = val <= 0 ? null : val < 0.7 ? { label: 'Sehr gut', color: 'text-green-600' } : val <= 1.0 ? { label: 'Gut', color: 'text-emerald-600' } : val <= 1.3 ? { label: 'OK', color: 'text-yellow-600' } : { label: 'Teuer', color: 'text-red-600' };
              return (
                <div className="bg-muted/60 rounded-lg p-3 flex items-center justify-between">
                  <div><div className="text-xs text-muted-foreground">Leasingfaktor</div><span className="text-sm font-bold">{lf}</span></div>
                  {rating && <span className={`text-xs font-semibold ${rating.color}`}>{rating.label}</span>}
                </div>
              );
            })()}
            {!isBuyCategory && (
              <div className="pt-3 border-t border-border space-y-2">
                <div className="text-xs font-semibold">Bankangaben / Pflichthinweis</div>
                <textarea
                  value={isLeasing ? (data.dealer.leasingLegalText || '') : (data.dealer.financingLegalText || '')}
                  onChange={(e) => updateDealer(isLeasing ? 'leasingLegalText' : 'financingLegalText', e.target.value)}
                  className="w-full text-sm bg-muted/30 border border-border rounded-lg p-3 min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Bankangaben eintragen..."
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Consumption */}
        <AccordionItem value="consumption" className="bg-card rounded-xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 font-display text-lg font-semibold hover:no-underline border-b-2 border-primary">Verbrauch & Emissionen</AccordionTrigger>
          <AccordionContent className="pb-5 pt-3 space-y-4">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={calculateCosts} disabled={costCalculating}>
              {costCalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />} Kosten berechnen
            </Button>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <CO2LabelSelector consumption={consumption} onClassChange={(cls) => updateConsumption('co2Class', cls)} onDischargedClassChange={isPluginHybrid(consumption) ? (cls) => updateConsumption('co2ClassDischarged', cls) : undefined} />
              </div>
              <table className="w-full">
                <tbody>
                  <Row label="CO₂ (komb.)" value={consumption.co2Emissions} onChange={(v) => updateConsumption('co2Emissions', v)} suffix="g/km" />
                  <Row label="Verbrauch (komb.)" value={consumption.consumptionCombined} onChange={(v) => updateConsumption('consumptionCombined', v)} suffix="l/100 km" />
                  <Row label="Innenstadt" value={consumption.consumptionCity} onChange={(v) => updateConsumption('consumptionCity', v)} suffix="l/100 km" />
                  <Row label="Stadtrand" value={consumption.consumptionSuburban} onChange={(v) => updateConsumption('consumptionSuburban', v)} suffix="l/100 km" />
                  <Row label="Landstraße" value={consumption.consumptionRural} onChange={(v) => updateConsumption('consumptionRural', v)} suffix="l/100 km" />
                  <Row label="Autobahn" value={consumption.consumptionHighway} onChange={(v) => updateConsumption('consumptionHighway', v)} suffix="l/100 km" />
                </tbody>
              </table>
            </div>
            {isPluginHybrid(consumption) && (
              <table className="w-full">
                <tbody>
                  <Row label="Verbrauch (komb., entladen)" value={consumption.consumptionCombinedDischarged} onChange={(v) => updateConsumption('consumptionCombinedDischarged', v)} suffix="l/100 km" />
                  <Row label="CO₂ (entladen)" value={consumption.co2EmissionsDischarged} onChange={(v) => updateConsumption('co2EmissionsDischarged', v)} suffix="g/km" />
                  <Row label="Stromverbrauch" value={consumption.consumptionElectric} onChange={(v) => updateConsumption('consumptionElectric', v)} suffix="kWh/100 km" />
                  <Row label="Elektr. Reichweite" value={consumption.electricRange} onChange={(v) => updateConsumption('electricRange', v)} suffix="km" />
                </tbody>
              </table>
            )}
            <div className="pt-3 border-t border-border">
              <div className="text-xs font-semibold mb-2">Kosten (EnVKV)</div>
              <table className="w-full">
                <tbody>
                  <Row label="Hubraum" value={consumption.displacement} onChange={(v) => updateConsumption('displacement', v)} suffix="cm³" />
                  <Row label="Energiekosten/Jahr" value={consumption.energyCostPerYear} onChange={(v) => updateConsumption('energyCostPerYear', v)} suffix="€" />
                  <Row label="Kfz-Steuer" value={consumption.vehicleTax} onChange={(v) => updateConsumption('vehicleTax', v)} suffix="€/Jahr" />
                  <Row label="CO₂-Kosten (10J)" value={consumption.co2CostMedium} onChange={(v) => updateConsumption('co2CostMedium', v)} suffix="€" />
                </tbody>
              </table>
            </div>
            {costMissingFields.length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-xs font-semibold text-destructive mb-1">Fehlende Pflichtangaben:</p>
                <ul className="text-xs text-destructive/80 list-disc list-inside">{costMissingFields.map(f => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Features */}
        <AccordionItem value="features" className="bg-card rounded-xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 font-display text-lg font-semibold hover:no-underline border-b-2 border-primary">Ausstattung</AccordionTrigger>
          <AccordionContent className="pb-5 pt-3">
            <div className="flex flex-wrap gap-2">
              {(data.vehicle.features || []).map((f, i) => (
                <span key={i} className="group text-[11px] leading-none border border-border bg-muted/30 text-foreground px-3.5 py-2 rounded inline-flex items-center gap-1.5 hover:bg-muted transition-colors">
                  <EditableField value={f} onChange={(v) => updateFeature(i, v)} className="text-foreground" />
                  <button onClick={() => removeFeature(i)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </span>
              ))}
              {(!data.vehicle.features || data.vehicle.features.length === 0) && <span className="text-xs text-muted-foreground">Keine Ausstattung vorhanden.</span>}
            </div>
            <button onClick={addFeature} className="mt-3 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Hinzufügen</button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Dealer */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-display text-lg font-semibold mb-4 pb-2 border-b-2 border-primary">Händler & Kontakt</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground shrink-0" /><div><EditableField value={data.dealer.name} onChange={(v) => updateDealer('name', v)} className="font-semibold text-sm" /><EditableField value={data.dealer.address} onChange={(v) => updateDealer('address', v)} className="text-xs text-muted-foreground" /></div></div>
            {data.dealer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground shrink-0" /><EditableField value={data.dealer.phone} onChange={(v) => updateDealer('phone', v)} className="text-sm" /></div>}
            {data.dealer.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground shrink-0" /><EditableField value={data.dealer.email} onChange={(v) => updateDealer('email', v)} className="text-sm" /></div>}
            {data.dealer.website && <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-muted-foreground shrink-0" /><EditableField value={data.dealer.website} onChange={(v) => updateDealer('website', v)} className="text-sm" /></div>}
          </div>
          <div className="bg-primary text-primary-foreground rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <div className="text-[10px] uppercase tracking-wide opacity-70">Monatliche Rate</div>
            <div className="font-display text-3xl font-bold my-1">{data.finance.monthlyRate || '–'}</div>
            <div className="text-xs opacity-70">pro Monat</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KlassischEditor;
