import React, { useRef } from 'react';
import { ArrowLeft, ArrowRight, Car } from 'lucide-react';
import {
  livePriceLabel,
  liveSpecLabel,
  liveTitleLabel,
  type LiveInventoryConfig,
  type LiveVehicle,
} from '@/lib/live-inventory';

/**
 * Styles for the live-stock block. Kept as one string so the editor canvas
 * (LandingRenderer) and the exported/published HTML (landing-page-builder)
 * render the block exactly the same way.
 */
export const LIVE_INVENTORY_CSS = `
.lp-live-inner{max-width:1200px;margin:0 auto;padding:96px 32px}
.lp-live-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px;flex-wrap:wrap}
.lp-live-title{font-size:34px;font-weight:700;color:#0f172a;line-height:1.15}
.lp-live-nav{display:flex;gap:8px}
.lp-live-nav button{width:34px;height:34px;border-radius:999px;border:1px solid var(--lp-border);background:#fff;color:#0f172a;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color 140ms ease}
.lp-live-nav button:hover{background:var(--lp-tint)}
.lp-live-track{display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 4px 18px;scrollbar-width:thin}
.lp-live-track > .lp-live-card{flex:0 0 320px;scroll-snap-align:start}
.lp-live-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.lp-live-card{display:flex;flex-direction:column;border:1px solid var(--lp-border);border-radius:16px;overflow:hidden;background:#fff;text-decoration:none;color:inherit;transition:box-shadow 180ms ease, transform 180ms ease}
.lp-live-card:hover{box-shadow:0 10px 30px rgba(15,23,42,.10);transform:translateY(-2px)}
.lp-live-media{position:relative;aspect-ratio:4/3;background:var(--lp-tint);overflow:hidden;display:flex;align-items:center;justify-content:center;color:rgba(15,23,42,.35)}
.lp-live-media img{width:100%;height:100%;object-fit:cover;display:block}
.lp-live-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px}
.lp-live-name{font-size:16px;font-weight:700;color:#0f172a;line-height:1.3}
.lp-live-variant{font-size:13px;color:#64748b;line-height:1.4}
.lp-live-specs{font-size:12px;color:#64748b}
.lp-live-price{font-size:19px;font-weight:800;color:var(--lp-primary);margin-top:6px}
.lp-live-rate{font-size:12px;color:#64748b}
.lp-live-more{margin-top:10px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--lp-primary)}
.lp-live-empty{padding:28px;border:1px dashed var(--lp-border);border-radius:14px;text-align:center;color:#64748b;font-size:14px}
`;

/** Narrow layouts (tablet / mobile preview and real devices): one card per view. */
export const LIVE_INVENTORY_NARROW_CSS = `
  .lp-live-inner{padding:56px 20px !important}
  .lp-live-title{font-size:26px !important}
  .lp-live-track > .lp-live-card{flex:0 0 82%}
`;

interface Props {
  config: LiveInventoryConfig;
  vehicles: LiveVehicle[];
  inventoryUrl?: string;
  loading?: boolean;
  error?: string | null;
  editable?: boolean;
}

const LiveVehicleShowcase: React.FC<Props> = ({ config, vehicles, inventoryUrl, loading, error, editable }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  if (!config?.enabled) return null;

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const blockContent = loading ? (
    <div className="lp-live-empty">Fahrzeuge werden geladen …</div>
  ) : error ? (
    <div className="lp-live-empty">{error}</div>
  ) : vehicles.length === 0 ? (
    <div className="lp-live-empty">
      {editable
        ? 'Für die aktuelle Auswahl sind keine Fahrzeuge im Bestand.'
        : 'Derzeit keine passenden Fahrzeuge verfügbar.'}
    </div>
  ) : (
    <div className={config.layout === 'grid' ? 'lp-live-grid' : 'lp-live-track'} ref={config.layout === 'grid' ? undefined : trackRef}>
      {vehicles.map(v => (
        <a
          key={v.externalVehicleId}
          className="lp-live-card"
          href={inventoryUrl || undefined}
          target={inventoryUrl ? '_blank' : undefined}
          rel="noopener noreferrer"
          onClick={editable ? (e) => e.preventDefault() : undefined}
        >
          <div className="lp-live-media">
            {v.thumbnail
              ? <img src={v.thumbnail} alt={`${liveTitleLabel(v)}`} loading="lazy" decoding="async" />
              : <Car size={26} />}
          </div>
          <div className="lp-live-body">
            <div className="lp-live-name">{liveTitleLabel(v)}</div>
            {v.variant && <div className="lp-live-variant">{v.variant}</div>}
            <div className="lp-live-specs">{liveSpecLabel(v)}</div>
            <div className="lp-live-price">{livePriceLabel(v)}</div>
            {v.monthlyRate ? <div className="lp-live-rate">ab {v.monthlyRate.toLocaleString('de-DE')} €/Monat</div> : null}
            {inventoryUrl && <span className="lp-live-more">Zum Angebot →</span>}
          </div>
        </a>
      ))}
    </div>
  );

  return (
    <section id="live-fahrzeuge" style={{ background: 'var(--lp-tint)', borderTop: '1px solid var(--lp-border)' }}>
      <div className="lp-live-inner">
        <div className="lp-live-head">
          <h2 className="lp-live-title">{config.title || 'Aktuelle Fahrzeuge aus unserem Bestand'}</h2>
          {config.layout === 'slider' && vehicles.length > 1 && !loading && !error && (
            <div className="lp-live-nav">
              <button type="button" onClick={() => scroll(-1)} title="Zurück" aria-label="Zurück"><ArrowLeft size={16} /></button>
              <button type="button" onClick={() => scroll(1)} title="Weiter" aria-label="Weiter"><ArrowRight size={16} /></button>
            </div>
          )}
        </div>
        {blockContent}
      </div>
    </section>
  );
};

export default LiveVehicleShowcase;
