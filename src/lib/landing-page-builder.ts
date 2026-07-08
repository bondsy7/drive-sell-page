import { buildContactFormHTML } from '@/lib/templates/shared';

export interface LandingPageContent {
  meta: { title: string; description: string; h1: string };
  hero: { headline: string; subheadline: string; ctaText: string; imagePrompt?: string };
  sections: LandingPageSection[];
  seo?: { keywords?: string[]; structuredData?: any };
}

export interface LandingPageSection {
  id: string;
  type: string;
  headline: string;
  content: string;
  imagePrompt?: string | null;
  bgStyle: string;
  enabled?: boolean;
}

export interface LandingPageDealer {
  name?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  defaultLegalText?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface LandingPageContactForm {
  dealerUserId: string;
  projectId?: string;
  vehicleId?: string | null;
  supabaseUrl: string;
  vehicleTitle: string;
  pageType?: string;
}

/* ─── color helpers ─── */
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
function rgba(hex: string, a: number) {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${a})` : `rgba(23,79,107,${a})`;
}
function luma(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.2;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function readableOn(hex: string) {
  return luma(hex) > 0.55 ? '#0f172a' : '#ffffff';
}
function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]
  );
}

/* ─── Section renderers (matching React renderer 1:1) ─── */

function renderSection(
  s: LandingPageSection,
  idx: number,
  image: string,
  primary: string,
  secondary: string,
  onSec: string,
  phone: string,
  whatsapp: string
): string {
  if (s.enabled === false) return '';

  const bgMap: Record<string, string> = {
    white: '#ffffff',
    light: rgba(primary, 0.04),
    dark: '#0b1220',
    accent: primary,
  };
  const bg = bgMap[s.bgStyle] || '#ffffff';
  const isDark = s.bgStyle === 'dark' || s.bgStyle === 'accent';
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const bodyColor = isDark ? 'rgba(255,255,255,0.85)' : '#475569';

  if (s.type === 'cta') {
    return `<section style="background:linear-gradient(135deg,${primary},#0b1220);color:#fff;padding:88px 24px;text-align:center">
  <div style="max-width:720px;margin:0 auto">
    <h2 style="font-size:36px;font-weight:700;margin-bottom:16px;color:#fff">${escapeHtml(s.headline)}</h2>
    <div class="lp-body-html" style="font-size:17px;opacity:0.9;margin-bottom:32px">${s.content || ''}</div>
    <div style="display:inline-flex;gap:12px;flex-wrap:wrap;justify-content:center">
      ${phone ? `<a href="tel:${phone}" style="background:${secondary};color:${onSec};padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none">📞 Anrufen</a>` : ''}
      ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" style="background:#25d366;color:#fff;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none">💬 WhatsApp</a>` : ''}
    </div>
  </div>
</section>`;
  }

  const isFullWidth = ['steps', 'faq', 'comparison', 'benefits'].includes(s.type) || (!image && !s.imagePrompt);

  if (isFullWidth) {
    return `<section style="background:${bg}">
  <div style="max-width:900px;margin:0 auto;padding:96px 32px">
    <h2 style="font-size:34px;font-weight:700;margin-bottom:24px;text-align:center;color:${textColor}">${escapeHtml(s.headline)}</h2>
    <div class="lp-body-html" style="font-size:16px;color:${bodyColor};line-height:1.75">${s.content || ''}</div>
  </div>
</section>`;
  }

  if (s.type === 'gallery' || s.type === 'specs') {
    return `<section style="background:${bg}">
  <div style="max-width:1100px;margin:0 auto;padding:96px 32px">
    <h2 style="font-size:34px;font-weight:700;margin-bottom:32px;text-align:center;color:${textColor}">${escapeHtml(s.headline)}</h2>
    ${image ? `<div style="aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:${rgba(primary, 0.06)};margin-bottom:28px"><img src="${image}" alt="${escapeHtml(s.headline)}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy" decoding="async"/></div>` : ''}
    <div class="lp-body-html" style="font-size:16px;color:${bodyColor};line-height:1.75">${s.content || ''}</div>
  </div>
</section>`;
  }

  // Editorial split
  const imageOnLeft = idx % 2 === 0;
  const imgHtml = `<div style="aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:${rgba(primary, 0.06)}">${image ? `<img src="${image}" alt="${escapeHtml(s.headline)}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy" decoding="async"/>` : ''}</div>`;
  const textHtml = `<div>
    <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${isDark ? 'rgba(255,255,255,0.6)' : primary};margin-bottom:14px">${`0${idx + 1}`.slice(-2)}</div>
    <h2 style="font-size:32px;font-weight:700;margin-bottom:20px;line-height:1.15;color:${textColor}">${escapeHtml(s.headline)}</h2>
    <div class="lp-body-html" style="font-size:16px;color:${bodyColor};line-height:1.75">${s.content || ''}</div>
  </div>`;

  return `<section style="background:${bg}">
  <div style="max-width:1200px;margin:0 auto;padding:96px 32px">
    <div class="lp-split" style="display:grid;grid-template-columns:${imageOnLeft ? '1.1fr 1fr' : '1fr 1.1fr'};gap:56px;align-items:center">
      ${imageOnLeft ? imgHtml + textHtml : textHtml + imgHtml}
    </div>
  </div>
</section>`;
}

/* ─── Main builder ─── */

export function buildLandingPageHTML(
  content: LandingPageContent,
  images: Record<string, string>,
  dealer: LandingPageDealer,
  brand: string,
  model: string,
  brandLogoUrl?: string,
  contactForm?: LandingPageContactForm
): string {
  const meta = content.meta || ({} as any);
  const hero = content.hero || ({} as any);
  const sections = content.sections || [];
  const seo = content.seo || ({} as any);

  const primary = /^#[0-9a-fA-F]{6}$/.test(dealer.primaryColor || '') ? dealer.primaryColor! : '#174f6b';
  const secondary = /^#[0-9a-fA-F]{6}$/.test(dealer.secondaryColor || '') ? dealer.secondaryColor! : '#e2b04a';
  const onPrimary = readableOn(primary);
  const onSecondary = readableOn(secondary);

  const heroImage = images.hero || '';
  const dealerName = dealer.name || '';
  const dealerLogo = dealer.logoUrl || '';
  const phone = dealer.phone || '';
  const email = dealer.email || '';
  const website = dealer.website || '';
  const whatsapp = dealer.whatsappNumber || '';
  const address = [dealer.address, dealer.postalCode, dealer.city].filter(Boolean).join(', ');

  const jsonLd = seo.structuredData
    ? `<script type="application/ld+json">${JSON.stringify(seo.structuredData)}</script>`
    : '';
  const ogImage = heroImage ? `<meta property="og:image" content="${heroImage}">` : '';

  const heroCtaText = hero.ctaText || 'Jetzt anfragen';
  const heroHeadline = hero.headline || `${brand} ${model}`;
  const heroSub = hero.subheadline || '';

  const sectionBlocks = sections
    .map((s, idx) => renderSection(s, idx, images[s.id] || '', primary, secondary, onSecondary, phone, whatsapp))
    .join('\n');

  const contactFormHTML = contactForm
    ? buildContactFormHTML({
        dealerUserId: contactForm.dealerUserId,
        projectId: contactForm.projectId,
        vehicleId: contactForm.vehicleId,
        supabaseUrl: contactForm.supabaseUrl,
        vehicleTitle: contactForm.vehicleTitle,
        currentCategory: contactForm.pageType || '',
      })
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title || `${brand} ${model}`)}</title>
  <meta name="description" content="${escapeHtml(meta.description || '')}">
  <meta name="keywords" content="${(seo.keywords || []).map(escapeHtml).join(', ')}">
  <link rel="canonical" href="${website || '#'}">
  <meta property="og:title" content="${escapeHtml(meta.title || `${brand} ${model}`)}">
  <meta property="og:description" content="${escapeHtml(meta.description || '')}">
  <meta property="og:type" content="website">
  ${ogImage}
  ${jsonLd}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{--lp-primary:${primary};--lp-primary-on:${onPrimary};--lp-secondary:${secondary};--lp-secondary-on:${onSecondary};--lp-tint:${rgba(primary, 0.06)};--lp-border:${rgba(primary, 0.14)}}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',ui-sans-serif,system-ui,sans-serif;color:#0f172a;background:#fff;-webkit-font-smoothing:antialiased}
    img{max-width:100%;display:block}
    a{color:var(--lp-primary);text-decoration:none}
    h1,h2,h3{font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.01em;color:#0f172a}
    .lp-body-html h3{font-size:17px;font-weight:600;margin:18px 0 8px}
    .lp-body-html ul,.lp-body-html ol{padding-left:20px;margin:8px 0}
    .lp-body-html li{margin-bottom:6px}
    .lp-body-html p{margin-bottom:10px}
    .lp-body-html table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
    .lp-body-html th,.lp-body-html td{padding:8px 12px;border:1px solid var(--lp-border);text-align:left}
    .lp-body-html th{background:var(--lp-tint);font-weight:600}
    @media(max-width:768px){
      section > div{padding:56px 20px !important}
      .lp-split{grid-template-columns:1fr !important;gap:24px !important}
      h1{font-size:32px !important;line-height:1.15 !important}
      h2{font-size:26px !important}
    }
  </style>
</head>
<body>
  <header style="position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--lp-border);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px">
    <div style="display:flex;align-items:center;gap:14px">
      ${brandLogoUrl ? `<img src="${brandLogoUrl}" alt="${escapeHtml(brand)}" style="height:30px;width:auto"/>` : ''}
      ${dealerLogo ? `<img src="${dealerLogo}" alt="${escapeHtml(dealerName)}" style="height:34px;width:auto"/>` : ''}
      ${!dealerLogo && dealerName ? `<span style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px">${escapeHtml(dealerName)}</span>` : ''}
    </div>
    ${phone ? `<a href="tel:${phone}" style="background:var(--lp-primary);color:var(--lp-primary-on);padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600">Jetzt anfragen</a>` : ''}
  </header>

  <section style="position:relative;min-height:560px;overflow:hidden;background:#0b1220">
    <div style="display:grid;grid-template-columns:1fr 1fr;min-height:560px" class="lp-split">
      <div style="display:flex;flex-direction:column;justify-content:center;padding:80px 56px;background:linear-gradient(135deg,#0b1220 0%,${primary} 130%);color:#fff;min-height:420px">
        <div style="max-width:520px">
          <div style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:${rgba(secondary, 0.2)};border:1px solid ${rgba(secondary, 0.4)};color:${secondary};font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:20px">${escapeHtml(brand)}</div>
          <h1 style="font-size:52px;font-weight:800;line-height:1.05;margin-bottom:20px;color:#fff">${escapeHtml(heroHeadline)}</h1>
          <p style="font-size:19px;line-height:1.55;color:rgba(255,255,255,0.85);margin-bottom:36px">${escapeHtml(heroSub)}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <a href="#kontakt" style="display:inline-flex;align-items:center;background:${secondary};color:${onSecondary};padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px">${escapeHtml(heroCtaText)}</a>
            ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:rgba(255,255,255,0.1);color:#fff;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;border:1px solid rgba(255,255,255,0.2)">💬 WhatsApp</a>` : ''}
          </div>
        </div>
      </div>
      <div style="position:relative;min-height:420px;background:#0f172a">
        ${heroImage ? `<img src="${heroImage}" alt="${escapeHtml(brand)} ${escapeHtml(model)}" style="width:100%;height:100%;object-fit:cover;display:block" loading="eager" decoding="async"/>` : ''}
      </div>
    </div>
  </section>

  ${sectionBlocks}

  <section id="kontakt" style="background:var(--lp-tint);border-top:1px solid var(--lp-border);padding:80px 24px">
    <div style="max-width:960px;margin:0 auto;text-align:center">
      ${dealerLogo ? `<img src="${dealerLogo}" alt="${escapeHtml(dealerName)}" style="height:56px;margin:0 auto 20px"/>` : ''}
      <h2 style="font-size:30px;font-weight:700;margin-bottom:10px">${escapeHtml(dealerName)}</h2>
      ${address ? `<p style="color:#64748b;font-size:15px;margin-bottom:20px">${escapeHtml(address)}</p>` : ''}
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:20px">
        ${phone ? `<a href="tel:${phone}" style="display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;background:#fff;color:${primary};border:1px solid ${rgba(primary, 0.2)};font-size:14px;font-weight:600">📞 ${escapeHtml(phone)}</a>` : ''}
        ${email ? `<a href="mailto:${email}" style="display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;background:#fff;color:${primary};border:1px solid ${rgba(primary, 0.2)};font-size:14px;font-weight:600">✉ ${escapeHtml(email)}</a>` : ''}
        ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;background:#25d366;color:#fff;border:1px solid #25d366;font-size:14px;font-weight:600">💬 WhatsApp</a>` : ''}
      </div>
    </div>
  </section>

  <footer style="background:#0b1220;color:#94a3b8;padding:32px 24px;text-align:center;font-size:12px">
    <p>© ${new Date().getFullYear()} ${escapeHtml(dealerName)}. Alle Angaben ohne Gewähr.</p>
    ${dealer.defaultLegalText ? `<p style="margin-top:10px;max-width:800px;margin-left:auto;margin-right:auto;line-height:1.6">${escapeHtml(dealer.defaultLegalText)}</p>` : ''}
  </footer>

  ${contactFormHTML}
</body>
</html>`;
}
