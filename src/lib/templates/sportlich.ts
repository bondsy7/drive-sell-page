import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, determineCO2Class, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures } from "./shared";

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
    body{font-family:'Inter',sans-serif;background:#0a0a0a;color:#e5e5e5}
    .container{max-width:960px;margin:0 auto;padding:24px}
    .hero{position:relative;border-radius:16px;overflow:hidden;margin-bottom:24px}
    .hero img#mainImg{width:100%;max-height:420px;object-fit:cover;display:block}
    .hero-overlay{position:absolute;bottom:0;left:0;right:0;padding:32px;background:linear-gradient(transparent,rgba(0,0,0,0.85))}
    .hero-overlay h1{font-family:'Rajdhani',sans-serif;font-size:32px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px}
    .hero-overlay .price{font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:#ef4444}
    .gallery{display:flex;gap:8px;margin-top:12px;padding:0 16px 16px}
    .gallery-thumb{width:72px;height:52px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent;transition:border-color .2s;opacity:0.7}
    .gallery-thumb:hover{border-color:#ef4444;opacity:1}
    .section{background:#141414;border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid #222}
    .section h3{font-family:'Rajdhani',sans-serif;font-size:18px;font-weight:600;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px}
    .specs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:600px){.specs-grid{grid-template-columns:1fr 1fr}}
    .spec-card{background:#1a1a1a;border-radius:10px;padding:14px;border-left:3px solid #ef4444}
    .spec-card .label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px}
    .spec-card .val{font-size:14px;font-weight:600;color:#fff;margin-top:2px}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{background:#1a1a1a;border-radius:10px;padding:12px}
    .fin-label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px}
    .fin-value{font-size:14px;font-weight:600;color:#fff}
    .tags{display:flex;flex-wrap:wrap;gap:8px}
    .tag{font-size:11px;border:1px solid #333;padding:6px 14px;border-radius:6px;color:#ccc;background:#1a1a1a}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:600px){.cons-grid{grid-template-columns:1fr}}
    .cons-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #222}
    .cons-row:last-child{border-bottom:none}
    .cons-label{font-size:11px;color:#666}
    .cons-value{font-size:12px;font-weight:600;color:#fff}
    .cons-sub{margin-top:16px;padding-top:16px;border-top:1px solid #222}
    .cons-sub-title{font-size:12px;font-weight:600;color:#ef4444;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px}
    .dealer-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:600px){.dealer-grid{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#aaa}
    .dealer-info strong{display:block;font-size:15px;color:#fff}
    .rate-box{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border-radius:12px;padding:20px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .rate-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:0.8}
    .rate-amount{font-family:'Rajdhani',sans-serif;font-size:32px;font-weight:700}
    .rate-period{font-size:12px;opacity:0.8}
    .footer{text-align:center;padding:20px;font-size:11px;color:#444}
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}"/>` : ''}
      <div class="hero-overlay">
        <div style="font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">${data.category || 'Angebot'}</div>
        <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
        <div style="font-size:13px;color:#999;margin-bottom:8px">${data.vehicle.variant || ''}</div>
        <div class="price">${data.finance.totalPrice || '–'}</div>
      </div>
    </div>
    ${allImages.length > 1 ? `<div style="margin-bottom:20px">${galleryHTML}</div>` : ''}

    <div class="section"><h3>Technische Daten</h3>
      <div class="specs-grid">
        <div class="spec-card"><div class="label">Typ</div><div class="val">${data.category||'–'}</div></div>
        <div class="spec-card"><div class="label">Getriebe</div><div class="val">${data.vehicle.transmission||'–'}</div></div>
        <div class="spec-card"><div class="label">Leistung</div><div class="val">${data.vehicle.power||'–'}</div></div>
        <div class="spec-card"><div class="label">Kraftstoff</div><div class="val">${data.vehicle.fuelType||'–'}</div></div>
        <div class="spec-card"><div class="label">Farbe</div><div class="val">${data.vehicle.color||'–'}</div></div>
        <div class="spec-card"><div class="label">Baujahr</div><div class="val">${data.vehicle.year||'–'}</div></div>
      </div>
    </div>
    <div class="section"><h3>Finanzierung</h3><div class="fin-grid">${financeItems}</div></div>
    ${hasConsumption ? `<div class="section"><h3>Verbrauch & Emissionen</h3>
      <div class="cons-grid"><div>${consumptionRows}</div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:12px;font-weight:600;margin-bottom:8px;color:#ef4444">CO₂-Effizienz</div>${getCO2LabelHTML(determineCO2Class(consumption))}</div></div>
      ${detailedConsumption ? `<div class="cons-sub"><div class="cons-sub-title">Verbrauch im Detail</div><div class="cons-grid"><div>${detailedConsumption}</div><div></div></div></div>` : ''}
      ${costRows ? `<div class="cons-sub"><div class="cons-sub-title">Kosten</div><div class="cons-grid"><div>${costRows}</div><div></div></div></div>` : ''}
    </div>` : ''}
    ${features ? `<div class="section"><h3>Ausstattung</h3><div class="tags">${features}</div></div>` : ''}
    <div class="section"><h3>Händler</h3>
      <div class="dealer-grid">
        <div class="dealer-info"><strong>${data.dealer.name||'–'}</strong>${data.dealer.address||''}<br/>${data.dealer.phone||''}<br/>${data.dealer.email||''}<br/>${data.dealer.website||''}</div>
        <div class="rate-box"><div class="rate-label">Monatliche Rate</div><div class="rate-amount">${data.finance.monthlyRate||'–'}</div><div class="rate-period">pro Monat</div></div>
      </div>
    </div>
  </div>
  <div class="footer">Alle Angaben ohne Gewähr.</div>
</body></html>`;
}
