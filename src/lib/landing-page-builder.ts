import { normalizeSectionColor, sectionColorTheme } from '@/lib/landing-section-colors';
import { getImageStack, hasExtraImages, STACK_GAP_PX, STACK_MAIN, stackImageKey } from '@/lib/landing-image-stack';
import { LANDING_LAYOUT_CSS } from '@/lib/landing-layout';
import { LANDING_LOGO_CSS, type LandingLogoSizes } from '@/lib/landing-logo-size';
import LandingLogo from '@/components/landing/LandingLogo';
import { shouldLabelLandingImage } from '@/lib/landing-image-disclosure';
import { isLandingElementRemoved } from '@/lib/landing-element-editing';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JacobsVehicleCard from '@/components/landing/JacobsVehicleCard';
import FinanceFootnotes from '@/components/landing/FinanceFootnotes';
import { buildFinanceFootnotes, toSuperscript } from '@/lib/finance-footnotes';
import { buildContactFormHTML } from '@/lib/templates/shared';
import { LANDING_IMAGE_FRAME_CSS, frameImageCss, frameOuterCss, normalizeImageFrame, type LandingImageFrame } from '@/lib/landing-image-frame';
import { landingPrimary, landingSecondary, readableOn, rgba } from '@/lib/landing-theme';
import { buildAiDisclosureImageOverlayHTML, withAiDisclosureAlt } from "@/lib/ai-disclosure";
import {
  LIVE_INVENTORY_CSS,
  LIVE_INVENTORY_NARROW_CSS,
  livePriceLabel,
  liveSpecLabel,
  liveTitleLabel,
  type LiveInventoryConfig,
  type LiveVehicle,
} from '@/lib/live-inventory';

export interface LandingPageContent {
  sectionColors?: Record<string, string>;
  logoSizes?: LandingLogoSizes;
  imageFrames?: Record<string, Partial<import('@/lib/landing-image-frame').LandingImageFrame>>;
  /** Ordered image blocks per section; '@main' marks the section's original image. */
  imageStacks?: Record<string, string[]>;
  imageSources?: Record<string, { kind: 'upload' | 'ai'; url: string }>;
  removedElements?: string[];
  meta: { title: string; description: string; h1: string };
  hero: { headline: string; subheadline: string; ctaText: string; imagePrompt?: string };
  sections: LandingPageSection[];
  seo?: { keywords?: string[]; structuredData?: any };
}

function resolveFrame(content: LandingPageContent, id: string, aspect: number): LandingImageFrame | null {
  const raw = content.imageFrames?.[id];
  return raw ? normalizeImageFrame(raw, aspect) : null;
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
  heading?: string;
  intro?: string;
}

/* ─── color helpers come from @/lib/landing-theme (shared with the React renderer) ─── */
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
  whatsapp: string,
  removedElements: string[] = [],
  labelImage = true,
  frames: LandingPageContent['imageFrames'] = undefined,
  stackCtx?: { content: LandingPageContent; images: Record<string, string> },
): string {
  if (s.enabled === false) return '';
  const removed = (field: string) => removedElements.includes(`${s.id}.${field}`);
  const stackEntries = stackCtx ? getImageStack(stackCtx.content, s.id) : [STACK_MAIN];
  const hasExtra = !!stackCtx && hasExtraImages(stackCtx.content, stackCtx.images, s.id);
  const stackHtml = (aspect: number, aspectCss: string, mainBlankAllowed: boolean) => {
    const blocks = stackEntries.map(entry => {
      const isMain = entry === STACK_MAIN;
      if (isMain && removed('image')) return '';
      const url = isMain ? image : stackCtx?.images[entry];
      if (!url && !(isMain && mainBlankAllowed)) return '';
      const key = stackImageKey(s.id, entry);
      const fr = frames?.[key] ? normalizeImageFrame(frames[key], aspect) : null;
      const lbl = isMain ? labelImage : (stackCtx ? shouldLabelLandingImage(stackCtx.content, key, url) : true);
      return `<div class="${fr ? 'lp-framed' : ''}" style="position:relative;${fr ? frameOuterCss(fr) : aspectCss};border-radius:16px;overflow:hidden;background:${rgba(primary, 0.06)}">${url && lbl ? buildAiDisclosureImageOverlayHTML("landing") : ''}${url ? `<img src="${url}" alt="${escapeHtml(lbl ? withAiDisclosureAlt(s.headline) : s.headline)}" style="width:100%;height:100%;object-fit:cover;display:block${fr ? ';' + frameImageCss(fr) : ''}" loading="lazy" decoding="async"/>` : ''}</div>`;
    }).filter(Boolean);
    return blocks.length ? `<div style="display:flex;flex-direction:column;gap:${STACK_GAP_PX}px">${blocks.join('')}</div>` : '';
  };

  const theme = sectionColorTheme(stackCtx?.content.sectionColors?.[s.id], s.bgStyle, primary);
  const bg = theme.background;
  const textColor = theme.foreground;
  const bodyColor = theme.body;

  if (s.type === 'cta') {
    return `<section style="background:${theme.custom ? bg : `linear-gradient(135deg,${primary},#0b1220)`};color:${theme.custom ? textColor : '#fff'};padding:88px 0;text-align:center">
  <div class="lp-content-width">
    ${removed('headline') ? '' : `<h2 style="font-size:36px;font-weight:700;margin-bottom:16px;color:${theme.custom ? textColor : '#fff'}">${escapeHtml(s.headline)}</h2>`}
    ${removed('content') ? '' : `<div class="lp-body-html" style="font-size:17px;opacity:0.9;margin-bottom:32px">${s.content || ''}</div>`}
    <div style="display:inline-flex;gap:12px;flex-wrap:wrap;justify-content:center">
      ${phone && !removed('phone') ? `<a href="tel:${phone}" style="background:${secondary};color:${onSec};padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none">📞 Anrufen</a>` : ''}
      ${whatsapp && !removed('whatsapp') ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" style="background:#25d366;color:#fff;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none">💬 WhatsApp</a>` : ''}
    </div>
  </div>
</section>`;
  }

  const isFullWidth = ['steps', 'faq', 'comparison', 'benefits'].includes(s.type) || (removed('image') || (!image && !s.imagePrompt)) && !hasExtra;

  if (isFullWidth) {
    return `<section style="background:${bg}">
  <div class="lp-content-width" style="padding:96px 32px">
    ${removed('headline') ? '' : `<h2 style="font-size:34px;font-weight:700;margin-bottom:24px;text-align:center;color:${textColor}">${escapeHtml(s.headline)}</h2>`}
    ${removed('content') ? '' : `<div class="lp-body-html" style="font-size:16px;color:${bodyColor};line-height:1.75">${s.content || ''}</div>`}
  </div>
</section>`;
  }

  if (s.type === 'gallery' || s.type === 'specs') {
    return `<section style="background:${bg}">
  <div class="lp-content-width" style="padding:96px 32px">
    ${removed('headline') ? '' : `<h2 style="font-size:34px;font-weight:700;margin-bottom:32px;text-align:center;color:${textColor}">${escapeHtml(s.headline)}</h2>`}
    ${(() => { const h = stackHtml(16 / 9, 'aspect-ratio:16/9', false); return h ? `<div style="margin-bottom:28px">${h}</div>` : ''; })()}
    ${removed('content') ? '' : `<div class="lp-body-html" style="font-size:16px;color:${bodyColor};line-height:1.75">${s.content || ''}</div>`}
  </div>
</section>`;
  }

  // Editorial split
  const imageOnLeft = idx % 2 === 0;
  const imgHtml = `<div class="lp-split-media">${stackHtml(4 / 3, 'aspect-ratio:4/3', true)}</div>`;
  const textHtml = removed('headline') && removed('content') ? '' : `<div>
    ${removed('headline') ? '' : `<h2 style="font-size:32px;font-weight:700;margin-bottom:20px;line-height:1.15;color:${textColor}">${escapeHtml(s.headline)}</h2>`}
    ${removed('content') ? '' : `<div class="lp-body-html" style="font-size:16px;color:${bodyColor};line-height:1.75">${s.content || ''}</div>`}
  </div>`;

  return `<section style="background:${bg}">
  <div class="lp-content-width" style="padding:96px 32px">
    <div class="lp-split" style="display:grid;grid-template-columns:${!textHtml ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))'};gap:56px;align-items:center">
      ${imageOnLeft ? imgHtml + textHtml : textHtml + imgHtml}
    </div>
  </div>
</section>`;
}

/* ─── Live vehicle block (mini vehicle shop from the connected dealer stock) ─── */

export interface LandingPageLiveInventory {
  config: LiveInventoryConfig;
  vehicles: LiveVehicle[];
  inventoryUrl?: string;
}

function buildLiveInventorySectionHTML(live: LandingPageLiveInventory): string {
  const { config, vehicles, inventoryUrl = '' } = live;
  if (!config?.enabled) return '';

  const notes = new Map(buildFinanceFootnotes(vehicles, config).map(n => [n.vehicleId, n]));
  const card = (v: LiveVehicle) => {
    const note = notes.get(v.externalVehicleId);
    if (config.cardDesign?.preset === 'jacobs') return renderToStaticMarkup(createElement(JacobsVehicleCard, { vehicle: v, design: config.cardDesign, footnote: note }));
    const name = escapeHtml(liveTitleLabel(v));
    const href = inventoryUrl ? escapeHtml(inventoryUrl) : '#';
    return `<a class="lp-live-card" href="${href}"${inventoryUrl ? ' target="_blank" rel="noopener noreferrer"' : ''}>
  <div class="lp-live-media">${v.thumbnail ? `<img src="${escapeHtml(v.thumbnail)}" alt="${name}" loading="lazy" decoding="async"/>` : ''}</div>
  <div class="lp-live-body">
    <div class="lp-live-name">${name}</div>
    ${v.variant ? `<div class="lp-live-variant">${escapeHtml(v.variant)}</div>` : ''}
    <div class="lp-live-specs">${escapeHtml(liveSpecLabel(v))}</div>
    <div class="lp-live-price">${escapeHtml(livePriceLabel(v))}</div>
    ${note ? `<div class="lp-live-rate">ab ${escapeHtml(note.rate.toLocaleString('de-DE'))} €/Monat<sup title="${escapeHtml(note.text)}">${toSuperscript(note.number)}</sup></div>` : ''}
    ${inventoryUrl ? '<span class="lp-live-more">Zum Angebot →</span>' : ''}
  </div>
</a>`;
  };

  const inner = vehicles.length
    ? `<div class="${config.layout === 'grid' ? 'lp-live-grid' : 'lp-live-track'}">${vehicles.map(card).join('\n')}</div>`
    : '<div class="lp-live-empty">Derzeit keine passenden Fahrzeuge verfügbar.</div>';

  // The rule travels with the page so an external site can re-resolve the live stock.
  const rule = escapeHtml(JSON.stringify({ ...config, selectedIds: config.selectedIds ?? [] }));

  return `<section id="live-fahrzeuge" class="${config.cardDesign?.preset === 'jacobs' ? 'lp-live-jacobs' : ''}" style="background:var(--lp-tint);border-top:1px solid var(--lp-border)" data-live-inventory="${rule}">
  <div class="lp-live-inner">
    <div class="lp-live-head"><h2 class="lp-live-title">${escapeHtml(config.title || 'Aktuelle Fahrzeuge aus unserem Bestand')}</h2></div>
    ${inner}
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
  contactForm?: LandingPageContactForm,
  liveInventory?: LandingPageLiveInventory
): string {
  const meta = content.meta || ({} as any);
  const hero = content.hero || ({} as any);
  const sections = content.sections || [];
  const seo = content.seo || ({} as any);

  const primary = landingPrimary(dealer);
  const secondary = landingSecondary(dealer);
  const onPrimary = readableOn(primary);
  const heroBackground = normalizeSectionColor(content.sectionColors?.hero) || primary;
  const onHero = readableOn(heroBackground);
  const onSecondary = readableOn(secondary);

  const removed = (id: string) => isLandingElementRemoved(content, id);
  const heroHasImage = !removed('hero.image');
  const heroHasText = !['brand', 'headline', 'subheadline', 'ctaText', 'whatsapp'].every(field => removed(`hero.${field}`));
  const heroImage = heroHasImage ? images.hero || '' : '';
  const heroFrame = resolveFrame(content, 'hero', 1);
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
    .map((s, idx) => renderSection(s, idx, images[s.id] || '', primary, secondary, onSecondary, phone, whatsapp, content.removedElements, shouldLabelLandingImage(content, s.id, images[s.id]), content.imageFrames, { content, images }))
    .join('\n');

  const liveBlock = liveInventory && !removed('live-fahrzeuge') ? buildLiveInventorySectionHTML(liveInventory) : '';

  const contactFormHTML = contactForm && !removed('kontakt')
    ? buildContactFormHTML({
        dealerUserId: contactForm.dealerUserId,
        projectId: contactForm.projectId,
        vehicleId: contactForm.vehicleId,
        supabaseUrl: contactForm.supabaseUrl,
        vehicleTitle: contactForm.vehicleTitle,
        currentCategory: contactForm.pageType || '',
        heading: contactForm.heading,
        intro: contactForm.intro,
        accent: secondary,
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
    body{container-type:inline-size;container-name:lp}
    ${LANDING_IMAGE_FRAME_CSS}
    ${LIVE_INVENTORY_CSS}
    /* Narrow layouts (tablet / mobile and real devices): image and text always stack. */
    @media(max-width:768px){
      section > div:not(.lp-hero-grid){padding:56px 20px !important}
      .lp-split{grid-template-columns:1fr !important;gap:24px !important}
      .lp-split-media{order:-1 !important}
      .lp-hero-text{padding:48px 24px !important;min-height:0 !important}
      .lp-hero-media{min-height:300px !important}
      h1{font-size:32px !important;line-height:1.15 !important}
      h2{font-size:26px !important}
      ${LIVE_INVENTORY_NARROW_CSS}
    }
    @container lp (max-width:900px){
      section > div:not(.lp-hero-grid){padding:56px 20px !important}
      .lp-split{grid-template-columns:1fr !important;gap:28px !important;align-items:start !important}
      .lp-split-media{order:-1 !important}
      .lp-hero-text{padding:48px 24px !important;min-height:0 !important}
      .lp-hero-media{min-height:300px !important}
      h1{font-size:32px !important;line-height:1.15 !important}
      h2{font-size:26px !important}
      ${LIVE_INVENTORY_NARROW_CSS}
    }
    ${LANDING_LAYOUT_CSS}
    ${LANDING_LOGO_CSS}
  </style>
</head>
<body class="lp-layout">
${removed('header') ? '' : `  <header style="position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--lp-border);padding:14px 0">
    <div class="lp-content-width lp-header-inner">
    <div class="lp-header-logos">
      ${brandLogoUrl ? renderToStaticMarkup(createElement(LandingLogo, { id: 'header.brand', src: brandLogoUrl, alt: brand, sizes: content.logoSizes })) : ''}
      ${dealerLogo ? renderToStaticMarkup(createElement(LandingLogo, { id: 'header.dealer', src: dealerLogo, alt: dealerName, sizes: content.logoSizes })) : ''}
      ${!dealerLogo && dealerName ? `<span style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px">${escapeHtml(dealerName)}</span>` : ''}
    </div>
    ${phone ? `<a href="tel:${phone}" style="background:var(--lp-primary);color:var(--lp-primary-on);padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600">Jetzt anfragen</a>` : ''}
    </div>
  </header>`}

${removed('hero') ? '' : `  <section style="position:relative;min-height:560px;overflow:hidden;background:${heroBackground}">
    <div style="display:grid;grid-template-columns:${heroHasImage && heroHasText ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)'};min-height:560px" class="lp-content-width lp-hero-grid">
${heroHasText ? `      <div class="lp-hero-text" style="display:flex;flex-direction:column;justify-content:center;padding:80px 56px;background:${heroBackground};color:${onHero};min-height:420px">
        <div style="max-width:${heroHasImage ? '520px' : 'none'}">
${removed('hero.brand') ? '' : `          <div style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:${secondary};border:1px solid ${secondary};color:${onSecondary};font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:20px">${escapeHtml(brand)}</div>`}
${removed('hero.headline') ? '' : `          <h1 style="font-size:52px;font-weight:800;line-height:1.05;margin-bottom:20px;color:${onHero}">${escapeHtml(heroHeadline)}</h1>`}
${removed('hero.subheadline') ? '' : `          <p style="font-size:19px;line-height:1.55;color:${rgba(onHero, 0.85)};margin-bottom:36px">${escapeHtml(heroSub)}</p>`}
          <div style="display:flex;gap:12px;flex-wrap:wrap">
${removed('hero.ctaText') ? '' : `            <a href="#kontakt" style="display:inline-flex;align-items:center;background:${secondary};color:${onSecondary};padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px">${escapeHtml(heroCtaText)}</a>`}
            ${whatsapp && !removed('hero.whatsapp') ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:${rgba(onHero, 0.1)};color:${onHero};padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;border:1px solid ${rgba(onHero, 0.2)}">💬 WhatsApp</a>` : ''}
          </div>
        </div>
      </div>
` : ''}
${heroHasImage ? (heroFrame ? `      <div class="lp-hero-media" style="position:relative;align-self:start">
        <div class="lp-framed" style="position:relative;overflow:hidden;border-radius:16px;${frameOuterCss(heroFrame)}">
        ${shouldLabelLandingImage(content, 'hero', heroImage) ? buildAiDisclosureImageOverlayHTML("landing") : ''}
        ${heroImage ? `<img src="${heroImage}" alt="${escapeHtml(shouldLabelLandingImage(content, 'hero', heroImage) ? withAiDisclosureAlt(`${brand} ${model}`) : `${brand} ${model}`)}" style="width:100%;height:100%;object-fit:cover;display:block;${frameImageCss(heroFrame)}" loading="eager" decoding="async"/>` : ''}
        </div>
      </div>` : `      <div class="lp-hero-media" style="position:relative;min-height:420px;background:${rgba(primary, 0.06)};border-radius:16px;overflow:hidden">
        ${shouldLabelLandingImage(content, 'hero', heroImage) ? buildAiDisclosureImageOverlayHTML("landing") : ''}
        ${heroImage ? `<img src="${heroImage}" alt="${escapeHtml(shouldLabelLandingImage(content, 'hero', heroImage) ? withAiDisclosureAlt(`${brand} ${model}`) : `${brand} ${model}`)}" style="width:100%;height:100%;object-fit:cover;display:block" loading="eager" decoding="async"/>` : ''}
      </div>`) : ''}
    </div>
  </section>`}

  ${sectionBlocks}

  ${liveBlock}

${removed('kontakt') ? '' : `  <section id="kontakt" style="background:var(--lp-tint);border-top:1px solid var(--lp-border);padding:80px 0">
    <div class="lp-content-width" style="text-align:center">
      ${dealerLogo ? renderToStaticMarkup(createElement(LandingLogo, { id: 'contact.dealer', src: dealerLogo, alt: dealerName, sizes: content.logoSizes })) : ''}
      <h2 style="font-size:30px;font-weight:700;margin-bottom:10px">${escapeHtml(dealerName)}</h2>
      ${address ? `<p style="color:#64748b;font-size:15px;margin-bottom:20px">${escapeHtml(address)}</p>` : ''}
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:20px">
        ${phone ? `<a href="tel:${phone}" style="display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;background:#fff;color:${primary};border:1px solid ${rgba(primary, 0.2)};font-size:14px;font-weight:600">📞 ${escapeHtml(phone)}</a>` : ''}
        ${email ? `<a href="mailto:${email}" style="display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;background:#fff;color:${primary};border:1px solid ${rgba(primary, 0.2)};font-size:14px;font-weight:600">✉ ${escapeHtml(email)}</a>` : ''}
        ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;background:#25d366;color:#fff;border:1px solid #25d366;font-size:14px;font-weight:600">💬 WhatsApp</a>` : ''}
      </div>
    </div>
  </section>`}

  ${liveInventory && !removed('live-fahrzeuge') && liveInventory.config?.enabled ? renderToStaticMarkup(createElement(FinanceFootnotes, { notes: buildFinanceFootnotes(liveInventory.vehicles, liveInventory.config) })) : ''}


  ${contactFormHTML}
</body>
</html>`;
}
