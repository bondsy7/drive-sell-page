import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildWhatsAppButtonHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle } from "./shared";

export function generateSportlichHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
  const consumption = getConsumptionData(data);
  const allImages = [imageBase64, ...galleryImages].filter(Boolean) as string[];
  const features = buildFeatures(data, 'tag');
  const financeItems = buildFinanceItems(data);
  const consumptionRows = buildConsumptionRows(consumption);
  const detailedConsumption = buildDetailedConsumption(consumption);
  const costRows = buildCostRows(consumption);
  const galleryHTML = getGalleryHTML(allImages);
  const hasConsumption = consumptionRows || detailedConsumption || costRows;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} – Angebot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#08090d;color:#e8eaed}
    .container{max-width:960px;margin:0 auto;padding:24px}
    .hero{position:relative;border-radius:16px;overflow:hidden;margin-bottom:24px;border:1px solid rgba(230,57,70,0.15)}
    .hero img#mainImg{width:100%;max-height:420px;object-fit:cover;display:block}
    .hero-overlay{position:absolute;bottom:0;left:0;right:0;padding:32px;background:linear-gradient(transparent,rgba(8,9,13,0.95))}
    .hero-overlay h1{font-family:'Rajdhani',sans-serif;font-size:34px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px}
    .hero-overlay .price{font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:#e63946}
    .gallery{display:flex;gap:8px;margin-top:12px;padding:0 16px 16px;overflow-x:auto;max-width:100%}
    .gallery-thumb{width:72px;height:52px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:all .2s;opacity:0.6;flex-shrink:0}
    .gallery-thumb:hover{border-color:#e63946;opacity:1}
    .section{background:#0f1117;border-radius:14px;padding:24px;margin-bottom:16px;border:1px solid #1a1e2a}
    .section h3{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:600;color:#e63946;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px}
    .specs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    @media(max-width:600px){.specs-grid{grid-template-columns:1fr 1fr}}
    .spec-card{background:#13151d;border-radius:10px;padding:14px;border-left:3px solid #e63946}
    .spec-card .label{font-size:10px;color:#5a6070;text-transform:uppercase;letter-spacing:1px}
    .spec-card .val{font-size:14px;font-weight:600;color:#fff;margin-top:2px}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{background:#13151d;border-radius:10px;padding:12px;border:1px solid #1a1e2a}
    .fin-label{font-size:10px;color:#5a6070;text-transform:uppercase;letter-spacing:0.5px}
    .fin-value{font-size:14px;font-weight:600;color:#fff}
    .tags{display:flex;flex-wrap:wrap;gap:6px}
    .tag{font-size:11px;border:1px solid #1f2333;padding:5px 12px;border-radius:6px;color:#8a90a0;background:#13151d}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1a1e2a}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#5a6070}
    .cons-value{font-size:12px;font-weight:600;color:#e8eaed}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #1a1e2a}
    .cons-sub-title{font-size:12px;font-weight:600;color:#e63946;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px}
    .dealer-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#8a90a0}
    .dealer-info strong{display:block;font-size:15px;color:#fff}
    .rate-box{background:linear-gradient(135deg,#e63946,#b82d38);color:#fff;border-radius:12px;padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .rate-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:0.8}
    .rate-amount{font-family:'Rajdhani',sans-serif;font-size:32px;font-weight:700}
    .rate-period{font-size:12px;opacity:0.8}
    .footer{text-align:center;padding:20px;font-size:11px;color:#3a3f50}
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}"/>` : ''}
      <div class="hero-overlay">
        <div style="font-size:10px;color:#e63946;text-transform:uppercase;letter-spacing:3px;margin-bottom:4px;font-weight:600">${data.category || 'Angebot'}</div>
        <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
        <div style="font-size:13px;color:#6a7080;margin-bottom:8px">${data.vehicle.variant || ''}</div>
        <div class="price">${data.finance.totalPrice || '–'}</div>
      </div>
    </div>
    ${allImages.length > 1 ? `<div style="margin-bottom:16px">${galleryHTML}</div>` : ''}
    <div class="section"><h3>Technische Daten</h3>
      <div class="specs-grid">
        <div class="spec-card"><div class="label">Typ</div><div class="val">${data.category||'–'}</div></div>
        <div class="spec-card"><div class="label">Getriebe</div><div class="val">${data.vehicle.transmission||'–'}</div></div>
        <div class="spec-card"><div class="label">Leistung</div><div class="val">${data.vehicle.power||'–'}</div></div>
        <div class="spec-card"><div class="label">Kraftstoff</div><div class="val">${data.vehicle.fuelType||'–'}</div></div>
        <div class="spec-card"><div class="label">Farbe</div><div class="val">${data.vehicle.color||'–'}</div></div>
        <div class="spec-card"><div class="label">Baujahr</div><div class="val">${data.vehicle.year||'–'}</div></div>
        ${data.vehicle.vin ? `<div class="spec-card" style="grid-column:1/-1"><div class="label">VIN</div><div class="val" style="font-family:monospace">${data.vehicle.vin}</div></div>` : ''}
      </div>
    </div>
    <div class="section"><h3>${getFinanceSectionTitle(data)}</h3><div class="fin-grid">${financeItems}</div></div>
    ${hasConsumption ? `<div class="section"><h3>Verbrauch & Emissionen</h3>
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div></div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}
    ${features ? `<div class="section"><h3>Ausstattung</h3><div class="tags">${features}</div></div>` : ''}
    <div class="section"><h3>Händler</h3>
      <div class="dealer-grid">
        <div class="dealer-info">
          ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:40px;margin-bottom:8px" />` : ''}
          <strong>${data.dealer.name||'–'}</strong>${buildDealerAddressHTML(data.dealer)}<br/>${data.dealer.phone||''}<br/>${data.dealer.email||''}<br/>${buildWebsiteLinkHTML(data.dealer)}
          ${buildDealerFooterHTML(data.dealer)}
          ${buildSocialLinksHTML(data.dealer)}
          ${buildWhatsAppButtonHTML(data.dealer, `${data.vehicle.brand} ${data.vehicle.model}`)}
        </div>
        <div class="rate-box"><div class="rate-label">Monatliche Rate</div><div class="rate-amount">${data.finance.monthlyRate||'–'}</div><div class="rate-period">pro Monat</div></div>
      </div>
    </div>
    ${buildLegalTextHTML(data)}
  </div>
  <div class="footer">Alle Angaben ohne Gewähr.</div>
</body></html>`;
}