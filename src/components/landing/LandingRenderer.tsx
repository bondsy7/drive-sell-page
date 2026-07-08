import React, { useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Upload, Sparkles, ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Plus, ImageIcon } from 'lucide-react';
import type { LandingPageContent, LandingPageSection, LandingPageDealer, LandingPageContactForm } from '@/lib/landing-page-builder';

/* ─── Helpers ─── */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(23,79,107,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.2;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function readableOn(hex: string): string {
  return relativeLuminance(hex) > 0.55 ? '#0f172a' : '#ffffff';
}

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
  onAddSection?: (afterId: string | null) => void;
  imageLoading?: string | null;
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
}> = ({ value, editable, onChange, as: Tag = 'div', multiline, className, style, placeholder, html }) => {
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

  if (html) {
    return (
      // @ts-ignore
      <Tag
        ref={ref as any}
        className={`lp-editable ${className || ''}`}
        style={combined}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        {...editableProps}
      />
    );
  }
  return (
    // @ts-ignore
    <Tag ref={ref as any} className={`lp-editable ${className || ''}`} style={combined} {...editableProps}>
      {value || (editable ? '' : '')}
    </Tag>
  );
};

const ImageFrame: React.FC<{
  src?: string;
  alt: string;
  aspect: string;
  editable: boolean;
  loading?: boolean;
  onReplace?: () => void;
  primary: string;
  rounded?: boolean;
}> = ({ src, alt, aspect, editable, loading, onReplace, primary, rounded = true }) => (
  <div
    className="lp-image-frame"
    style={{
      position: 'relative',
      width: '100%',
      aspectRatio: aspect,
      overflow: 'hidden',
      borderRadius: rounded ? 16 : 0,
      background: rgba(primary, 0.06),
    }}
  >
    {src ? (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    ) : (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: rgba(primary, 0.5),
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <ImageIcon size={20} style={{ marginRight: 8 }} /> Kein Bild
      </div>
    )}
    {editable && (
      <button
        onClick={onReplace}
        className="lp-image-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          border: 'none',
          background: 'rgba(15,23,42,0)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: 0,
          transition: 'opacity 160ms ease, background-color 160ms ease',
        }}
      >
        {loading ? <RefreshCw size={18} className="lp-spin" /> : <><Sparkles size={16} /> Bild ändern</>}
      </button>
    )}
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
}> = ({ id, editable, enabled = true, onMove, onToggle, onDelete, onAddAfter, children, bg }) => {
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
      {editable && (
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
          <ToolbarButton onClick={onDelete} title="Löschen"><Trash2 size={14} /></ToolbarButton>
        </div>
      )}
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
            title="Section einfügen"
            style={{
              position: 'absolute',
              top: -14,
              width: 28,
              height: 28,
              borderRadius: 999,
              border: '1px solid rgba(15,23,42,0.15)',
              background: '#fff',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(15,23,42,0.12)',
              opacity: 0,
              transition: 'opacity 140ms ease',
            }}
            className="lp-insert-btn"
          >
            <Plus size={14} />
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
  onMoveSection,
  onToggleSection,
  onDeleteSection,
  onAddSection,
  imageLoading,
}) => {
  const primary = /^#[0-9a-fA-F]{6}$/.test(dealer.primaryColor || '') ? dealer.primaryColor! : '#174f6b';
  const secondary = /^#[0-9a-fA-F]{6}$/.test(dealer.secondaryColor || '') ? dealer.secondaryColor! : '#e2b04a';
  const onPrimary = readableOn(primary);
  const onSecondary = readableOn(secondary);

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
    <div className="lp-root" style={{ ...cssVars, background: '#ffffff', color: '#0f172a', fontFamily: "'Inter',ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        .lp-root h1,.lp-root h2,.lp-root h3{font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.01em;color:#0f172a}
        .lp-root p{line-height:1.7}
        .lp-root a{color:var(--lp-primary);text-decoration:none}
        .lp-editable[contenteditable="true"]:hover{outline-color:var(--lp-primary) !important;background:var(--lp-tint)}
        .lp-editable[contenteditable="true"]:focus{outline:2px solid var(--lp-primary) !important;background:#fff;outline-offset:2px}
        .lp-editable[contenteditable="true"]:empty::before{content:attr(data-placeholder);color:rgba(15,23,42,0.35)}
        .lp-image-frame:hover .lp-image-overlay{opacity:1;background:rgba(15,23,42,0.55)}
        .lp-section:hover .lp-section-toolbar{opacity:1}
        .lp-section:hover .lp-insert-btn{opacity:1}
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
        @media(max-width:768px){
          .lp-hero-h1{font-size:32px !important;line-height:1.15 !important}
          .lp-hero-p{font-size:16px !important}
          .lp-section-inner{padding:56px 20px !important}
          .lp-split{grid-template-columns:1fr !important;gap:24px !important}
        }
      `}</style>

      {/* Sticky header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--lp-border)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {brandLogoUrl && <img src={brandLogoUrl} alt={brand} style={{ height: 30, width: 'auto' }} />}
          {dealerLogo && <img src={dealerLogo} alt={dealerName} style={{ height: 34, width: 'auto' }} />}
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
      </header>

      {/* HERO */}
      <SectionShell id="hero" editable={editable} onAddAfter={onAddSection ? () => onAddSection('hero') : undefined} bg="#0b1220">
        <div
          className="lp-section-inner"
          style={{
            position: 'relative',
            minHeight: 560,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Left: text */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '80px 56px',
              background: `linear-gradient(135deg, #0b1220 0%, ${primary} 130%)`,
              color: '#fff',
              minHeight: 420,
            }}
          >
            <div style={{ maxWidth: 520 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: rgba(secondary, 0.2),
                  border: `1px solid ${rgba(secondary, 0.4)}`,
                  color: secondary,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 20,
                }}
              >
                {brand}
              </div>
              <Editable
                as="h1"
                editable={editable}
                value={content.hero?.headline || `${brand} ${model}`}
                onChange={(v) => onUpdateHero?.('headline', v)}
                placeholder="Headline eingeben…"
                className="lp-hero-h1"
                style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.05, marginBottom: 20, color: '#fff' }}
              />
              <Editable
                as="p"
                editable={editable}
                multiline
                value={content.hero?.subheadline || ''}
                onChange={(v) => onUpdateHero?.('subheadline', v)}
                placeholder="Untertitel eingeben…"
                className="lp-hero-p"
                style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', marginBottom: 36 }}
              />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
                {whatsapp && (
                  <a
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '14px 28px',
                      borderRadius: 12,
                      fontWeight: 600,
                      fontSize: 15,
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: image */}
          <div style={{ position: 'relative', minHeight: 420, background: '#0f172a' }}>
            <ImageFrame
              src={heroImage}
              alt={`${brand} ${model}`}
              aspect="1 / 1"
              editable={editable}
              loading={imageLoading === 'hero'}
              onReplace={() => onReplaceImage?.('hero')}
              primary={primary}
              rounded={false}
            />
          </div>
        </div>
      </SectionShell>

      {/* Sections */}
      {sections.map((s, idx) => (
        <SectionRenderer
          key={s.id}
          section={s}
          index={idx}
          image={images[s.id]}
          editable={editable}
          primary={primary}
          secondary={secondary}
          onSecondary={onSecondary}
          phone={phone}
          whatsapp={whatsapp}
          imageLoading={imageLoading === s.id}
          onUpdate={(field, v) => onUpdateSection?.(s.id, field, v)}
          onMove={(dir) => onMoveSection?.(s.id, dir)}
          onToggle={() => onToggleSection?.(s.id)}
          onDelete={() => onDeleteSection?.(s.id)}
          onReplaceImage={() => onReplaceImage?.(s.id)}
          onAddAfter={onAddSection ? () => onAddSection(s.id) : undefined}
        />
      ))}

      {/* Contact */}
      <section
        id="kontakt"
        style={{
          background: 'var(--lp-tint)',
          borderTop: '1px solid var(--lp-border)',
          padding: '80px 24px',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          {dealerLogo && <img src={dealerLogo} alt={dealerName} style={{ height: 56, marginBottom: 20 }} />}
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

      <footer style={{ background: '#0b1220', color: '#94a3b8', padding: '32px 24px', textAlign: 'center', fontSize: 12 }}>
        <p>© {new Date().getFullYear()} {dealerName}. Alle Angaben ohne Gewähr.</p>
        {dealer.defaultLegalText && (
          <p style={{ marginTop: 10, maxWidth: 800, margin: '10px auto 0', lineHeight: 1.6 }}>{dealer.defaultLegalText}</p>
        )}
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
  index: number;
  image?: string;
  editable: boolean;
  primary: string;
  secondary: string;
  onSecondary: string;
  phone: string;
  whatsapp: string;
  imageLoading: boolean;
  onUpdate: (field: 'headline' | 'content', v: string) => void;
  onMove: (dir: 'up' | 'down') => void;
  onToggle: () => void;
  onDelete: () => void;
  onReplaceImage: () => void;
  onAddAfter?: () => void;
}> = ({
  section: s,
  index,
  image,
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
  const enabled = (s as any).enabled !== false;

  // CTA band
  if (s.type === 'cta') {
    return (
      <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter}>
        <div
          className="lp-section-inner"
          style={{
            background: `linear-gradient(135deg, ${primary}, #0b1220)`,
            color: '#fff',
            padding: '88px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Editable
              as="h2"
              editable={editable}
              value={s.headline}
              onChange={(v) => onUpdate('headline', v)}
              placeholder="CTA-Überschrift"
              style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, color: '#fff' }}
            />
            <Editable
              as="div"
              html
              editable={editable}
              value={s.content}
              onChange={(v) => onUpdate('content', v)}
              placeholder="Text…"
              className="lp-body-html"
              style={{ fontSize: 17, opacity: 0.9, marginBottom: 32 }}
            />
            <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {phone && (
                <a href={`tel:${phone}`} style={{ background: secondary, color: onSecondary, padding: '14px 28px', borderRadius: 12, fontWeight: 600 }}>
                  📞 Anrufen
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener"
                  style={{ background: '#25d366', color: '#fff', padding: '14px 28px', borderRadius: 12, fontWeight: 600 }}
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  // Full-width text-only (steps, faq, comparison, benefits, content-only)
  const isFullWidth = ['steps', 'faq', 'comparison', 'benefits'].includes(s.type) || (!image && !s.imagePrompt);

  if (isFullWidth) {
    return (
      <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} bg={bg}>
        <div className="lp-section-inner" style={{ maxWidth: 900, margin: '0 auto', padding: '96px 32px' }}>
          <Editable
            as="h2"
            editable={editable}
            value={s.headline}
            onChange={(v) => onUpdate('headline', v)}
            placeholder="Überschrift"
            style={{ fontSize: 34, fontWeight: 700, marginBottom: 24, textAlign: 'center', color: textColor }}
          />
          <Editable
            as="div"
            html
            editable={editable}
            value={s.content}
            onChange={(v) => onUpdate('content', v)}
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
      <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} bg={bg}>
        <div className="lp-section-inner" style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 32px' }}>
          <Editable
            as="h2"
            editable={editable}
            value={s.headline}
            onChange={(v) => onUpdate('headline', v)}
            placeholder="Überschrift"
            style={{ fontSize: 34, fontWeight: 700, marginBottom: 32, textAlign: 'center', color: textColor }}
          />
          <div style={{ marginBottom: 28 }}>
            <ImageFrame
              src={image}
              alt={s.headline}
              aspect="16 / 9"
              editable={editable}
              loading={imageLoading}
              onReplace={onReplaceImage}
              primary={primary}
            />
          </div>
          <Editable
            as="div"
            html
            editable={editable}
            value={s.content}
            onChange={(v) => onUpdate('content', v)}
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
    <SectionShell id={s.id} editable={editable} enabled={enabled} onMove={onMove} onToggle={onToggle} onDelete={onDelete} onAddAfter={onAddAfter} bg={bg}>
      <div
        className="lp-section-inner"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '96px 32px',
        }}
      >
        <div
          className="lp-split"
          style={{
            display: 'grid',
            gridTemplateColumns: imageOnLeft ? '1.1fr 1fr' : '1fr 1.1fr',
            gap: 56,
            alignItems: 'center',
          }}
        >
          {imageOnLeft && (
            <div>
              <ImageFrame
                src={image}
                alt={s.headline}
                aspect="4 / 3"
                editable={editable}
                loading={imageLoading}
                onReplace={onReplaceImage}
                primary={primary}
              />
            </div>
          )}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: isDark ? rgba('#ffffff', 0.6) : primary,
                marginBottom: 14,
              }}
            >
              {`0${index + 1}`.slice(-2)}
            </div>
            <Editable
              as="h2"
              editable={editable}
              value={s.headline}
              onChange={(v) => onUpdate('headline', v)}
              placeholder="Überschrift"
              style={{ fontSize: 32, fontWeight: 700, marginBottom: 20, lineHeight: 1.15, color: textColor }}
            />
            <Editable
              as="div"
              html
              editable={editable}
              value={s.content}
              onChange={(v) => onUpdate('content', v)}
              className="lp-body-html"
              style={{ fontSize: 16, color: bodyColor, lineHeight: 1.75 }}
            />
          </div>
          {!imageOnLeft && (
            <div>
              <ImageFrame
                src={image}
                alt={s.headline}
                aspect="4 / 3"
                editable={editable}
                loading={imageLoading}
                onReplace={onReplaceImage}
                primary={primary}
              />
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
};

export default LandingRenderer;
