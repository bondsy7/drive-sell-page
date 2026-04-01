import { buildContactFormHTML, type ContactFormOptions } from '@/lib/templates/shared';

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
}

export interface LandingPageContactForm {
  dealerUserId: string;
  projectId?: string;
  supabaseUrl: string;
  vehicleTitle: string;
  pageType?: string;
}

// ─── Section Renderers ───

function renderSectionBase(bg: string, inner: string): string {
  return `<section style="${bg};padding:64px 24px">${inner}</section>`;
}

function getColors(bgStyle: string) {
  const bgMap: Record<string, string> = {
    white: 'background:#ffffff',
    light: 'background:#f8fafc',
    dark: 'background:#0f172a;color:#f1f5f9',
    accent: 'background:#1e3a5f;color:#ffffff',
  };
  const bg = bgMap[bgStyle] || bgMap.white;
  const isDark = bgStyle === 'dark' || bgStyle === 'accent';
  return {
    bg,
    headlineColor: isDark ? '#ffffff' : '#0f172a',
    subColor: isDark ? '#cbd5e1' : '#475569',
  };
}

function renderSteps(s: LandingPageSection, colors: ReturnType<typeof getColors>): string {
  return renderSectionBase(colors.bg,
    `<div style="max-width:960px;margin:0 auto;text-align:center">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${colors.headlineColor};margin-bottom:40px">${s.headline}</h2>
      <div style="font-size:15px;line-height:1.8;color:${colors.subColor}">${s.content}</div>
    </div>`);
}

function renderFaq(s: LandingPageSection, colors: ReturnType<typeof getColors>): string {
  return renderSectionBase(colors.bg,
    `<div style="max-width:760px;margin:0 auto">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${colors.headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2>
      <div style="font-size:15px;line-height:1.8;color:${colors.subColor}">${s.content}</div>
    </div>`);
}

function renderCta(s: LandingPageSection, phone: string, whatsapp: string): string {
  return `<section style="background:linear-gradient(135deg,#1e3a5f,#0f172a);color:#ffffff;padding:80px 24px;text-align:center">
    <div style="max-width:640px;margin:0 auto">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:32px;font-weight:700;margin-bottom:16px">${s.headline}</h2>
      <div style="font-size:16px;line-height:1.7;opacity:0.9;margin-bottom:32px">${s.content}</div>
      ${phone ? `<a href="tel:${phone}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">📞 Jetzt anrufen</a>` : ''}
      ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" style="display:inline-block;background:#25d366;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-left:12px">💬 WhatsApp</a>` : ''}
    </div>
  </section>`;
}

function renderSpecs(s: LandingPageSection, img: string, colors: ReturnType<typeof getColors>): string {
  const imgBlock = img ? `<div style="flex:1;min-width:280px"><img src="${img}" alt="${s.headline}" style="width:100%;border-radius:12px;object-fit:cover;max-height:420px" loading="lazy" /></div>` : '';
  return renderSectionBase(colors.bg,
    `<div style="max-width:960px;margin:0 auto">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${colors.headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2>
      <div style="display:flex;flex-wrap:wrap;gap:32px;align-items:flex-start">
        ${imgBlock}
        <div style="flex:1;min-width:280px;font-size:14px;line-height:1.8;color:${colors.subColor}">${s.content}</div>
      </div>
    </div>`);
}

function renderComparison(s: LandingPageSection, colors: ReturnType<typeof getColors>): string {
  return renderSectionBase(colors.bg,
    `<div style="max-width:860px;margin:0 auto">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${colors.headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2>
      <div style="font-size:14px;line-height:1.8;color:${colors.subColor};overflow-x:auto">${s.content}</div>
    </div>`);
}

function renderBenefits(s: LandingPageSection, colors: ReturnType<typeof getColors>): string {
  return renderSectionBase(colors.bg,
    `<div style="max-width:960px;margin:0 auto;text-align:center">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${colors.headlineColor};margin-bottom:40px">${s.headline}</h2>
      <div style="font-size:15px;line-height:1.8;color:${colors.subColor}">${s.content}</div>
    </div>`);
}

function renderGallery(s: LandingPageSection, img: string, colors: ReturnType<typeof getColors>): string {
  return renderSectionBase(colors.bg,
    `<div style="max-width:960px;margin:0 auto">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${colors.headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2>
      ${img ? `<img src="${img}" alt="${s.headline}" style="width:100%;border-radius:12px;object-fit:cover;max-height:500px" loading="lazy" />` : ''}
      <div style="font-size:15px;line-height:1.8;color:${colors.subColor};margin-top:20px">${s.content}</div>
    </div>`);
}

function renderContentWithImage(s: LandingPageSection, img: string, idx: number, colors: ReturnType<typeof getColors>): string {
  const imageOnLeft = idx % 2 === 0;
  const imgBlock = `<div style="flex:1;min-width:280px"><img src="${img}" alt="${s.headline}" style="width:100%;border-radius:12px;object-fit:cover;max-height:400px" loading="lazy" /><p style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:center;font-style:italic">${s.headline}</p></div>`;
  const textBlock = `<div style="flex:1;min-width:280px"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:${colors.headlineColor};margin-bottom:16px">${s.headline}</h2><div style="font-size:15px;line-height:1.8;color:${colors.subColor}">${s.content}</div></div>`;

  return renderSectionBase(colors.bg,
    `<div style="max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:40px;align-items:center">
      ${imageOnLeft ? imgBlock + textBlock : textBlock + imgBlock}
    </div>`);
}

function renderContentOnly(s: LandingPageSection, colors: ReturnType<typeof getColors>): string {
  return renderSectionBase(colors.bg,
    `<div style="max-width:760px;margin:0 auto">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${colors.headlineColor};margin-bottom:20px;text-align:center">${s.headline}</h2>
      <div style="font-size:15px;line-height:1.8;color:${colors.subColor}">${s.content}</div>
    </div>`);
}

// ─── Main Builder ───

export function buildLandingPageHTML(
  content: LandingPageContent,
  images: Record<string, string>,
  dealer: LandingPageDealer,
  brand: string,
  model: string,
  brandLogoUrl?: string,
  contactForm?: LandingPageContactForm
): string {
  const meta = content.meta || {} as any;
  const hero = content.hero || {} as any;
  const sections = content.sections || [];
  const seo = content.seo || {} as any;

  const heroImage = images.hero || '';
  const dealerName = dealer?.name || '';
  const dealerLogo = dealer?.logoUrl || '';
  const phone = dealer?.phone || '';
  const email = dealer?.email || '';
  const website = dealer?.website || '';
  const whatsapp = dealer?.whatsappNumber || '';
  const address = [dealer?.address, dealer?.postalCode, dealer?.city].filter(Boolean).join(', ');

  const socials = [
    dealer?.facebookUrl && `<a href="${dealer.facebookUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">Facebook</a>`,
    dealer?.instagramUrl && `<a href="${dealer.instagramUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">Instagram</a>`,
    dealer?.youtubeUrl && `<a href="${dealer.youtubeUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">YouTube</a>`,
    dealer?.tiktokUrl && `<a href="${dealer.tiktokUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">TikTok</a>`,
  ].filter(Boolean).join(' · ');

  const jsonLd = seo.structuredData
    ? `<script type="application/ld+json">${JSON.stringify(seo.structuredData)}</script>`
    : '';

  const ogImage = heroImage ? `<meta property="og:image" content="${heroImage}">` : '';

  const logoHeader = [
    brandLogoUrl ? `<img src="${brandLogoUrl}" alt="${brand}" style="max-height:32px" />` : '',
    dealerLogo ? `<img src="${dealerLogo}" alt="${dealerName}" style="max-height:40px" />` : '',
  ].filter(Boolean).join('');

  const sectionBlocks = sections
    .map((s, idx) => {
      const img = images[s.id] || '';
      const colors = getColors(s.bgStyle);

      switch (s.type) {
        case 'steps': return renderSteps(s, colors);
        case 'faq': return renderFaq(s, colors);
        case 'cta': return renderCta(s, phone, whatsapp);
        case 'specs': return renderSpecs(s, img, colors);
        case 'comparison': return renderComparison(s, colors);
        case 'benefits': return renderBenefits(s, colors);
        case 'gallery': return renderGallery(s, img, colors);
        default:
          return img
            ? renderContentWithImage(s, img, idx, colors)
            : renderContentOnly(s, colors);
      }
    })
    .join('\n');

  const contactFormHTML = contactForm
    ? buildContactFormHTML({
        dealerUserId: contactForm.dealerUserId,
        projectId: contactForm.projectId,
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
  <title>${meta.title || `${brand} ${model}`}</title>
  <meta name="description" content="${meta.description || ''}">
  <meta name="keywords" content="${(seo.keywords || []).join(', ')}">
  <link rel="canonical" href="${website || '#'}">
  <meta property="og:title" content="${meta.title || `${brand} ${model}`}">
  <meta property="og:description" content="${meta.description || ''}">
  <meta property="og:type" content="website">
  ${ogImage}
  ${jsonLd}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;color:#1e293b;background:#ffffff}
    img{max-width:100%}
    a{color:#3b82f6}
    h1,h2,h3{font-family:'Space Grotesk',sans-serif}
    h3{font-size:18px;font-weight:600;margin:20px 0 8px}
    ul,ol{padding-left:20px}
    li{margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{padding:10px 14px;border:1px solid #e2e8f0;text-align:left;font-size:13px}
    th{background:#f1f5f9;font-weight:600;font-family:'Space Grotesk',sans-serif}
    @media(max-width:768px){
      .hero-content{padding:40px 20px !important}
      .hero-content h1{font-size:28px !important}
      table{font-size:12px}
      th,td{padding:6px 8px}
    }
  </style>
</head>
<body>
  <header style="background:#ffffff;border-bottom:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHeader}
      <span style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px;color:#0f172a">${dealerName}</span>
    </div>
    ${phone ? `<a href="tel:${phone}" style="background:#3b82f6;color:#fff;padding:8px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">Jetzt anfragen</a>` : ''}
  </header>

  <section style="position:relative;min-height:480px;display:flex;align-items:center;overflow:hidden;${heroImage ? `background:url('${heroImage}') center/cover no-repeat` : 'background:linear-gradient(135deg,#0f172a,#1e3a5f)'}">
    <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(15,23,42,0.85) 0%,rgba(15,23,42,0.4) 100%)"></div>
    <div class="hero-content" style="position:relative;z-index:1;max-width:640px;padding:80px 48px;color:#ffffff">
      <h1 style="font-family:'Space Grotesk',sans-serif;font-size:42px;font-weight:800;line-height:1.15;margin-bottom:16px">${hero.headline || `${brand} ${model}`}</h1>
      <p style="font-size:18px;line-height:1.6;opacity:0.9;margin-bottom:32px">${hero.subheadline || ''}</p>
      ${hero.ctaText ? `<a href="#kontakt" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">${hero.ctaText}</a>` : ''}
    </div>
  </section>

  ${sectionBlocks}

  <section id="kontakt" style="background:#f8fafc;padding:64px 24px;border-top:1px solid #e2e8f0">
    <div style="max-width:760px;margin:0 auto;text-align:center">
      ${dealerLogo ? `<img src="${dealerLogo}" alt="${dealerName}" style="max-height:56px;margin-bottom:16px" />` : ''}
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;margin-bottom:8px">${dealerName}</h2>
      ${address ? `<p style="color:#64748b;font-size:14px;margin-bottom:4px">${address}</p>` : ''}
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-top:16px;font-size:14px">
        ${phone ? `<a href="tel:${phone}" style="color:#3b82f6;text-decoration:none">📞 ${phone}</a>` : ''}
        ${email ? `<a href="mailto:${email}" style="color:#3b82f6;text-decoration:none">✉️ ${email}</a>` : ''}
        ${website ? `<a href="${website.startsWith('http') ? website : 'https://' + website}" target="_blank" style="color:#3b82f6;text-decoration:none">🌐 Website</a>` : ''}
        ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" style="color:#25d366;text-decoration:none">💬 WhatsApp</a>` : ''}
      </div>
      ${socials ? `<div style="margin-top:16px;font-size:13px">${socials}</div>` : ''}
    </div>
  </section>

  <footer style="background:#0f172a;color:#94a3b8;padding:32px 24px;text-align:center;font-size:12px">
    <p>&copy; ${new Date().getFullYear()} ${dealerName}. Alle Angaben ohne Gewähr.</p>
    ${dealer?.defaultLegalText ? `<p style="margin-top:8px;max-width:640px;margin-left:auto;margin-right:auto;line-height:1.6">${dealer.defaultLegalText}</p>` : ''}
  </footer>

  ${contactFormHTML}
</body>
</html>`;
}
