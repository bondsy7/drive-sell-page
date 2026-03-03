import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle } from "./shared";

export function generateKlassischHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
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
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} – Angebot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Source Sans 3',sans-serif;background:#f8f6f3;color:#2c3040}
    .container{max-width:900px;margin:0 auto;padding:32px}
    .header{text-align:center;margin-bottom:32px;padding-bottom:28px;border-bottom:1px solid #d4cfc7}
    .header .cat{font-size:11px;text-transform:uppercase;letter-spacing:4px;color:#1a365d;margin-bottom:10px;font-weight:500}
    .header h1{font-family:'Playfair Display',serif;font-size:34px;font-weight:700;color:#1a2332}
    .header .variant{font-size:14px;color:#7a7e8a;margin-top:6px;font-style:italic}
    .header .price{font-family:'Playfair Display',serif;font-size:28px;color:#1a365d;margin-top:14px;font-weight:600}
    .img-block{margin-bottom:32px;text-align:center}
    .img-block img#mainImg{width:100%;max-height:420px;object-fit:cover;border-radius:8px}
    .gallery{display:flex;gap:8px;margin-top:12px;justify-content:center}
    .gallery-thumb{width:68px;height:50px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent;transition:all .2s}
    .gallery-thumb:hover{border-color:#1a365d}
    .section{margin-bottom:24px;padding:28px;background:#fff;border:1px solid #e8e4de;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,0.03)}
    .section h3{font-family:'Playfair Display',serif;font-size:18px;color:#1a2332;margin-bottom:18px;padding-bottom:10px;border-bottom:2px solid #1a365d}
    .specs-table{width:100%;border-collapse:collapse}
    .specs-table td{padding:10px 14px;font-size:13px;border-bottom:1px solid #f0ede8}
    .specs-table td:first-child{color:#7a7e8a;width:40%}
    .specs-table td:last-child{font-weight:600;color:#1a2332}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{padding:14px;border:1px solid #e8e4de;border-radius:8px;background:#faf9f6}
    .fin-label{font-size:10px;color:#7a7e8a;text-transform:uppercase;letter-spacing:0.5px}
    .fin-value{font-size:14px;font-weight:600;color:#1a365d}
    .tags{display:flex;flex-wrap:wrap;gap:8px}
    .tag{font-size:12px;border:1px solid #d4cfc7;padding:5px 14px;border-radius:4px;color:#4a5060;background:#faf9f6}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0ede8}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#7a7e8a}
    .cons-value{font-size:12px;font-weight:600;color:#1a2332}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #e8e4de}
    .cons-sub-title{font-size:13px;font-weight:600;color:#1a365d;margin-bottom:8px}
    .dealer-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#5a5e6a}
    .dealer-info strong{display:block;font-family:'Playfair Display',serif;font-size:16px;color:#1a2332}
    .rate-box{background:#1a365d;color:#fff;border-radius:10px;padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .rate-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.7}
    .rate-amount{font-family:'Playfair Display',serif;font-size:30px;font-weight:700;margin:4px 0}
    .rate-period{font-size:12px;opacity:0.7}
    .footer{text-align:center;padding:24px;font-size:11px;color:#a0a4ae;border-top:1px solid #e8e4de;margin-top:12px}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="cat">${data.category || 'Angebot'}</div>
      <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
      <div class="variant">${data.vehicle.variant || ''}</div>
      <div class="price">${data.finance.totalPrice || '–'}</div>
    </div>
    <div class="img-block">
      ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}"/>` : ''}
      ${galleryHTML}
    </div>
    <div class="section"><h3>Fahrzeugdaten</h3>
      <table class="specs-table">
        <tr><td>Fahrzeugtyp</td><td>${data.category||'–'}</td></tr>
        <tr><td>Getriebe</td><td>${data.vehicle.transmission||'–'}</td></tr>
        <tr><td>Leistung</td><td>${data.vehicle.power||'–'}</td></tr>
        <tr><td>Kraftstoff</td><td>${data.vehicle.fuelType||'–'}</td></tr>
        <tr><td>Farbe</td><td>${data.vehicle.color||'–'}</td></tr>
        <tr><td>Baujahr</td><td>${data.vehicle.year||'–'}</td></tr>
      </table>
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
          ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:44px;margin-bottom:8px" />` : ''}
          <strong>${data.dealer.name||'–'}</strong>${buildDealerAddressHTML(data.dealer)}<br/>${data.dealer.phone||''}<br/>${data.dealer.email||''}<br/>${buildWebsiteLinkHTML(data.dealer)}
          ${buildDealerFooterHTML(data.dealer)}
          ${buildSocialLinksHTML(data.dealer)}
        </div>
        <div class="rate-box"><div class="rate-label">Monatliche Rate</div><div class="rate-amount">${data.finance.monthlyRate||'–'}</div><div class="rate-period">pro Monat</div></div>
      </div>
    </div>
    ${buildLegalTextHTML(data)}
  </div>
  <div class="footer">Alle Angaben ohne Gewähr.</div>
</body></html>`;
}