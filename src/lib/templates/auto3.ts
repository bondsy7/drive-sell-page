import { VehicleData } from "@/types/vehicle";
import {
  getCO2LabelHTML, getGalleryHTML, getConsumptionData,
  buildConsumptionRows, buildDetailedConsumption, buildCostRows,
  buildFinanceItems, buildFeatures, buildSocialLinksHTML,
  buildWhatsAppButtonHTML, buildLegalTextHTML, buildDealerAddressHTML,
  buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle,
  vatNoteHTML, getMonthlyRateLabel, customerTypeBadgeHTML,
} from "./shared";

export function generateAuto3HTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
  const consumption = getConsumptionData(data);
  const allImages = [imageBase64, ...galleryImages].filter(Boolean) as string[];
  const features = buildFeatures(data);
  const financeItems = buildFinanceItems(data);
  const consumptionRows = buildConsumptionRows(consumption);
  const detailedConsumption = buildDetailedConsumption(consumption);
  const costRows = buildCostRows(consumption);
  const galleryHTML = getGalleryHTML(allImages);
  const hasConsumption = consumptionRows || detailedConsumption || costRows;

  const cat = (data.category || '').toLowerCase();
  const isBuy = cat.includes('barkauf') || cat.includes('neuwagen') || cat.includes('gebrauchtwagen') || cat.includes('tageszulassung');
  const isLeasing = cat.includes('leasing');
  const priceLabel = isLeasing ? 'Leasingpreis' : 'Fahrzeugpreis';
  const sup = `<sup style="font-size:0.55em;vertical-align:super;font-weight:700;margin-left:2px">1</sup>`;

  const accent = data.templateColors?.accent || '#e30613';
  const dark = data.templateColors?.dark || '#111111';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} – Angebot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    :root{--accent:${accent};--dark:${dark};}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#ffffff;color:var(--dark);line-height:1.5}
    .container{max-width:1280px;margin:0 auto;padding:32px 24px}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}
    @media(max-width:720px){.layout{grid-template-columns:1fr}}
    .gallery-main{position:relative;border-radius:16px;overflow:hidden;background:#f4f4f4}
    .gallery-main img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}
    .thumbs{display:flex;gap:8px;margin-top:12px;overflow-x:auto;padding-bottom:4px}
    .thumb{width:96px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0;cursor:pointer;border:2px solid transparent;transition:.2s}
    .thumb:hover{border-color:var(--accent)}
    .title-block{margin-top:24px}
    .title-block h1{font-size:28px;font-weight:700;color:var(--dark)}
    .title-block .variant{font-size:14px;color:#666;margin-top:4px}
    .specs{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:20px;border:1px solid #eaeaea;border-radius:12px;padding:18px 22px}
    @media(max-width:640px){.specs{grid-template-columns:repeat(2,1fr)}}
    .spec{padding:10px 6px}
    .spec-label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:600}
    .spec-value{font-size:14px;font-weight:600;color:var(--dark);margin-top:4px}
    .section{margin-top:28px}
    .section h2{font-size:18px;font-weight:700;margin-bottom:14px;color:var(--dark)}
    .badges{display:flex;flex-wrap:wrap;gap:8px}
    .badge,.tag{display:inline-block;background:var(--dark);color:#fff;font-size:11px;font-weight:600;padding:6px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.5px}
    .accordion{border:1px solid #eaeaea;border-radius:12px;padding:18px 22px;margin-top:12px}
    .accordion h3{font-size:14px;font-weight:700;margin-bottom:14px;color:var(--dark);display:flex;justify-content:space-between;align-items:center}
    .cons-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px}
    .cons-row:last-child{border-bottom:none}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:640px){.cons-grid{grid-template-columns:1fr}}
    .fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    @media(max-width:600px){.fin-grid{grid-template-columns:1fr 1fr}}
    .fin-item{background:#f7f7f7;border-radius:10px;padding:12px}
    .fin-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px}
    .fin-value{font-size:14px;font-weight:700;color:var(--dark);margin-top:2px}

    /* Sidebar cards */
    .side-card{background:#fff;border:1px solid #eaeaea;border-radius:14px;padding:22px;margin-bottom:20px;box-shadow:0 2px 14px rgba(0,0,0,.04)}
    .side-card h4{font-size:13px;font-weight:700;color:var(--dark);margin-bottom:6px}
    .side-card .muted{font-size:12px;color:#777;margin-bottom:14px}
    .price-row{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 4px}
    .price-label{font-size:13px;color:#666;font-weight:500}
    .price{font-size:26px;font-weight:800;color:var(--dark)}
    .price-sub{font-size:11px;color:#999;text-align:right}
    .cta{display:block;width:100%;text-align:center;background:var(--accent);color:#fff;font-weight:700;font-size:14px;padding:14px;border-radius:10px;text-decoration:none;margin-top:14px;border:none;cursor:pointer}
    .cta.secondary{background:transparent;color:var(--accent);border:2px solid var(--accent);margin-top:10px}
    .toggle-row{display:flex;gap:6px;background:#f4f4f4;border-radius:10px;padding:4px;margin-bottom:14px}
    .toggle-row span{flex:1;text-align:center;padding:8px;font-size:12px;font-weight:600;border-radius:7px;color:#666;cursor:pointer}
    .toggle-row span.active{background:var(--dark);color:#fff}
    .form-field{margin-bottom:12px}
    .form-field label{display:block;font-size:11px;font-weight:600;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
    .form-field input,.form-field textarea{width:100%;border:1px solid #d4d4d4;border-radius:8px;padding:10px 12px;font-size:13px;font-family:inherit}
    .form-field textarea{min-height:96px;resize:vertical}

    /* Dealer */
    .dealer-block{margin-top:28px;padding-top:24px;border-top:1px solid #eaeaea;display:grid;grid-template-columns:1fr 1fr;gap:24px}
    @media(max-width:640px){.dealer-block{grid-template-columns:1fr}}
    .dealer-info{font-size:13px;line-height:1.8;color:#555}
    .dealer-info strong{display:block;font-size:15px;color:var(--dark);margin-bottom:4px}
    .footer{text-align:center;padding:24px;font-size:11px;color:#aaa;border-top:1px solid #eaeaea;margin-top:32px}
  </style>
</head>
<body>
  <div class="container">
    <div class="layout">
      <!-- LEFT: Gallery + details -->
      <div>
        <div class="gallery-main">
          ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}" />` : `<div style="padding:120px;text-align:center;color:#aaa">Kein Bild</div>`}
        </div>
        ${allImages.length > 1 ? `<div class="thumbs">${allImages.map(img => `<img class="thumb" src="${img}" alt="" />`).join('')}</div>` : galleryHTML}

        <div class="title-block">
          ${customerTypeBadgeHTML(data)}
          <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
          <div class="variant">${data.vehicle.variant || ''}</div>
        </div>

        <div class="specs">
          <div class="spec"><div class="spec-label">Fahrzeugtyp</div><div class="spec-value">${data.vehicle.bodyType || '–'}</div></div>
          <div class="spec"><div class="spec-label">Getriebe</div><div class="spec-value">${data.vehicle.transmission || '–'}</div></div>
          <div class="spec"><div class="spec-label">Leistung</div><div class="spec-value">${data.vehicle.power || '–'}</div></div>
          <div class="spec"><div class="spec-label">Kraftstoff</div><div class="spec-value">${data.vehicle.fuelType || '–'}</div></div>
          <div class="spec"><div class="spec-label">Kilometerstand</div><div class="spec-value">${consumption.mileage || '–'}${consumption.mileage ? ' km' : ''}</div></div>
          <div class="spec"><div class="spec-label">Erstzulassung</div><div class="spec-value">${data.vehicle.year || '–'}</div></div>
        </div>

        ${features ? `<div class="section"><h2>Ausstattung</h2><div class="badges">${features}</div></div>` : ''}

        ${hasConsumption ? `<div class="section"><h2>Verbrauch & Umwelt</h2>
          <div class="accordion">
            <div class="cons-grid">
              <div>${consumptionRows || ''}${detailedConsumption || ''}${costRows || ''}</div>
              <div style="display:flex;align-items:center;justify-content:center">${getCO2LabelHTML(consumption)}</div>
            </div>
          </div>
        </div>` : ''}

        <div class="section"><h2>${getFinanceSectionTitle(data)}</h2>
          <div class="accordion"><div class="fin-grid">${financeItems}</div></div>
        </div>

        <div class="dealer-block">
          <div class="dealer-info">
            ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:48px;margin-bottom:8px" />` : ''}
            <strong>${data.dealer.name || '–'}</strong>
            ${buildDealerAddressHTML(data.dealer)}<br/>${data.dealer.phone || ''}<br/>${data.dealer.email || ''}<br/>${buildWebsiteLinkHTML(data.dealer)}
            ${buildDealerFooterHTML(data.dealer)}
            ${buildSocialLinksHTML(data.dealer)}
            ${buildWhatsAppButtonHTML(data.dealer, `${data.vehicle.brand} ${data.vehicle.model}`)}
          </div>
          <div></div>
        </div>

        ${buildLegalTextHTML(data)}
      </div>

      <!-- RIGHT: Offer + Inquiry -->
      <aside>
        <div class="side-card">
          <h4>Mehr Angebote</h4>
          <div class="muted">Wähle Deine Finanzierungsart</div>
          <div class="toggle-row">
            <span>Leasing</span>
            <span class="active">Kauf / Finanzierung</span>
            <span>Abo +</span>
          </div>
          <div class="price-row">
            <span class="price-label">Fahrzeugpreis</span>
            <span class="price">${data.finance.totalPrice || '–'}</span>
          </div>
          ${vatNoteHTML(data, 'display:block;text-align:right;font-size:11px;color:#999')}
          ${data.finance.monthlyRate ? `<div style="font-size:12px;color:#666;margin-top:8px">oder ab <strong>${data.finance.monthlyRate} €/mtl.</strong> / ${getMonthlyRateLabel(data)} auf Anfrage möglich</div>` : ''}
        </div>

        <div class="side-card" id="anfrage">
          <h4>Fahrzeuganfrage</h4>
          <div class="form-field"><label>Vorname*</label><input type="text" /></div>
          <div class="form-field"><label>Nachname*</label><input type="text" /></div>
          <div class="form-field"><label>E-Mail-Adresse*</label><input type="email" /></div>
          <div class="form-field"><label>Telefonnummer*</label><input type="tel" /></div>
          <div class="form-field"><label>Ihre Nachricht (optional)</label><textarea>Hallo,
ich interessiere mich für das angebotene Fahrzeug ${data.vehicle.brand} ${data.vehicle.model} und bitte um weitere Informationen.
Mit freundlichen Grüßen</textarea></div>
          <button class="cta">Senden</button>
          ${data.dealer.phone ? `<a href="tel:${data.dealer.phone}" class="cta secondary">Anrufen</a>` : ''}
        </div>
      </aside>
    </div>
  </div>
  <div class="footer">Alle Angaben ohne Gewähr.</div>
</body></html>`;
}
