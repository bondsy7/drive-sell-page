import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML } from "./shared";

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
    body{font-family:'Outfit',sans-serif;background:#fafafa;color:#1a1a1a}
    .container{max-width:960px;margin:0 auto;padding:24px}
    .masthead{display:flex;justify-content:space-between;align-items:center;padding:12px 0;margin-bottom:24px;border-bottom:3px solid #c026d3}
    .masthead .logo{font-family:'Newsreader',serif;font-size:20px;font-weight:700}
    .masthead .issue{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:2px}
    .hero-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:0;margin-bottom:28px;background:#fff;overflow:hidden;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
    @media(max-width:768px){.hero-grid{grid-template-columns:1fr}}
    .hero-img{position:relative}
    .hero-img img#mainImg{width:100%;height:100%;min-height:360px;object-fit:cover}
    .hero-info{padding:32px;display:flex;flex-direction:column;justify-content:center}
    .hero-info .cat{font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#c026d3;font-weight:700;margin-bottom:8px}
    .hero-info h1{font-family:'Newsreader',serif;font-size:30px;font-weight:700;line-height:1.2}
    .hero-info .variant{font-size:13px;color:#888;margin:6px 0 16px;font-style:italic}
    .hero-info .price{font-size:28px;font-weight:800;color:#c026d3}
    .hero-info .rate-inline{display:inline-flex;align-items:baseline;gap:6px;margin-top:8px;font-size:13px;color:#666}
    .hero-info .rate-inline strong{font-size:18px;color:#1a1a1a}
    .gallery{display:flex;gap:6px;padding:12px;background:rgba(0,0,0,0.03)}
    .gallery-thumb{width:72px;height:54px;object-fit:cover;border-radius:4px;cursor:pointer;opacity:0.6;transition:opacity .2s}
    .gallery-thumb:hover{opacity:1}
    .columns{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
    @media(max-width:768px){.columns{grid-template-columns:1fr}}
    .col-card{background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
    .col-card h3{font-family:'Newsreader',serif;font-size:16px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #c026d3;display:inline-block}
    .specs-list .item{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px}
    .specs-list .item:last-child{border-bottom:none}
    .specs-list .item .lbl{color:#888}
    .specs-list .item .val{font-weight:600}
    .fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .fin-item{padding:10px;background:#faf5ff;border-radius:6px}
    .fin-label{font-size:10px;color:#999}
    .fin-value{font-size:13px;font-weight:600;color:#7e22ce}
    .full-card{background:#fff;border-radius:8px;padding:24px;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
    .full-card h3{font-family:'Newsreader',serif;font-size:16px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #c026d3;display:inline-block}
    .tags{display:flex;flex-wrap:wrap;gap:6px}
    .tag{font-size:11px;padding:5px 12px;border:1px solid #e8e8e8;border-radius:100px;color:#666;background:#fafafa}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#888}
    .cons-value{font-size:12px;font-weight:600}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #eee}
    .cons-sub-title{font-size:11px;font-weight:600;color:#c026d3;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
    .dealer-grid{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#666}
    .dealer-info strong{display:block;font-family:'Newsreader',serif;font-size:16px;color:#1a1a1a}
    .rate-badge{background:linear-gradient(135deg,#c026d3,#7e22ce);color:#fff;padding:20px 28px;border-radius:8px;text-align:center}
    .rate-badge .amount{font-size:28px;font-weight:700}
    .rate-badge .period{font-size:11px;opacity:0.8}
    .footer{text-align:center;padding:24px;font-size:11px;color:#bbb;border-top:1px solid #eee}
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
        </div>
      </div>
      <div class="col-card"><h3>Finanzierung</h3><div class="fin-grid">${financeItems}</div></div>
    </div>
    ${hasConsumption ? `<div class="full-card"><h3>Verbrauch & Emissionen</h3>
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div></div></div></div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}
    ${features ? `<div class="full-card"><h3>Ausstattung</h3><div class="tags">${features}</div></div>` : ''}
    <div class="full-card"><h3>Händler & Kontakt</h3>
      <div class="dealer-grid">
        <div class="dealer-info">
          ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:40px;margin-bottom:8px" />` : ''}
          <strong>${data.dealer.name||'–'}</strong>${buildDealerAddressHTML(data.dealer)}<br/>${data.dealer.phone||''}<br/>${data.dealer.email||''}<br/>${data.dealer.website||''}
          ${buildDealerFooterHTML(data.dealer)}
          ${buildSocialLinksHTML(data.dealer)}
        </div>
        <div class="rate-badge"><div class="amount">${data.finance.monthlyRate||'–'}</div><div class="period">pro Monat</div></div>
      </div>
    </div>
    ${buildLegalTextHTML(data)}
  </div>
  <div class="footer">Alle Angaben ohne Gewähr. Irrtümer und Änderungen vorbehalten.</div>
</body></html>`;
}
