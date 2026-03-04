import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildWhatsAppButtonHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle } from "./shared";

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
    body{font-family:'Montserrat',sans-serif;background:#0a0c10;color:#c8cad0}
    .container{max-width:960px;margin:0 auto;padding:24px}
    .gold{color:#c9a84c}
    .hero{position:relative;border-radius:14px;overflow:hidden;margin-bottom:28px;border:1px solid rgba(201,168,76,0.15)}
    .hero img#mainImg{width:100%;max-height:440px;object-fit:cover}
    .hero-overlay{position:absolute;bottom:0;left:0;right:0;padding:36px;background:linear-gradient(transparent,rgba(10,12,16,0.95))}
    .hero-overlay .cat{font-size:10px;text-transform:uppercase;letter-spacing:4px;color:#c9a84c;font-weight:500}
    .hero-overlay h1{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:600;color:#fff}
    .hero-overlay .variant{font-size:13px;color:#7a7e8a;margin:4px 0 12px}
    .hero-overlay .price{font-family:'Cormorant Garamond',serif;font-size:30px;color:#c9a84c}
    .gallery{display:flex;gap:8px;margin-top:12px;padding:0 16px 16px}
    .gallery-thumb{width:68px;height:50px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent;opacity:0.5;transition:all .2s}
    .gallery-thumb:hover{border-color:#c9a84c;opacity:1}
    .section{background:#10131a;border-radius:14px;padding:24px;margin-bottom:16px;border:1px solid #1c2030}
    .section h3{font-family:'Cormorant Garamond',serif;font-size:20px;color:#c9a84c;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #1c2030}
    .specs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    @media(max-width:600px){.specs-grid{grid-template-columns:1fr 1fr}}
    .spec-card{background:#141824;border-radius:8px;padding:14px;border:1px solid #1c2030}
    .spec-card .label{font-size:10px;color:#5a6070;text-transform:uppercase;letter-spacing:1px}
    .spec-card .val{font-size:14px;font-weight:600;color:#e8eaed;margin-top:2px}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{background:#141824;border-radius:8px;padding:12px;border:1px solid #1c2030}
    .fin-label{font-size:10px;color:#5a6070;text-transform:uppercase;letter-spacing:0.5px}
    .fin-value{font-size:14px;font-weight:600;color:#c9a84c}
    .tags{display:flex;flex-wrap:wrap;gap:6px}
    .tag{font-size:11px;border:1px solid #1c2030;padding:5px 14px;border-radius:100px;color:#8a90a0;background:#141824}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1c2030}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#5a6070}
    .cons-value{font-size:12px;font-weight:600;color:#e8eaed}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #1c2030}
    .cons-sub-title{font-size:12px;font-weight:600;color:#c9a84c;margin-bottom:8px}
    .dealer-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#8a90a0}
    .dealer-info strong{display:block;font-family:'Cormorant Garamond',serif;font-size:18px;color:#c9a84c}
    .rate-box{background:linear-gradient(135deg,#c9a84c,#a6872e);color:#0a0c10;border-radius:12px;padding:24px;text-align:center}
    .rate-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:0.7}
    .rate-amount{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:700;margin:4px 0}
    .rate-period{font-size:12px;opacity:0.7}
    .footer{text-align:center;padding:20px;font-size:11px;color:#3a3f50}
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
    ${allImages.length > 1 ? `<div style="margin-bottom:16px">${galleryHTML}</div>` : ''}
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
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div></div>
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