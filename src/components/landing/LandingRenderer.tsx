import LandingEditMenu from '@/components/landing/LandingEditMenu';
import { Button } from '@/components/ui/button';
import SectionBackgroundPicker from '@/components/landing/SectionBackgroundPicker';
import LandingSectionResize, { LandingSectionSizeContext } from '@/components/landing/LandingSectionResize';
import LandingHeaderResize from '@/components/landing/LandingHeaderResize';
import { LANDING_SECTION_HEIGHT_CSS } from '@/lib/landing-section-height';
import { buttonColorOverride, normalizeSectionColor, sectionColorTheme, textColorOverride } from '@/lib/landing-section-colors';
import { LANDING_LAYOUT_CSS } from '@/lib/landing-layout';
import LandingLogo, { LogoSizeControl } from '@/components/landing/LandingLogo';
import ImageFrame from '@/components/landing/LandingImageFrame';
import ImageStack from '@/components/landing/LandingImageStack';
import { getImageStack, hasExtraImages } from '@/lib/landing-image-stack';
import { LANDING_IMAGE_FRAME_CSS, type LandingImageFrame } from '@/lib/landing-image-frame';
import { LANDING_LOGO_CSS, type LandingLogoId } from '@/lib/landing-logo-size';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { liveInsertIndex, LIVE_BLOCK_ID } from '@/lib/landing-section-order';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, ArrowUp, ArrowDown, Eye, EyeOff, Plus, ImageIcon } from 'lucide-react';
import type { LandingPageContent, LandingPageSection, LandingPageDealer, LandingPageContactForm } from '@/lib/landing-page-builder';
import { shouldLabelLandingImage } from '@/lib/landing-image-disclosure';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelVector, getAiDisclosureLabelAlt, withAiDisclosureAlt } from "@/lib/ai-disclosure";
import LandingElementBox, { ElementDeleteButton } from '@/components/landing/LandingElementBox';
import TextColorButton from '@/components/landing/TextColorButton';
import ButtonColorButton from '@/components/landing/ButtonColorButton';

import { isLandingElementRemoved } from '@/lib/landing-element-editing';
import { editorControlStyle, landingPrimary, landingSecondary, readableOn, rgba } from '@/lib/landing-theme';
import LiveVehicleShowcase from '@/components/landing/LiveVehicleShowcase';
import {
  LIVE_INVENTORY_CSS,
  LIVE_INVENTORY_NARROW_CSS,
  type LiveInventoryConfig,
  type LiveVehicle,
} from '@/lib/live-inventory';

import FinanceFootnotes from '@/components/landing/FinanceFootnotes';
import { buildFinanceFootnotes } from '@/lib/finance-footnotes';

export interface LiveInventoryView {
  config: LiveInventoryConfig;
  vehicles: LiveVehicle[];
  inventoryUrl?: string;
  loading?: boolean;
  error?: string | null;
}

/* ─── Colour helpers come from @/lib/landing-theme (shared with the HTML export) ─── */

/* ─── Section registry ─── */

export interface RendererProps {
  content: LandingPageContent;
  images: Record<string, string>;
  dealer: LandingPageDealer;
  brand: string;
  model: string;
  brandLogoUrl?: string;
  editable?: boolean;
  onUpdateHero?: (field: 'headline' | 'subheadline' | 'ctaText', value: string) => void;
  onUpdateSection?: (id: string, field: 'headline' | 'content', value: string) => void;
  onReplaceImage?: (sectionId: string) => void;
  onMoveSection?: (id: string, dir: 'up' | 'down') => void;
  onToggleSection?: (id: string) => void;
  onDeleteSection?: (id: string) => void;
  onSectionColorChange?: (id: string, color: string | null) => void;
  onTextColorChange?: (id: string, color: string | null) => void;
  onButtonColorChange?: (id: string, color: string | null) => void;

  onDeleteElement?: (id: string) => void;
  onResizeLogo?: (id: LandingLogoId, height: number) => void;
  onResizeSection?: (id: string, height: number) => void;
  /** Desktop editor only: frame/pan/zoom tools for images. */
  frameEditing?: boolean;
  onFrameChange?: (imageId: string, frame: LandingImageFrame | null) => void;
  /** Insert a new image block above/below an existing one in a section. */
  onInsertImage?: (sectionId: string, anchor: string, pos: 'before' | 'after') => void;
  onDeleteStackImage?: (imageId: string) => void;
  onAddSection?: (afterId: string | null) => void;
  imageLoading?: string | null;
  liveInventory?: LiveInventoryView | null;
}

const Editable: React.FC<{
  value: string;
  editable: boolean;
  onChange?: (v: string) => void;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3';
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  html?: boolean;
  hidden?: boolean;
  onDelete?: () => void;
  colorControl?: React.ReactNode;
}> = ({ value, editable, onChange, as: Tag = 'div', multiline, className, style, placeholder, html, hidden, onDelete, colorControl }) => {
  const ref = useRef<HTMLElement>(null);
  const commit = useCallback(() => {
    if (!ref.current) return;
    const next = html ? ref.current.innerHTML : (ref.current.innerText || '');
    if (next !== value) onChange?.(next);
  }, [onChange, value, html]);

  const editableProps = editable
    ? {
        contentEditable: true,
        suppressContentEditableWarning: true,
        onBlur: commit,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
        },
        'data-placeholder': placeholder,
      }
    : {};

  const hoverStyle: React.CSSProperties = editable
    ? {
        outline: '1px dashed transparent',
        outlineOffset: 4,
        borderRadius: 4,
        transition: 'outline-color 120ms ease, background-color 120ms ease',
        cursor: 'text',
      }
    : {};

  const combined = { ...hoverStyle, ...style };

  if (hidden) return null;
  if (html) {
    return (
      <LandingElementBox editable={editable} onDelete={onDelete} colorControl={colorControl} label={Tag === 'h1' || Tag === 'h2' || Tag === 'h3' ? 'Überschrift löschen' : 'Text löschen'}>
      <Tag
        ref={ref as any}
        className={`lp-editable ${className || ''}`}
        style={combined}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        {...editableProps}
      />
      </LandingElementBox>
    );
  }
  return (
    <LandingElementBox editable={editable} onDelete={onDelete} colorControl={colorControl} inline={Tag === 'span'} label={Tag === 'h1' || Tag === 'h2' || Tag === 'h3' ? 'Überschrift löschen' : 'Text löschen'}>
    <Tag ref={ref as any} className={`lp-editable ${className || ''}`} style={combined} {...editableProps}>
      {value || (editable ? '' : '')}
    </Tag>
    </LandingElementBox>
  );
};

/** Wrapper that keeps sections relatively positioned for the editor controls. */
const SortableSection: React.FC<{ id: string; children: React.ReactNode }> = ({ children }) => (
  <div className="lp-sortable" style={{ position: 'relative' }}>
    {children}
  </div>
);

const SectionShell: React.FC<{
  id: string;
  editable: boolean;
  enabled?: boolean;
  onMove?: (dir: 'up' | 'down') => void;
  onToggle?: () => void;
  onDelete?: () => void;
  onAddAfter?: () => void;
  children: React.ReactNode;
  bg?: string;
  surface?: string;
  colorControl?: React.ReactNode;
}> = ({ id, editable, enabled = true, onMove, onToggle, onDelete, onAddAfter, children, bg, surface, colorControl }) => {
  if (!enabled && !editable) return null;
  return (
    <LandingSectionResize id={id} editable={editable} surface={surface ?? bg}><motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="lp-section"
      style={{ position: 'relative', background: bg, opacity: enabled ? 1 : 0.4, ...editorControlStyle(surface ?? bg) }}
    >
      {editable && <div className="lp-section-controls">
        <LandingEditMenu label={id === 'hero' ? 'Header bearbeiten' : 'Abschnitt bearbeiten'}>
          {onMove && <Button variant="ghost" onClick={() => onMove('up')}><ArrowUp size={16} /> Nach oben</Button>}
          {onMove && <Button variant="ghost" onClick={() => onMove('down')}><ArrowDown size={16} /> Nach unten</Button>}
          {onToggle && <Button variant="ghost" onClick={onToggle}>{enabled ? <EyeOff size={16} /> : <Eye size={16} />} {enabled ? 'Ausblenden' : 'Einblenden'}</Button>}
          {colorControl}
          {onAddAfter && <Button variant="ghost" onClick={onAddAfter}><Plus size={16} /> Abschnitt einfügen</Button>}
          {onDelete && <ElementDeleteButton onDelete={onDelete} label={id === 'hero' ? 'Header löschen' : 'Abschnitt löschen'} />}
        </LandingEditMenu>
      </div>}
      {children}
    </motion.section></LandingSectionResize>
  );
};

const ToolbarButton: React.FC<{ onClick?: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 26,
      height: 26,
      borderRadius: 6,
      background: 'transparent',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </button>
);

/* ─── Main renderer ─── */

const LandingRenderer: React.FC<RendererProps> = ({
  content,
  images,
  dealer,
  brand,
  model,
  brandLogoUrl,
  editable = false,
  onUpdateHero,
  onUpdateSection,
  onReplaceImage,
  onInsertImage,
  onDeleteStackImage,
  onMoveSection,
  onToggleSection,
  onDeleteSection,
  onSectionColorChange,
  onTextColorChange,
  onButtonColorChange,

  onDeleteElement,
  onResizeLogo,
  onResizeSection,
  frameEditing = false,
  onFrameChange,
  onAddSection,
  imageLoading,
  liveInventory,
}) => {
  const primary = landingPrimary(dealer);
  const secondary = landingSecondary(dealer);
  const onPrimary = readableOn(primary);
  const onSecondary = readableOn(secondary);
  const heroBackground = normalizeSectionColor(content.sectionColors?.hero) || primary;
  const onHero = readableOn(heroBackground);
  const profileColors = [
    { label: 'Primärfarbe', value: dealer.primaryColor },
    { label: 'Sekundärfarbe', value: dealer.secondaryColor },
  ].flatMap(color => { const value = normalizeSectionColor(color.value); return value ? [{ label: color.label, value }] : []; });
  const colorControl = (id: string) => editable && onSectionColorChange ? <SectionBackgroundPicker value={content.sectionColors?.[id]} colors={profileColors} onChange={color => onSectionColorChange(id, color)} /> : undefined;
  const textControl = (id: string) => editable && onTextColorChange
    ? <TextColorButton value={content.textColors?.[id]} colors={profileColors} onChange={color => onTextColorChange(id, color)} />
    : undefined;
  const textOverride = (id: string, fallback: string) => textColorOverride(content.textColors?.[id], fallback);
  const buttonControl = (id: string) => editable && onButtonColorChange
    ? <ButtonColorButton value={content.buttonColors?.[id]} colors={profileColors} onChange={color => onButtonColorChange(id, color)} />
    : undefined;
  const buttonColor = (id: string, fallback: string) => buttonColorOverride(content.buttonColors?.[id], fallback);


  const removed = (id: string) => isLandingElementRemoved(content, id);
  const heroHasImage = !removed('hero.image');
  const heroHasText = !['brand', 'headline', 'subheadline', 'ctaText', 'whatsapp'].every(field => removed(`hero.${field}`));
  const heroImage = images.hero || '';
  const dealerName = dealer.name || '';
  const dealerLogo = dealer.logoUrl || '';
  const phone = dealer.phone || '';
  const whatsapp = dealer.whatsappNumber || '';
  const address = [dealer.address, dealer.postalCode, dealer.city].filter(Boolean).join(', ');

  const cssVars = useMemo(
    () =>
      ({
        '--lp-primary': primary,
        '--lp-primary-on': onPrimary,
        '--lp-secondary': secondary,
        '--lp-secondary-on': onSecondary,
        '--lp-tint': rgba(primary, 0.06),
        '--lp-border': rgba(primary, 0.14),
      }) as React.CSSProperties,
    [primary, secondary, onPrimary, onSecondary]
  );

  const sections = content.sections || [];
  const liveAt = liveInsertIndex(content);
  const liveNode = liveInventory?.config?.enabled && !removed('live-fahrzeuge') ? (
    <SortableSection id={LIVE_BLOCK_ID}>
      <LandingElementBox editable={editable} cover controlOn="#ffffff" onDelete={() => onDeleteElement?.('live-fahrzeuge')} label="Live-Fahrzeuge löschen">
      <LandingSectionResize id={LIVE_BLOCK_ID} editable={editable}>
        <LiveVehicleShowcase
          config={liveInventory.config}
          vehicles={liveInventory.vehicles}
          inventoryUrl={liveInventory.inventoryUrl}
          loading={liveInventory.loading}
          error={liveInventory.error}
          editable={editable}
        />
      </LandingSectionResize>
      </LandingElementBox>
    </SortableSection>
  ) : null;
  const heroCtaText = content.hero?.ctaText || 'Jetzt anfragen';
  const headerButtonBg = buttonColor('header', primary);
  const heroCtaBg = buttonColor('hero.ctaText', secondary);
  const heroWhatsappBg = normalizeSectionColor(content.buttonColors?.['hero.whatsapp']);


  return (
    <LandingSectionSizeContext.Provider value={{ heights: content.sectionHeights, onResize: onResizeSection }}>
    <div className="lp-root lp-layout" style={{ ...cssVars, background: '#ffffff', color: '#0f172a', fontFamily: "'Inter',ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        .lp-root h1,.lp-root h2,.lp-root h3{font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.01em;color:#0f172a}
        .lp-root p{line-height:1.7}
        .lp-root a{color:var(--lp-primary);text-decoration:none}
        .lp-editable[contenteditable="true"]:hover{outline-color:var(--lp-primary) !important;background:rgba(15,23,42,0.10)}
        .lp-editable[contenteditable="true"]:focus{outline:2px solid var(--lp-primary) !important;background:rgba(15,23,42,0.10);outline-offset:2px}
        .lp-editable[contenteditable="true"]:empty::before{content:attr(data-placeholder);color:rgba(15,23,42,0.35)}
        .lp-image-frame:hover .lp-image-overlay{opacity:1;background:rgba(15,23,42,0.55)}
        .lp-section:hover .lp-section-toolbar{opacity:1}
        .lp-section:hover .lp-insert-btn{opacity:1}
        .lp-section:hover,.lp-section:focus-within{z-index:5}
        .lp-section-insert{z-index:25 !important}
        .lp-insert-btn:hover{background:var(--lp-primary);color:var(--lp-primary-on) !important}
        .lp-spin{animation:lp-spin 0.9s linear infinite}
        @keyframes lp-spin{to{transform:rotate(360deg)}}
        .lp-body-html h3{font-size:17px;font-weight:600;margin:18px 0 8px}
        .lp-body-html ul,.lp-body-html ol{padding-left:20px;margin:8px 0}
        .lp-body-html li{margin-bottom:6px}
        .lp-body-html p{margin-bottom:10px}
        .lp-body-html table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
        .lp-body-html th,.lp-body-html td{padding:8px 12px;border:1px solid var(--lp-border);text-align:left}
        .lp-body-html th{background:var(--lp-tint);font-weight:600}
        .lp-root{container-type:inline-size;container-name:lp}
        ${LIVE_INVENTORY_CSS}
        /* Narrow layouts (tablet / mobile preview and real devices): image and text always stack. */
        @media(max-width:768px){
          .lp-hero-h1{font-size:32px !important;line-height:1.15 !important}
          .lp-hero-p{font-size:16px !important}
          .lp-section-inner:not(.lp-hero-grid){padding:56px 20px !important}
          .lp-hero-grid{grid-template-columns:1fr !important}
          .lp-hero-text{padding:48px 24px !important;min-height:0 !important}
          .lp-hero-media{min-height:300px !important}
          .lp-hero-media .lp-image-frame{aspect-ratio:4 / 3 !important}
          .lp-split{grid-template-columns:1fr !important;gap:24px !important}
          .lp-split-media{order:-1 !important}
          ${LIVE_INVENTORY_NARROW_CSS}
        }
        @container lp (max-width:900px){
          .lp-hero-h1{font-size:32px !important;line-height:1.15 !important}
          .lp-hero-p{font-size:16px !important}
          .lp-section-inner:not(.lp-hero-grid){padding:56px 20px !important}
          .lp-hero-grid{grid-template-columns:1fr !important}
          .lp-hero-text{padding:48px 24px !important;min-height:0 !important}
          .lp-hero-media{min-height:300px !important}
          .lp-hero-media .lp-image-frame{aspect-ratio:4 / 3 !important}
          .lp-split{grid-template-columns:1fr !important;gap:28px !important;align-items:start !important}
          .lp-split-media{order:-1 !important}
          ${LIVE_INVENTORY_NARROW_CSS}
        }
        ${LANDING_LAYOUT_CSS}
        ${LANDING_LOGO_CSS}
        ${LANDING_IMAGE_FRAME_CSS}
        ${LANDING_SECTION_HEIGHT_CSS}
      `}</style>

      {/* Sticky header */}
      <LandingElementBox editable={editable} hidden={removed('header')} controlOn="#ffffff" onDelete={() => onDeleteElement?.('header')} label="Kopfzeile löschen" colorControl={buttonControl('header')}>
      <LandingHeaderResize editable={editable} surface="#ffffff"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--lp-border)',
          padding: '14px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div className="lp-content-width lp-header-inner">
        <div className="lp-header-logos">
          {brandLogoUrl && !removed('header.brand') && <LandingElementBox editable={editable} inline menuSide="right" onDelete={() => onDeleteElement?.('header.brand')} label="Herstellerlogo löschen" colorControl={<LogoSizeControl id="header.brand" alt="Herstellerlogo" sizes={content.logoSizes} onResize={onResizeLogo} />}><LandingLogo id="header.brand" src={brandLogoUrl} alt={brand} sizes={content.logoSizes} /></LandingElementBox>}
          {dealerLogo && !removed('header.dealer') && <LandingElementBox editable={editable} inline menuSide="right" onDelete={() => onDeleteElement?.('header.dealer')} label="Händlerlogo löschen" colorControl={<LogoSizeControl id="header.dealer" alt="Händlerlogo" sizes={content.logoSizes} onResize={onResizeLogo} />}><LandingLogo id="header.dealer" src={dealerLogo} alt={dealerName} sizes={content.logoSizes} /></LandingElementBox>}
          {!dealerLogo && dealerName && (
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 15 }}>{dealerName}</span>
          )}
        </div>
        {phone && (
          <a
            href={`tel:${phone}`}
            style={{
              background: headerButtonBg,
              color: readableOn(headerButtonBg),

              padding: '10px 20px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Jetzt anfragen
          </a>
        )}
        </div>
      </LandingHeaderResize>
      </LandingElementBox>

      {/* HERO */}
      {!removed('hero') && <SectionShell id="hero" editable={editable} onDelete={() => onDeleteElement?.('hero')} onAddAfter={onAddSection ? () => onAddSection('hero') : undefined} bg={heroBackground} colorControl={colorControl('hero')}>
        <div
          className="lp-section-inner lp-content-width lp-hero-grid"
          style={{
            position: 'relative',
            minHeight: 560,
            display: 'grid',
            gridTemplateColumns: heroHasImage && heroHasText ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            gap: 0,
            padding: '80px 32px',
            overflow: 'hidden',
          }}
        >
          {/* Left: text */}
          {heroHasText && <div
            className="lp-hero-text"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '80px 56px',
              background: heroBackground,
              color: onHero,
              minHeight: 420,
            }}
          >
            <div style={{ maxWidth: heroHasImage ? 520 : undefined }}>
              <LandingElementBox editable={editable} hidden={removed('hero.brand')} onDelete={() => onDeleteElement?.('hero.brand')} label="Marke löschen" inline>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: secondary,
                  border: `1px solid ${secondary}`,
                  color: onSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 20,
                }}
              >
                {brand}
              </div>
              </LandingElementBox>
              <Editable
                as="h1"
                editable={editable}
                value={content.hero?.headline || `${brand} ${model}`}
                onChange={(v) => onUpdateHero?.('headline', v)}
                hidden={removed('hero.headline')} onDelete={() => onDeleteElement?.('hero.headline')}
                colorControl={textControl('hero.headline')}
                placeholder="Headline eingeben…"
                className="lp-hero-h1"
                style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.05, marginBottom: 20, color: textOverride('hero.headline', onHero) }}
              />
              <Editable
                as="p"
                editable={editable}
                multiline
                value={content.hero?.subheadline || ''}
                onChange={(v) => onUpdateHero?.('subheadline', v)}
                hidden={removed('hero.subheadline')} onDelete={() => onDeleteElement?.('hero.subheadline')}
                colorControl={textControl('hero.subheadline')}
                placeholder="Untertitel eingeben…"
                className="lp-hero-p"
                style={{ fontSize: 19, lineHeight: 1.55, color: textOverride('hero.subheadline', rgba(onHero, 0.85)), marginBottom: 36 }}
              />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <LandingElementBox editable={editable} hidden={removed('hero.ctaText')} onDelete={() => onDeleteElement?.('hero.ctaText')} label="Anfragebutton löschen" inline>
                <a
                  href="#kontakt"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: heroCtaBg,
                    color: readableOn(heroCtaBg),

                    padding: '14px 28px',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  <Editable
                    as="span"
                    editable={editable}
                    value={heroCtaText}
                    onChange={(v) => onUpdateHero?.('ctaText', v)}
                    colorControl={<>{textControl('hero.ctaText')}{buttonControl('hero.ctaText')}</>}
                    style={{ color: textOverride('hero.ctaText', readableOn(heroCtaBg)) }}

                    placeholder="CTA-Text"
                  />
                </a>
                </LandingElementBox>
                {whatsapp && !removed('hero.whatsapp') && (
                  <LandingElementBox editable={editable} onDelete={() => onDeleteElement?.('hero.whatsapp')} label="WhatsApp-Button löschen" inline colorControl={buttonControl('hero.whatsapp')}><a
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: heroWhatsappBg || rgba(onHero, 0.1),
                      color: heroWhatsappBg ? readableOn(heroWhatsappBg) : onHero,
                      padding: '14px 28px',
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: 15,
                      border: `1px solid ${heroWhatsappBg ? rgba(readableOn(heroWhatsappBg), 0.2) : rgba(onHero, 0.2)}`,

                    }}
                  >
                    💬 WhatsApp
                  </a></LandingElementBox>
                )}
              </div>
            </div>
          </div>}

          {/* Right: image */}
          {heroHasImage && <div className="lp-hero-media" style={content.imageFrames?.hero ? { position: 'relative', alignSelf: 'start' } : { position: 'relative', minHeight: 420 }}>
            <ImageFrame
              src={heroImage}
              labelImage={shouldLabelLandingImage(content, 'hero', heroImage)}
              alt={`${brand} ${model}`}
              aspect="1 / 1"
              editable={editable}
              loading={imageLoading === 'hero'}
              onReplace={() => onReplaceImage?.('hero')}
              onDelete={() => onDeleteElement?.('hero.image')}
              primary={primary}
              frame={content.imageFrames?.hero}
              frameEditing={editable && frameEditing}
              onFrameChange={(f) => onFrameChange?.('hero', f)}
            />
          </div>}
        </div>
      </SectionShell>}

      {/* Sections */}
      {sections.map((s, idx) => (
        <React.Fragment key={s.id}>
        {idx === liveAt && liveNode}
        <SortableSection id={s.id}>
        <SectionRenderer
          key={s.id}
          section={s}
          backgroundColor={content.sectionColors?.[s.id]}
          colorControl={colorControl(s.id)}
          textColors={content.textColors}
          buttonColors={content.buttonColors}
          profileColors={profileColors}
          onTextColorChange={onTextColorChange}
          onButtonColorChange={onButtonColorChange}

          index={idx}
          image={images[s.id]}
          labelImage={shouldLabelLandingImage(content, s.id, images[s.id])}
          editable={editable}
          primary={primary}
          secondary={secondary}
          onSecondary={onSecondary}
          phone={phone}
          whatsapp={whatsapp}
          imageLoading={imageLoading === s.id}
          removedElements={content.removedElements}
          onDeleteElement={(field) => onDeleteElement?.(`${s.id}.${field}`)}
          onUpdate={(field, v) => onUpdateSection?.(s.id, field, v)}
          onMove={(dir) => onMoveSection?.(s.id, dir)}
          onToggle={() => onToggleSection?.(s.id)}
          onDelete={() => onDeleteSection?.(s.id)}
          onReplaceImage={() => onReplaceImage?.(s.id)}
          frame={content.imageFrames?.[s.id]}
          frameEditing={editable && frameEditing}
          onFrameChange={(f) => onFrameChange?.(s.id, f)}
          onAddAfter={onAddSection ? () => onAddSection(s.id) : undefined}
          hasExtra={hasExtraImages(content, images, s.id)}
          stack={(aspect, main) => (
            <ImageStack
              entries={getImageStack(content, s.id)}
              main={main}
              editable={editable}
              onInsert={onInsertImage ? (anchor, pos) => onInsertImage(s.id, anchor, pos) : undefined}
              renderExtra={(key) => (
                <ImageFrame
                  src={images[key]}
                  labelImage={shouldLabelLandingImage(content, key, images[key])}
                  alt={s.headline}
                  aspect={aspect}
                  editable={editable}
                  loading={imageLoading === key}
                  onReplace={() => onReplaceImage?.(key)}
                  onDelete={onDeleteStackImage ? () => onDeleteStackImage(key) : undefined}
                  primary={primary}
                  frame={content.imageFrames?.[key]}
                  frameEditing={editable && frameEditing}
                  onFrameChange={(f) => onFrameChange?.(key, f)}
                />
              )}
              hasImage={(key) => !!images[key]}
            />
          )}
        />
        </SortableSection>
        </React.Fragment>
      ))}
      {liveAt >= sections.length && liveNode}

      {/* Contact */}
      {!removed('kontakt') && <>
      <LandingElementBox editable={editable} cover controlOn="#ffffff" hidden={removed('kontakt')} onDelete={() => onDeleteElement?.('kontakt')} label="Kontaktbereich löschen" colorControl={buttonControl('kontakt')}>
      <LandingSectionResize id="kontakt" editable={editable}>
      <section
        id="kontakt"
        style={{
          background: 'var(--lp-tint)',
          borderTop: '1px solid var(--lp-border)',
          padding: '80px 0',
        }}
      >
        <div className="lp-content-width" style={{ textAlign: 'center' }}>
          {dealerLogo && <LandingLogo id="contact.dealer" src={dealerLogo} alt={dealerName} sizes={content.logoSizes} editable={editable} onResize={onResizeLogo} />}
          <h2 style={{ fontSize: 30, fontWeight: 700, marginBottom: 10 }}>{dealerName}</h2>
          {address && <p style={{ color: '#64748b', fontSize: 15, marginBottom: 20 }}>{address}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 20 }}>
            {phone && (
              <a href={`tel:${phone}`} style={contactPillStyle(primary)}>
                📞 {phone}
              </a>
            )}
            {dealer.email && (
              <a href={`mailto:${dealer.email}`} style={contactPillStyle(primary)}>
                ✉ {dealer.email}
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener"
                style={{ ...contactPillStyle(primary), background: '#25d366', color: '#fff', borderColor: '#25d366' }}
              >
                💬 WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>
      </LandingSectionResize>
      </LandingElementBox></>}

      {liveInventory?.config?.enabled && !removed('live-fahrzeuge') && !liveInventory.loading && (
        <FinanceFootnotes notes={buildFinanceFootnotes(liveInventory.vehicles, liveInventory.config)} title={liveInventory.config.financeTitle} />
      )}

    </div>
    </LandingSectionSizeContext.Provider>
  );
};

function contactPillStyle(primary: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: 999,
    background: '#fff',
    color: primary,
    border: `1px solid ${rgba(primary, 0.2)}`,
    fontSize: 14,
    fontWeight: 600,
  };
}

/* ─── Section Renderer ─── */

const SectionRenderer: React.FC<{
  section: LandingPageSection;
  backgroundColor?: string;
  colorControl?: React.ReactNode;
  textColors?: Record<string, string>;
  buttonColors?: Record<string, string>;
  profileColors?: { label: string; value: string }[];
  onTextColorChange?: (id: string, color: string | null) => void;
  onButtonColorChange?: (id: string, color: string | null) => void;

  index: number;
  image?: string;
  labelImage: boolean;
  editable: boolean;
  primary: string;
  secondary: string;
  onSecondary: string;
  phone: string;
  whatsapp: string;
  imageLoading: boolean;
  removedElements?: string[];
  onDeleteElement?: (field: string) => void;
  onUpdate: (field: 'headline' | 'content', v: string) => void;
  onMove: (dir: 'up' | 'down') => void;
  onToggle: () => void;
  onDelete: () => void;
  onReplaceImage: () => void;
  frame?: Partial<LandingImageFrame>;
  frameEditing?: boolean;
  onFrameChange?: (f: LandingImageFrame | null) => void;
  onAddAfter?: () => void;
  hasExtra?: boolean;
  stack: (aspect: string, main: React.ReactNode | null) => React.ReactNode;
}> = ({
  hasExtra,
  stack,
  frame,
  frameEditing,
  onFrameChange,
  section: s,
  backgroundColor,
  colorControl,
  textColors,
  profileColors,
  onTextColorChange,
  removedElements,
  onDeleteElement,
  index,
  image,
  labelImage,
  editable,
  primary,
  secondary,
  onSecondary,
  phone,
  whatsapp,
  imageLoading,
  onUpdate,
  onMove,
  onToggle,
  onDelete,
  onReplaceImage,
  onAddAfter,
}) => {
  const removed = (field: string) => removedElements?.includes(`${s.id}.${field}`) ?? false;
  const theme = sectionColorTheme(backgroundColor, s.bgStyle, primary);
  const bg = theme.background;
  const textColor = theme.foreground;
  const bodyColor = theme.body;
  const textControl = (field: string) => editable && onTextColorChange
    ? <TextColorButton value={textColors?.[`${s.id}.${field}`]} colors={profileColors || []} onChange={color => onTextColorChange(`${s.id}.${field}`, color)} />
    : undefined;
  const textOverride = (field: string, fallback: string) => textColorOverride(textColors?.[`${s.id}.${field}`], fallback);
  const textOverrideOptional = (field: string) => normalizeSectionColor(textColors?.[`${s.id}.${field}`]);
  const buttonControl = (field: string) => editable && onButtonColorChange
    ? <ButtonColorButton value={buttonColors?.[`${s.id}.${field}`]} colors={profileColors || []} onChange={color => onButtonColorChange(`${s.id}.${field}`, color)} />
    : undefined;
  const buttonBg = (field: string, fallback: string) => buttonColorOverride(buttonColors?.[`${s.id}.${field}`], fallback);

  const enabled = (s as any).enabled !== false;

  // CTA band
  if (s.type === 'cta') {
    return (
      <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} colorControl={colorControl} bg={theme.custom ? bg : undefined} surface={theme.custom ? bg : '#0b1220'}>
        <div
          className="lp-section-inner"
          style={{
            background: theme.custom ? bg : `linear-gradient(135deg, ${primary}, #0b1220)`,
            color: theme.custom ? textColor : '#fff',
            padding: '88px 0',
            textAlign: 'center',
          }}
        >
          <div className="lp-content-width">
            <Editable
              as="h2"
              editable={editable}
              value={s.headline}
              onChange={(v) => onUpdate('headline', v)}
              hidden={removed('headline')} onDelete={() => onDeleteElement?.('headline')}
              colorControl={textControl('headline')}
              placeholder="CTA-Überschrift"
              style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, color: textOverride('headline', theme.custom ? textColor : '#fff') }}
            />
            <Editable
              as="div"
              html
              editable={editable}
              value={s.content}
              onChange={(v) => onUpdate('content', v)}
              hidden={removed('content')} onDelete={() => onDeleteElement?.('content')}
              colorControl={textControl('content')}
              placeholder="Text…"
              className="lp-body-html"
              style={{ fontSize: 17, opacity: 0.9, marginBottom: 32, ...(textOverrideOptional('content') ? { color: textOverrideOptional('content') } : {}) }}
            />
            <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {phone && !removed('phone') && (
                <LandingElementBox editable={editable} onDelete={() => onDeleteElement?.('phone')} label="Telefonbutton löschen" inline colorControl={buttonControl('phone')}><a href={`tel:${phone}`} style={{ background: buttonBg('phone', secondary), color: readableOn(buttonBg('phone', secondary)), padding: '14px 28px', borderRadius: 12, fontWeight: 600 }}>
                  📞 Anrufen
                </a></LandingElementBox>
              )}
              {whatsapp && !removed('whatsapp') && (
                <LandingElementBox editable={editable} onDelete={() => onDeleteElement?.('whatsapp')} label="WhatsApp-Button löschen" inline colorControl={buttonControl('whatsapp')}><a
                  href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener"
                  style={{ background: buttonBg('whatsapp', '#25d366'), color: readableOn(buttonBg('whatsapp', '#25d366')), padding: '14px 28px', borderRadius: 12, fontWeight: 600 }}

                >
                  💬 WhatsApp
                </a></LandingElementBox>
              )}
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  // Full-width text-only (steps, faq, comparison, benefits, content-only)
  const isFullWidth = ['steps', 'faq', 'comparison', 'benefits'].includes(s.type) || (removed('image') || (!image && !s.imagePrompt)) && !hasExtra;

  if (isFullWidth) {
    return (
      <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} colorControl={colorControl} bg={bg}>
        <div className="lp-section-inner lp-content-width" style={{ padding: '96px 32px' }}>
          <Editable
            as="h2"
            editable={editable}
            value={s.headline}
            onChange={(v) => onUpdate('headline', v)}
              hidden={removed('headline')} onDelete={() => onDeleteElement?.('headline')}
            colorControl={textControl('headline')}
            placeholder="Überschrift"
            style={{ fontSize: 34, fontWeight: 700, marginBottom: 24, textAlign: 'center', color: textOverride('headline', textColor) }}
          />
          <Editable
            as="div"
            html
            editable={editable}
            value={s.content}
            onChange={(v) => onUpdate('content', v)}
              hidden={removed('content')} onDelete={() => onDeleteElement?.('content')}
            colorControl={textControl('content')}
            placeholder="Inhalt eingeben…"
            className="lp-body-html"
            style={{ fontSize: 16, color: textOverride('content', bodyColor), lineHeight: 1.75 }}
          />
        </div>
      </SectionShell>
    );
  }

  // Gallery: image on top, text below
  if (s.type === 'gallery' || s.type === 'specs') {
    return (
      <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} colorControl={colorControl} bg={bg}>
        <div className="lp-section-inner lp-content-width" style={{ padding: '96px 32px' }}>
          <Editable
            as="h2"
            editable={editable}
            value={s.headline}
            onChange={(v) => onUpdate('headline', v)}
              hidden={removed('headline')} onDelete={() => onDeleteElement?.('headline')}
            colorControl={textControl('headline')}
            placeholder="Überschrift"
            style={{ fontSize: 34, fontWeight: 700, marginBottom: 32, textAlign: 'center', color: textOverride('headline', textColor) }}
          />
          <div style={{ marginBottom: 28 }}>
            {stack('16 / 9', removed('image') ? null : (<ImageFrame
              src={image}
                labelImage={labelImage}
              alt={s.headline}
              aspect="16 / 9"
              editable={editable}
              loading={imageLoading}
              onReplace={onReplaceImage}
                onDelete={() => onDeleteElement?.('image')}
              primary={primary}
              frame={frame}
              frameEditing={frameEditing}
              onFrameChange={onFrameChange}
            />))}
          </div>
          <Editable
            as="div"
            html
            editable={editable}
            value={s.content}
            onChange={(v) => onUpdate('content', v)}
              hidden={removed('content')} onDelete={() => onDeleteElement?.('content')}
            colorControl={textControl('content')}
            className="lp-body-html"
            style={{ fontSize: 16, color: textOverride('content', bodyColor), lineHeight: 1.75 }}
          />
        </div>
      </SectionShell>
    );
  }

  // Editorial split (default content type with image) - alternating
  const imageOnLeft = index % 2 === 0;
  return (
    <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} colorControl={colorControl} bg={bg}>
      <div
        className="lp-section-inner lp-content-width"
        style={{
          padding: '96px 32px',
        }}
      >
        <div
          className="lp-split"
          style={{
            display: 'grid',
            gridTemplateColumns: removed('headline') && removed('content') ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
            gap: 56,
            alignItems: 'center',
          }}
        >
          {imageOnLeft && (
            <div className="lp-split-media">
              {stack('4 / 3', removed('image') ? null : (<ImageFrame
                src={image}
                labelImage={labelImage}
                alt={s.headline}
                aspect="4 / 3"
                editable={editable}
                loading={imageLoading}
                onReplace={onReplaceImage}
                onDelete={() => onDeleteElement?.('image')}
                primary={primary}
                frame={frame}
                frameEditing={frameEditing}
                onFrameChange={onFrameChange}
              />))}
            </div>
          )}
          {!(removed('headline') && removed('content')) && <div>
            <Editable
              as="h2"
              editable={editable}
              value={s.headline}
              onChange={(v) => onUpdate('headline', v)}
              hidden={removed('headline')} onDelete={() => onDeleteElement?.('headline')}
              colorControl={textControl('headline')}
              placeholder="Überschrift"
              style={{ fontSize: 32, fontWeight: 700, marginBottom: 20, lineHeight: 1.15, color: textOverride('headline', textColor) }}
            />
            <Editable
              as="div"
              html
              editable={editable}
              value={s.content}
              onChange={(v) => onUpdate('content', v)}
              hidden={removed('content')} onDelete={() => onDeleteElement?.('content')}
              colorControl={textControl('content')}
              className="lp-body-html"
              style={{ fontSize: 16, color: textOverride('content', bodyColor), lineHeight: 1.75 }}
            />
          </div>}
          {!imageOnLeft && (
            <div className="lp-split-media">
              {stack('4 / 3', removed('image') ? null : (<ImageFrame
                src={image}
                labelImage={labelImage}
                alt={s.headline}
                aspect="4 / 3"
                editable={editable}
                loading={imageLoading}
                onReplace={onReplaceImage}
                onDelete={() => onDeleteElement?.('image')}
                primary={primary}
                frame={frame}
                frameEditing={frameEditing}
                onFrameChange={onFrameChange}
              />))}
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
};

export default LandingRenderer;
