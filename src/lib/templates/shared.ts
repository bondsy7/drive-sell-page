import { VehicleData, ConsumptionData } from "@/types/vehicle";

export function getCO2LabelHTML(co2Class: string, darkBg = false): string {
  const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const colors = ['#3a9b42', '#4ca84a', '#6dbf47', '#b5c327', '#f5a623', '#e8651a', '#c0392b'];
  const activeIndex = classes.indexOf(co2Class.toUpperCase());
  const indicatorBg = darkBg ? '#ffffff' : '#1a1a1a';
  const indicatorColor = darkBg ? '#1a1a1a' : '#ffffff';

  return classes.map((cls, i) => {
    const w = 40 + i * 9;
    const indicator = i === activeIndex
      ? `<span style="background:${indicatorBg};color:${indicatorColor};font-size:11px;font-weight:700;padding:2px 10px 2px 14px;border-radius:2px;clip-path:polygon(8px 0,100% 0,100% 100%,8px 100%,0 50%);margin-left:6px">${cls}</span>`
      : '';
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
      <span style="display:inline-flex;align-items:center;width:${w}%;background:${colors[i]};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,0 100%);min-height:18px">${cls}</span>
      ${indicator}
    </div>`;
  }).join('');
}

export function getGalleryHTML(allImages: string[]): string {
  if (allImages.length <= 1) return '';
  return `<div class="gallery">
    ${allImages.map((img, i) => `<img src="${img}" alt="Bild ${i + 1}" class="gallery-thumb" onclick="document.getElementById('mainImg').src=this.src" />`).join('')}
  </div>`;
}

export function getConsumptionData(data: VehicleData): ConsumptionData {
  return data.consumption || {} as ConsumptionData;
}

export function buildConsumptionRows(consumption: ConsumptionData, rowClass = 'cons-row', labelClass = 'cons-label', valueClass = 'cons-value'): string {
  return [
    ['Herkunft', consumption.origin],
    ['Kilometerstand', consumption.mileage],
    ['Hubraum', consumption.displacement],
    ['Leistung', consumption.power],
    ['Antriebsart', consumption.driveType],
    ['Kraftstoffart', consumption.fuelType],
    ['Verbrauch (komb.)', consumption.consumptionCombined],
    ['CO₂-Emissionen (komb.)', consumption.co2Emissions],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="${rowClass}"><span class="${labelClass}">${l}</span><span class="${valueClass}">${v}</span></div>`).join('');
}

export function buildDetailedConsumption(consumption: ConsumptionData, rowClass = 'cons-row', labelClass = 'cons-label', valueClass = 'cons-value'): string {
  return [
    ['Kombiniert', consumption.consumptionCombined],
    ['Innenstadt', consumption.consumptionCity],
    ['Stadtrand', consumption.consumptionSuburban],
    ['Landstraße', consumption.consumptionRural],
    ['Autobahn', consumption.consumptionHighway],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="${rowClass}"><span class="${labelClass}">${l}</span><span class="${valueClass}">${v}</span></div>`).join('');
}

export function buildCostRows(consumption: ConsumptionData, rowClass = 'cons-row', labelClass = 'cons-label', valueClass = 'cons-value'): string {
  return [
    ['Energiekosten/Jahr', consumption.energyCostPerYear],
    ['Kraftstoffpreis', consumption.fuelPrice],
    ['CO₂-Kosten (mittel, 10J)', consumption.co2CostMedium],
    ['CO₂-Kosten (niedrig, 10J)', consumption.co2CostLow],
    ['CO₂-Kosten (hoch, 10J)', consumption.co2CostHigh],
    ['Kfz-Steuer', consumption.vehicleTax],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="${rowClass}"><span class="${labelClass}">${l}</span><span class="${valueClass}">${v}</span></div>`).join('');
}

export function buildFinanceItems(data: VehicleData, itemClass = 'fin-item', labelClass = 'fin-label', valueClass = 'fin-value'): string {
  return [
    ['Monatliche Rate', data.finance.monthlyRate],
    ['Anzahlung', data.finance.downPayment],
    ['Laufzeit', data.finance.duration],
    ['Jahresfahrleistung', data.finance.annualMileage],
    ['Sonderzahlung', data.finance.specialPayment],
    ['Restwert', data.finance.residualValue],
  ].filter(([, v]) => v).map(([l, v]) => `
    <div class="${itemClass}">
      <div class="${labelClass}">${l}</div>
      <div class="${valueClass}">${v}</div>
    </div>`).join('');
}

export function buildFeatures(data: VehicleData, tagClass = 'tag'): string {
  return data.vehicle.features?.map(f => `<span class="${tagClass}">${f}</span>`).join('\n') || '';
}
