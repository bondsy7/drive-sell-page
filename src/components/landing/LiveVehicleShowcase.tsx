import React, { useRef } from 'react';
import { ArrowLeft, ArrowRight, Car } from 'lucide-react';
import JacobsVehicleCard from '@/components/landing/JacobsVehicleCard';
import { buildFinanceFootnotes, toSuperscript } from '@/lib/finance-footnotes';
import { Button } from '@/components/ui/button';
import {
  livePriceLabel,
  liveSpecLabel,
  liveTitleLabel,
  type LiveInventoryConfig,
  type LiveVehicle,
} from '@/lib/live-inventory';

interface Props {
  config: LiveInventoryConfig;
  vehicles: LiveVehicle[];
  inventoryUrl?: string;
  loading?: boolean;
  error?: string | null;
  editable?: boolean;
}

/**
 * Mini vehicle shop inside the landing page. Cards are always resolved from the
 * current dealer stock – the page only stores the rule (LiveInventoryConfig).
 */
const LiveVehicleShowcase: React.FC<Props> = ({ config, vehicles, inventoryUrl, loading, error, editable }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  if (!config?.enabled) return null;
  const notes = new Map(buildFinanceFootnotes(vehicles, config).map(n => [n.vehicleId, n]));

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
      {vehicles.map(v => config.cardDesign?.preset === 'jacobs' ? <JacobsVehicleCard key={v.externalVehicleId} vehicle={v} design={config.cardDesign} editable={editable} footnote={notes.get(v.externalVehicleId)} /> : (
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
            {v.monthlyRate ? <div className="lp-live-rate">ab {v.monthlyRate.toLocaleString('de-DE')} €/Monat{notes.get(v.externalVehicleId) && <sup title={notes.get(v.externalVehicleId)!.text}>{toSuperscript(notes.get(v.externalVehicleId)!.number)}</sup>}</div> : null}
            {inventoryUrl && <span className="lp-live-more">Zum Angebot →</span>}
          </div>
        </a>
      ))}
    </div>
  );

  return (
    <section id="live-fahrzeuge" className={config.cardDesign?.preset === 'jacobs' ? 'lp-live-jacobs' : undefined} style={{ background: 'var(--lp-tint)', borderTop: '1px solid var(--lp-border)' }}>
      <div className="lp-live-inner">
        <div className="lp-live-head">
          <h2 className="lp-live-title">{config.title || 'Aktuelle Fahrzeuge aus unserem Bestand'}</h2>
          {config.layout === 'slider' && vehicles.length > 1 && !loading && !error && (
            <div className="lp-live-nav">
              <Button variant="outline" size="icon" type="button" onClick={() => scroll(-1)} title="Zurück" aria-label="Zurück"><ArrowLeft size={16} /></Button>
              <Button variant="outline" size="icon" type="button" onClick={() => scroll(1)} title="Weiter" aria-label="Weiter"><ArrowRight size={16} /></Button>
            </div>
          )}
        </div>
        {blockContent}
      </div>
    </section>
  );
};

export default LiveVehicleShowcase;
