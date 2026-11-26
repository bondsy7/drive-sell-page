import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import LandingRenderer from '@/components/landing/LandingRenderer';
import { buildLandingPageHTML, type LandingPageContent } from '@/lib/landing-page-builder';

const baseContent = (): LandingPageContent => ({
  meta: { title: 'T', description: 'D', h1: 'H' },
  hero: { headline: 'Head', subheadline: 'Sub', ctaText: 'Jetzt Probefahrt vereinbaren' },
  sections: [{ id: 'cta1', type: 'cta', headline: 'Kontakt', content: 'Text', bgStyle: 'dark' }],
});

const dealer = {
  name: 'Händler',
  phone: '+49123456',
  whatsappNumber: '49123456',
  email: 'team@haendler.example',
  primaryColor: '#174f6b',
  secondaryColor: '#e00000',
};

const renderPage = (editable: boolean) => render(
  <LandingRenderer
    content={baseContent()}
    images={{}}
    dealer={dealer}
    brand="Kia"
    model="EV4"
    editable={editable}
  />,
);

describe('Klicks auf Buttons im Bearbeitungsmodus', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  });
  afterAll(() => vi.unstubAllGlobals());

  it('blocks the header request button from navigating while editing', () => {
    renderPage(true);
    const headerButton = screen.getByRole('link', { name: 'Jetzt anfragen' });
    expect(headerButton.getAttribute('href')).toBe('tel:+49123456');
    expect(fireEvent.click(headerButton)).toBe(false);
  });

  it('blocks the hero button from scrolling to the contact form while editing', () => {
    renderPage(true);
    const heroButton = screen.getByRole('link', { name: 'Jetzt Probefahrt vereinbaren' });
    expect(heroButton.getAttribute('href')).toBe('#kontakt');
    expect(fireEvent.click(heroButton)).toBe(false);
  });

  it('blocks the phone button inside the CTA band while editing', () => {
    renderPage(true);
    const phoneButton = screen.getByRole('link', { name: /Anrufen/ });
    expect(fireEvent.click(phoneButton)).toBe(false);
  });

  it('keeps every button clickable in the preview', () => {
    renderPage(false);
    const headerButton = screen.getByRole('link', { name: 'Jetzt anfragen' });
    const heroButton = screen.getByRole('link', { name: 'Jetzt Probefahrt vereinbaren' });
    expect(headerButton.getAttribute('href')).toBe('tel:+49123456');
    expect(heroButton.getAttribute('href')).toBe('#kontakt');
    expect(fireEvent.click(headerButton)).toBe(true);
    expect(fireEvent.click(heroButton)).toBe(true);
  });

  it('keeps the links in the exported HTML', () => {
    const html = buildLandingPageHTML(baseContent(), {}, dealer, 'Kia', 'EV4');
    expect(html).toContain('href="tel:+49123456"');
    expect(html).toContain('href="#kontakt"');
    expect(html).not.toContain('preventDefault');
  });
});
