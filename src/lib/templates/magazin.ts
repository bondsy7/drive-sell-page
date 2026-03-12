import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildWhatsAppButtonHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle } from "./shared";

export function generateMagazinHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
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
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Newsreader:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Outfit',sans-serif;background:#f8fafc;color:#1e293b}
    .container{max-width:960px;margin:0 auto;padding:24px}
    .masthead{display:flex;justify-content:space-between;align-items:center;padding:14px 0;margin-bottom:24px;border-bottom:3px solid #2563eb}
    .masthead .logo{font-family:'Newsreader',serif;font-size:20px;font-weight:700;color:#1e293b}
    .masthead .issue{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px}
    .hero-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:0;margin-bottom:28px;background:#fff;overflow:hidden;border-radius:12px;box-shadow:0 2px 16px rgba(30,41,59,0.06);border:1px solid #e2e8f0}
    @media(max-width:768px){.hero-grid{grid-template-columns:1fr}}
    .hero-img{position:relative}
    .hero-img img#mainImg{width:100%;height:100%;min-height:360px;object-fit:cover}
    .hero-info{padding:32px;display:flex;flex-direction:column;justify-content:center}
    .hero-info .cat{font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#2563eb;font-weight:700;margin-bottom:8px}
    .hero-info h1{font-family:'Newsreader',serif;font-size:28px;font-weight:700;line-height:1.2;color:#1e293b}
    .hero-info .variant{font-size:13px;color:#94a3b8;margin:6px 0 16px;font-style:italic}
    .hero-info .price{font-size:26px;font-weight:800;color:#2563eb}
    .hero-info .rate-inline{display:inline-flex;align-items:baseline;gap:6px;margin-top:8px;font-size:13px;color:#64748b}
    .hero-info .rate-inline strong{font-size:18px;color:#1e293b}
    .gallery{display:flex;gap:6px;padding:12px;background:#f1f5f9;overflow-x:auto;max-width:100%}
    .gallery-thumb{width:72px;height:54px;object-fit:cover;border-radius:6px;cursor:pointer;opacity:0.5;transition:all .2s;flex-shrink:0}
    .gallery-thumb:hover{opacity:1}
    .columns{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
    @media(max-width:768px){.columns{grid-template-columns:1fr}}
    .col-card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 6px rgba(30,41,59,0.04);border:1px solid #e2e8f0}
    .col-card h3{font-family:'Newsreader',serif;font-size:16px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #2563eb;display:inline-block;color:#1e293b}
    .specs-list .item{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
    .specs-list .item:last-child{border-bottom:none}
    .specs-list .item .lbl{color:#94a3b8}
    .specs-list .item .val{font-weight:600;color:#1e293b}
    .fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .fin-item{padding:10px;background:#eff6ff;border-radius:8px;border:1px solid #dbeafe}
    .fin-label{font-size:10px;color:#94a3b8}
    .fin-value{font-size:13px;font-weight:600;color:#1e40af}
    .full-card{background:#fff;border-radius:12px;padding:24px;margin-bottom:20px;box-shadow:0 1px 6px rgba(30,41,59,0.04);border:1px solid #e2e8f0}
    .full-card h3{font-family:'Newsreader',serif;font-size:16px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #2563eb;display:inline-block;color:#1e293b}
    .tags{display:flex;flex-wrap:wrap;gap:6px}
    .tag{font-size:11px;padding:5px 12px;border:1px solid #e2e8f0;border-radius:100px;color:#475569;background:#f8fafc}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#94a3b8}
    .cons-value{font-size:12px;font-weight:600;color:#1e293b}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0}
    .cons-sub-title{font-size:11px;font-weight:600;color:#2563eb;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
    .dealer-grid{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#64748b}
    .dealer-info strong{display:block;font-family:'Newsreader',serif;font-size:16px;color:#1e293b}
    .rate-badge{background:linear-gradient(135deg,#2563eb,#1e40af);color:#fff;padding:24px 28px;border-radius:12px;text-align:center}
    .rate-badge .amount{font-size:28px;font-weight:700}
    .rate-badge .period{font-size:11px;opacity:0.8;margin-top:2px}
    .footer{text-align:center;padding:24px;font-size:11px;color:#cbd5e1;border-top:1px solid #e2e8f0}
  </style>
</head>
<body>
  <div class="container">
    <div class="masthead">
      <div class="logo">AutoPage</div>
      <div class="issue">${data.category||'Fahrzeugangebot'}</div>
    </div>
    <div class="hero-grid">
      <div class="hero-img">
        ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}"/>` : ''}
        ${allImages.length > 1 ? galleryHTML : ''}
      </div>
      <div class="hero-info">
        <div class="cat">${data.category||'Angebot'}</div>
        <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
        <div class="variant">${data.vehicle.variant||''}</div>
        <div class="price">${data.finance.totalPrice||'–'}</div>
        <div class="rate-inline">ab <strong>${data.finance.monthlyRate||'–'}</strong> / Monat</div>
      </div>
    </div>
    <div class="columns">
      <div class="col-card"><h3>Fahrzeugdaten</h3>
        <div class="specs-list">
          <div class="item"><span class="lbl">Typ</span><span class="val">${data.category||'–'}</span></div>
          <div class="item"><span class="lbl">Getriebe</span><span class="val">${data.vehicle.transmission||'–'}</span></div>
          <div class="item"><span class="lbl">Leistung</span><span class="val">${data.vehicle.power||'–'}</span></div>
          <div class="item"><span class="lbl">Kraftstoff</span><span class="val">${data.vehicle.fuelType||'–'}</span></div>
          <div class="item"><span class="lbl">Farbe</span><span class="val">${data.vehicle.color||'–'}</span></div>
          <div class="item"><span class="lbl">Baujahr</span><span class="val">${data.vehicle.year||'–'}</span></div>
          ${data.vehicle.vin ? `<div class="item"><span class="lbl">VIN</span><span class="val" style="font-family:monospace">${data.vehicle.vin}</span></div>` : ''}
        </div>
      </div>
      <div class="col-card"><h3>${getFinanceSectionTitle(data)}</h3><div class="fin-grid">${financeItems}</div></div>
    </div>
    ${hasConsumption ? `<div class="full-card"><h3>Verbrauch & Emissionen</h3>
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div></div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}
    ${features ? `<div class="full-card"><h3>Ausstattung</h3><div class="tags">${features}</div></div>` : ''}
    <div class="full-card"><h3>Händler & Kontakt</h3>
      <div class="dealer-grid">
        <div class="dealer-info">
          ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:40px;margin-bottom:8px" />` : ''}
          <strong>${data.dealer.name||'–'}</strong>${buildDealerAddressHTML(data.dealer)}<br/>${data.dealer.phone||''}<br/>${data.dealer.email||''}<br/>${buildWebsiteLinkHTML(data.dealer)}
          ${buildDealerFooterHTML(data.dealer)}
          ${buildSocialLinksHTML(data.dealer)}
          ${buildWhatsAppButtonHTML(data.dealer, `${data.vehicle.brand} ${data.vehicle.model}`)}
        </div>
        <div class="rate-badge"><div class="amount">${data.finance.monthlyRate||'–'}</div><div class="period">pro Monat</div></div>
      </div>
    </div>
    ${buildLegalTextHTML(data)}
  </div>
  <div class="footer">Alle Angaben ohne Gewähr.</div>
</body></html>`;
}