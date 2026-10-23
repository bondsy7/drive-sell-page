import { describe, expect, it } from 'vitest';
import { landingPrimary, landingSecondary, readableOn } from '@/lib/landing-theme';
import { buildContactFormHTML } from '@/lib/templates/shared';

const BASE = {
  dealerUserId: 'u-1',
  supabaseUrl: 'https://example.supabase.co',
  vehicleTitle: 'Kia EV4',
};

describe('landing page enquiry button colour', () => {
  it('uses the page button colour with readable white text on a red brand', () => {
    const html = buildContactFormHTML({ ...BASE, accent: '#e00000' });
    expect(html).toContain('background:#e00000');
    expect(html).toContain('color:#ffffff');
    expect(html).not.toContain('#3366cc');
  });

  it('keeps the neutral blue offer-page design when no page colour is given', () => {
    const html = buildContactFormHTML(BASE);
    expect(html).toContain('background:linear-gradient(135deg,#3366cc,#2952a3)');
    expect(html).not.toContain('background:#e00000');
  });

  it('picks dark text for a light brand colour', () => {
    expect(readableOn('#f2c14e')).toBe('#0f172a');
    expect(readableOn('#e00000')).toBe('#ffffff');
  });

  it('falls back to the neutral colours for missing or malformed dealer colours', () => {
    expect(landingPrimary({ primaryColor: 'nope' })).toBe('#174f6b');
    expect(landingPrimary(undefined)).toBe('#174f6b');
    expect(landingSecondary({ secondaryColor: '#e00000' })).toBe('#e00000');
    expect(landingSecondary({ secondaryColor: '#zzz' })).toBe('#e2b04a');
  });
});
