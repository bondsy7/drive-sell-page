import { VehicleData } from "@/types/vehicle";
import { getCO2LabelHTML, getGalleryHTML, getConsumptionData, buildConsumptionRows, buildDetailedConsumption, buildCostRows, buildFinanceItems, buildFeatures, buildSocialLinksHTML, buildWhatsAppButtonHTML, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildWebsiteLinkHTML, getFinanceSectionTitle, buildVinHTML } from "./shared";

export function generateAutohausHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
  const consumption = getConsumptionData(data);
  const allImages = [imageBase64, ...galleryImages].filter(Boolean) as string[];
  const features = buildFeatures(data, 'ah-tag');
  const financeItems = buildFinanceItems(data, 'ah-fin-item', 'ah-fin-label', 'ah-fin-value');
  const consumptionRows = buildConsumptionRows(consumption, 'ah-row', 'ah-row-label', 'ah-row-value');
  const detailedConsumption = buildDetailedConsumption(consumption, 'ah-row', 'ah-row-label', 'ah-row-value');
  const costRows = buildCostRows(consumption, 'ah-row', 'ah-row-label', 'ah-row-value');
  const galleryHTML = getGalleryHTML(allImages);
  const hasConsumption = consumptionRows || detailedConsumption || costRows;
  const cat = (data.category || '').toLowerCase();
  const isBuy = cat.includes('barkauf') || cat.includes('neuwagen') || cat.includes('gebrauchtwagen') || cat.includes('tageszulassung') || cat.includes('kauf');

  const accordionSections: { id: string; title: string; content: string }[] = [];

  // Finance accordion
  if (financeItems) {
    accordionSections.push({
      id: 'finance',
      title: getFinanceSectionTitle(data),
      content: `<div class="ah-fin-grid">${financeItems}</div>`,
    });
  }

  // Consumption accordion
  if (hasConsumption) {
    accordionSections.push({
      id: 'consumption',
      title: 'Verbrauch & Emissionen',
      content: `
        <div class="ah-cons-layout">
          <div>${consumptionRows}</div>
          <div class="ah-co2-label">${getCO2LabelHTML(consumption)}</div>
        </div>
        ${detailedConsumption ? `<div class="ah-cons-sub"><div class="ah-cons-sub-title">Verbrauch im Detail</div>${detailedConsumption}</div>` : ''}
        ${costRows ? `<div class="ah-cons-sub"><div class="ah-cons-sub-title">Kosten</div>${costRows}</div>` : ''}
      `,
    });
  }

  // Features accordion
  if (features) {
    accordionSections.push({
      id: 'features',
      title: 'Ausstattung & Extras',
      content: `<div class="ah-tags">${features}</div>`,
    });
  }

  const accordionsHTML = accordionSections.map((s, i) => `
    <div class="ah-accordion">
      <button class="ah-acc-trigger" onclick="toggleAccordion('${s.id}')" aria-expanded="${i === 0 ? 'true' : 'false'}">
        <span>${s.title}</span>
        <svg class="ah-acc-chevron" id="chevron-${s.id}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${i === 0 ? 'transform:rotate(180deg)' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="ah-acc-content" id="acc-${s.id}" style="${i === 0 ? '' : 'display:none'}">
        ${s.content}
      </div>
    </div>
  `).join('');

  const specs = [
    ['Leistung', data.vehicle.power],
    ['Getriebe', data.vehicle.transmission],
    ['Kraftstoff', data.vehicle.fuelType],
    ['Farbe', data.vehicle.color],
    ['Baujahr', data.vehicle.year],
  ].filter(([, v]) => v);

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} – Angebot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#f5f5f5;color:#1a1a1a}

    /* === TWO-COLUMN LAYOUT === */
    .ah-wrapper{max-width:1248px;margin:0 auto;padding:24px;display:flex;gap:31px;align-items:flex-start}
    .ah-main{flex:1;max-width:822px;min-width:0}
    .ah-sidebar{width:395px;flex-shrink:0;position:sticky;top:24px}

    @media(max-width:1024px){
      .ah-wrapper{flex-direction:column;max-width:700px}
      .ah-sidebar{width:100%;position:static}
    }

    /* === HERO IMAGE === */
    .ah-hero{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;margin-bottom:20px}
    .ah-hero img#mainImg{width:100%;height:auto;max-height:500px;object-fit:cover;display:block}
    .ah-gallery{display:flex;gap:8px;padding:12px;overflow-x:auto;background:#fafafa}
    .ah-gallery-thumb{width:72px;height:54px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:all .2s;opacity:0.7}
    .ah-gallery-thumb:hover,.ah-gallery-thumb.active{border-color:#1a1a1a;opacity:1}

    /* === ACCORDION === */
    .ah-accordion{background:#fff;border-radius:14px;border:1px solid #e5e5e5;margin-bottom:12px;overflow:hidden}
    .ah-acc-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border:none;background:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;color:#1a1a1a;transition:background .15s}
    .ah-acc-trigger:hover{background:#fafafa}
    .ah-acc-chevron{transition:transform .25s ease;color:#999}
    .ah-acc-content{padding:0 22px 20px}

    /* === FINANCE GRID === */
    .ah-fin-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
    .ah-fin-item{background:#f9f9f9;border-radius:10px;padding:14px;border:1px solid #ebebeb}
    .ah-fin-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px}
    .ah-fin-value{font-size:15px;font-weight:600;color:#1a1a1a}

    /* === CONSUMPTION === */
    .ah-cons-layout{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:start}
    @media(max-width:600px){.ah-cons-layout{grid-template-columns:1fr}}
    .ah-co2-label{display:flex;align-items:center;justify-content:center}
    .ah-co2-label img{max-width:240px}
    .ah-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f0f0}
    .ah-row:last-child{border-bottom:none}
    .ah-row-label{font-size:12px;color:#888}
    .ah-row-value{font-size:13px;font-weight:600;color:#1a1a1a}
    .ah-cons-sub{margin-top:16px;padding-top:14px;border-top:1px solid #eee}
    .ah-cons-sub-title{font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:10px}

    /* === FEATURES === */
    .ah-tags{display:flex;flex-wrap:wrap;gap:6px}
    .ah-tag{font-size:12px;padding:6px 14px;border-radius:100px;background:#f3f3f3;color:#444;border:1px solid #e5e5e5}

    /* === SIDEBAR === */
    .ah-sidebar-card{background:#fff;border-radius:16px;border:1px solid #e5e5e5;overflow:hidden}
    .ah-sidebar-header{padding:24px;border-bottom:1px solid #f0f0f0}
    .ah-sidebar-cat{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#fff;background:#1a1a1a;padding:4px 12px;border-radius:4px;display:inline-block;margin-bottom:12px}
    .ah-sidebar-title{font-family:'DM Sans',sans-serif;font-size:22px;font-weight:700;color:#1a1a1a;line-height:1.2}
    .ah-sidebar-variant{font-size:13px;color:#888;margin-top:4px}

    .ah-sidebar-price{padding:20px 24px;border-bottom:1px solid #f0f0f0}
    .ah-price-main{font-family:'DM Sans',sans-serif;font-size:32px;font-weight:700;color:#1a1a1a}
    .ah-price-sub{font-size:12px;color:#888;margin-top:2px}

    .ah-sidebar-rate{background:#1a1a1a;color:#fff;margin:16px;border-radius:14px;padding:22px;text-align:center}
    .ah-rate-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;opacity:0.6}
    .ah-rate-amount{font-family:'DM Sans',sans-serif;font-size:34px;font-weight:700;margin:6px 0}
    .ah-rate-period{font-size:12px;opacity:0.6}

    .ah-sidebar-specs{padding:20px 24px;border-top:1px solid #f0f0f0}
    .ah-spec-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5}
    .ah-spec-row:last-child{border-bottom:none}
    .ah-spec-label{font-size:11px;color:#888}
    .ah-spec-value{font-size:12px;font-weight:600;color:#1a1a1a}

    .ah-sidebar-dealer{padding:20px 24px;border-top:1px solid #f0f0f0}
    .ah-dealer-name{font-family:'DM Sans',sans-serif;font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:6px}
    .ah-dealer-info{font-size:12px;color:#666;line-height:1.8}
    .ah-dealer-info a{color:#1a1a1a;text-decoration:none}

    /* === LEGAL & FOOTER === */
    .ah-footer{text-align:center;padding:24px;font-size:11px;color:#bbb;margin-top:8px}
  </style>
</head>
<body>
  <div class="ah-wrapper">
    <!-- LEFT: Main Content -->
    <div class="ah-main">
      <div class="ah-hero">
        ${imageBase64 ? `<img id="mainImg" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}" />` : `<div style="color:#bbb;text-align:center;padding:80px">Kein Bild verfügbar</div>`}
        ${allImages.length > 1 ? `<div class="ah-gallery">${allImages.map((img, i) => `<img src="${img}" alt="Bild ${i + 1}" class="ah-gallery-thumb${i === 0 ? ' active' : ''}" onclick="document.getElementById('mainImg').src=this.src;document.querySelectorAll('.ah-gallery-thumb').forEach(t=>t.classList.remove('active'));this.classList.add('active')" />`).join('')}</div>` : ''}
      </div>

      ${accordionsHTML}

      ${buildLegalTextHTML(data)}
    </div>

    <!-- RIGHT: Sticky Sidebar -->
    <div class="ah-sidebar">
      <div class="ah-sidebar-card">
        <div class="ah-sidebar-header">
          <div class="ah-sidebar-cat">${data.category || 'Angebot'}</div>
          <div class="ah-sidebar-title">${data.vehicle.brand} ${data.vehicle.model}</div>
          ${data.vehicle.variant ? `<div class="ah-sidebar-variant">${data.vehicle.variant}</div>` : ''}
        </div>

        <div class="ah-sidebar-price">
          <div class="ah-price-main">${data.finance.totalPrice || '–'}</div>
          <div class="ah-price-sub">${isBuy ? 'Fahrzeugpreis inkl. MwSt.' : 'Gesamtpreis'}</div>
        </div>

        ${!isBuy && data.finance.monthlyRate ? `
          <div class="ah-sidebar-rate">
            <div class="ah-rate-label">Monatliche Rate</div>
            <div class="ah-rate-amount">${data.finance.monthlyRate}</div>
            <div class="ah-rate-period">pro Monat</div>
          </div>
        ` : ''}

        <div class="ah-sidebar-specs">
          ${specs.map(([l, v]) => `<div class="ah-spec-row"><span class="ah-spec-label">${l}</span><span class="ah-spec-value">${v}</span></div>`).join('')}
          ${data.vehicle.vin ? `<div class="ah-spec-row"><span class="ah-spec-label">VIN</span><span class="ah-spec-value" style="font-family:monospace;font-size:11px">${data.vehicle.vin}</span></div>` : ''}
        </div>

        <div class="ah-sidebar-dealer">
          ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:40px;margin-bottom:10px;display:block" />` : ''}
          <div class="ah-dealer-name">${data.dealer.name || '–'}</div>
          <div class="ah-dealer-info">
            ${buildDealerAddressHTML(data.dealer)}<br/>
            ${data.dealer.phone ? `${data.dealer.phone}<br/>` : ''}
            ${data.dealer.email ? `${data.dealer.email}<br/>` : ''}
            ${buildWebsiteLinkHTML(data.dealer)}
            ${buildDealerFooterHTML(data.dealer)}
            ${buildSocialLinksHTML(data.dealer)}
            ${buildWhatsAppButtonHTML(data.dealer, `${data.vehicle.brand} ${data.vehicle.model}`)}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="ah-footer">Alle Angaben ohne Gewähr.</div>

  <script>
    function toggleAccordion(id) {
      var content = document.getElementById('acc-' + id);
      var chevron = document.getElementById('chevron-' + id);
      var trigger = chevron.closest('.ah-acc-trigger');
      if (content.style.display === 'none') {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        trigger.setAttribute('aria-expanded', 'false');
      }
    }
  </script>
</body></html>`;
}
