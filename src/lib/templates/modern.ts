import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildWhatsAppButtonHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle, buildVinHTML } from "./shared";

export function generateModernHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
  const consumption = getConsumptionData(data);
  const allImages = [imageBase64, ...galleryImages].filter(Boolean) as string[];
  const features = buildFeatures(data);
  const financeItems = buildFinanceItems(data);
  const consumptionRows = buildConsumptionRows(consumption);
  const detailedConsumption = buildDetailedConsumption(consumption);
  const costRows = buildCostRows(consumption);
  const galleryHTML = getGalleryHTML(allImages);
  const hasConsumption = consumptionRows || detailedConsumption || costRows;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} – Angebot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#f0f4f8;color:#1a2332}
    .container{max-width:960px;margin:0 auto;padding:24px}
    .main-card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(26,35,50,0.06);border:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr}
    @media(max-width:768px){.main-card{grid-template-columns:1fr}}
    .image-side{background:#f0f4f8;display:flex;flex-direction:column;min-height:320px;padding:16px}
    .image-side img#mainImg{width:100%;height:auto;max-height:350px;object-fit:cover;border-radius:12px}
    .gallery{display:flex;gap:8px;margin-top:12px;overflow-x:auto;max-width:100%}
    .gallery-thumb{width:64px;height:48px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:all .2s;flex-shrink:0}
    .gallery-thumb:hover{border-color:#3366cc;opacity:1}
    .info-side{padding:28px;display:flex;flex-direction:column}
    .category{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#fff;background:#3366cc;padding:4px 10px;border-radius:4px;margin-bottom:10px}
    .info-side h1{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;margin-bottom:2px;color:#1a2332}
    .variant{font-size:13px;color:#6b7a8d;margin-bottom:12px}
    .price-row{display:flex;align-items:baseline;gap:8px;margin-bottom:16px}
    .price{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:#1a2332}
    .price-sub{font-size:12px;color:#6b7a8d}
    .specs{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid #e2e8f0;padding-top:12px}
    .spec{padding:8px 0}
    .spec-label{font-size:10px;color:#8896a6;text-transform:uppercase;letter-spacing:0.5px}
    .spec-value{font-size:13px;font-weight:600;color:#1a2332}
    .section{background:#fff;border-radius:16px;padding:24px;margin-top:20px;box-shadow:0 2px 12px rgba(26,35,50,0.04);border:1px solid #e2e8f0}
    .section h3{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:600;margin-bottom:16px;color:#1a2332}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{background:#f7f9fc;border-radius:10px;padding:12px;border:1px solid #e2e8f0}
    .fin-label{font-size:10px;color:#8896a6;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.3px}
    .fin-value{font-size:14px;font-weight:600;color:#1a2332}
    .tags{display:flex;flex-wrap:wrap;gap:6px}
    .tag{font-size:11px;border:1px solid #e2e8f0;padding:5px 12px;border-radius:100px;color:#4a5568;background:#f7f9fc}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f4f8}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#8896a6}
    .cons-value{font-size:12px;font-weight:600;color:#1a2332}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0}
    .cons-sub-title{font-size:12px;font-weight:600;margin-bottom:8px;color:#3366cc}
    .dealer-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#4a5568}
    .dealer-info strong{display:block;font-size:15px;color:#1a2332;margin-bottom:4px}
    .rate-box{background:linear-gradient(135deg,#3366cc,#2952a3);color:#fff;border-radius:12px;padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .rate-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:0.8}
    .rate-amount{font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:700;margin:4px 0}
    .rate-period{font-size:12px;opacity:0.8}
    .footer{text-align:center;padding:20px;font-size:11px;color:#a0aec0}
  </style>
</head>
<body>
  <div class="container">
    <div class="main-card">
      <div class="image-side">
        ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}" />` : `<div style="color:#a0aec0;text-align:center;padding:60px">Kein Bild</div>`}
        ${galleryHTML}
      </div>
      <div class="info-side">
        <div class="category">${data.category || 'Angebot'}</div>
        <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
        <p class="variant">${data.vehicle.variant || ''}</p>
        <div class="price-row"><div class="price">${data.finance.totalPrice || '–'}</div></div>
        <div class="specs">
          <div class="spec"><div class="spec-label">Fahrzeugtyp</div><div class="spec-value">${data.category || '–'}</div></div>
          <div class="spec"><div class="spec-label">Getriebe</div><div class="spec-value">${data.vehicle.transmission || '–'}</div></div>
          <div class="spec"><div class="spec-label">Leistung</div><div class="spec-value">${data.vehicle.power || '–'}</div></div>
          <div class="spec"><div class="spec-label">Kraftstoff</div><div class="spec-value">${data.vehicle.fuelType || '–'}</div></div>
          <div class="spec"><div class="spec-label">Farbe</div><div class="spec-value">${data.vehicle.color || '–'}</div></div>
          <div class="spec"><div class="spec-label">Baujahr</div><div class="spec-value">${data.vehicle.year || '–'}</div></div>
          ${data.vehicle.vin ? `<div class="spec" style="grid-column:1/-1"><div class="spec-label">VIN</div><div class="spec-value" style="font-family:monospace">${data.vehicle.vin}</div></div>` : ''}
        </div>
      </div>
    </div>
    <div class="section"><h3>${getFinanceSectionTitle(data)}</h3><div class="fin-grid">${financeItems}</div></div>
    ${hasConsumption ? `<div class="section"><h3>Verbrauch & Emissionen</h3>
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div></div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}
    ${features ? `<div class="section"><h3>Ausstattung</h3><div class="tags">${features}</div></div>` : ''}
    <div class="section"><h3>Händler & Kontakt</h3>
      <div class="dealer-grid">
        <div class="dealer-info">
          ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:48px;margin-bottom:8px" />` : ''}
          <strong>${data.dealer.name || '–'}</strong>
          ${buildDealerAddressHTML(data.dealer)}<br/>${data.dealer.phone || ''}<br/>${data.dealer.email || ''}<br/>${buildWebsiteLinkHTML(data.dealer)}
          ${buildDealerFooterHTML(data.dealer)}
          ${buildSocialLinksHTML(data.dealer)}
          ${buildWhatsAppButtonHTML(data.dealer, `${data.vehicle.brand} ${data.vehicle.model}`)}
        </div>
        <div class="rate-box"><div class="rate-label">Monatliche Rate</div><div class="rate-amount">${data.finance.monthlyRate || '–'}</div><div class="rate-period">pro Monat</div></div>
      </div>
    </div>
    ${buildLegalTextHTML(data)}
  </div>
  <div class="footer">Alle Angaben ohne Gewähr.</div>
</body></html>`;
}