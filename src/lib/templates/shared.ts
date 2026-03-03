import { VehicleData, ConsumptionData } from "@/types/vehicle";
import { getCO2ClassFromEmissions, getCO2LabelPath, isPluginHybrid } from "@/lib/co2-utils";

/**
 * Converts a public image path to a base64 data URL for embedding in exported HTML.
 */
async function imageToBase64(path: string): Promise<string> {
  try {
    const resp = await fetch(path);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/**
 * Get the CO2 label as an <img> tag with base64-embedded image for HTML export.
 * Automatically picks PHEV dual-class or standard label.
 */
export async function getCO2LabelImgHTML(consumption: ConsumptionData): Promise<string> {
  const path = getCO2LabelPath(consumption);
  const base64 = await imageToBase64(path);
  if (!base64) return `<div style="font-size:12px;font-weight:600">CO₂-Klasse</div>`;
  return `<img src="${base64}" alt="CO₂-Klasse" style="max-width:280px;width:100%;height:auto" />`;
}

/** Synchronous version using direct path (for iframe preview) */
export function getCO2LabelHTML(consumption: ConsumptionData): string {
  const path = getCO2LabelPath(consumption);
  return `<img src="${path}" alt="CO₂-Klasse" style="max-width:280px;width:100%;height:auto" />`;
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

export function determineCO2Class(consumption: ConsumptionData): string {
  if (consumption.co2Class) return consumption.co2Class;
  const derived = getCO2ClassFromEmissions(consumption.co2Emissions);
  return derived || 'A';
}

export function buildConsumptionRows(consumption: ConsumptionData, rowClass = 'cons-row', labelClass = 'cons-label', valueClass = 'cons-value'): string {
  const rows = [
    ['Herkunft', consumption.origin],
    ['Kilometerstand', consumption.mileage],
    ['Hubraum', consumption.displacement],
    ['Leistung', consumption.power],
    ['Antriebsart', consumption.driveType],
    ['Kraftstoffart', consumption.fuelType],
    ['Verbrauch (komb.)', consumption.consumptionCombined],
    ['CO₂-Emissionen (komb.)', consumption.co2Emissions],
  ];

  // Add PHEV-specific rows
  if (isPluginHybrid(consumption)) {
    if (consumption.consumptionCombinedDischarged) {
      rows.push(['Verbrauch (komb., entladen)', consumption.consumptionCombinedDischarged]);
    }
    if (consumption.co2EmissionsDischarged) {
      rows.push(['CO₂-Emissionen (entladen)', consumption.co2EmissionsDischarged]);
    }
    if (consumption.consumptionElectric) {
      rows.push(['Stromverbrauch (komb.)', consumption.consumptionElectric]);
    }
    if (consumption.electricRange) {
      rows.push(['Elektrische Reichweite', consumption.electricRange]);
    }
  }

  return rows.filter(([, v]) => v).map(([l, v]) => `<div class="${rowClass}"><span class="${labelClass}">${l}</span><span class="${valueClass}">${v}</span></div>`).join('');
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
