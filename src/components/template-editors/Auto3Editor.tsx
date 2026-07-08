import React, { useState } from 'react';
import EditableField from '@/components/EditableField';
import CO2LabelSelector from '@/components/CO2LabelSelector';
import { Palette, RotateCcw, Plus, Trash2, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { isPluginHybrid } from '@/lib/co2-utils';
import { getFinanceSectionTitle } from '@/lib/templates/shared';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { TemplateEditorProps } from './types';

const PRESETS: Array<{ label: string; accent: string; dark: string }> = [
  { label: 'Auto3 Rot', accent: '#e30613', dark: '#111111' },
  { label: 'Petrol-Blau', accent: '#174f6b', dark: '#0f172a' },
  { label: 'Forest', accent: '#0b6b3a', dark: '#1c1c1c' },
  { label: 'Royal', accent: '#3949ab', dark: '#1a1a2e' },
  { label: 'Monochrom', accent: '#111111', dark: '#111111' },
];

const Auto3Editor: React.FC<TemplateEditorProps> = ({
  data, consumption, imageBase64, galleryImages, allImages,
  isBuyCategory, category,
  updateVehicle, updateFinance, updateDealer, updateConsumption,
  updatePower, updateFuelType, onDataChange,
  addFeature, updateFeature, removeFeature,
  dealerBanks = [],
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const colors = data.templateColors ?? { accent: '#e30613', dark: '#111111' };
  const accent = colors.accent || '#e30613';
  const dark = colors.dark || '#111111';

  const updateColors = (next: { accent?: string; dark?: string }) => {
    onDataChange({
      ...data,
      templateColors: { accent, dark, ...next },
    });
  };

  const cat = (category || '').toLowerCase();
  const isLeasing = cat.includes('leasing');
  const isFinanzierung = cat.includes('finanzierung') || cat.includes('kredit');
  const isMonthlyOffer = isLeasing || isFinanzierung;
  const sidebarPriceLabel = isLeasing ? 'Leasing ab' : isFinanzierung ? 'Finanzierung ab' : 'Fahrzeugpreis';
  const sidebarPriceValue = isMonthlyOffer ? (data.finance.monthlyRate || '') : (data.finance.totalPrice || '');
  const sidebarPriceSuffix = isMonthlyOffer ? '€/mtl.' : '€';
  const sidebarOnChange = (v: string) => updateFinance(isMonthlyOffer ? 'monthlyRate' : 'totalPrice', v);
  const mainImage = allImages[selectedImage] || allImages[0] || imageBase64;
  const features = data.vehicle.features || [];

  // Inline style helpers — use CSS variables so children inherit
  const rootStyle: React.CSSProperties = {
    ['--a3-accent' as any]: accent,
    ['--a3-dark' as any]: dark,
    fontFamily: "'Inter', system-ui, sans-serif",
    color: dark,
  };

  return (
    <div className="space-y-4">
      {/* Color controls (sticky bar) */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4" style={{ color: accent }} />
          <h3 className="text-sm font-semibold">Auto3 Farben</h3>
          <span className="text-[11px] text-muted-foreground">— Akzent & Dunkel anpassen</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <input type="color" value={accent} onChange={(e) => updateColors({ accent: e.target.value })}
              className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Akzentfarbe (CTA)</div>
              <input type="text" value={accent} onChange={(e) => updateColors({ accent: e.target.value })}
                className="w-full bg-transparent text-sm font-mono font-semibold outline-none" />
            </div>
          </label>
          <label className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <input type="color" value={dark} onChange={(e) => updateColors({ dark: e.target.value })}
              className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Dunkelton (Text / Badges)</div>
              <input type="text" value={dark} onChange={(e) => updateColors({ dark: e.target.value })}
                className="w-full bg-transparent text-sm font-mono font-semibold outline-none" />
            </div>
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => updateColors({ accent: p.accent, dark: p.dark })}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors">
              <span className="w-3 h-3 rounded-full border border-border" style={{ background: p.accent }} />
              <span className="w-3 h-3 rounded-full border border-border" style={{ background: p.dark }} />
              {p.label}
            </button>
          ))}
          <button type="button" onClick={() => updateColors({ accent: '#e30613', dark: '#111111' })}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted ml-auto">
            <RotateCcw className="w-3 h-3" /> Zurücksetzen
          </button>
        </div>
      </div>

      {/* === Visual replica of auto3 preview === */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden" style={rootStyle}>
        <div className="max-w-[1280px] mx-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
          {/* LEFT */}
          <div>
            {/* Gallery */}
            <div className="relative rounded-2xl overflow-hidden bg-[#f4f4f4]">
              {mainImage ? (
                <img src={mainImage} alt="" className="w-full aspect-[16/10] object-cover block" />
              ) : (
                <div className="aspect-[16/10] flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Upload className="w-10 h-10 opacity-50" /><span className="text-sm">Kein Bild</span>
                </div>
              )}
              {allImages.length > 1 && (
                <>
                  <button onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md"
                    disabled={selectedImage === 0}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setSelectedImage(Math.min(allImages.length - 1, selectedImage + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md"
                    disabled={selectedImage === allImages.length - 1}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className="shrink-0 w-24 h-[72px] rounded-[10px] overflow-hidden border-2 transition"
                    style={{ borderColor: i === selectedImage ? accent : 'transparent' }}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Title block */}
            <div className="mt-6">
              <h1 className="text-[28px] font-bold leading-tight" style={{ color: dark }}>
                <EditableField
                  value={`${data.vehicle.brand} ${data.vehicle.model}`}
                  onChange={(v) => { const parts = v.split(' '); updateVehicle('brand', parts[0] || ''); updateVehicle('model', parts.slice(1).join(' ') || ''); }}
                  className="text-[28px] font-bold"
                />
              </h1>
              <EditableField value={data.vehicle.variant || ''} onChange={(v) => updateVehicle('variant', v)}
                className="text-sm text-gray-500 mt-1" />
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 mt-5 border border-[#eaeaea] rounded-xl px-5 py-4">
              {[
                { label: 'Fahrzeugtyp', value: data.vehicle.bodyType || '', onChange: (v: string) => updateVehicle('bodyType' as any, v) },
                { label: 'Getriebe', value: data.vehicle.transmission || '', onChange: (v: string) => updateVehicle('transmission', v) },
                { label: 'Leistung', value: data.vehicle.power || '', onChange: updatePower },
                { label: 'Kraftstoff', value: data.vehicle.fuelType || '', onChange: updateFuelType },
                { label: 'Kilometerstand', value: consumption.mileage || '', onChange: (v: string) => updateConsumption('mileage', v), suffix: 'km' },
                { label: 'Erstzulassung', value: String(data.vehicle.year || ''), onChange: (v: string) => updateVehicle('year', v as any) },
              ].map((s) => (
                <div key={s.label} className="py-2.5 px-1.5">
                  <div className="text-[10px] uppercase tracking-[1px] text-gray-400 font-semibold">{s.label}</div>
                  <EditableField value={s.value} onChange={s.onChange} suffix={s.suffix}
                    className="text-sm font-semibold mt-1" />
                </div>
              ))}
            </div>

            {/* Equipment */}
            <div className="mt-7">
              <h2 className="text-lg font-bold mb-3.5" style={{ color: dark }}>Ausstattung</h2>
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span key={i}
                    className="group inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.5px] text-white px-3 py-1.5 rounded-full"
                    style={{ background: dark }}>
                    <EditableField value={f} onChange={(v) => updateFeature(i, v)} className="text-white text-[11px]" />
                    <button onClick={() => removeFeature(i)} className="opacity-0 group-hover:opacity-100 text-white/80 hover:text-white">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button onClick={addFeature}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
                  <Plus className="w-3 h-3" /> Hinzufügen
                </button>
              </div>
            </div>

            {/* Consumption */}
            <div className="mt-7">
              <h2 className="text-lg font-bold mb-3.5" style={{ color: dark }}>Verbrauch & Umwelt</h2>
              <div className="border border-[#eaeaea] rounded-xl px-5 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-0">
                    {[
                      { l: 'CO₂-Emissionen (komb.)', v: consumption.co2Emissions, on: (v: string) => updateConsumption('co2Emissions', v), s: 'g/km' },
                      { l: 'Verbrauch (komb.)', v: consumption.consumptionCombined, on: (v: string) => updateConsumption('consumptionCombined', v), s: 'l/100 km' },
                      { l: 'Innenstadt', v: consumption.consumptionCity, on: (v: string) => updateConsumption('consumptionCity', v), s: 'l/100 km' },
                      { l: 'Stadtrand', v: consumption.consumptionSuburban, on: (v: string) => updateConsumption('consumptionSuburban', v), s: 'l/100 km' },
                      { l: 'Landstraße', v: consumption.consumptionRural, on: (v: string) => updateConsumption('consumptionRural', v), s: 'l/100 km' },
                      { l: 'Autobahn', v: consumption.consumptionHighway, on: (v: string) => updateConsumption('consumptionHighway', v), s: 'l/100 km' },
                    ].map((r) => (
                      <div key={r.l} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-[13px]">
                        <span className="text-gray-600">{r.l}</span>
                        <EditableField value={r.v} onChange={r.on} suffix={r.s} className="text-[13px] font-semibold" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center">
                    <CO2LabelSelector
                      consumption={consumption}
                      onClassChange={(c) => updateConsumption('co2Class', c)}
                      onDischargedClassChange={isPluginHybrid(consumption) ? (c) => updateConsumption('co2ClassDischarged', c) : undefined}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Finance section */}
            <div className="mt-7">
              <h2 className="text-lg font-bold mb-3.5" style={{ color: dark }}>{getFinanceSectionTitle(data)}</h2>
              <div className="border border-[#eaeaea] rounded-xl px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <FinItem label={isLeasing ? 'Leasingpreis' : 'Gesamtpreis'} value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} suffix="€" sup={!isBuyCategory} />
                {!isBuyCategory && (
                  <>
                    <FinItem label="Rate" value={data.finance.monthlyRate || ''} onChange={(v) => updateFinance('monthlyRate', v)} suffix="€" sup />
                    <FinItem label="Laufzeit" value={data.finance.duration || ''} onChange={(v) => updateFinance('duration', v)} suffix="Monate" />
                    {isLeasing ? (
                      <>
                        <FinItem label="Sonderzahlung" value={data.finance.specialPayment || ''} onChange={(v) => updateFinance('specialPayment', v)} suffix="€" />
                        <FinItem label="Fahrleistung" value={data.finance.annualMileage || ''} onChange={(v) => updateFinance('annualMileage', v)} suffix="km/Jahr" />
                      </>
                    ) : (
                      <>
                        <FinItem label="Anzahlung" value={data.finance.downPayment || ''} onChange={(v) => updateFinance('downPayment', v)} suffix="€" />
                        <FinItem label="Schlussrate" value={data.finance.residualValue || ''} onChange={(v) => updateFinance('residualValue', v)} suffix="€" />
                      </>
                    )}
                    <FinItem label="Eff. Jahreszins" value={data.finance.interestRate || ''} onChange={(v) => updateFinance('interestRate', v)} suffix="%" />
                  </>
                )}
              </div>
            </div>

            {/* Bankangaben / Pflichthinweis */}
            {(() => {
              const isFinanzierung = cat.includes('finanzierung') || cat.includes('kredit');
              const legalKey: 'leasingLegalText' | 'financingLegalText' | 'defaultLegalText' =
                isLeasing ? 'leasingLegalText' : isFinanzierung ? 'financingLegalText' : 'defaultLegalText';
              const bankKey: 'leasingBank' | 'financingBank' | null =
                isLeasing ? 'leasingBank' : isFinanzierung ? 'financingBank' : null;
              const filterType = isLeasing ? 'leasing' : isFinanzierung ? 'financing' : null;
              const banks = filterType ? dealerBanks.filter(b => b.bank_type === filterType) : dealerBanks;
              const value = (data.dealer as any)[legalKey] || '';
              const isEmpty = !value.trim();
              return (
                <div className="mt-7 pt-6 border-t border-[#eaeaea]">
                  <div className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: dark }}>
                    Bankangaben / Pflichthinweis
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded">Pflichtfeld</span>
                  </div>
                  {banks.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      <label className="text-xs text-gray-500">Gespeicherte Banktexte</label>
                      <Select
                        value=""
                        onValueChange={(bankId) => {
                          const bank = banks.find(b => b.id === bankId);
                          if (!bank) return;
                          if (bankKey) updateDealer(bankKey, bank.bank_name);
                          updateDealer(legalKey, bank.legal_text);
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm bg-white">
                          <SelectValue placeholder="Banktext aus Profil wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {banks.map(bank => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.bank_name} ({bank.bank_type === 'leasing' ? 'Leasing' : 'Finanzierung'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="relative">
                    {!isBuyCategory && <span className="absolute top-3 left-3 text-xs font-bold text-gray-700 select-none"><sup>1</sup></span>}
                    <textarea
                      value={value}
                      onChange={(e) => updateDealer(legalKey, e.target.value)}
                      className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3 pl-6 min-h-[80px] resize-y focus:outline-none focus:ring-2"
                      style={{ ['--tw-ring-color' as any]: accent }}
                      placeholder="Ihre Bankangaben und Pflichthinweise eintragen..."
                    />
                  </div>
                  {isEmpty && (
                    <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium mt-2">
                      <span className="text-base">⚠</span>
                      Pflichtfeld – Bankangaben müssen ausgefüllt sein
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Dealer */}
            <div className="mt-7 pt-6 border-t border-[#eaeaea] grid grid-cols-1 sm:grid-cols-2 gap-6 text-[13px] text-gray-600 leading-[1.8]">
              <div>
                {data.dealer.logoUrl && (
                  <img src={data.dealer.logoUrl} alt={data.dealer.name} style={{ maxHeight: 48, marginBottom: 8 }} />
                )}
                <EditableField value={data.dealer.name} onChange={(v) => updateDealer('name', v)}
                  className="block text-[15px] font-bold mb-1" />
                <EditableField value={data.dealer.address} onChange={(v) => updateDealer('address', v)} className="block" />
                <EditableField value={data.dealer.phone} onChange={(v) => updateDealer('phone', v)} className="block" />
                <EditableField value={data.dealer.email} onChange={(v) => updateDealer('email', v)} className="block" />
                <EditableField value={data.dealer.website} onChange={(v) => updateDealer('website', v)} className="block" />
              </div>
            </div>
          </div>

          {/* RIGHT — Aside cards */}
          <aside className="space-y-5">
            <div className="bg-white border border-[#eaeaea] rounded-[14px] p-5 shadow-[0_2px_14px_rgba(0,0,0,.04)]">
              <h4 className="text-[13px] font-bold mb-1.5" style={{ color: dark }}>Mehr Angebote</h4>
              <div className="text-[12px] text-gray-500 mb-3">{isBuyCategory ? 'Kaufpreis-Angebot' : 'Wähle Deine Finanzierungsart'}</div>
              {!isBuyCategory && (
                <div className="flex gap-1.5 bg-gray-100 rounded-[10px] p-1 mb-3.5">
                  <span className={`flex-1 text-center py-2 text-[12px] font-semibold rounded-[7px] ${isLeasing ? 'text-white' : 'text-gray-500 cursor-pointer'}`} style={isLeasing ? { background: dark } : undefined}>Leasing</span>
                  <span className={`flex-1 text-center py-2 text-[12px] font-semibold rounded-[7px] ${!isLeasing ? 'text-white' : 'text-gray-500 cursor-pointer'}`} style={!isLeasing ? { background: dark } : undefined}>Kauf / Finanzierung</span>
                </div>
              )}
              <div className="flex justify-between items-baseline my-2">
                <span className="text-[13px] text-gray-600 font-medium">{sidebarPriceLabel}</span>
                <span className="inline-flex items-baseline">
                  <EditableField value={sidebarPriceValue || '–'} onChange={sidebarOnChange}
                    suffix={sidebarPriceSuffix} className="text-[26px] font-extrabold" />
                  {sidebarPriceValue && !isBuyCategory && <sup className="text-[11px] font-bold ml-0.5" style={{ color: dark }}>1</sup>}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 text-right">
                <EditableField
                  value={data.finance.vatNote || 'inkl. MwSt.'}
                  onChange={(v) => updateFinance('vatNote', v)}
                  className="text-[11px] text-gray-400 inline"
                />
              </div>
              {isMonthlyOffer && data.finance.totalPrice && (
                <div className="text-[12px] text-gray-500 mt-1 text-right">
                  Gesamtpreis: <EditableField value={data.finance.totalPrice} onChange={(v) => updateFinance('totalPrice', v)} suffix="€" className="font-semibold inline" />
                </div>
              )}
            </div>

            <div className="bg-white border border-[#eaeaea] rounded-[14px] p-5 shadow-[0_2px_14px_rgba(0,0,0,.04)]">
              <h4 className="text-[13px] font-bold mb-3" style={{ color: dark }}>Fahrzeuganfrage</h4>
              {[
                { label: 'Vorname*', type: 'text' },
                { label: 'Nachname*', type: 'text' },
                { label: 'E-Mail-Adresse*', type: 'email' },
                { label: 'Telefonnummer*', type: 'tel' },
              ].map((f) => (
                <div key={f.label} className="mb-3">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-[.5px]">{f.label}</label>
                  <input type={f.type} disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] bg-gray-50 cursor-not-allowed" />
                </div>
              ))}
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-[.5px]">Ihre Nachricht (optional)</label>
                <textarea disabled
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] bg-gray-50 cursor-not-allowed min-h-[96px] resize-y"
                  defaultValue={`Hallo,\nich interessiere mich für das angebotene Fahrzeug ${data.vehicle.brand} ${data.vehicle.model} und bitte um weitere Informationen.\nMit freundlichen Grüßen`} />
              </div>
              <button className="block w-full text-center font-bold text-sm py-3.5 rounded-[10px] text-white"
                style={{ background: accent }}>Senden</button>
              {data.dealer.phone && (
                <button className="block w-full text-center font-bold text-sm py-3.5 rounded-[10px] mt-2.5 bg-transparent border-2"
                  style={{ color: accent, borderColor: accent }}>Anrufen</button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const FinItem: React.FC<{ label: string; value: string; onChange: (v: string) => void; suffix?: string; sup?: boolean }> = ({ label, value, onChange, suffix, sup }) => (
  <div className="bg-[#f7f7f7] rounded-[10px] p-3">
    <div className="text-[10px] text-gray-500 uppercase tracking-[.5px] font-semibold">{label}</div>
    <div className="inline-flex items-baseline">
      <EditableField value={value} onChange={onChange} suffix={suffix} className="text-sm font-bold mt-0.5" />
      {sup && value && <sup className="text-[8px] font-bold ml-0.5 text-gray-700">1</sup>}
    </div>
  </div>
);

export default Auto3Editor;
