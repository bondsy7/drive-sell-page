import React, { useState } from 'react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import EditableField from '@/components/EditableField';
import CO2LabelSelector from '@/components/CO2LabelSelector';
import FuelTypeDropdown from '@/components/FuelTypeDropdown';
import CategoryDropdown from '@/components/CategoryDropdown';
import LeasingDurationDropdown from '@/components/LeasingDurationDropdown';
import AnnualMileageDropdown from '@/components/AnnualMileageDropdown';
import { Button } from '@/components/ui/button';
import {
  Car, Cog, Zap, Fuel, Gauge, Calendar, Palette,
  MapPin, Phone, Mail, Globe,
  Plus, Trash2, ChevronLeft, ChevronRight,
  Calculator, Loader2, Search, Upload, Pencil,
} from 'lucide-react';
import { isPluginHybrid } from '@/lib/co2-utils';
import { getFinanceSectionTitle, calculateLeasingFactor } from '@/lib/templates/shared';
import type { TemplateEditorProps } from './types';

const Row: React.FC<{
  label: string; value: string; onChange: (v: string) => void; suffix?: string;
}> = ({ label, value, onChange, suffix }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <EditableField value={value} onChange={onChange} className="text-sm font-semibold text-foreground" suffix={suffix} />
  </div>
);

const ModernEditor: React.FC<TemplateEditorProps> = ({
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
    <div className="space-y-5">
      {/* Hero: two-column image + info */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Left: Image */}
          <div className="relative bg-muted">
            {allImages.length > 0 ? (
              <>
                <img
                  src={allImages[selectedImage] || allImages[0]}
                  alt={`${data.vehicle.brand} ${data.vehicle.model}`}
                  className="w-full aspect-[4/3] object-cover"
                />
                {allImages.length > 1 && (
                  <>
                    <button onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))} className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md" disabled={selectedImage === 0}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSelectedImage(Math.min(allImages.length - 1, selectedImage + 1))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md" disabled={selectedImage === allImages.length - 1}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full aspect-[4/3] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Upload className="w-10 h-10 opacity-50" />
                <span className="text-sm">Kein Bild</span>
              </div>
            )}
            {allImages.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-muted/50 border-t border-border/40">
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === selectedImage ? 'border-primary ring-1 ring-primary/30' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                    <img src={img} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Vehicle info */}
          <div className="p-6 flex flex-col">
            <CategoryDropdown value={data.category || ''} onChange={(v) => onDataChange({ ...data, category: v })} />
            <h1 className="text-2xl font-bold text-foreground mt-2">
              <EditableField value={`${data.vehicle.brand} ${data.vehicle.model}`} onChange={(v) => { const parts = v.split(' '); updateVehicle('brand', parts[0] || ''); updateVehicle('model', parts.slice(1).join(' ') || ''); }} className="text-2xl font-bold text-foreground" />
            </h1>
            <EditableField value={data.vehicle.variant || ''} onChange={(v) => updateVehicle('variant', v)} className="text-sm text-muted-foreground mt-1" />
            <div className="mt-4">
              <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} className="text-3xl font-bold text-primary" suffix="€" />
            </div>

            {!isBuyCategory && data.finance.monthlyRate && (
              <div className="mt-4 bg-primary text-primary-foreground rounded-xl p-4 text-center">
                <div className="text-xs opacity-70 mb-1">Monatliche Rate</div>
                <EditableField value={data.finance.monthlyRate} onChange={(v) => updateFinance('monthlyRate', v)} className="text-2xl font-bold text-primary-foreground" suffix="€" />
                <div className="text-xs opacity-70 mt-1">pro Monat</div>
              </div>
            )}

            {/* Quick specs */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Cog className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-[10px] text-muted-foreground">Getriebe</div>
                  <EditableField value={data.vehicle.transmission} onChange={(v) => updateVehicle('transmission', v)} className="text-xs font-semibold" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-[10px] text-muted-foreground">Leistung</div>
                  <EditableField value={data.vehicle.power || ''} onChange={updatePower} className="text-xs font-semibold" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Fuel className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-[10px] text-muted-foreground">Kraftstoff</div>
                  <FuelTypeDropdown value={data.vehicle.fuelType} onChange={updateFuelType} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-[10px] text-muted-foreground">Farbe</div>
                  <EditableField value={data.vehicle.color} onChange={(v) => updateVehicle('color', v)} className="text-xs font-semibold" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <Accordion type="multiple" defaultValue={['finance', 'consumption', 'features']} className="space-y-3">
        {/* Finance */}
        <AccordionItem value="finance" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">{getFinanceSectionTitle(data)}</AccordionTrigger>
          <AccordionContent className="pb-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-[10px] text-muted-foreground uppercase">Gesamtpreis</div>
                <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} className="text-sm font-bold" suffix="€" />
              </div>
              {!isBuyCategory && (
                <>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="text-[10px] text-muted-foreground uppercase">Rate</div>
                    <EditableField value={data.finance.monthlyRate || ''} onChange={(v) => updateFinance('monthlyRate', v)} className="text-sm font-bold" suffix="€" />
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="text-[10px] text-muted-foreground uppercase">Laufzeit</div>
                    <LeasingDurationDropdown value={data.finance.duration} onChange={(v) => updateFinance('duration', v)} />
                  </div>
                  {isLeasing ? (
                    <>
                      <div className="bg-muted/50 rounded-xl p-3">
                        <div className="text-[10px] text-muted-foreground uppercase">Sonderzahlung</div>
                        <EditableField value={data.finance.specialPayment || ''} onChange={(v) => updateFinance('specialPayment', v)} className="text-sm font-bold" suffix="€" />
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3">
                        <div className="text-[10px] text-muted-foreground uppercase">Fahrleistung</div>
                        <AnnualMileageDropdown value={data.finance.annualMileage || ''} onChange={(v) => updateFinance('annualMileage', v)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-muted/50 rounded-xl p-3">
                        <div className="text-[10px] text-muted-foreground uppercase">Anzahlung</div>
                        <EditableField value={data.finance.downPayment || ''} onChange={(v) => updateFinance('downPayment', v)} className="text-sm font-bold" suffix="€" />
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3">
                        <div className="text-[10px] text-muted-foreground uppercase">Schlussrate</div>
                        <EditableField value={data.finance.residualValue || ''} onChange={(v) => updateFinance('residualValue', v)} className="text-sm font-bold" suffix="€" />
                      </div>
                    </>
                  )}
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="text-[10px] text-muted-foreground uppercase">Eff. Jahreszins</div>
                    <EditableField value={data.finance.interestRate || ''} onChange={(v) => updateFinance('interestRate', v)} className="text-sm font-bold" suffix="%" />
                  </div>
                </>
              )}
            </div>
            {!isBuyCategory && (
              <Button variant="outline" size="sm" className="gap-2" onClick={recalculateRate}>
                <Calculator className="w-3.5 h-3.5" /> Rate neu berechnen
              </Button>
            )}
            {isLeasing && (() => {
              const lf = calculateLeasingFactor(data);
              if (!lf) return null;
              const val = parseFloat(lf.replace(',', '.'));
              const rating = val <= 0 ? null : val < 0.7 ? { label: 'Sehr gut', color: 'text-green-600' } : val <= 1.0 ? { label: 'Gut', color: 'text-emerald-600' } : val <= 1.3 ? { label: 'OK', color: 'text-yellow-600' } : { label: 'Teuer', color: 'text-red-600' };
              return (
                <div className="bg-muted/60 rounded-xl p-3 flex items-center justify-between">
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
                  className="w-full text-sm bg-muted/30 border border-border rounded-xl p-3 min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Bankangaben eintragen..."
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Consumption */}
        <AccordionItem value="consumption" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">Verbrauch & Emissionen</AccordionTrigger>
          <AccordionContent className="pb-5 space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={calculateCosts} disabled={costCalculating}>
                {costCalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />} Kosten berechnen
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <CO2LabelSelector consumption={consumption} onClassChange={(cls) => updateConsumption('co2Class', cls)} onDischargedClassChange={isPluginHybrid(consumption) ? (cls) => updateConsumption('co2ClassDischarged', cls) : undefined} />
                <div className="mt-3 space-y-0">
                  <Row label="CO₂-Emissionen (komb.)" value={consumption.co2Emissions} onChange={(v) => updateConsumption('co2Emissions', v)} suffix="g/km" />
                  <Row label="Verbrauch (komb.)" value={consumption.consumptionCombined} onChange={(v) => updateConsumption('consumptionCombined', v)} suffix="l/100 km" />
                </div>
              </div>
              <div className="space-y-0">
                <Row label="Innenstadt" value={consumption.consumptionCity} onChange={(v) => updateConsumption('consumptionCity', v)} suffix="l/100 km" />
                <Row label="Stadtrand" value={consumption.consumptionSuburban} onChange={(v) => updateConsumption('consumptionSuburban', v)} suffix="l/100 km" />
                <Row label="Landstraße" value={consumption.consumptionRural} onChange={(v) => updateConsumption('consumptionRural', v)} suffix="l/100 km" />
                <Row label="Autobahn" value={consumption.consumptionHighway} onChange={(v) => updateConsumption('consumptionHighway', v)} suffix="l/100 km" />
              </div>
            </div>
            {isPluginHybrid(consumption) && (
              <div className="grid grid-cols-2 gap-x-6">
                <Row label="Verbrauch (komb., entladen)" value={consumption.consumptionCombinedDischarged} onChange={(v) => updateConsumption('consumptionCombinedDischarged', v)} suffix="l/100 km" />
                <Row label="CO₂ (entladen)" value={consumption.co2EmissionsDischarged} onChange={(v) => updateConsumption('co2EmissionsDischarged', v)} suffix="g/km" />
                <Row label="Stromverbrauch (komb.)" value={consumption.consumptionElectric} onChange={(v) => updateConsumption('consumptionElectric', v)} suffix="kWh/100 km" />
                <Row label="Elektr. Reichweite" value={consumption.electricRange} onChange={(v) => updateConsumption('electricRange', v)} suffix="km" />
              </div>
            )}
            <div className="pt-3 border-t border-border">
              <div className="text-xs font-semibold mb-2">Kosten (EnVKV)</div>
              <div className="grid grid-cols-2 gap-x-6">
                <Row label="Hubraum" value={consumption.displacement} onChange={(v) => updateConsumption('displacement', v)} suffix="cm³" />
                <Row label="Energiekosten/Jahr" value={consumption.energyCostPerYear} onChange={(v) => updateConsumption('energyCostPerYear', v)} suffix="€" />
                <Row label="Kfz-Steuer" value={consumption.vehicleTax} onChange={(v) => updateConsumption('vehicleTax', v)} suffix="€/Jahr" />
                <Row label="CO₂-Kosten (10J)" value={consumption.co2CostMedium} onChange={(v) => updateConsumption('co2CostMedium', v)} suffix="€" />
              </div>
            </div>
            {costMissingFields.length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-xs font-semibold text-destructive mb-1">Fehlende Pflichtangaben:</p>
                <ul className="text-xs text-destructive/80 list-disc list-inside">{costMissingFields.map(f => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Technical data */}
        <AccordionItem value="techdata" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">Technische Daten</AccordionTrigger>
          <AccordionContent className="pb-5">
            <div className="grid grid-cols-2 gap-x-6">
              <Row label="Herkunft" value={consumption.origin} onChange={(v) => updateConsumption('origin', v)} />
              <Row label="Kilometerstand" value={consumption.mileage} onChange={(v) => updateConsumption('mileage', v)} suffix="km" />
              <Row label="Hubraum" value={consumption.displacement} onChange={(v) => updateConsumption('displacement', v)} suffix="cm³" />
              <Row label="Antriebsart" value={consumption.driveType} onChange={(v) => updateConsumption('driveType', v)} />
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-sm text-muted-foreground">Leistung</span>
                <EditableField value={(() => { const m = consumption.power?.match(/^([\d.,]+)/); return m ? m[1] : consumption.power || ''; })()} onChange={(v) => { const kw = parseFloat(v.replace(',', '.')); const ps = isNaN(kw) ? '' : String(Math.round(kw * 1.36)); updatePower(v && !isNaN(kw) ? `${v} kW (${ps} PS)` : v); }} className="text-sm font-semibold" suffix="kW" />
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/30">
                <span className="text-sm text-muted-foreground">Kraftstoffart</span>
                <FuelTypeDropdown value={consumption.fuelType} onChange={updateFuelType} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Features */}
        <AccordionItem value="features" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
          <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">Ausstattung</AccordionTrigger>
          <AccordionContent className="pb-5">
            <div className="flex flex-wrap gap-2">
              {(data.vehicle.features || []).map((f, i) => (
                <span key={i} className="group text-[11px] leading-none border border-primary/20 bg-primary/5 text-foreground px-3.5 py-2 rounded-full inline-flex items-center gap-1.5 hover:bg-primary/10 transition-colors">
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
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-base font-semibold mb-4">Händler & Kontakt</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <EditableField value={data.dealer.name} onChange={(v) => updateDealer('name', v)} className="font-semibold text-foreground text-sm" />
                <EditableField value={data.dealer.address} onChange={(v) => updateDealer('address', v)} className="text-xs text-muted-foreground" />
              </div>
            </div>
            {data.dealer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground shrink-0" /><EditableField value={data.dealer.phone} onChange={(v) => updateDealer('phone', v)} className="text-sm" /></div>}
            {data.dealer.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground shrink-0" /><EditableField value={data.dealer.email} onChange={(v) => updateDealer('email', v)} className="text-sm" /></div>}
            {data.dealer.website && <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-muted-foreground shrink-0" /><EditableField value={data.dealer.website} onChange={(v) => updateDealer('website', v)} className="text-sm" /></div>}
          </div>
          <div className="bg-primary text-primary-foreground rounded-xl p-5 flex flex-col items-center justify-center text-center">
            <div className="text-xs opacity-70">Monatliche Rate</div>
            <div className="text-3xl font-bold my-1">{data.finance.monthlyRate || '–'}</div>
            <div className="text-xs opacity-70">pro Monat</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernEditor;
