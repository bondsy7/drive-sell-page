import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures } from "./shared";

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
    body{font-family:'Source Sans 3',sans-serif;background:#faf9f6;color:#2c2c2c}
    .container{max-width:900px;margin:0 auto;padding:32px}
    .header{text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #1e3a5f}
    .header .cat{font-size:12px;text-transform:uppercase;letter-spacing:3px;color:#1e3a5f;margin-bottom:8px}
    .header h1{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;color:#1e3a5f}
    .header .variant{font-size:15px;color:#777;margin-top:4px;font-style:italic}
    .header .price{font-family:'Playfair Display',serif;font-size:28px;color:#1e3a5f;margin-top:12px}
    .img-block{margin-bottom:28px;text-align:center}
    .img-block img#mainImg{width:100%;max-height:400px;object-fit:cover;border-radius:4px;border:1px solid #ddd}
    .gallery{display:flex;gap:8px;margin-top:12px;justify-content:center}
    .gallery-thumb{width:64px;height:48px;object-fit:cover;border-radius:4px;cursor:pointer;border:2px solid transparent}
    .gallery-thumb:hover{border-color:#1e3a5f}
    .section{margin-bottom:28px;padding:24px;background:#fff;border:1px solid #e5e2db;border-radius:4px}
    .section h3{font-family:'Playfair Display',serif;font-size:18px;color:#1e3a5f;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #e5e2db}
    .specs-table{width:100%;border-collapse:collapse}
    .specs-table td{padding:8px 12px;font-size:13px;border-bottom:1px solid #f0ede8}
    .specs-table td:first-child{color:#888;width:40%}
    .specs-table td:last-child{font-weight:600}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{padding:12px;border:1px solid #e5e2db;border-radius:4px}
    .fin-label{font-size:11px;color:#888}
    .fin-value{font-size:14px;font-weight:600;color:#1e3a5f}
    .tags{display:flex;flex-wrap:wrap;gap:8px}
    .tag{font-size:12px;border:1px solid #ccc;padding:5px 14px;border-radius:2px;color:#555}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0ede8}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#888}
    .cons-value{font-size:12px;font-weight:600}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #e5e2db}
    .cons-sub-title{font-size:13px;font-weight:600;color:#1e3a5f;margin-bottom:8px}
    .dealer-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8}
    .dealer-info strong{display:block;font-family:'Playfair Display',serif;font-size:16px;color:#1e3a5f}
    .rate-box{background:#1e3a5f;color:#fff;border-radius:4px;padding:20px;text-align:center}
    .rate-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.7}
    .rate-amount{font-family:'Playfair Display',serif;font-size:28px;font-weight:700}
    .rate-period{font-size:12px;opacity:0.7}
    .footer{text-align:center;padding:24px;font-size:11px;color:#aaa;border-top:1px solid #e5e2db;margin-top:12px}
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
    <div class="section"><h3>Finanzierung</h3><div class="fin-grid">${financeItems}</div></div>
    ${hasConsumption ? `<div class="section"><h3>Verbrauch & Emissionen</h3>
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption.co2Class||'A')}</div></div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}
    ${features ? `<div class="section"><h3>Ausstattung</h3><div class="tags">${features}</div></div>` : ''}
    <div class="section"><h3>Händler & Kontakt</h3>
      <div class="dealer-grid">
        <div class="dealer-info"><strong>${data.dealer.name||'–'}</strong>${data.dealer.address||''}<br/>${data.dealer.phone||''}<br/>${data.dealer.email||''}<br/>${data.dealer.website||''}</div>
        <div class="rate-box"><div class="rate-label">Monatliche Rate</div><div class="rate-amount">${data.finance.monthlyRate||'–'}</div><div class="rate-period">pro Monat</div></div>
      </div>
    </div>
  </div>
  <div class="footer">Alle Angaben ohne Gewähr. Irrtümer und Änderungen vorbehalten.</div>
</body></html>`;
}
