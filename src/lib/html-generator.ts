import { VehicleData } from "@/types/vehicle";

export function generateLandingPageHTML(data: VehicleData, imageBase64: string | null): string {
  const features = data.vehicle.features?.map(f => `<li>${f}</li>`).join('\n            ') || '';
  
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
    
    .hero {
      position: relative;
      background: linear-gradient(135deg, #1a1f2e 0%, #2a3142 100%);
      padding: 60px 24px 80px;
      text-align: center;
      color: white;
      overflow: hidden;
    }
    .hero::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 80px;
      background: linear-gradient(to top, #f4f5f7, transparent);
    }
    .hero-badge {
      display: inline-block;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
      padding: 6px 16px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .hero h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: clamp(28px, 5vw, 48px);
      font-weight: 700;
      margin-bottom: 8px;
    }
    .hero .variant {
      font-size: 18px;
      opacity: 0.7;
      font-weight: 300;
    }
    .hero-image {
      max-width: 800px;
      width: 100%;
      margin: 32px auto 0;
      border-radius: 16px;
      position: relative;
      z-index: 1;
    }
    .hero-image img {
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .price-badge {
      position: absolute;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, #e8a308, #ca8a04);
      color: #1a1f2e;
      padding: 12px 24px;
      border-radius: 12px;
      z-index: 2;
      box-shadow: 0 8px 24px rgba(232,163,8,0.4);
    }
    .price-badge .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .price-badge .amount { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; }
    .price-badge .period { font-size: 13px; font-weight: 500; }
    
    .container { max-width: 1000px; margin: 0 auto; padding: 0 24px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: -40px; position: relative; z-index: 2; }
    
    .card {
      background: white;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid #e8eaee;
    }
    .card h3 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #1a1f2e;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card h3 .icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #f4f5f7;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f4f5f7;
      font-size: 14px;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-row .label { color: #6b7280; }
    .detail-row .value { font-weight: 600; }
    
    .features-list {
      list-style: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .features-list li {
      font-size: 13px;
      padding: 6px 10px;
      background: #f4f5f7;
      border-radius: 6px;
      color: #374151;
    }
    
    .dealer-section {
      margin-top: 24px;
      margin-bottom: 48px;
    }
    .dealer-card {
      background: linear-gradient(135deg, #1a1f2e, #2a3142);
      color: white;
      border-radius: 16px;
      padding: 32px;
    }
    .dealer-card h3 { color: white; }
    .dealer-card .detail-row { border-color: rgba(255,255,255,0.1); }
    .dealer-card .detail-row .label { color: rgba(255,255,255,0.6); }
    .dealer-card .detail-row .value { color: white; }
    
    .footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e8eaee;
    }
  </style>
</head>
<body>
  <div class="hero">
    <div class="hero-badge">${data.category || 'Angebot'}</div>
    <h1>${data.vehicle.brand} ${data.vehicle.model}</h1>
    <p class="variant">${data.vehicle.variant || ''}</p>
    ${imageBase64 ? `
    <div class="hero-image">
      <img src="${imageBase64}" alt="${data.vehicle.brand} ${data.vehicle.model}" />
      <div class="price-badge">
        <div class="label">Monatliche Rate</div>
        <div class="amount">${data.finance.monthlyRate || '–'}</div>
        <div class="period">pro Monat</div>
      </div>
    </div>
    ` : ''}
  </div>

  <div class="container">
    <div class="grid">
      <div class="card">
        <h3><span class="icon">🚗</span> Fahrzeugdaten</h3>
        <div class="detail-row"><span class="label">Marke</span><span class="value">${data.vehicle.brand}</span></div>
        <div class="detail-row"><span class="label">Modell</span><span class="value">${data.vehicle.model}</span></div>
        <div class="detail-row"><span class="label">Farbe</span><span class="value">${data.vehicle.color || '–'}</span></div>
        <div class="detail-row"><span class="label">Antrieb</span><span class="value">${data.vehicle.fuelType || '–'}</span></div>
        <div class="detail-row"><span class="label">Getriebe</span><span class="value">${data.vehicle.transmission || '–'}</span></div>
        <div class="detail-row"><span class="label">Leistung</span><span class="value">${data.vehicle.power || '–'}</span></div>
      </div>

      <div class="card">
        <h3><span class="icon">💰</span> Finanzierung</h3>
        <div class="detail-row"><span class="label">Monatliche Rate</span><span class="value">${data.finance.monthlyRate || '–'}</span></div>
        <div class="detail-row"><span class="label">Anzahlung</span><span class="value">${data.finance.downPayment || '–'}</span></div>
        <div class="detail-row"><span class="label">Laufzeit</span><span class="value">${data.finance.duration || '–'}</span></div>
        <div class="detail-row"><span class="label">Gesamtpreis</span><span class="value">${data.finance.totalPrice || '–'}</span></div>
        <div class="detail-row"><span class="label">Jahresfahrleistung</span><span class="value">${data.finance.annualMileage || '–'}</span></div>
        <div class="detail-row"><span class="label">Sonderzahlung</span><span class="value">${data.finance.specialPayment || '–'}</span></div>
      </div>

      ${features ? `
      <div class="card" style="grid-column: 1 / -1;">
        <h3><span class="icon">✨</span> Ausstattung</h3>
        <ul class="features-list">
            ${features}
        </ul>
      </div>
      ` : ''}
    </div>

    <div class="dealer-section">
      <div class="dealer-card">
        <h3><span class="icon">📍</span> Ihr Ansprechpartner</h3>
        <div class="detail-row"><span class="label">Autohaus</span><span class="value">${data.dealer.name || '–'}</span></div>
        <div class="detail-row"><span class="label">Adresse</span><span class="value">${data.dealer.address || '–'}</span></div>
        <div class="detail-row"><span class="label">Telefon</span><span class="value">${data.dealer.phone || '–'}</span></div>
        <div class="detail-row"><span class="label">E-Mail</span><span class="value">${data.dealer.email || '–'}</span></div>
        <div class="detail-row"><span class="label">Website</span><span class="value">${data.dealer.website || '–'}</span></div>
      </div>
    </div>
  </div>

  <div class="footer">
    Alle Angaben ohne Gewähr. Irrtümer und Änderungen vorbehalten.
  </div>
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
