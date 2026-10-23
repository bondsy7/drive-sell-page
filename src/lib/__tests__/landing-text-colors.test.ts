import { describe, it, expect } from 'vitest';
import { textColorOverride } from '@/lib/landing-section-colors';
import { buildLandingPageHTML, type LandingPageContent } from '@/lib/landing-page-builder';

describe('text colour overrides', () => {
  it('applies a freely selected colour', () => {
    expect(textColorOverride('#FF0000', '#0f172a')).toBe('#ff0000');
  });
  it('falls back to the section colour when the value is missing or invalid', () => {
    expect(textColorOverride(undefined, '#0f172a')).toBe('#0f172a');
    expect(textColorOverride('red; background:url(x)', '#0f172a')).toBe('#0f172a');
  });
});

const baseContent = (): LandingPageContent => ({
  meta: { title: 'T', description: 'D', h1: 'H' },
  hero: { headline: 'Head', subheadline: 'Sub', ctaText: 'CTA' },
  sections: [{ id: 'sec1', type: 'benefits', headline: 'Sek-Kopf', content: 'Sek-Text', bgStyle: 'white' }],
});

describe('landing page HTML export with text colours', () => {
  it('uses the stored text colour for hero headline and section headline', () => {
    const html = buildLandingPageHTML(
      { ...baseContent(), textColors: { 'hero.headline': '#ff0000', 'sec1.headline': '#00ff00' } },
      {}, { name: 'Händler' }, 'Kia', 'EV4',
    );
    expect(html).toContain('color:#ff0000');
    expect(html).toContain('color:#00ff00');
  });
  it('keeps the previous colours without overrides', () => {
    const html = buildLandingPageHTML(baseContent(), {}, { name: 'Händler' }, 'Kia', 'EV4');
    expect(html).not.toContain('color:#ff0000');
    expect(html).not.toContain('color:#00ff00');
  });
});
