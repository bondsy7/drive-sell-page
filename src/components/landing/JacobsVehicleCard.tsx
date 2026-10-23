import { Car, Gauge, SlidersHorizontal, Fuel, Zap, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FinanceFootnote } from '@/lib/finance-footnotes';
import { toSuperscript } from '@/lib/finance-footnotes';
import { jacobsFuelLabel, jacobsPowerLabel, jacobsPriceLabel, jacobsTitleLabel, liveVehicleHref, type LiveVehicle, type LiveVehicleCardDesign } from '@/lib/live-inventory';

export default function JacobsVehicleCard({ vehicle: v, design, editable, footnote }: { vehicle: LiveVehicle; design: LiveVehicleCardDesign; editable?: boolean; footnote?: FinanceFootnote }) {
  const href = liveVehicleHref(v, design);
  const title = jacobsTitleLabel(v);
  // Rate only with complete § 17 PAngV details (footnote exists).
  const rate = footnote?.rate ?? null;
  const stopEditingClick = editable ? (event: React.MouseEvent) => event.preventDefault() : undefined;
  return <article className="lp-live-card lp-jacobs-card">
    <a className="lp-jacobs-main" href={href} target={href ? '_blank' : undefined} rel="noopener noreferrer" aria-label={`Zum Fahrzeug: ${title}`} onClick={stopEditingClick}>
      <div className="lp-jacobs-image">{v.thumbnail ? <img src={v.thumbnail} alt={title} loading="lazy" decoding="async" /> : <Car size={26} />}</div>
      <div className="lp-jacobs-content">
        <div className="lp-jacobs-heading"><h3 className="lp-jacobs-title" title={title}>{title}</h3><p className="lp-jacobs-subtitle">{v.used === false ? 'Neuwagen' : v.used ? 'Gebrauchtwagen' : 'Fahrzeug'}</p></div>
        <div className="lp-jacobs-specs">
          <div className="lp-jacobs-spec"><Gauge aria-hidden="true" /><span>{v.mileage != null ? `${v.mileage.toLocaleString('de-DE')} km` : '—'}</span></div>
          <div className="lp-jacobs-spec"><SlidersHorizontal aria-hidden="true" /><span>{v.transmission || '—'}</span></div>
          <div className="lp-jacobs-spec">{['ELECTRIC', 'Elektro'].includes(v.fuelType || '') ? <Zap aria-hidden="true" /> : <Fuel aria-hidden="true" />}<span>{jacobsFuelLabel(v)}</span></div>
          <div className="lp-jacobs-spec"><Gauge aria-hidden="true" /><span>{jacobsPowerLabel(v)}</span></div>
        </div>
      </div>
    </a>
    <div className="lp-jacobs-price-panel"><div className="lp-jacobs-price">{jacobsPriceLabel(v)}</div><div className="lp-jacobs-rate">{rate ? <>oder ab {rate.toLocaleString('de-DE')} € mtl.{footnote && <a href={`#lp-fin-${footnote.number}`} title={footnote.text} aria-label={`Finanzierungsbeispiel ${footnote.number}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>{toSuperscript(footnote.number)}</a>}</> : ''}</div></div>
    <div className="lp-jacobs-footer">
      {href ? <Button asChild variant="outline" className="lp-jacobs-cta"><a href={href} target="_blank" rel="noopener noreferrer" onClick={stopEditingClick}>Zum Fahrzeug</a></Button> : <span className="lp-jacobs-cta" aria-disabled="true">Fahrzeuglink nicht verfügbar</span>}
      {design.contactEmail && <Button asChild variant="outline" size="icon" className="lp-jacobs-action"><a href={`mailto:${design.contactEmail}?subject=${encodeURIComponent(`Anfrage: ${title} (${v.internalNumber || ''})`)}`} aria-label="Anfrage senden" title="Anfrage senden" onClick={stopEditingClick}><Mail /></a></Button>}
      {design.contactPhone && <Button asChild variant="outline" size="icon" className="lp-jacobs-action"><a href={`tel:${design.contactPhone.replace(/[^+\d]/g, '')}`} aria-label="Anrufen" title="Anrufen" onClick={stopEditingClick}><Phone /></a></Button>}
    </div>
    <div className="lp-jacobs-emission">{v.emissionText && <p>{v.emissionText.replace(/<[^>]*>/g, '')}</p>}</div>
  </article>;
}