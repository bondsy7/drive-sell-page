import { VehicleData } from "@/types/vehicle";
import { parsePrice, formatPrice } from "@/lib/finance-utils";
import { getCO2LabelHTML, getConsumptionData, buildLegalTextHTML, buildDealerAddressHTML, buildDealerFooterHTML, buildSocialLinksHTML, buildWhatsAppButtonHTML, buildWebsiteLinkHTML, getFinanceSectionTitle, calculateLeasingFactor } from "./shared";

export function generateAutohausHTML(data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
  const consumption = getConsumptionData(data);
  const allImages = [imageBase64, ...galleryImages].filter(Boolean) as string[];
  const cat = (data.category || '').toLowerCase();
  const isBuy = cat.includes('barkauf') || cat.includes('neuwagen') || cat.includes('gebrauchtwagen') || cat.includes('tageszulassung') || cat.includes('kauf');
  const isLeasing = cat.includes('leasing');

  // Features as badges
  const featuresList = data.vehicle.features || [];
  const badgesHTML = featuresList.length > 0
    ? `<div class="card"><h2>Ausstattung</h2><div class="badges">${featuresList.map(f => `<span class="badge">${f}</span>`).join('')}</div></div>`
    : '';

  // Consumption & Environment section
  const co2Label = getCO2LabelHTML(consumption);
  const consumptionRowPairs: [string, string | undefined][] = [
    ['Emissionsklasse', consumption.co2Class],
    ['CO₂-Emissionen (komb.)', consumption.co2Emissions],
    ['Verbrauch (komb.)', consumption.consumptionCombined],
  ];
  if (consumption.isPluginHybrid) {
    if (consumption.consumptionCombinedDischarged) consumptionRowPairs.push(['Verbrauch (komb., entladen)', consumption.consumptionCombinedDischarged]);
    if (consumption.co2EmissionsDischarged) consumptionRowPairs.push(['CO₂-Emissionen (entladen)', consumption.co2EmissionsDischarged]);
    if (consumption.consumptionElectric) consumptionRowPairs.push(['Stromverbrauch (komb.)', consumption.consumptionElectric]);
    if (consumption.electricRange) consumptionRowPairs.push(['Elektrische Reichweite', consumption.electricRange]);
  }

  const consumptionMainRows = consumptionRowPairs
    .filter(([, v]) => v)
    .map(([l, v]) => `<div class="cons-row"><span>${l}</span><span style="font-weight:600">${v}</span></div>`)
    .join('');

  const consumptionDetailPairs: [string, string | undefined][] = [
    ['Kombiniert', consumption.consumptionCombined],
    ['Innerorts', consumption.consumptionCity],
    ['Außerorts / Landstraße', consumption.consumptionSuburban || consumption.consumptionRural],
    ['Autobahn', consumption.consumptionHighway],
  ];
  const consumptionDetailCells = consumptionDetailPairs
    .filter(([, v]) => v)
    .map(([l, v]) => `<div class="cons-cell"><span class="cons-label">${l}</span><span class="cons-val">${v}</span></div>`)
    .join('');

  // Cost rows
  const costPairs: [string, string | undefined][] = [
    ['Energiekosten (15.000 km/Jahr)', consumption.energyCostPerYear],
    ['Kraftfahrzeugsteuer (€/Jahr)', consumption.vehicleTax],
  ];
  if (consumption.co2CostMedium) costPairs.push(['CO₂-Kosten über 10 Jahre (€)', consumption.co2CostMedium]);

  const costRows = costPairs.filter(([, v]) => v).map(([l, v]) => `<div class="cons-row"><span>${l}</span><span style="font-weight:600">${v}</span></div>`).join('');

  const hasConsumptionData = consumptionMainRows || consumptionDetailCells || costRows;

  // EnVKV Pflichtangaben blue box
  const envkvBoxHTML = `
    <div class="envkv-box">
      <div class="envkv-title">Pflichtangaben nach Pkw-EnVKV (Anlage 4):</div>
      <p>Die angegebenen Werte wurden nach dem vorgeschriebenen WLTP-Messverfahren (Worldwide Harmonised Light Vehicle Test Procedure) ermittelt.</p>
      <p style="margin-top:.5rem">Weitere Informationen zum offiziellen Kraftstoffverbrauch und den offiziellen spezifischen CO₂-Emissionen neuer Personenkraftwagen können dem „Leitfaden über den Kraftstoffverbrauch, die CO₂-Emissionen und den Stromverbrauch neuer Personenkraftwagen" entnommen werden, der an allen Verkaufsstellen und bei der Deutschen Automobil Treuhand GmbH (DAT) unentgeltlich erhältlich ist.</p>
    </div>`;

  const consumptionHTML = hasConsumptionData ? `
    <div class="card">
      <h2>Verbrauch &amp; Umwelt</h2>
      ${consumptionMainRows}
      ${consumptionDetailCells ? `<div class="cons-grid">${consumptionDetailCells}</div>` : ''}
      ${costRows ? `<div style="margin-top:1rem">${costRows}</div>` : ''}
      ${co2Label ? `<div style="margin-top:1rem">${co2Label}</div>` : ''}
      ${envkvBoxHTML}
    </div>` : '';

  // Technical data — extended, only show rows with values
  const techPairs: [string, string | number | undefined][] = [
    ['Leistung', data.vehicle.power],
    ['HSN / TSN', consumption.hsnTsn],
    ['Elektromotor Max. Leistung', consumption.electricMotorPower],
    ['Elektromotor Max. Drehmoment', consumption.electricMotorTorque],
    ['Getriebeart', consumption.gearboxType || data.vehicle.transmission],
    ['Antriebsart', consumption.driveType],
    ['Höchstgeschwindigkeit', consumption.topSpeed],
    ['Beschleunigung 0 bis 100 km/h', consumption.acceleration],
    ['Leergewicht', consumption.curbWeight],
    ['Zulässiges Gesamtgewicht', consumption.grossWeight],
    ['Hubraum', consumption.displacement],
    ['Kraftstoff', data.vehicle.fuelType],
    ['Farbe / Lackierung', consumption.paintColor || data.vehicle.color],
    ['Baujahr', data.vehicle.year && data.vehicle.year > 0 ? String(data.vehicle.year) : undefined],
    ['Fahrzeuggarantie', consumption.warranty],
  ];
  const techRows = techPairs
    .filter(([, v]) => v && String(v).trim() !== '' && String(v).trim() !== '-')
    .map(([l, v]) => `<div class="tech-row"><span class="tech-label">${l}:</span><span class="tech-value">${v}</span></div>`)
    .join('');
  const techHTML = techRows ? `<div class="card"><h2>Technische Daten</h2><div class="tech-grid">${techRows}</div></div>` : '';

  // Vehicle description
  const descText = data.vehicle.description || '';
  const descHTML = descText ? `<div class="card"><h2>Fahrzeugbeschreibung</h2><p class="desc-text">${descText}</p></div>` : '';

  // Legal text
  const legalTextHTML = buildLegalTextHTML(data);

  // Leasing / Finance conditions
  const leasingFactor = isLeasing ? calculateLeasingFactor(data) : '';
  let leasingConditionsHTML = '';
  if (!isBuy && data.finance.monthlyRate) {
    const conditionPairs: [string, string | undefined][] = [
      ['Laufzeit', data.finance.duration],
      ['Laufleistung / Jahr', data.finance.annualMileage],
      [isLeasing ? 'Sonderzahlung' : 'Anzahlung', isLeasing ? data.finance.specialPayment : data.finance.downPayment],
    ];
    if (isLeasing && leasingFactor) conditionPairs.push(['Leasingfaktor', leasingFactor]);
    if (isLeasing && data.finance.residualValue) conditionPairs.push(['Restwert', data.finance.residualValue]);
    if (!isLeasing && data.finance.residualValue) conditionPairs.push(['Schlussrate', data.finance.residualValue]);

    const conditionCells = conditionPairs
      .filter(([, v]) => v)
      .map(([l, v]) => `<div class="grid-cell"><div class="cell-label">${l}</div><div class="cell-value">${v}</div></div>`)
      .join('');

    leasingConditionsHTML = `
      <div class="card">
        <h2>${getFinanceSectionTitle(data)}konditionen</h2>
        <div class="leasing-highlight">
          <div class="rate-value">${data.finance.monthlyRate} <span style="font-size:1rem;font-weight:400;opacity:.85">/ Monat<sup style="font-size:.6rem;vertical-align:super">1</sup></span></div>
          <div style="font-size:.78rem;opacity:.7;margin-top:.3rem">inkl. MwSt.</div>
        </div>
        <div class="grid-2">${conditionCells}</div>
        ${data.finance.totalPrice ? (() => {
          const tp = parsePrice(data.finance.totalPrice);
          const dp = isLeasing ? parsePrice(data.finance.specialPayment) : parsePrice(data.finance.downPayment);
          const fp = parsePrice(data.finance.residualValue);
          const mr = parsePrice(data.finance.monthlyRate);
          const dur = parseInt((data.finance.duration || '').match(/(\d+)/)?.[1] || '0');
          const nettodarlehensbetrag = tp - dp;
          const gesamtbetrag = mr > 0 && dur > 0 ? (mr * dur + dp + fp) : 0;
          return `
        <div style="margin-top:1rem;border-top:1px solid #e5e7eb;padding-top:1rem">
          <div style="font-size:.85rem">
            <div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
              <span style="color:#6b7280">Effektiver Jahreszins</span>
              <span style="font-weight:600">${data.finance.interestRate || '–'}</span>
            </div>
            ${nettodarlehensbetrag > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
              <span style="color:#6b7280">Nettodarlehensbetrag</span>
              <span style="font-weight:600">${formatPrice(nettodarlehensbetrag)}</span>
            </div>` : ''}
            ${gesamtbetrag > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
              <span style="color:#6b7280">Gesamtbetrag</span>
              <span style="font-weight:600">${formatPrice(gesamtbetrag)}</span>
            </div>` : ''}
          </div>
        </div>`;
        })() : ''}
        ${legalTextHTML}
      </div>`;
  }

  // Sidebar specs
  const sidebarSpecs: [string, string | undefined][] = [
    ['Fahrzeugtyp', data.category || undefined],
    ['Getriebe', consumption.gearboxType || data.vehicle.transmission],
    ['Zustand', cat.includes('neuwagen') || cat.includes('neu') ? 'Neufahrzeug' : cat.includes('gebrauchtwagen') ? 'Gebrauchtfahrzeug' : undefined],
    ['Leistung', data.vehicle.power],
    ['Kraftstoff', data.vehicle.fuelType],
    ['Kilometer', consumption.mileage],
  ];
  const sidebarSpecsHTML = sidebarSpecs
    .filter(([, v]) => v)
    .map(([l, v]) => `<div><span class="spec-label">${l}</span><div class="spec-value">${v}</div></div>`)
    .join('');

  // Contact form
  const contactFormHTML = `
    <div class="card" style="margin-top:1.5rem">
      <h2>Kontakt aufnehmen</h2>
      <form onsubmit="return false" style="display:flex;flex-direction:column;gap:.75rem">
        <div>
          <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem">Vorname*</label>
          <input type="text" name="firstname" required style="width:100%;padding:.6rem .75rem;border:1px solid #e5e7eb;border-radius:6px;font-size:.875rem;font-family:inherit" />
        </div>
        <div>
          <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem">Nachname*</label>
          <input type="text" name="lastname" required style="width:100%;padding:.6rem .75rem;border:1px solid #e5e7eb;border-radius:6px;font-size:.875rem;font-family:inherit" />
        </div>
        <div>
          <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem">E-Mail-Adresse*</label>
          <input type="email" name="email" required style="width:100%;padding:.6rem .75rem;border:1px solid #e5e7eb;border-radius:6px;font-size:.875rem;font-family:inherit" />
        </div>
        <div>
          <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem">Telefonnummer *</label>
          <input type="tel" name="phone" style="width:100%;padding:.6rem .75rem;border:1px solid #e5e7eb;border-radius:6px;font-size:.875rem;font-family:inherit" />
        </div>
        <div>
          <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.3rem">Ihre Nachricht (optional)</label>
          <textarea name="message" rows="4" style="width:100%;padding:.6rem .75rem;border:1px solid #e5e7eb;border-radius:6px;font-size:.875rem;font-family:inherit;resize:vertical">Hallo,\nich interessiere mich für das angebotene Fahrzeug und bitte um weitere Informationen.\nMit freundlichen Grüßen</textarea>
        </div>
        <button type="submit" style="background:#1a2e5a;color:#fff;border:none;padding:.75rem 1.5rem;border-radius:6px;font-size:.95rem;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:.5px;font-family:inherit">Senden</button>
      </form>
      <p style="font-size:.7rem;color:#9ca3af;margin-top:.75rem">Bitte mit * gekennzeichnete Felder ausfüllen. Kostenlos und unverbindlich!</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.variant || ''} – Angebot</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;color:#111827}

    .page-wrap{max-width:1200px;margin:0 auto;padding:2rem 1rem;display:grid;grid-template-columns:1fr 360px;gap:2rem}
    @media(max-width:900px){.page-wrap{grid-template-columns:1fr}}

    .left-col,.right-col{display:flex;flex-direction:column;gap:1.5rem}

    /* Cards */
    .card{background:white;border-radius:10px;border:1px solid #e5e7eb;padding:1.5rem}
    .card h2{font-size:1.05rem;font-weight:700;color:#1a2e5a;margin-bottom:1rem}

    /* Gallery */
    .gallery-card{background:white;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden}
    .gallery-main-img{width:100%;display:block;max-height:600px;object-fit:cover;background:#f9fafb}
    .gallery-thumbs{display:flex;gap:.5rem;padding:.75rem;overflow-x:auto}
    .thumb{width:80px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent;flex-shrink:0}
    .thumb.active{border-color:#1a2e5a}

    /* Price card / sidebar */
    .price-card{position:sticky;top:1rem}
    .price-card h1{font-size:1.2rem;font-weight:800;color:#1a2e5a;margin-bottom:.25rem}
    .price-card .subtitle{font-size:.8rem;color:#6b7280;margin-bottom:1rem}
    .price-card .rate{font-size:2rem;font-weight:800;color:#1a2e5a}
    .list-price{font-size:.75rem;color:#6b7280;margin-top:.2rem;margin-bottom:1rem}
    .specs-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.85rem}
    .spec-label{color:#6b7280;font-size:.73rem}
    .spec-value{font-weight:600}
    .divider{border:none;border-top:1px solid #e5e7eb;margin:1rem 0}

    /* Leasing highlight */
    .leasing-highlight{background:linear-gradient(135deg,#1a2e5a,#2a4070);border-radius:10px;padding:1.5rem;color:white;margin-bottom:1rem}
    .rate-label{font-size:.85rem;opacity:.75;margin-bottom:.2rem}
    .rate-value{font-size:2.2rem;font-weight:800}

    /* Grid cells */
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
    .grid-cell{background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:.75rem}
    .cell-label{font-size:.72rem;color:#6b7280;margin-bottom:.2rem}
    .cell-value{font-weight:700;color:#1a2e5a;font-size:.9rem}

    /* Badges */
    .badges{display:flex;flex-wrap:wrap;gap:.4rem}
    .badge{background:#f3f4f6;color:#374151;font-size:.75rem;padding:.3rem .7rem;border-radius:999px}

    /* Tech grid */
    .tech-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 1.5rem}
    .tech-row{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #f3f4f6;font-size:.875rem}
    .tech-label{color:#6b7280}
    .tech-value{font-weight:600;text-align:right}

    /* Consumption */
    .cons-row{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #f3f4f6;font-size:.875rem}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.75rem}
    .cons-cell{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:.75rem}
    .cons-label{font-size:.72rem;color:#6b7280;display:block;margin-bottom:.2rem}
    .cons-val{font-weight:700;font-size:.9rem}

    /* Description */
    .desc-text{font-size:.875rem;color:#4b5563;line-height:1.7;white-space:pre-line}

    /* EnVKV Pflichtangaben box */
    .envkv-box{margin-top:1rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:.75rem;font-size:.72rem;color:#1e40af;line-height:1.6}
    .envkv-title{font-weight:700;margin-bottom:.4rem;font-size:.82rem}

    /* Legal */
    .legal-text{margin-top:24px;padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #e8eaee}
  </style>
</head>
<body>
  <div class="page-wrap">
    <!-- LEFT COLUMN -->
    <div class="left-col">
      <div class="gallery-card">
        ${imageBase64
          ? `<img id="mainImg" class="gallery-main-img" src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}"/>`
          : `<div style="color:#bbb;text-align:center;padding:80px;background:#f9fafb">Kein Bild verfügbar</div>`
        }
        ${allImages.length > 1 ? `
          <div class="gallery-thumbs">
            ${allImages.map((img, i) => `<img src="${img}" alt="Bild ${i + 1}" class="thumb${i === 0 ? ' active' : ''}" onclick="setMain(this)" />`).join('')}
          </div>` : ''}
      </div>

      ${badgesHTML}
      ${consumptionHTML}
      ${techHTML}
      ${descHTML}
      ${leasingConditionsHTML}
    </div>

    <!-- RIGHT COLUMN (sticky sidebar) -->
    <div class="right-col">
      <div class="card price-card">
        <h1>${data.vehicle.brand} ${data.vehicle.model}${data.vehicle.variant ? ' ' + data.vehicle.variant : ''}</h1>
        ${!isBuy && data.finance.monthlyRate
          ? `<div class="rate">${data.finance.monthlyRate} <span style="font-size:.95rem;font-weight:400;color:#6b7280">/ Monat<sup style="font-size:.6rem;vertical-align:super">1</sup></span></div>
             ${data.finance.totalPrice ? `<p class="list-price">Fahrzeugpreis: ${data.finance.totalPrice} inkl. MwSt.</p>` : ''}`
          : `<div class="rate">${data.finance.totalPrice || '–'}</div>
             <p class="list-price">${isBuy ? 'Fahrzeugpreis inkl. MwSt.' : ''}</p>`
        }
        <hr class="divider"/>
        <div class="specs-grid">
          ${sidebarSpecsHTML}
        </div>
        ${data.vehicle.vin ? `<hr class="divider"/><div style="font-size:.75rem;color:#9ca3af;font-style:italic">VIN: ${data.vehicle.vin}</div>` : ''}
      </div>

      ${contactFormHTML}

      ${data.dealer.name ? `
      <div class="card">
        ${data.dealer.logoUrl ? `<img src="${data.dealer.logoUrl}" alt="${data.dealer.name}" style="max-height:40px;margin-bottom:10px;display:block" />` : ''}
        <div style="font-weight:700;color:#1a2e5a;font-size:.95rem;margin-bottom:.4rem">${data.dealer.name}</div>
        <div style="font-size:.8rem;color:#6b7280;line-height:1.8">
          ${buildDealerAddressHTML(data.dealer)}<br/>
          ${data.dealer.phone ? `${data.dealer.phone}<br/>` : ''}
          ${data.dealer.email ? `${data.dealer.email}<br/>` : ''}
          ${buildWebsiteLinkHTML(data.dealer)}
          ${buildDealerFooterHTML(data.dealer)}
          ${buildSocialLinksHTML(data.dealer)}
          ${buildWhatsAppButtonHTML(data.dealer, `${data.vehicle.brand} ${data.vehicle.model}`)}
        </div>
      </div>` : ''}
    </div>
  </div>

  <script>
    function setMain(el){
      document.getElementById('mainImg').src=el.src;
      document.querySelectorAll('.thumb').forEach(function(t){t.classList.remove('active')});
      el.classList.add('active');
    }
  </script>
</body></html>`;
}
