import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import EditableField from '@/components/EditableField';
import CO2LabelSelector from '@/components/CO2LabelSelector';
import FuelTypeDropdown from '@/components/FuelTypeDropdown';
import CategoryDropdown from '@/components/CategoryDropdown';
import LeasingDurationDropdown from '@/components/LeasingDurationDropdown';
import AnnualMileageDropdown from '@/components/AnnualMileageDropdown';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Car, Cog, Zap, Fuel, Gauge, Calendar,
  MapPin, Phone, Mail, Globe,
  Plus, Trash2, ChevronLeft, ChevronRight,
  Calculator, Loader2, Search, Upload, Pencil, Code,
} from 'lucide-react';
import { isPluginHybrid } from '@/lib/co2-utils';
import { getFinanceSectionTitle, calculateLeasingFactor } from '@/lib/templates/shared';
import type { TemplateEditorProps } from './types';

/* ─── small helpers ─── */
const ConsumptionRow: React.FC<{
  label: string; value: string; onChange: (v: string) => void; suffix?: string;
}> = ({ label, value, onChange, suffix }) => (
  <div className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <EditableField value={value} onChange={onChange} className="text-sm font-semibold text-foreground" suffix={suffix} />
  </div>
);

const SpecCell: React.FC<{
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void;
}> = ({ icon, label, value, onChange }) => (
  <div className="flex items-start gap-2 py-2">
    <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
    <div className="flex flex-col min-w-0">
      <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
      <EditableField value={value} onChange={onChange} className="text-sm font-bold text-foreground" />
    </div>
  </div>
);

const OrangeButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }> = ({
  children, className = '', ...props
}) => (
  <button
    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors ${className}`}
    {...props}
  >
    {children}
  </button>
);

/** Tech data row – always visible in editor, shows "-" placeholder when empty */
const TechDataRow: React.FC<{
  label: string; value: string; onChange: (v: string) => void; suffix?: string;
}> = ({ label, value, onChange, suffix }) => (
  <div className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <EditableField
      value={value || '-'}
      onChange={(v) => onChange(v === '-' ? '' : v)}
      className={`text-sm font-semibold ${value && value !== '-' ? 'text-foreground' : 'text-muted-foreground/50'}`}
      suffix={suffix}
    />
  </div>
);

/* ─── main component ─── */
const AutohausEditor: React.FC<TemplateEditorProps> = ({
  data, consumption, imageBase64, galleryImages, allImages,
  isBuyCategory, category,
  updateVehicle, updateFinance, updateDealer, updateConsumption,
  updatePower, updateFuelType, onDataChange,
  recalculateRate, calculateCosts, costCalculating, costMissingFields,
  addFeature, updateFeature, removeFeature, vinLookup,
  dealerBanks = [],
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const cat = category.toLowerCase();
  const isLeasing = cat.includes('leasing');
  const relevantBanks = dealerBanks.filter(b => b.bank_type === (isLeasing ? 'leasing' : 'financing'));

  return (
    <div className="flex gap-6 items-start w-full">
      {/* ════════ LEFT: MAIN CONTENT ════════ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* ── HERO IMAGE ── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="relative">
            {/* Category badge */}
            <div className="absolute top-4 left-4 z-10">
              <CategoryDropdown
                value={data.category || ''}
                onChange={(v) => onDataChange({ ...data, category: v })}
              />
            </div>

            {allImages.length > 0 ? (
              <div className="relative bg-muted/30">
                <img
                  src={allImages[selectedImage] || allImages[0]}
                  alt={`${data.vehicle.brand} ${data.vehicle.model}`}
                  className="w-full max-h-[600px] object-cover mx-auto block"
                />
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md"
                      disabled={selectedImage === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedImage(Math.min(allImages.length - 1, selectedImage + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md"
                      disabled={selectedImage === allImages.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full aspect-[4/3] bg-muted flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Upload className="w-10 h-10 opacity-50" />
                <span className="text-sm">Eigene Fahrzeugbilder hochladen · Thumbnail hover → zum Entfernen</span>
              </div>
            )}
          </div>

          {/* Gallery thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto bg-muted/30 border-t border-border/40">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === selectedImage ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>


        {/* ── ACCORDION SECTIONS ── */}
        <Accordion type="multiple" defaultValue={['description', 'features', 'consumption', 'techdata', 'finance']} className="space-y-3">

          {/* ── FAHRZEUGBESCHREIBUNG ── */}
          <AccordionItem value="description" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
            <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">
              Fahrzeugbeschreibung
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <textarea
                value={data.vehicle.description || ''}
                onChange={(e) => onDataChange({ ...data, vehicle: { ...data.vehicle, description: e.target.value } })}
                className="w-full text-sm text-foreground bg-muted/30 border border-border rounded-xl p-3 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Beschreibung des Fahrzeugs (2-3 Sätze)..."
              />
            </AccordionContent>
          </AccordionItem>

          {/* ── AUSSTATTUNG ── */}
          <AccordionItem value="features" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
            <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">
              Ausstattung
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="flex items-center gap-2 mb-3">
                <OrangeButton onClick={addFeature}>
                  <Pencil className="w-3 h-3" /> Felder bearbeiten
                </OrangeButton>
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.vehicle.features || []).map((f, i) => (
                  <span key={i} className="group text-[11px] leading-none border border-border bg-muted/60 text-foreground px-3.5 py-2 rounded-full inline-flex items-center gap-1.5 hover:bg-muted transition-colors">
                    <EditableField value={f} onChange={(v) => updateFeature(i, v)} className="text-foreground" />
                    <button onClick={() => removeFeature(i)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {(!data.vehicle.features || data.vehicle.features.length === 0) && (
                  <span className="text-xs text-muted-foreground">Keine Ausstattung vorhanden.</span>
                )}
              </div>
              <button onClick={addFeature} className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Hinzufügen
              </button>
            </AccordionContent>
          </AccordionItem>

          {/* ── VERBRAUCH & UMWELT ── */}
          <AccordionItem value="consumption" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">Verbrauch & Umwelt</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5 rounded">Pflicht</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <OrangeButton onClick={calculateCosts} disabled={costCalculating}>
                  {costCalculating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calculator className="w-3 h-3" />}
                  Verbrauchen
                </OrangeButton>
                <OrangeButton>
                  <Pencil className="w-3 h-3" /> Felder anklicken
                </OrangeButton>
              </div>


              {/* Consumption (WLTP) */}
              <div>
                <div className="text-xs font-semibold text-foreground mb-2">Kraftstoffverbrauch (WLTP)</div>
                <div className="grid grid-cols-2 gap-x-6">
                  <ConsumptionRow label="Kombiniert" value={consumption.consumptionCombined} onChange={(v) => updateConsumption('consumptionCombined', v)} suffix="l/100 km" />
                  <ConsumptionRow label="Innenstadt" value={consumption.consumptionCity} onChange={(v) => updateConsumption('consumptionCity', v)} suffix="l/100 km" />
                  <ConsumptionRow label="Stadtrand" value={consumption.consumptionSuburban} onChange={(v) => updateConsumption('consumptionSuburban', v)} suffix="l/100 km" />
                  <ConsumptionRow label="Landstraße" value={consumption.consumptionRural} onChange={(v) => updateConsumption('consumptionRural', v)} suffix="l/100 km" />
                  <ConsumptionRow label="Autobahn" value={consumption.consumptionHighway} onChange={(v) => updateConsumption('consumptionHighway', v)} suffix="l/100 km" />
                </div>
                {isPluginHybrid(consumption) && (
                  <div className="mt-2 grid grid-cols-2 gap-x-6">
                    <ConsumptionRow label="Verbrauch (komb., entladen)" value={consumption.consumptionCombinedDischarged} onChange={(v) => updateConsumption('consumptionCombinedDischarged', v)} suffix="l/100 km" />
                    <ConsumptionRow label="CO₂ (entladen)" value={consumption.co2EmissionsDischarged} onChange={(v) => updateConsumption('co2EmissionsDischarged', v)} suffix="g/km" />
                    <ConsumptionRow label="Stromverbrauch (komb.)" value={consumption.consumptionElectric} onChange={(v) => updateConsumption('consumptionElectric', v)} suffix="kWh/100 km" />
                    <ConsumptionRow label="Elektr. Reichweite" value={consumption.electricRange} onChange={(v) => updateConsumption('electricRange', v)} suffix="km" />
                  </div>
                )}
              </div>

              {/* EnVKV costs */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  ENVKV-PFLICHTANGABEN (§1 PKW-ENVKV)
                </div>
                <ConsumptionRow label="Hubraum (für Steuerberechnung)" value={consumption.displacement} onChange={(v) => updateConsumption('displacement', v)} suffix="cm³" />
                <ConsumptionRow label="Energiekosten (15.000 km/Jahr)" value={consumption.energyCostPerYear} onChange={(v) => updateConsumption('energyCostPerYear', v)} suffix="€" />
                <ConsumptionRow label="Kraftfahrzeugsteuer (€/Jahr)" value={consumption.vehicleTax} onChange={(v) => updateConsumption('vehicleTax', v)} suffix="€" />
                <ConsumptionRow label="CO₂-Kosten über 10 Jahre (€)" value={consumption.co2CostMedium} onChange={(v) => updateConsumption('co2CostMedium', v)} suffix="€" />
              </div>

              {costMissingFields.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-xs font-semibold text-destructive mb-1">Fehlende Pflichtangaben:</p>
                  <ul className="text-xs text-destructive/80 list-disc list-inside">
                    {costMissingFields.map(f => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              )}

              {/* CO2 label graphic */}
              <div>
                <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  Effizienzklassen-Grafik
                  <OrangeButton>
                    <Pencil className="w-3 h-3" /> Klasse wählen
                  </OrangeButton>
                </div>
                <CO2LabelSelector
                  consumption={consumption}
                  onClassChange={(cls) => updateConsumption('co2Class', cls)}
                  onDischargedClassChange={isPluginHybrid(consumption) ? (cls) => updateConsumption('co2ClassDischarged', cls) : undefined}
                />
              </div>

              {/* Legal Pflichtangaben text */}
              <div className="bg-[hsl(213,50%,95%)] border border-[hsl(213,40%,78%)] rounded-xl p-4 text-xs text-[hsl(220,55%,23%)] leading-relaxed">
                <div className="font-bold mb-1">Pflichtangaben nach Pkw-EnVKV (Anlage 4):</div>
                <p>Die angegebenen Werte wurden nach dem vorgeschriebenen WLTP-Messverfahren (Worldwide Harmonised Light Vehicle Test Procedure) ermittelt.</p>
                <p className="mt-1">Weitere Informationen zum offiziellen Kraftstoffverbrauch und den offiziellen spezifischen CO₂-Emissionen neuer Personenkraftwagen können dem „Leitfaden über den Kraftstoffverbrauch, die CO₂-Emissionen und den Stromverbrauch neuer Personenkraftwagen" entnommen werden, der an allen Verkaufsstellen und bei der <strong>Deutschen Automobil Treuhand GmbH (DAT)</strong> unentgeltlich erhältlich ist.</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── TECHNISCHE DATEN (extended) ── */}
          <AccordionItem value="techdata" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
            <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">
              Technische Daten
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <p className="text-[10px] text-muted-foreground mb-3">Felder mit „-" werden in der HTML-Ausgabe nicht angezeigt. Klicken um Werte einzutragen.</p>
              <div className="grid grid-cols-2 gap-x-6">
                {/* Power – special handling for kW/PS */}
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-sm text-muted-foreground">Leistung</span>
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                    <EditableField
                      value={(() => { const m = consumption.power?.match(/^([\d.,]+)/); return m ? m[1] : consumption.power || '-'; })()}
                      onChange={(v) => { const kw = parseFloat(v.replace(',', '.')); const ps = isNaN(kw) ? '' : String(Math.round(kw * 1.36)); updatePower(v && !isNaN(kw) ? `${v} kW (${ps} PS)` : v === '-' ? '' : v); }}
                      className="text-sm font-semibold text-foreground"
                      suffix="kW"
                    />
                    {(() => { const m = consumption.power?.match(/^([\d.,]+)/); const kw = m ? parseFloat(m[1].replace(',', '.')) : NaN; return !isNaN(kw) ? <span className="text-xs text-muted-foreground ml-1">({Math.round(kw * 1.36)} PS)</span> : null; })()}
                  </span>
                </div>
                <TechDataRow label="HSN / TSN" value={consumption.hsnTsn || ''} onChange={(v) => updateConsumption('hsnTsn', v)} />
                <TechDataRow label="Elektromotor Max. Leistung" value={consumption.electricMotorPower || ''} onChange={(v) => updateConsumption('electricMotorPower', v)} />
                <TechDataRow label="Elektromotor Max. Drehmoment" value={consumption.electricMotorTorque || ''} onChange={(v) => updateConsumption('electricMotorTorque', v)} suffix="Nm" />
                <TechDataRow label="Getriebeart" value={consumption.gearboxType || data.vehicle.transmission || ''} onChange={(v) => updateConsumption('gearboxType', v)} />
                <TechDataRow label="Antriebsart" value={consumption.driveType} onChange={(v) => updateConsumption('driveType', v)} />
                <TechDataRow label="Höchstgeschwindigkeit" value={consumption.topSpeed || ''} onChange={(v) => updateConsumption('topSpeed', v)} suffix="km/h" />
                <TechDataRow label="Beschleunigung 0-100 km/h" value={consumption.acceleration || ''} onChange={(v) => updateConsumption('acceleration', v)} suffix="s" />
                <TechDataRow label="Leergewicht" value={consumption.curbWeight || ''} onChange={(v) => updateConsumption('curbWeight', v)} suffix="kg" />
                <TechDataRow label="Zulässiges Gesamtgewicht" value={consumption.grossWeight || ''} onChange={(v) => updateConsumption('grossWeight', v)} suffix="kg" />
                <TechDataRow label="Hubraum" value={consumption.displacement} onChange={(v) => updateConsumption('displacement', v)} suffix="cm³" />
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-sm text-muted-foreground">Kraftstoffart</span>
                  <FuelTypeDropdown value={consumption.fuelType} onChange={updateFuelType} />
                </div>
                <TechDataRow label="Herkunft" value={consumption.origin} onChange={(v) => updateConsumption('origin', v)} />
                <TechDataRow label="Kilometerstand" value={consumption.mileage} onChange={(v) => updateConsumption('mileage', v)} suffix="km" />
                <TechDataRow label="Farbe / Lackierung" value={consumption.paintColor || data.vehicle.color || ''} onChange={(v) => updateConsumption('paintColor', v)} />
                <TechDataRow label="Fahrzeuggarantie" value={consumption.warranty || ''} onChange={(v) => updateConsumption('warranty', v)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── FINANZIERUNGSKONDITIONEN ── */}
          <AccordionItem value="finance" className="bg-card rounded-2xl border border-border px-5 overflow-hidden">
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">{getFinanceSectionTitle(data)}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5">

              {/* Rate highlight card */}
              {!isBuyCategory && data.finance.monthlyRate && (
                <div className="bg-foreground text-background rounded-2xl p-6">
                  <div className="text-xs font-medium opacity-60 mb-1">Monatliche Rate</div>
                  <div className="flex items-baseline gap-2">
                    <EditableField
                      value={data.finance.monthlyRate}
                      onChange={(v) => updateFinance('monthlyRate', v)}
                      className="text-3xl font-bold text-background"
                      suffix="€"
                    />
                  </div>
                  <div className="text-xs opacity-60 mt-1">inkl. MwSt.</div>
                </div>
              )}

              {/* Finance details grid */}
              <div className="grid grid-cols-2 gap-4">
                {!isBuyCategory && (
                  <>
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">Laufzeit</div>
                      <LeasingDurationDropdown value={data.finance.duration} onChange={(v) => updateFinance('duration', v)} />
                    </div>
                    {isLeasing ? (
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground">Sonderzahlung</div>
                        <EditableField value={data.finance.specialPayment || ''} onChange={(v) => updateFinance('specialPayment', v)} className="text-lg font-bold text-foreground" suffix="€" />
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground">Anzahlung</div>
                        <EditableField value={data.finance.downPayment || ''} onChange={(v) => updateFinance('downPayment', v)} className="text-lg font-bold text-foreground" suffix="€" />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Additional finance rows */}
              <div className="space-y-0">
                {!isBuyCategory && (
                  <>
                    <ConsumptionRow label="Gesamtpreis" value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} suffix="€" />
                    {isLeasing ? (
                      <>
                        <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                          <span className="text-xs text-muted-foreground">Jahresfahrleistung</span>
                          <AnnualMileageDropdown value={data.finance.annualMileage || ''} onChange={(v) => updateFinance('annualMileage', v)} className="w-[160px]" />
                        </div>
                        <ConsumptionRow label="Restwert" value={data.finance.residualValue || ''} onChange={(v) => updateFinance('residualValue', v)} suffix="€" />
                      </>
                    ) : (
                      <ConsumptionRow label="Schlussrate" value={data.finance.residualValue || ''} onChange={(v) => updateFinance('residualValue', v)} suffix="€" />
                    )}
                    <ConsumptionRow label="Effektiver Jahreszins" value={data.finance.interestRate || ''} onChange={(v) => updateFinance('interestRate', v)} suffix="%" />
                  </>
                )}
                {isBuyCategory && (
                  <ConsumptionRow label="Fahrzeugpreis" value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} suffix="€" />
                )}
              </div>

              {/* Leasing factor */}
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

              {/* Bank & Legal */}
              {!isBuyCategory && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    Bankangaben / Pflichthinweis
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5 rounded">Pflichtfeld</span>
                  </div>

                  {/* Bank selector dropdown */}
                  {relevantBanks.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">{isLeasing ? 'Leasing-Bank' : 'Finanzierungs-Bank'} wählen</label>
                      <Select
                        value={isLeasing ? (data.dealer.leasingBank || '') : (data.dealer.financingBank || '')}
                        onValueChange={(bankId) => {
                          const bank = relevantBanks.find(b => b.bank_name === bankId);
                          if (bank) {
                            if (isLeasing) {
                              updateDealer('leasingBank', bank.bank_name);
                              updateDealer('leasingLegalText', bank.legal_text);
                            } else {
                              updateDealer('financingBank', bank.bank_name);
                              updateDealer('financingLegalText', bank.legal_text);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Bank auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {relevantBanks.map(bank => (
                            <SelectItem key={bank.id} value={bank.bank_name || bank.id}>
                              {bank.bank_name || '(kein Name)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <textarea
                    value={isLeasing ? (data.dealer.leasingLegalText || '') : (data.dealer.financingLegalText || '')}
                    onChange={(e) => updateDealer(isLeasing ? 'leasingLegalText' : 'financingLegalText', e.target.value)}
                    className="w-full text-sm text-foreground bg-muted/30 border border-border rounded-xl p-3 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Ihre Bankangaben und Pflichthinweise eintragen..."
                  />
                  <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                    <span className="text-base">⚠</span>
                    Pflichtfeld – Bankangaben müssen ausgefüllt sein
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* ════════ RIGHT: STICKY SIDEBAR ════════ */}
      <div className="w-[360px] shrink-0 sticky top-4 hidden lg:block">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {/* Vehicle header */}
          <div className="p-5 border-b border-border/60">
            <h2 className="font-display text-lg font-bold text-foreground leading-tight">
              {data.vehicle.brand} {data.vehicle.model} {data.vehicle.variant || ''}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
              {data.category || 'Angebot'} · {data.vehicle.color || ''}
            </p>

            {/* Internal number */}
            <input
              type="text"
              placeholder="Interne Fahrzeugnummer eingeben..."
              value={data.vehicle.vin || ''}
              onChange={(e) => updateVehicle('vin', e.target.value)}
              className="mt-3 w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Price */}
          <div className="p-5 border-b border-border/60">
            <div className="flex items-baseline gap-1">
              <EditableField
                value={isBuyCategory ? data.finance.totalPrice : (data.finance.monthlyRate || data.finance.totalPrice)}
                onChange={(v) => updateFinance(isBuyCategory ? 'totalPrice' : 'monthlyRate', v)}
                className="text-2xl font-bold text-foreground"
                suffix="€"
              />
              {!isBuyCategory && <span className="text-sm text-muted-foreground">/ Monat <sup>1</sup></span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fahrzeugpreis: <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} className="text-xs text-muted-foreground inline" suffix="€ inkl. MwSt." />
            </p>
          </div>

          {/* Specs grid */}
          <div className="p-5 border-b border-border/60">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <SpecCell icon={<Car className="w-3.5 h-3.5" />} label="Fahr.typ" value={`${data.vehicle.brand} ${data.vehicle.model}`.substring(0, 15)} onChange={(v) => updateVehicle('model', v)} />
              <SpecCell icon={<Cog className="w-3.5 h-3.5" />} label="Getriebe" value={consumption.gearboxType || data.vehicle.transmission} onChange={(v) => updateVehicle('transmission', v)} />
              <SpecCell icon={<Calendar className="w-3.5 h-3.5" />} label="Zustand" value={data.category || 'Neufahrzeug'} onChange={(v) => onDataChange({ ...data, category: v })} />
              <SpecCell icon={<Zap className="w-3.5 h-3.5" />} label="Leistung" value={data.vehicle.power || ''} onChange={updatePower} />
              <SpecCell icon={<Fuel className="w-3.5 h-3.5" />} label="Kraftstoff" value={data.vehicle.fuelType} onChange={updateFuelType} />
              <SpecCell icon={<Gauge className="w-3.5 h-3.5" />} label="Kilometer" value={consumption.mileage || '0'} onChange={(v) => updateConsumption('mileage', v)} />
            </div>
          </div>

          {/* Contact form section */}
          <div className="p-5 border-b border-border/60">
            <h3 className="text-sm font-semibold mb-3">Kontaktformular</h3>
            <div className="bg-muted/40 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-dashed border-border">
              <Code className="w-8 h-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs font-semibold text-foreground mb-1">Eigenes Formular einbetten</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Klicken, um Ihren Formular-Code (iframe, HubSpot, TypeForm u.ä.) einzufügen.
              </p>
              <OrangeButton className="mt-3 text-[10px]">
                Code einfügen
              </OrangeButton>
            </div>
          </div>

          {/* Dealer info */}
          <div className="p-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div>
                  <EditableField value={data.dealer.name} onChange={(v) => updateDealer('name', v)} className="font-semibold text-foreground text-sm" />
                  <EditableField value={data.dealer.address} onChange={(v) => updateDealer('address', v)} className="text-xs text-muted-foreground" />
                </div>
              </div>
              {data.dealer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <EditableField value={data.dealer.phone} onChange={(v) => updateDealer('phone', v)} className="text-foreground text-sm" />
                </div>
              )}
              {data.dealer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <EditableField value={data.dealer.email} onChange={(v) => updateDealer('email', v)} className="text-foreground text-sm" />
                </div>
              )}
              {data.dealer.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <EditableField value={data.dealer.website} onChange={(v) => updateDealer('website', v)} className="text-foreground text-sm" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutohausEditor;
