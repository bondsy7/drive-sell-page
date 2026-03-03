import { VehicleData } from "@/types/vehicle";

export function generateLandingPageHTML(data: VehicleData, imageBase64: string | null): string {
  const features = data.vehicle.features?.map(f => `<span class="tag">${f}</span>`).join('\n            ') || '';

  const financeItems = [
    ['Monatliche Rate', data.finance.monthlyRate],
    ['Anzahlung', data.finance.downPayment],
    ['Laufzeit', data.finance.duration],
    ['Jahresfahrleistung', data.finance.annualMileage],
    ['Sonderzahlung', data.finance.specialPayment],
    ['Restwert', data.finance.residualValue],
  ].filter(([, v]) => v).map(([l, v]) => `
              <div class="fin-item">
                <div class="fin-label">${l}</div>
                <div class="fin-value">${v}</div>
              </div>`).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.vehicle.brand} ${data.vehicle.model} – Angebot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f4f5f7; color: #1a1f2e; }
    .container { max-width: 960px; margin: 0 auto; padding: 24px; }
    
    .main-card {
      background: white; border-radius: 16px; overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e8eaee;
      display: grid; grid-template-columns: 1fr 1fr;
    }
    @media (max-width: 768px) { .main-card { grid-template-columns: 1fr; } }
    
    .image-side {
      background: #f4f5f7; display: flex; align-items: center; justify-content: center;
      min-height: 320px; padding: 16px;
    }
    .image-side img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
    
    .info-side { padding: 28px; display: flex; flex-direction: column; }
    .category { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
    .info-side h1 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 2px; }
    .variant { font-size: 13px; color: #6b7280; margin-bottom: 12px; }
    .price { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; margin-bottom: 16px; }
    
    .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e8eaee; padding-top: 12px; }
    .spec { padding: 8px 0; }
    .spec-label { font-size: 11px; color: #6b7280; }
    .spec-value { font-size: 13px; font-weight: 600; }
    
    .section { background: white; border-radius: 16px; padding: 24px; margin-top: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e8eaee; }
    .section h3 { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    
    .fin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    @media (max-width: 600px) { .fin-grid { grid-template-columns: 1fr 1fr; } }
    .fin-item { background: #f9fafb; border-radius: 12px; padding: 12px; }
    .fin-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
    .fin-value { font-size: 14px; font-weight: 600; }
    
    .tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { font-size: 12px; border: 1px solid #e8eaee; padding: 6px 14px; border-radius: 100px; color: #374151; }
    
    .dealer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 600px) { .dealer-grid { grid-template-columns: 1fr; } }
    .dealer-info { font-size: 13px; line-height: 1.8; }
    .dealer-info strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .rate-box {
      background: linear-gradient(135deg, #e8a308, #ca8a04); color: #1a1f2e;
      border-radius: 12px; padding: 20px; text-align: center;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .rate-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
    .rate-amount { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; }
    .rate-period { font-size: 12px; font-weight: 500; opacity: 0.8; }
    
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="main-card">
      <div class="image-side">
        ${imageBase64 ? `<img src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}" />` : `<div style="color:#9ca3af;text-align:center">Kein Bild</div>`}
      </div>
      <div class="info-side">
        <div class="category">${data.category || 'Angebot'}</div>
        <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
        <p class="variant">${data.vehicle.variant || ''}</p>
        <div class="price">${data.finance.totalPrice || '–'}</div>
        <div class="specs">
          <div class="spec"><div class="spec-label">Fahrzeugtyp</div><div class="spec-value">${data.category || '–'}</div></div>
          <div class="spec"><div class="spec-label">Getriebe</div><div class="spec-value">${data.vehicle.transmission || '–'}</div></div>
          <div class="spec"><div class="spec-label">Leistung</div><div class="spec-value">${data.vehicle.power || '–'}</div></div>
          <div class="spec"><div class="spec-label">Kraftstoff</div><div class="spec-value">${data.vehicle.fuelType || '–'}</div></div>
          <div class="spec"><div class="spec-label">Farbe</div><div class="spec-value">${data.vehicle.color || '–'}</div></div>
          <div class="spec"><div class="spec-label">Baujahr</div><div class="spec-value">${data.vehicle.year || '–'}</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>💰 Finanzierung</h3>
      <div class="fin-grid">${financeItems}</div>
    </div>

    ${features ? `
    <div class="section">
      <h3>Ausstattung</h3>
      <div class="tags">${features}</div>
    </div>` : ''}

    <div class="section">
      <h3>📍 Händler & Kontakt</h3>
      <div class="dealer-grid">
        <div class="dealer-info">
          <strong>${data.dealer.name || '–'}</strong>
          ${data.dealer.address || ''}<br/>
          ${data.dealer.phone || ''}<br/>
          ${data.dealer.email || ''}<br/>
          ${data.dealer.website || ''}
        </div>
        <div class="rate-box">
          <div class="rate-label">Monatliche Rate</div>
          <div class="rate-amount">${data.finance.monthlyRate || '–'}</div>
          <div class="rate-period">pro Monat</div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer">Alle Angaben ohne Gewähr. Irrtümer und Änderungen vorbehalten.</div>
</body>
</html>`;
}

export function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
