import { VehicleData, ConsumptionData } from "@/types/vehicle";
import { getCO2LabelPath } from "@/lib/co2-utils";

function generateCO2LabelHTML(consumption: ConsumptionData): string {
  const path = getCO2LabelPath(consumption);
  return `<img src="${path}" alt="CO₂-Klasse" style="max-width:280px;width:100%;height:auto" />`;
}

export function generateLandingPageHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
  const features = data.vehicle.features?.map(f => `<span class="tag">${f}</span>`).join('\n            ') || '';
  const consumption: ConsumptionData = data.consumption || {} as ConsumptionData;

  const financeItems = [
    ['Monatliche Rate', data.finance.monthlyRate],
    ['Anzahlung', data.finance.downPayment],
    ['Laufzeit', data.finance.duration],
    ['Jahresfahrleistung', data.finance.annualMileage],
    ['Sonderzahlung', data.finance.specialPayment],
    ['Restwert', data.finance.residualValue],
  ].filter(([, v]) => v).map(([l, v]) => `
              <div class="fin-item">
                <div class="fin-label">${l}</div>
                <div class="fin-value">${v}</div>
              </div>`).join('');

  const allImages = [imageBase64, ...galleryImages].filter(Boolean);
  const galleryHTML = allImages.length > 1 ? `
    <div class="gallery">
      ${allImages.map((img, i) => `<img src="${img}" alt="Bild ${i + 1}" class="gallery-thumb" onclick="document.getElementById('mainImg').src=this.src" />`).join('')}
    </div>` : '';

  const consumptionRows = [
    ['Herkunft', consumption.origin],
    ['Kilometerstand', consumption.mileage],
    ['Hubraum', consumption.displacement],
    ['Leistung', consumption.power],
    ['Antriebsart', consumption.driveType],
    ['Kraftstoffart', consumption.fuelType],
    ['Verbrauch (komb.)', consumption.consumptionCombined],
    ['CO₂-Emissionen (komb.)', consumption.co2Emissions],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="cons-row"><span class="cons-label">${l}</span><span class="cons-value">${v}</span></div>`).join('');

  const detailedConsumption = [
    ['Kombiniert', consumption.consumptionCombined],
    ['Innenstadt', consumption.consumptionCity],
    ['Stadtrand', consumption.consumptionSuburban],
    ['Landstraße', consumption.consumptionRural],
    ['Autobahn', consumption.consumptionHighway],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="cons-row"><span class="cons-label">${l}</span><span class="cons-value">${v}</span></div>`).join('');

  const costRows = [
    ['Energiekosten/Jahr', consumption.energyCostPerYear],
    ['Kraftstoffpreis', consumption.fuelPrice],
    ['CO₂-Kosten (mittel, 10J)', consumption.co2CostMedium],
    ['CO₂-Kosten (niedrig, 10J)', consumption.co2CostLow],
    ['CO₂-Kosten (hoch, 10J)', consumption.co2CostHigh],
    ['Kfz-Steuer', consumption.vehicleTax],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="cons-row"><span class="cons-label">${l}</span><span class="cons-value">${v}</span></div>`).join('');

  const hasConsumption = consumptionRows || detailedConsumption || costRows;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} – Angebot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f4f5f7; color: #1a1f2e; }
    .container { max-width: 960px; margin: 0 auto; padding: 24px; }
    
    .main-card {
      background: white; border-radius: 16px; overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e8eaee;
      display: grid; grid-template-columns: 1fr 1fr;
    }
    @media (max-width: 768px) { .main-card { grid-template-columns: 1fr; } }
    
    .image-side {
      background: #f4f5f7; display: flex; flex-direction: column;
      min-height: 320px; padding: 16px;
    }
    .image-side img#mainImg { width: 100%; height: auto; max-height: 350px; object-fit: cover; border-radius: 12px; }
    .gallery { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; }
    .gallery-thumb { width: 64px; height: 48px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: border-color 0.2s; }
    .gallery-thumb:hover { border-color: #e8a308; }
    
    .info-side { padding: 28px; display: flex; flex-direction: column; }
    .category { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
    .info-side h1 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 2px; }
    .variant { font-size: 13px; color: #6b7280; margin-bottom: 12px; }
    .price { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; margin-bottom: 16px; }
    
    .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e8eaee; padding-top: 12px; }
    .spec { padding: 8px 0; }
    .spec-label { font-size: 11px; color: #6b7280; }
    .spec-value { font-size: 13px; font-weight: 600; }
    
    .section { background: white; border-radius: 16px; padding: 24px; margin-top: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e8eaee; }
    .section h3 { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    
    .fin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    @media (max-width: 600px) { .fin-grid { grid-template-columns: 1fr 1fr; } }
    .fin-item { background: #f9fafb; border-radius: 12px; padding: 12px; }
    .fin-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
    .fin-value { font-size: 14px; font-weight: 600; }
    
    .tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { font-size: 12px; border: 1px solid #e8eaee; padding: 6px 14px; border-radius: 100px; color: #374151; }
    
    .cons-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 600px) { .cons-grid { grid-template-columns: 1fr; } }
    .cons-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .cons-row:last-child { border-bottom: none; }
    .cons-label { font-size: 11px; color: #6b7280; }
    .cons-value { font-size: 12px; font-weight: 600; }
    .cons-sub { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e8eaee; }
    .cons-sub-title { font-size: 12px; font-weight: 600; margin-bottom: 8px; }
    
    .dealer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 600px) { .dealer-grid { grid-template-columns: 1fr; } }
    .dealer-info { font-size: 13px; line-height: 1.8; }
    .dealer-info strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .rate-box {
      background: linear-gradient(135deg, #e8a308, #ca8a04); color: #1a1f2e;
      border-radius: 12px; padding: 20px; text-align: center;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .rate-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
    .rate-amount { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; }
    .rate-period { font-size: 12px; font-weight: 500; opacity: 0.8; }
    
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="main-card">
      <div class="image-side">
        ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}" />` : `<div style="color:#9ca3af;text-align:center;padding:60px">Kein Bild</div>`}
        ${galleryHTML}
      </div>
      <div class="info-side">
        <div class="category">${data.category || 'Angebot'}</div>
        <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
        <p class="variant">${data.vehicle.variant || ''}</p>
        <div class="price">${data.finance.totalPrice || '–'}</div>
        <div class="specs">
          <div class="spec"><div class="spec-label">Fahrzeugtyp</div><div class="spec-value">${data.category || '–'}</div></div>
          <div class="spec"><div class="spec-label">Getriebe</div><div class="spec-value">${data.vehicle.transmission || '–'}</div></div>
          <div class="spec"><div class="spec-label">Leistung</div><div class="spec-value">${data.vehicle.power || '–'}</div></div>
          <div class="spec"><div class="spec-label">Kraftstoff</div><div class="spec-value">${data.vehicle.fuelType || '–'}</div></div>
          <div class="spec"><div class="spec-label">Farbe</div><div class="spec-value">${data.vehicle.color || '–'}</div></div>
          <div class="spec"><div class="spec-label">Baujahr</div><div class="spec-value">${data.vehicle.year || '–'}</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>💰 Finanzierung</h3>
      <div class="fin-grid">${financeItems}</div>
    </div>

    ${hasConsumption ? `
    <div class="section">
      <h3>⛽ Verbrauch & Emissionen</h3>
      <div class="cons-grid">
        <div>${consumptionRows}</div>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-size:12px;font-weight:600;margin-bottom:8px">CO₂-Effizienz</div>
          ${generateCO2LabelHTML(consumption)}
        </div>
      </div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Kraftstoffverbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}

    ${features ? `
    <div class="section">
      <h3>Ausstattung</h3>
      <div class="tags">${features}</div>
    </div>` : ''}

    <div class="section">
      <h3>📍 Händler & Kontakt</h3>
      <div class="dealer-grid">
        <div class="dealer-info">
          <strong>${data.dealer.name || '–'}</strong>
          ${data.dealer.address || ''}<br/>
          ${data.dealer.phone || ''}<br/>
          ${data.dealer.email || ''}<br/>
          ${data.dealer.website || ''}
        </div>
        <div class="rate-box">
          <div class="rate-label">Monatliche Rate</div>
          <div class="rate-amount">${data.finance.monthlyRate || '–'}</div>
          <div class="rate-period">pro Monat</div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer">Alle Angaben ohne Gewähr. Irrtümer und Änderungen vorbehalten.</div>
</body>
</html>`;
}

export function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
