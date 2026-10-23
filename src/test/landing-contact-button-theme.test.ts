import { describe, expect, it } from 'vitest';
import { landingPrimary, landingSecondary, readableOn } from '@/lib/landing-theme';
import { buildContactFormHTML } from '@/lib/templates/shared';

const BASE = {
  dealerUserId: 'u-1',
  supabaseUrl: 'https://example.supabase.co',
  vehicleTitle: 'Kia EV4',
};

describe('landing page enquiry button colour', () => {
  it('uses the page primary colour with readable white text on a red brand', () => {
    const html = buildContactFormHTML({ ...BASE, primary: '#c8102e' });
    expect(html).toContain('background:#c8102e');
    expect(html).toContain('color:#ffffff');
    expect(html).not.toContain('#3366cc');
  });

  it('keeps the neutral blue offer-page design when no page colour is given', () => {
    const html = buildContactFormHTML(BASE);
    expect(html).toContain('background:linear-gradient(135deg,#3366cc,#2952a3)');
    expect(html).not.toContain('background:#c8102e');
  });

  it('picks dark text for a light brand colour', () => {
    expect(readableOn('#f2c14e')).toBe('#0f172a');
    expect(readableOn('#c8102e')).toBe('#ffffff');
  });

  it('falls back to petrol blue for missing or malformed dealer colours', () => {
    expect(landingPrimary({ primaryColor: 'nope' })).toBe('#174f6b');
    expect(landingPrimary(undefined)).toBe('#174f6b');
    expect(landingPrimary({ primaryColor: '#c8102e' })).toBe('#c8102e');
    expect(landingSecondary({ secondaryColor: '#zzz' })).toBe('#e2b04a');
  });
});
