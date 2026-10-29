import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import LandingRenderer from '@/components/landing/LandingRenderer';
import { buildLandingPageHTML, type LandingPageContent } from '@/lib/landing-page-builder';
import { buttonColorOverride } from '@/lib/landing-section-colors';

const baseContent = (): LandingPageContent => ({
  meta: { title: 'T', description: 'D', h1: 'H' },
  hero: { headline: 'Head', subheadline: 'Sub', ctaText: 'CTA' },
  sections: [{ id: 'cta1', type: 'cta', headline: 'Kontakt', content: 'Text', bgStyle: 'dark' }],
});

const dealer = {
  name: 'Händler',
  phone: '+49123456',
  whatsappNumber: '49123456',
  primaryColor: '#174f6b',
  secondaryColor: '#e00000',
};

const contactForm = {
  dealerUserId: 'u-1',
  projectId: 'p-1',
  vehicleId: 'v-1',
  supabaseUrl: 'https://example.supabase.co',
  vehicleTitle: 'Kia EV4',
  heading: 'Fahrzeuganfrage',
  intro: 'Text',
};

describe('Buttonfarbe auf generierten Landingpages', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
  afterAll(() => vi.unstubAllGlobals());

  it('exports the saved request-button colour with readable text', () => {
    const html = buildLandingPageHTML(
      { ...baseContent(), buttonColors: { 'hero.ctaText': '#123456' } }, {}, dealer, 'Kia', 'EV4',
    );
    expect(html).toContain('background:#123456;color:#ffffff');
    expect(html).not.toContain('background:#e00000;color:#ffffff');
  });

  it('keeps the dealer button colour as long as nothing was saved', () => {
    const html = buildLandingPageHTML(baseContent(), {}, dealer, 'Kia', 'EV4');
    expect(html).toContain('background:#e00000;color:#ffffff');
  });

  it('colours the phone button inside the CTA band', () => {
    const html = buildLandingPageHTML(
      { ...baseContent(), buttonColors: { 'cta1.phone': '#0a0a0a' } }, {}, dealer, 'Kia', 'EV4',
    );
    expect(html).toContain('background:#0a0a0a;color:#ffffff');
  });

  it('colours the enquiry form button', () => {
    const html = buildLandingPageHTML(
      { ...baseContent(), buttonColors: { kontakt: '#0a0a0a' } }, {}, dealer, 'Kia', 'EV4', undefined, contactForm,
    );
    expect(html).toContain('--inquiry-accent:#0a0a0a');
  });

  it('shows the saved colour in the editor and offers Buttonfarbe in the menu', () => {
    render(
      <LandingRenderer
        content={{ ...baseContent(), buttonColors: { 'hero.ctaText': '#123456' } }}
        images={{}}
        dealer={dealer}
        brand="Kia"
        model="EV4"
        editable
        onButtonColorChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: 'CTA' }).style.background).toBe('rgb(18, 52, 86)');
    fireEvent.click(screen.getByRole('button', { name: 'Anfragebutton bearbeiten' }));
    expect(screen.getByRole('button', { name: 'Buttonfarbe ändern' })).toBeTruthy();
  });

  it('falls back to the page button colour when the colour is reset', () => {
    expect(buttonColorOverride(null, '#e00000')).toBe('#e00000');
    expect(buttonColorOverride('#123456', '#e00000')).toBe('#123456');
    expect(buttonColorOverride('nope', '#e00000')).toBe('#e00000');
  });
});
