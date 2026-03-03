import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle } from "./shared";

export function generatePremiumHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
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
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Montserrat',sans-serif;background:#0d0d0d;color:#d4d4d4}
    .container{max-width:960px;margin:0 auto;padding:24px}
    .gold{color:#d4a843}
    .hero{position:relative;border-radius:12px;overflow:hidden;margin-bottom:28px;border:1px solid #2a2218}
    .hero img#mainImg{width:100%;max-height:440px;object-fit:cover}
    .hero-overlay{position:absolute;bottom:0;left:0;right:0;padding:36px;background:linear-gradient(transparent,rgba(0,0,0,0.9))}
    .hero-overlay .cat{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#d4a843}
    .hero-overlay h1{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:600;color:#fff}
    .hero-overlay .variant{font-size:13px;color:#999;margin:4px 0 12px}
    .hero-overlay .price{font-family:'Cormorant Garamond',serif;font-size:30px;color:#d4a843}
    .gallery{display:flex;gap:8px;margin-top:12px;padding:0 16px 16px}
    .gallery-thumb{width:68px;height:50px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent;opacity:0.6;transition:all .2s}
    .gallery-thumb:hover{border-color:#d4a843;opacity:1}
    .section{background:#161616;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #2a2218}
    .section h3{font-family:'Cormorant Garamond',serif;font-size:20px;color:#d4a843;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #2a2218}
    .specs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:600px){.specs-grid{grid-template-columns:1fr 1fr}}
    .spec-card{background:#1a1a1a;border-radius:8px;padding:14px;border:1px solid #2a2218}
    .spec-card .label{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1px}
    .spec-card .val{font-size:14px;font-weight:600;color:#fff;margin-top:2px}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{background:#1a1a1a;border-radius:8px;padding:12px;border:1px solid #2a2218}
    .fin-label{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:0.5px}
    .fin-value{font-size:14px;font-weight:600;color:#d4a843}
    .tags{display:flex;flex-wrap:wrap;gap:8px}
    .tag{font-size:11px;border:1px solid #2a2218;padding:6px 14px;border-radius:100px;color:#bbb;background:#1a1a1a}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #222}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#777}
    .cons-value{font-size:12px;font-weight:600;color:#eee}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #2a2218}
    .cons-sub-title{font-size:12px;font-weight:600;color:#d4a843;margin-bottom:8px}
    .dealer-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#aaa}
    .dealer-info strong{display:block;font-family:'Cormorant Garamond',serif;font-size:18px;color:#d4a843}
    .rate-box{background:linear-gradient(135deg,#d4a843,#b8892e);color:#0d0d0d;border-radius:12px;padding:20px;text-align:center}
    .rate-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:0.7}
    .rate-amount{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:700}
    .rate-period{font-size:12px;opacity:0.7}
    .footer{text-align:center;padding:20px;font-size:11px;color:#555}
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}"/>` : ''}
      <div class="hero-overlay">
        <div class="cat">${data.category||'Angebot'}</div>
        <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
        <div class="variant">${data.vehicle.variant||''}</div>
        <div class="price">${data.finance.totalPrice||'–'}</div>
      </div>
    </div>
    ${allImages.length > 1 ? `<div style="margin-bottom:20px">${galleryHTML}</div>` : ''}
    <div class="section"><h3>Fahrzeugdaten</h3>
      <div class="specs-grid">
        <div class="spec-card"><div class="label">Typ</div><div class="val">${data.category||'–'}</div></div>
        <div class="spec-card"><div class="label">Getriebe</div><div class="val">${data.vehicle.transmission||'–'}</div></div>
        <div class="spec-card"><div class="label">Leistung</div><div class="val">${data.vehicle.power||'–'}</div></div>
        <div class="spec-card"><div class="label">Kraftstoff</div><div class="val">${data.vehicle.fuelType||'–'}</div></div>
        <div class="spec-card"><div class="label">Farbe</div><div class="val">${data.vehicle.color||'–'}</div></div>
        <div class="spec-card"><div class="label">Baujahr</div><div class="val">${data.vehicle.year||'–'}</div></div>
      </div>
    </div>
    <div class="section"><h3>${getFinanceSectionTitle(data)}</h3><div class="fin-grid">${financeItems}</div></div>
    ${hasConsumption ? `<div class="section"><h3>Verbrauch & Emissionen</h3>
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div></div></div></div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}
    ${features ? `<div class="section"><h3>Ausstattung</h3><div class="tags">${features}</div></div>` : ''}
    <div class="section"><h3>Ihr Ansprechpartner</h3>
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
