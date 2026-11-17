import { describe, expect, it } from 'vitest';
import { SERVER_INVOICE_OFFERS } from '../../supabase/functions/_shared/invoice-order-catalog';
import {
  calculateInvoiceTotals,
  getInvoiceOffer,
  INVOICE_OFFERS,
  INVOICE_PAYMENT_TERM_DAYS,
} from './invoice-order';

 describe('Rechnungsaufträge', () => {
  it('bietet alle 20 auf der Preisseite ausgewiesenen Leistungen ohne Dubletten an', () => {
    expect(INVOICE_OFFERS).toHaveLength(20);
    expect(new Set(INVOICE_OFFERS.map((offer) => offer.slug)).size).toBe(20);
    for (const offer of INVOICE_OFFERS) {
      expect(SERVER_INVOICE_OFFERS[offer.slug]?.priceCents).toBe(offer.priceCents);
      expect(SERVER_INVOICE_OFFERS[offer.slug]?.kind).toBe(offer.kind);
    }
  });

  it('berechnet Basic bei Erstbuchung mit 399 € Tarif, 990 € Einrichtung und 19 % USt.', () => {
    const totals = calculateInvoiceTotals(getInvoiceOffer('basic')!, true);
    expect(totals).toEqual({
      serviceNetCents: 39900,
      setupFeeCents: 99000,
      netCents: 138900,
      vatCents: 26391,
      totalGrossCents: 165291,
    });
  });

  it('berechnet Basic ohne Einrichtung mit 399 € netto und 474,81 € brutto', () => {
    const totals = calculateInvoiceTotals(getInvoiceOffer('basic')!, false);
    expect(totals.setupFeeCents).toBe(0);
    expect(totals.vatCents).toBe(7581);
    expect(totals.totalGrossCents).toBe(47481);
  });

  it('fügt beim 100 € Credit-Paket keine Einrichtungsgebühr hinzu', () => {
    const totals = calculateInvoiceTotals(getInvoiceOffer('credits-200')!, true);
    expect(totals.setupFeeCents).toBe(0);
    expect(totals.totalGrossCents).toBe(11900);
  });

  it('verwendet für jede Rechnung das bestätigte Zahlungsziel von 14 Tagen', () => {
    expect(INVOICE_PAYMENT_TERM_DAYS).toBe(14);
  });

  it('lehnt unbekannte Leistungen ab', () => {
    expect(getInvoiceOffer('stripe-card')).toBeUndefined();
    expect(SERVER_INVOICE_OFFERS['stripe-card']).toBeUndefined();
  });
});
