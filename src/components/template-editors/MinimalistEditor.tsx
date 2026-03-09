import React, { useState } from 'react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import EditableField from '@/components/EditableField';
import CO2LabelSelector from '@/components/CO2LabelSelector';
import FuelTypeDropdown from '@/components/FuelTypeDropdown';
import CategoryDropdown from '@/components/CategoryDropdown';
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
  <div className="flex justify-between items-center py-2 border-b border-border/20 last:border-0">
    <span className="text-[13px] text-muted-foreground">{label}</span>
    <EditableField value={value} onChange={onChange} className="text-[13px] font-semibold text-foreground" suffix={suffix} />
  </div>
);

const MinimalistEditor: React.FC<TemplateEditorProps> = ({
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
    <div className="max-w-[780px] mx-auto space-y-8">
      {/* Title block */}
      <div>
        <div className="text-[11px] uppercase tracking-[4px] text-muted-foreground mb-2">
          <CategoryDropdown value={data.category || ''} onChange={(v) => onDataChange({ ...data, category: v })} />
        </div>
        <h1 className="text-[30px] font-bold tracking-tight text-foreground leading-tight">
          <EditableField value={`${data.vehicle.brand} ${data.vehicle.model}`} onChange={(v) => { const parts = v.split(' '); updateVehicle('brand', parts[0] || ''); updateVehicle('model', parts.slice(1).join(' ') || ''); }} className="text-[30px] font-bold tracking-tight text-foreground" />
        </h1>
        <EditableField value={data.vehicle.variant || ''} onChange={(v) => updateVehicle('variant', v)} className="text-[13px] text-muted-foreground mt-1" />
        <div className="mt-4">
          <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} className="text-[26px] font-bold text-foreground" suffix="€" />
        </div>
      </div>

      {/* Image */}
      <div>
        {allImages.length > 0 ? (
          <div className="relative">
            <img src={allImages[selectedImage] || allImages[0]} alt={`${data.vehicle.brand} ${data.vehicle.model}`} className="w-full rounded-md" />
            {allImages.length > 1 && (
              <>
                <button onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))} className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md" disabled={selectedImage === 0}><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setSelectedImage(Math.min(allImages.length - 1, selectedImage + 1))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md" disabled={selectedImage === allImages.length - 1}><ChevronRight className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ) : (
          <div className="w-full aspect-[16/9] flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted rounded-md">
            <Upload className="w-10 h-10 opacity-50" /><span className="text-sm">Kein Bild</span>
          </div>
        )}
        {allImages.length > 1 && (
          <div className="flex gap-1.5 mt-2.5">
            {allImages.map((img, i) => (
              <button key={i} onClick={() => setSelectedImage(i)} className={`shrink-0 w-[60px] h-[44px] rounded object-cover overflow-hidden transition-opacity ${i === selectedImage ? 'opacity-100 ring-1 ring-foreground' : 'opacity-40 hover:opacity-100'}`}>
                <img src={img} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Sections */}
      <Accordion type="multiple" defaultValue={['specs', 'finance', 'consumption', 'features']} className="space-y-6">
        {/* Specs */}
        <AccordionItem value="specs" className="border-none">
          <AccordionTrigger className="py-0 pb-4 text-[11px] uppercase tracking-[3px] text-muted-foreground font-medium hover:no-underline">Technische Daten</AccordionTrigger>
          <AccordionContent className="space-y-0">
            <Row label="Getriebe" value={data.vehicle.transmission} onChange={(v) => updateVehicle('transmission', v)} />
            <div className="flex justify-between items-center py-2 border-b border-border/20">
              <span className="text-[13px] text-muted-foreground">Leistung</span>
              <EditableField value={data.vehicle.power || ''} onChange={updatePower} className="text-[13px] font-semibold" />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/20">
              <span className="text-[13px] text-muted-foreground">Kraftstoff</span>
              <FuelTypeDropdown value={data.vehicle.fuelType} onChange={updateFuelType} />
            </div>
            <Row label="Farbe" value={data.vehicle.color} onChange={(v) => updateVehicle('color', v)} />
            <Row label="Baujahr" value={String(data.vehicle.year || '–')} onChange={() => {}} />
            {data.vehicle.vin && <Row label="VIN" value={data.vehicle.vin} onChange={(v) => updateVehicle('vin', v)} />}
          </AccordionContent>
        </AccordionItem>

        <div className="h-px bg-border" />

        {/* Finance */}
        <AccordionItem value="finance" className="border-none">
          <AccordionTrigger className="py-0 pb-4 text-[11px] uppercase tracking-[3px] text-muted-foreground font-medium hover:no-underline">{getFinanceSectionTitle(data)}</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {!isBuyCategory && (
                <>
                  <div className="border-b border-border/20 pb-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Rate</div>
                    <EditableField value={data.finance.monthlyRate || ''} onChange={(v) => updateFinance('monthlyRate', v)} className="text-[15px] font-semibold" suffix="€" />
                  </div>
                  <div className="border-b border-border/20 pb-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Laufzeit</div>
                    <EditableField value={data.finance.duration} onChange={(v) => updateFinance('duration', v)} className="text-[15px] font-semibold" suffix="Monate" />
                  </div>
                  {isLeasing ? (
                    <div className="border-b border-border/20 pb-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Sonderzahlung</div>
                      <EditableField value={data.finance.specialPayment || ''} onChange={(v) => updateFinance('specialPayment', v)} className="text-[15px] font-semibold" suffix="€" />
                    </div>
                  ) : (
                    <div className="border-b border-border/20 pb-3">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Anzahlung</div>
                      <EditableField value={data.finance.downPayment || ''} onChange={(v) => updateFinance('downPayment', v)} className="text-[15px] font-semibold" suffix="€" />
                    </div>
                  )}
                  <div className="border-b border-border/20 pb-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Eff. Jahreszins</div>
                    <EditableField value={data.finance.interestRate || ''} onChange={(v) => updateFinance('interestRate', v)} className="text-[15px] font-semibold" suffix="%" />
                  </div>
                </>
              )}
            </div>
            {!isBuyCategory && <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={recalculateRate}><Calculator className="w-3.5 h-3.5" /> Rate berechnen</Button>}
            {isLeasing && (() => {
              const lf = calculateLeasingFactor(data);
              if (!lf) return null;
              const val = parseFloat(lf.replace(',', '.'));
              const rating = val <= 0 ? null : val < 0.7 ? { label: 'Sehr gut', color: 'text-green-600' } : val <= 1.0 ? { label: 'Gut', color: 'text-emerald-600' } : val <= 1.3 ? { label: 'OK', color: 'text-yellow-600' } : { label: 'Teuer', color: 'text-red-600' };
              return (
                <div className="flex items-center justify-between py-2">
                  <div><div className="text-[10px] text-muted-foreground">Leasingfaktor</div><span className="text-sm font-bold">{lf}</span></div>
                  {rating && <span className={`text-xs font-semibold ${rating.color}`}>{rating.label}</span>}
                </div>
              );
            })()}
            {!isBuyCategory && (
              <div className="pt-3 border-t border-border/20 space-y-2">
                <div className="text-[11px] uppercase tracking-[2px] text-muted-foreground">Bankangaben</div>
                <textarea
                  value={isLeasing ? (data.dealer.leasingLegalText || '') : (data.dealer.financingLegalText || '')}
                  onChange={(e) => updateDealer(isLeasing ? 'leasingLegalText' : 'financingLegalText', e.target.value)}
                  className="w-full text-[13px] bg-transparent border border-border/30 rounded p-3 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-foreground"
                  placeholder="Bankangaben eintragen..."
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <div className="h-px bg-border" />

        {/* Consumption */}
        <AccordionItem value="consumption" className="border-none">
          <AccordionTrigger className="py-0 pb-4 text-[11px] uppercase tracking-[3px] text-muted-foreground font-medium hover:no-underline">Verbrauch & Emissionen</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={calculateCosts} disabled={costCalculating}>
              {costCalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />} Kosten berechnen
            </Button>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-0">
                <Row label="CO₂ (komb.)" value={consumption.co2Emissions} onChange={(v) => updateConsumption('co2Emissions', v)} suffix="g/km" />
                <Row label="Verbrauch (komb.)" value={consumption.consumptionCombined} onChange={(v) => updateConsumption('consumptionCombined', v)} suffix="l/100 km" />
                <Row label="Innenstadt" value={consumption.consumptionCity} onChange={(v) => updateConsumption('consumptionCity', v)} suffix="l/100 km" />
                <Row label="Stadtrand" value={consumption.consumptionSuburban} onChange={(v) => updateConsumption('consumptionSuburban', v)} suffix="l/100 km" />
                <Row label="Landstraße" value={consumption.consumptionRural} onChange={(v) => updateConsumption('consumptionRural', v)} suffix="l/100 km" />
                <Row label="Autobahn" value={consumption.consumptionHighway} onChange={(v) => updateConsumption('consumptionHighway', v)} suffix="l/100 km" />
              </div>
              <div className="flex flex-col items-center justify-center">
                <CO2LabelSelector consumption={consumption} onClassChange={(cls) => updateConsumption('co2Class', cls)} onDischargedClassChange={isPluginHybrid(consumption) ? (cls) => updateConsumption('co2ClassDischarged', cls) : undefined} />
              </div>
            </div>
            {isPluginHybrid(consumption) && (
              <div className="grid grid-cols-2 gap-x-8">
                <Row label="Verbrauch (komb., entladen)" value={consumption.consumptionCombinedDischarged} onChange={(v) => updateConsumption('consumptionCombinedDischarged', v)} suffix="l/100 km" />
                <Row label="CO₂ (entladen)" value={consumption.co2EmissionsDischarged} onChange={(v) => updateConsumption('co2EmissionsDischarged', v)} suffix="g/km" />
                <Row label="Stromverbrauch" value={consumption.consumptionElectric} onChange={(v) => updateConsumption('consumptionElectric', v)} suffix="kWh/100 km" />
                <Row label="Elektr. Reichweite" value={consumption.electricRange} onChange={(v) => updateConsumption('electricRange', v)} suffix="km" />
              </div>
            )}
            <div className="pt-4 border-t border-border/20">
              <div className="text-[11px] uppercase tracking-[2px] text-muted-foreground mb-3">Kosten</div>
              <div className="grid grid-cols-2 gap-x-8">
                <Row label="Hubraum" value={consumption.displacement} onChange={(v) => updateConsumption('displacement', v)} suffix="cm³" />
                <Row label="Energiekosten/Jahr" value={consumption.energyCostPerYear} onChange={(v) => updateConsumption('energyCostPerYear', v)} suffix="€" />
                <Row label="Kfz-Steuer" value={consumption.vehicleTax} onChange={(v) => updateConsumption('vehicleTax', v)} suffix="€/Jahr" />
                <Row label="CO₂-Kosten (10J)" value={consumption.co2CostMedium} onChange={(v) => updateConsumption('co2CostMedium', v)} suffix="€" />
              </div>
            </div>
            {costMissingFields.length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded">
                <p className="text-xs font-semibold text-destructive mb-1">Fehlende Pflichtangaben:</p>
                <ul className="text-xs text-destructive/80 list-disc list-inside">{costMissingFields.map(f => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <div className="h-px bg-border" />

        {/* Features */}
        <AccordionItem value="features" className="border-none">
          <AccordionTrigger className="py-0 pb-4 text-[11px] uppercase tracking-[3px] text-muted-foreground font-medium hover:no-underline">Ausstattung</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-1.5">
              {(data.vehicle.features || []).map((f, i) => (
                <span key={i} className="group text-[11px] leading-none border border-border/40 text-foreground px-3 py-1.5 rounded inline-flex items-center gap-1.5 hover:bg-muted/50 transition-colors">
                  <EditableField value={f} onChange={(v) => updateFeature(i, v)} className="text-foreground" />
                  <button onClick={() => removeFeature(i)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </span>
              ))}
              {(!data.vehicle.features || data.vehicle.features.length === 0) && <span className="text-xs text-muted-foreground">Keine Ausstattung vorhanden.</span>}
            </div>
            <button onClick={addFeature} className="mt-3 text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Hinzufügen</button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="h-px bg-border" />

      {/* Dealer */}
      <div>
        <div className="text-[11px] uppercase tracking-[3px] text-muted-foreground font-medium mb-5">Kontakt</div>
        <div className="flex justify-between items-start gap-8">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 text-[13px]"><MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><div><EditableField value={data.dealer.name} onChange={(v) => updateDealer('name', v)} className="font-semibold text-[13px]" /><EditableField value={data.dealer.address} onChange={(v) => updateDealer('address', v)} className="text-xs text-muted-foreground" /></div></div>
            {data.dealer.phone && <div className="flex items-center gap-2 text-[13px]"><Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><EditableField value={data.dealer.phone} onChange={(v) => updateDealer('phone', v)} className="text-[13px]" /></div>}
            {data.dealer.email && <div className="flex items-center gap-2 text-[13px]"><Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><EditableField value={data.dealer.email} onChange={(v) => updateDealer('email', v)} className="text-[13px]" /></div>}
            {data.dealer.website && <div className="flex items-center gap-2 text-[13px]"><Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><EditableField value={data.dealer.website} onChange={(v) => updateDealer('website', v)} className="text-[13px]" /></div>}
          </div>
          <div className="bg-foreground text-background rounded-lg px-8 py-6 text-center shrink-0">
            <div className="text-[26px] font-bold">{data.finance.monthlyRate || '–'}</div>
            <div className="text-[11px] opacity-60 mt-1">pro Monat</div>
          </div>
        </div>
      </div>

      <div className="text-center py-8 text-[11px] text-muted-foreground/40">Alle Angaben ohne Gewähr.</div>
    </div>
  );
};

export default MinimalistEditor;
