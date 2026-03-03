import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML } from "./shared";

export function generateMinimalistHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
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
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',sans-serif;background:#fff;color:#111}
    .container{max-width:800px;margin:0 auto;padding:48px 24px}
    .title-block{margin-bottom:40px}
    .title-block .cat{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#999;margin-bottom:8px}
    .title-block h1{font-size:32px;font-weight:700;letter-spacing:-0.5px}
    .title-block .variant{font-size:14px;color:#888;margin-top:4px}
    .title-block .price{font-size:24px;font-weight:700;margin-top:16px}
    .img-block{margin-bottom:40px}
    .img-block img#mainImg{width:100%;border-radius:2px}
    .gallery{display:flex;gap:6px;margin-top:8px}
    .gallery-thumb{width:60px;height:44px;object-fit:cover;cursor:pointer;border:1px solid transparent;opacity:0.5;transition:opacity .2s}
    .gallery-thumb:hover{opacity:1;border-color:#111}
    .divider{height:1px;background:#eee;margin:40px 0}
    .section-title{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-bottom:20px}
    .data-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:13px}
    .data-row:last-child{border-bottom:none}
    .data-row .lbl{color:#888}
    .data-row .val{font-weight:600}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{padding:16px 0;border-bottom:1px solid #f5f5f5}
    .fin-label{font-size:11px;color:#999}
    .fin-value{font-size:15px;font-weight:600}
    .tags{display:flex;flex-wrap:wrap;gap:6px}
    .tag{font-size:11px;padding:4px 12px;border:1px solid #ddd;color:#555}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#999}
    .cons-value{font-size:12px;font-weight:600}
    .cons-sub{margin-top:24px;padding-top:24px;border-top:1px solid #eee}
    .cons-sub-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:12px}
    .dealer-block{display:grid;grid-template-columns:1fr auto;gap:32px;align-items:start}
    @media(max-width:600px){.dealer-block{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:2;color:#666}
    .dealer-info strong{display:block;font-size:15px;color:#111}
    .rate-pill{background:#111;color:#fff;padding:20px 32px;text-align:center;border-radius:2px}
    .rate-pill .amount{font-size:24px;font-weight:700}
    .rate-pill .period{font-size:11px;color:#888;margin-top:2px}
    .footer{text-align:center;padding:40px 0;font-size:11px;color:#ccc}
  </style>
</head>
<body>
  <div class="container">
    <div class="title-block">
      <div class="cat">${data.category||'Angebot'}</div>
      <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
      <div class="variant">${data.vehicle.variant||''}</div>
      <div class="price">${data.finance.totalPrice||'–'}</div>
    </div>
    <div class="img-block">
      ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}"/>` : ''}
      ${galleryHTML}
    </div>
    <div class="divider"></div>
    <div class="section-title">Technische Daten</div>
    <div class="data-row"><span class="lbl">Typ</span><span class="val">${data.category||'–'}</span></div>
    <div class="data-row"><span class="lbl">Getriebe</span><span class="val">${data.vehicle.transmission||'–'}</span></div>
    <div class="data-row"><span class="lbl">Leistung</span><span class="val">${data.vehicle.power||'–'}</span></div>
    <div class="data-row"><span class="lbl">Kraftstoff</span><span class="val">${data.vehicle.fuelType||'–'}</span></div>
    <div class="data-row"><span class="lbl">Farbe</span><span class="val">${data.vehicle.color||'–'}</span></div>
    <div class="data-row"><span class="lbl">Baujahr</span><span class="val">${data.vehicle.year||'–'}</span></div>
    <div class="divider"></div>
    <div class="section-title">Finanzierung</div>
    <div class="fin-grid">${financeItems}</div>
    ${hasConsumption ? `<div class="divider"></div>
    <div class="section-title">Verbrauch & Emissionen</div>
    <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div></div></div></div>
    ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
    ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}` : ''}
    ${features ? `<div class="divider"></div><div class="section-title">Ausstattung</div><div class="tags">${features}</div>` : ''}
    <div class="divider"></div>
    <div class="section-title">Kontakt</div>
    <div class="dealer-block">
      <div class="dealer-info">
        ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:36px;margin-bottom:8px" />` : ''}
        <strong>${data.dealer.name||'–'}</strong>${buildDealerAddressHTML(data.dealer)}<br/>${data.dealer.phone||''}<br/>${data.dealer.email||''}<br/>${buildWebsiteLinkHTML(data.dealer)}
        ${buildDealerFooterHTML(data.dealer)}
        ${buildSocialLinksHTML(data.dealer)}
      </div>
      <div class="rate-pill"><div class="amount">${data.finance.monthlyRate||'–'}</div><div class="period">pro Monat</div></div>
    </div>
    ${buildLegalTextHTML(data)}
  </div>
  <div class="footer">Alle Angaben ohne Gewähr.</div>
</body></html>`;
}
