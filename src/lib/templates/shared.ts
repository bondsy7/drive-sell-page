import { VehicleData, ConsumptionData } from "@/types/vehicle";
import { getCO2ClassFromEmissions, getCO2LabelPath, isPluginHybrid } from "@/lib/co2-utils";
import { parsePrice } from "@/lib/finance-utils";

/**
 * Calculate leasing factor: (monthlyRate / totalPrice) * 100
 * Returns formatted string or empty if not determinable.
 */
export function calculateLeasingFactor(data: VehicleData): string {
  const rate = parsePrice(data.finance.monthlyRate);
  const price = parsePrice(data.finance.totalPrice);
  if (rate <= 0 || price <= 0) return '';
  const factor = (rate / price) * 100;
  return factor.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

/**
 * Post-processes generated HTML to embed all CO2 label images as base64.
 * Replaces <img src="/images/co2/..."> with base64 data URLs for offline-capable exports.
 */
export async function embedCO2LabelsInHTML(html: string): Promise<string> {
  const regex = /<img\s+src="(\/images\/co2\/[^"]+)"/g;
  const matches = [...html.matchAll(regex)];
  if (matches.length === 0) return html;

  // Deduplicate paths
  const uniquePaths = [...new Set(matches.map(m => m[1]))];
  const base64Map = new Map<string, string>();

  await Promise.all(uniquePaths.map(async (path) => {
    const b64 = await imageToBase64(path);
    if (b64) base64Map.set(path, b64);
  }));

  let result = html;
  for (const [path, b64] of base64Map) {
    result = result.split(`src="${path}"`).join(`src="${b64}"`);
  }
  return result;
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
  const cat = (data.category || '').toLowerCase();
  const isBuy = cat.includes('barkauf') || cat.includes('neuwagen') || cat.includes('gebrauchtwagen') || cat.includes('tageszulassung');

  const items: [string, string][] = [];

  if (!isBuy) {
    items.push(['Monatliche Rate', data.finance.monthlyRate]);
    if (cat.includes('leasing')) {
      items.push(['Sonderzahlung', data.finance.specialPayment]);
    } else {
      items.push(['Anzahlung', data.finance.downPayment]);
    }
    items.push(['Laufzeit', data.finance.duration]);
    items.push(['Jahresfahrleistung', data.finance.annualMileage]);
    if (cat.includes('leasing')) {
      items.push(['Restwert', data.finance.residualValue]);
    }

    // Leasingfaktor for leasing
    if (cat.includes('leasing')) {
      const lf = calculateLeasingFactor(data);
      if (lf) items.push(['Leasingfaktor', lf]);
    }
  }

  return items.filter(([, v]) => v).map(([l, v]) => `
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

export function buildWhatsAppButtonHTML(dealer: VehicleData['dealer'], vehicleTitle?: string): string {
  if (!dealer.whatsappNumber) return '';
  const num = dealer.whatsappNumber.replace(/[^0-9]/g, '');
  const text = encodeURIComponent(vehicleTitle ? `Hallo, ich interessiere mich für: ${vehicleTitle}` : 'Hallo, ich interessiere mich für Ihr Fahrzeugangebot.');
  return `<a href="https://wa.me/${num}?text=${text}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;transition:background 0.2s" onmouseover="this.style.background='#1EB954'" onmouseout="this.style.background='#25D366'">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    WhatsApp Anfrage
  </a>`;
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

export function buildVinHTML(data: VehicleData): string {
  const vin = data.vehicle.vin;
  if (!vin) return '';
  return `<div class="vin-row" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e2e8f0"><span style="font-size:10px;color:#8896a6;text-transform:uppercase;letter-spacing:0.5px">VIN</span><span style="font-size:12px;font-weight:600;font-family:monospace;color:#1a2332">${vin}</span></div>`;
}

export function buildDealerFooterHTML(dealer: VehicleData['dealer']): string {
  const parts: string[] = [];
  if (dealer.taxId) parts.push(`USt-IdNr.: ${dealer.taxId}`);
  return parts.length ? `<div style="font-size:10px;color:#9ca3af;margin-top:6px">${parts.join(' · ')}</div>` : '';
}

export interface ContactFormOptions {
  dealerUserId: string;
  projectId?: string;
  supabaseUrl: string;
  vehicleTitle: string;
  /** Current category so we show alternative options */
  currentCategory?: 'leasing' | 'finanzierung' | 'kauf' | string;
}

export function buildContactFormHTML(options: ContactFormOptions): string {
  const { dealerUserId, projectId, supabaseUrl, vehicleTitle, currentCategory } = options;

  const cat = (currentCategory || '').toLowerCase();
  const isPurchase = ['barkauf', 'neuwagen', 'gebrauchtwagen', 'tageszulassung'].includes(cat);
  const showLeasing = cat !== 'leasing';
  const showFinancing = cat !== 'finanzierung';
  const showPurchase = !isPurchase;

  const checkboxStyle = `accent-color:#3366cc;width:16px;height:16px;cursor:pointer`;
  const labelStyle = `display:flex;align-items:center;gap:8px;font-size:13px;font-family:'Inter',sans-serif;color:#1a2332;cursor:pointer`;

  const interestCheckboxes = `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
      <span style="font-size:12px;font-weight:600;color:#6b7a8d;text-transform:uppercase;letter-spacing:0.5px">Ich interessiere mich für:</span>
      <label style="${labelStyle}"><input type="checkbox" name="interested_test_drive" style="${checkboxStyle}" /> Probefahrt</label>
      <label style="${labelStyle}"><input type="checkbox" name="interested_trade_in" style="${checkboxStyle}" /> Inzahlungnahme meines Fahrzeugs</label>
      ${showLeasing ? `<label style="${labelStyle}"><input type="checkbox" name="interested_leasing" style="${checkboxStyle}" /> Leasing-Angebot</label>` : ''}
      ${showFinancing ? `<label style="${labelStyle}"><input type="checkbox" name="interested_financing" style="${checkboxStyle}" /> Finanzierungs-Angebot</label>` : ''}
      ${showPurchase ? `<label style="${labelStyle}"><input type="checkbox" name="interested_purchase" style="${checkboxStyle}" /> Barkauf</label>` : ''}
    </div>`;

  return `
  <!-- Sticky CTA -->
  <div id="leadCta" style="position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px">
    <button onclick="document.getElementById('leadModal').style.display='flex'" style="
      background:linear-gradient(135deg,#3366cc,#2952a3);color:#fff;border:none;cursor:pointer;
      padding:14px 28px;border-radius:50px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;
      box-shadow:0 4px 24px rgba(51,102,204,0.4);transition:all .2s;display:flex;align-items:center;gap:8px;
    " onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 6px 32px rgba(51,102,204,0.5)'"
       onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 24px rgba(51,102,204,0.4)'">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      Jetzt anfragen
    </button>
  </div>

  <!-- Lead Modal -->
  <div id="leadModal" style="display:none;position:fixed;inset:0;z-index:10000;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)" onclick="if(event.target===this)this.style.display='none'">
    <div style="background:#fff;border-radius:20px;padding:32px;max-width:460px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15);position:relative;animation:leadSlideIn .3s ease">
      <button onclick="document.getElementById('leadModal').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;color:#9ca3af;font-size:20px">✕</button>
      <div style="margin-bottom:20px">
        <h3 style="font-family:'Space Grotesk','Inter',sans-serif;font-size:20px;font-weight:700;color:#1a2332;margin-bottom:4px">Interesse an diesem Fahrzeug?</h3>
        <p style="font-size:13px;color:#6b7a8d">${vehicleTitle}</p>
      </div>
      <form id="leadForm" onsubmit="return submitLead(event)">
        <div style="display:flex;flex-direction:column;gap:12px">
          <input name="name" placeholder="Ihr Name *" required style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none;transition:border .2s" onfocus="this.style.borderColor='#3366cc'" onblur="this.style.borderColor='#e2e8f0'" />
          <input name="email" type="email" placeholder="Ihre E-Mail *" required style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none;transition:border .2s" onfocus="this.style.borderColor='#3366cc'" onblur="this.style.borderColor='#e2e8f0'" />
          <input name="phone" type="tel" placeholder="Telefonnummer (optional)" style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none;transition:border .2s" onfocus="this.style.borderColor='#3366cc'" onblur="this.style.borderColor='#e2e8f0'" />
          <textarea name="message" placeholder="Ihre Nachricht (optional)" rows="3" style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none;resize:vertical;transition:border .2s" onfocus="this.style.borderColor='#3366cc'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
          ${interestCheckboxes}
          <button type="submit" id="leadSubmitBtn" style="
            background:linear-gradient(135deg,#3366cc,#2952a3);color:#fff;border:none;cursor:pointer;
            padding:14px;border-radius:10px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;
            transition:all .2s;
          " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
            Anfrage senden
          </button>
        </div>
      </form>
      <div id="leadSuccess" style="display:none;text-align:center;padding:20px 0">
        <div style="font-size:48px;margin-bottom:12px">✓</div>
        <h4 style="font-family:'Space Grotesk','Inter',sans-serif;font-size:18px;font-weight:700;color:#1a2332;margin-bottom:8px">Anfrage gesendet!</h4>
        <p style="font-size:13px;color:#6b7a8d">Vielen Dank für Ihr Interesse. Wir melden uns in Kürze bei Ihnen.</p>
      </div>
      <p style="font-size:10px;color:#9ca3af;margin-top:12px;text-align:center">Ihre Daten werden vertraulich behandelt und nicht an Dritte weitergegeben.</p>
    </div>
  </div>

  <style>
    @keyframes leadSlideIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
  </style>

  <script>
    async function submitLead(e) {
      e.preventDefault();
      var btn = document.getElementById('leadSubmitBtn');
      btn.disabled = true;
      btn.textContent = 'Wird gesendet...';
      var form = document.getElementById('leadForm');
      var fd = new FormData(form);
      try {
        var res = await fetch('${supabaseUrl}/functions/v1/submit-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealerUserId: '${dealerUserId}',
            projectId: ${projectId ? `'${projectId}'` : 'null'},
            name: fd.get('name'),
            email: fd.get('email'),
            phone: fd.get('phone') || null,
            message: fd.get('message') || null,
            vehicleTitle: '${vehicleTitle.replace(/'/g, "\\'")}',
            interestedTestDrive: !!form.querySelector('[name=interested_test_drive]')?.checked,
            interestedTradeIn: !!form.querySelector('[name=interested_trade_in]')?.checked,
            interestedLeasing: !!form.querySelector('[name=interested_leasing]')?.checked,
            interestedFinancing: !!form.querySelector('[name=interested_financing]')?.checked,
            interestedPurchase: !!form.querySelector('[name=interested_purchase]')?.checked
          })
        });
        if (res.ok) {
          form.style.display = 'none';
          document.getElementById('leadSuccess').style.display = 'block';
        } else {
          btn.textContent = 'Fehler – erneut versuchen';
          btn.disabled = false;
        }
      } catch(err) {
        btn.textContent = 'Fehler – erneut versuchen';
        btn.disabled = false;
      }
      return false;
    }
  </script>`;
}
