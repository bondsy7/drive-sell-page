import SectionBackgroundPicker from '@/components/landing/SectionBackgroundPicker';
import { normalizeSectionColor, sectionColorTheme } from '@/lib/landing-section-colors';
import { LANDING_LAYOUT_CSS } from '@/lib/landing-layout';
import LandingLogo from '@/components/landing/LandingLogo';
import ImageFrame from '@/components/landing/LandingImageFrame';
import ImageStack from '@/components/landing/LandingImageStack';
import { getImageStack, hasExtraImages } from '@/lib/landing-image-stack';
import { LANDING_IMAGE_FRAME_CSS, type LandingImageFrame } from '@/lib/landing-image-frame';
import { LANDING_LOGO_CSS, type LandingLogoId } from '@/lib/landing-logo-size';
import React, { useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, ArrowUp, ArrowDown, Eye, EyeOff, Plus, ImageIcon } from 'lucide-react';
import type { LandingPageContent, LandingPageSection, LandingPageDealer, LandingPageContactForm } from '@/lib/landing-page-builder';
import { shouldLabelLandingImage } from '@/lib/landing-image-disclosure';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelVector, getAiDisclosureLabelAlt, withAiDisclosureAlt, getAiDisclosureText } from "@/lib/ai-disclosure";
import LandingElementBox, { ElementDeleteButton } from '@/components/landing/LandingElementBox';
import { isLandingElementRemoved } from '@/lib/landing-element-editing';
import { landingPrimary, landingSecondary, readableOn, rgba } from '@/lib/landing-theme';
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
  onDeleteElement?: (id: string) => void;
  onResizeLogo?: (id: LandingLogoId, height: number) => void;
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
}> = ({ value, editable, onChange, as: Tag = 'div', multiline, className, style, placeholder, html, hidden, onDelete }) => {
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
      <LandingElementBox editable={editable} onDelete={onDelete} label={Tag === 'h1' || Tag === 'h2' || Tag === 'h3' ? 'Überschrift löschen' : 'Text löschen'}>
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
    <LandingElementBox editable={editable} onDelete={onDelete} inline={Tag === 'span'} label={Tag === 'h1' || Tag === 'h2' || Tag === 'h3' ? 'Überschrift löschen' : 'Text löschen'}>
    <Tag ref={ref as any} className={`lp-editable ${className || ''}`} style={combined} {...editableProps}>
      {value || (editable ? '' : '')}
    </Tag>
    </LandingElementBox>
  );
};

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
  colorControl?: React.ReactNode;
}> = ({ id, editable, enabled = true, onMove, onToggle, onDelete, onAddAfter, children, bg, colorControl }) => {
  if (!enabled && !editable) return null;
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="lp-section"
      style={{ position: 'relative', background: bg, opacity: enabled ? 1 : 0.4 }}
    >
      {editable && <div className="lp-section-controls">
        <div
          className="lp-section-toolbar"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            gap: 4,
            background: 'rgba(15,23,42,0.92)',
            padding: 4,
            borderRadius: 8,
            zIndex: 20,
            opacity: 0,
            transition: 'opacity 140ms ease',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ToolbarButton onClick={() => onMove?.('up')} title="Nach oben"><ArrowUp size={14} /></ToolbarButton>
          <ToolbarButton onClick={() => onMove?.('down')} title="Nach unten"><ArrowDown size={14} /></ToolbarButton>
          <ToolbarButton onClick={onToggle} title={enabled ? 'Ausblenden' : 'Einblenden'}>
            {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </ToolbarButton>

        </div>
        <div className="lp-section-actions">
          {onDelete && <ElementDeleteButton onDelete={onDelete} label={id === 'hero' ? 'Header löschen' : 'Abschnitt löschen'} />}
          {colorControl}
        </div>
      </div>}
      {children}
      {editable && onAddAfter && (
        <div
          className="lp-section-insert"
          style={{
            position: 'relative',
            height: 0,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 15,
          }}
        >
          <button
            onClick={onAddAfter}
            title="Abschnitt einfügen"
            aria-label="Abschnitt einfügen"
            style={{
              position: 'absolute',
              top: -15,
              height: 30,
              padding: '0 12px 0 8px',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              borderRadius: 999,
              border: '1px solid rgba(15,23,42,0.15)',
              background: '#fff',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(15,23,42,0.12)',
              opacity: 0.85,
              transition: 'opacity 140ms ease',
            }}
            className="lp-insert-btn"
          >
            <Plus size={14} /> Abschnitt einfügen
          </button>
        </div>
      )}
    </motion.section>
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
  onDeleteElement,
  onResizeLogo,
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
  const heroCtaText = content.hero?.ctaText || 'Jetzt anfragen';

  return (
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
      `}</style>

      {/* Sticky header */}
      <LandingElementBox editable={editable} hidden={removed('header')} onDelete={() => onDeleteElement?.('header')} label="Kopfzeile löschen">
      <header
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
          {brandLogoUrl && <LandingLogo id="header.brand" src={brandLogoUrl} alt={brand} sizes={content.logoSizes} editable={editable} onResize={onResizeLogo} />}
          {dealerLogo && <LandingLogo id="header.dealer" src={dealerLogo} alt={dealerName} sizes={content.logoSizes} editable={editable} onResize={onResizeLogo} />}
          {!dealerLogo && dealerName && (
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 15 }}>{dealerName}</span>
          )}
        </div>
        {phone && (
          <a
            href={`tel:${phone}`}
            style={{
              background: 'var(--lp-primary)',
              color: 'var(--lp-primary-on)',
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
      </header>
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
                placeholder="Headline eingeben…"
                className="lp-hero-h1"
                style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.05, marginBottom: 20, color: onHero }}
              />
              <Editable
                as="p"
                editable={editable}
                multiline
                value={content.hero?.subheadline || ''}
                onChange={(v) => onUpdateHero?.('subheadline', v)}
                hidden={removed('hero.subheadline')} onDelete={() => onDeleteElement?.('hero.subheadline')}
                placeholder="Untertitel eingeben…"
                className="lp-hero-p"
                style={{ fontSize: 19, lineHeight: 1.55, color: rgba(onHero, 0.85), marginBottom: 36 }}
              />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <LandingElementBox editable={editable} hidden={removed('hero.ctaText')} onDelete={() => onDeleteElement?.('hero.ctaText')} label="Anfragebutton löschen" inline>
                <a
                  href="#kontakt"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: secondary,
                    color: onSecondary,
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

                    placeholder="CTA-Text"
                  />
                </a>
                </LandingElementBox>
                {whatsapp && !removed('hero.whatsapp') && (
                  <LandingElementBox editable={editable} onDelete={() => onDeleteElement?.('hero.whatsapp')} label="WhatsApp-Button löschen" inline><a
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: rgba(onHero, 0.1),
                      color: onHero,
                      padding: '14px 28px',
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: 15,
                      border: `1px solid ${rgba(onHero, 0.2)}`,
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
        <SectionRenderer
          key={s.id}
          section={s}
          backgroundColor={content.sectionColors?.[s.id]}
          colorControl={colorControl(s.id)}
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
      ))}

      {liveInventory?.config?.enabled && !removed('live-fahrzeuge') && (
        <LandingElementBox editable={editable} onDelete={() => onDeleteElement?.('live-fahrzeuge')} label="Live-Fahrzeuge löschen">
        <LiveVehicleShowcase
          config={liveInventory.config}
          vehicles={liveInventory.vehicles}
          inventoryUrl={liveInventory.inventoryUrl}
          loading={liveInventory.loading}
          error={liveInventory.error}
          editable={editable}
        />
        </LandingElementBox>
      )}

      {/* Contact */}
      <LandingElementBox editable={editable} hidden={removed('kontakt')} onDelete={() => onDeleteElement?.('kontakt')} label="Kontaktbereich löschen">
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
      </LandingElementBox>

      {liveInventory?.config?.enabled && !removed('live-fahrzeuge') && !liveInventory.loading && (
        <FinanceFootnotes notes={buildFinanceFootnotes(liveInventory.vehicles, liveInventory.config)} />
      )}

      <footer style={{ background: '#0b1220', color: '#94a3b8', padding: '32px 0', textAlign: 'center', fontSize: 12 }}>
        <div className="lp-content-width">
        <p>© {new Date().getFullYear()} {dealerName}. Alle Angaben ohne Gewähr.</p>
        <p style={{ marginTop: 8 }}>{getAiDisclosureText('landing')}</p>
        {dealer.defaultLegalText && (
          <p style={{ marginTop: 10, margin: '10px auto 0', lineHeight: 1.6 }}>{dealer.defaultLegalText}</p>
        )}
        </div>
      </footer>
    </div>
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
  const enabled = (s as any).enabled !== false;

  // CTA band
  if (s.type === 'cta') {
    return (
      <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} colorControl={colorControl} bg={theme.custom ? bg : undefined}>
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
              placeholder="CTA-Überschrift"
              style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, color: theme.custom ? textColor : '#fff' }}
            />
            <Editable
              as="div"
              html
              editable={editable}
              value={s.content}
              onChange={(v) => onUpdate('content', v)}
              hidden={removed('content')} onDelete={() => onDeleteElement?.('content')}
              placeholder="Text…"
              className="lp-body-html"
              style={{ fontSize: 17, opacity: 0.9, marginBottom: 32 }}
            />
            <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {phone && !removed('phone') && (
                <LandingElementBox editable={editable} onDelete={() => onDeleteElement?.('phone')} label="Telefonbutton löschen" inline><a href={`tel:${phone}`} style={{ background: secondary, color: onSecondary, padding: '14px 28px', borderRadius: 12, fontWeight: 600 }}>
                  📞 Anrufen
                </a></LandingElementBox>
              )}
              {whatsapp && !removed('whatsapp') && (
                <LandingElementBox editable={editable} onDelete={() => onDeleteElement?.('whatsapp')} label="WhatsApp-Button löschen" inline><a
                  href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener"
                  style={{ background: '#25d366', color: '#fff', padding: '14px 28px', borderRadius: 12, fontWeight: 600 }}
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
            placeholder="Überschrift"
            style={{ fontSize: 34, fontWeight: 700, marginBottom: 24, textAlign: 'center', color: textColor }}
          />
          <Editable
            as="div"
            html
            editable={editable}
            value={s.content}
            onChange={(v) => onUpdate('content', v)}
              hidden={removed('content')} onDelete={() => onDeleteElement?.('content')}
            placeholder="Inhalt eingeben…"
            className="lp-body-html"
            style={{ fontSize: 16, color: bodyColor, lineHeight: 1.75 }}
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
            placeholder="Überschrift"
            style={{ fontSize: 34, fontWeight: 700, marginBottom: 32, textAlign: 'center', color: textColor }}
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
            className="lp-body-html"
            style={{ fontSize: 16, color: bodyColor, lineHeight: 1.75 }}
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
              placeholder="Überschrift"
              style={{ fontSize: 32, fontWeight: 700, marginBottom: 20, lineHeight: 1.15, color: textColor }}
            />
            <Editable
              as="div"
              html
              editable={editable}
              value={s.content}
              onChange={(v) => onUpdate('content', v)}
              hidden={removed('content')} onDelete={() => onDeleteElement?.('content')}
              className="lp-body-html"
              style={{ fontSize: 16, color: bodyColor, lineHeight: 1.75 }}
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
