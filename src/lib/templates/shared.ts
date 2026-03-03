import { VehicleData, ConsumptionData } from "@/types/vehicle";
import { getCO2ClassFromEmissions, getCO2LabelPath, isPluginHybrid } from "@/lib/co2-utils";

export function getFinanceSectionTitle(data: VehicleData): string {
  const cat = (data.category || '').toLowerCase();
  if (cat.includes('leasing')) return 'Leasing';
  if (cat.includes('kauf') || cat.includes('barkauf') || cat.includes('tageszulassung') || cat.includes('gebrauchtwagen') || cat.includes('neuwagen')) return 'Kaufpreis';
  return 'Finanzierung';
}

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

export function buildSocialLinksHTML(dealer: VehicleData['dealer']): string {
  const links: [string, string, string][] = [
    [dealer.facebookUrl, 'Facebook', `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`],
    [dealer.instagramUrl, 'Instagram', `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`],
    [dealer.xUrl, 'X', `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`],
    [dealer.tiktokUrl, 'TikTok', `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`],
    [dealer.youtubeUrl, 'YouTube', `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`],
  ];

  const filled = links.filter(([url]) => url);
  if (filled.length === 0) return '';

  return `<div class="social-links" style="display:flex;gap:12px;margin-top:12px">
    ${filled.map(([url, label, svg]) => `<a href="${url}" target="_blank" rel="noopener noreferrer" title="${label}" style="color:#6b7280;transition:color 0.2s" onmouseover="this.style.color='#1a1f2e'" onmouseout="this.style.color='#6b7280'">${svg}</a>`).join('')}
  </div>`;
}

export function buildLegalTextHTML(data: VehicleData): string {
  const dealer = data.dealer;
  const category = (data.category || '').toLowerCase();

  let legalText = '';
  let bankInfo = '';

  if (category.includes('leasing') && dealer.leasingLegalText) {
    legalText = dealer.leasingLegalText;
    bankInfo = dealer.leasingBank ? `Leasingpartner: ${dealer.leasingBank}` : '';
  } else if ((category.includes('finanzierung') || category.includes('kredit')) && dealer.financingLegalText) {
    legalText = dealer.financingLegalText;
    bankInfo = dealer.financingBank ? `Finanzierungspartner: ${dealer.financingBank}` : '';
  } else if (dealer.defaultLegalText) {
    legalText = dealer.defaultLegalText;
  }

  if (!legalText && !bankInfo) return '';

  return `<div class="legal-text" style="margin-top:24px;padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e8eaee">
    ${bankInfo ? `<div style="font-size:12px;font-weight:600;margin-bottom:8px">${bankInfo}</div>` : ''}
    <div style="font-size:11px;color:#6b7280;line-height:1.6;white-space:pre-line">${legalText}</div>
  </div>`;
}

export function buildDealerAddressHTML(dealer: VehicleData['dealer']): string {
  const parts = [dealer.address];
  if (dealer.postalCode || dealer.city) {
    parts.push([dealer.postalCode, dealer.city].filter(Boolean).join(' '));
  }
  return parts.filter(Boolean).join('<br/>');
}

export function buildWebsiteLinkHTML(dealer: VehicleData['dealer']): string {
  if (!dealer.website) return '';
  const url = dealer.website.startsWith('http') ? dealer.website : `https://${dealer.website}`;
  const display = dealer.website.replace(/^https?:\/\//, '');
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none">${display}</a>`;
}

export function buildDealerFooterHTML(dealer: VehicleData['dealer']): string {
  const parts: string[] = [];
  if (dealer.taxId) parts.push(`USt-IdNr.: ${dealer.taxId}`);
  return parts.length ? `<div style="font-size:10px;color:#9ca3af;margin-top:6px">${parts.join(' · ')}</div>` : '';
}
