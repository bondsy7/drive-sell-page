import { describe, expect, it } from 'vitest';
import { landingDealerName, normalizeLandingDealerWording } from '../../supabase/functions/_shared/landing-dealer-wording';

const paul = 'd75734d2-9add-443b-9d3d-d1a0c8acbefa';
describe('profile-scoped landing-page wording', () => {
  it('uses wir-sind-jacobs for Paul in generated copy and metadata', () => {
    const input = { hero: { headline: 'Jetzt bei Autohaus Jacobs' }, sections: [{ id: 'cta-autohaus-jacobs', content: '<p>AUTOHAUS JACOBS</p><a href="https://example.org/Autohaus Jacobs">Kontakt</a>' }], seo: { keywords: ['Autohaus Jacobs'], canonicalUrl: 'https://example.org/Autohaus Jacobs', structuredData: { acceptedAnswer: { text: 'Probefahrt bei Autohaus Jacobs' } } } };
    const result = normalizeLandingDealerWording(input, paul);
    expect(landingDealerName(paul, 'Autohaus Jacobs')).toBe('wir-sind-jacobs');
    expect(result.hero.headline).toBe('Jetzt bei wir-sind-jacobs');
    expect(result.sections[0].content).toBe('<p>wir-sind-jacobs</p><a href="https://example.org/Autohaus Jacobs">Kontakt</a>');
    expect(result.seo.structuredData.acceptedAnswer.text).toBe('Probefahrt bei wir-sind-jacobs');
    expect(result.seo.keywords).toEqual(['wir-sind-jacobs']);
    expect(result.sections[0].id).toBe(input.sections[0].id);
    expect(result.seo.canonicalUrl).toBe(input.seo.canonicalUrl);
    expect(normalizeLandingDealerWording(result, paul)).toEqual(result);
    expect(input.hero.headline).toBe('Jetzt bei Autohaus Jacobs');
  });
  it.each([
    ['Entdecken Sie den Defender im Autohaus Jacobs', 'Entdecken Sie den Defender bei wir-sind-jacobs'],
    ['Entdecken Sie den Defender im wir-sind-jacobs', 'Entdecken Sie den Defender bei wir-sind-jacobs'],
    ['Im wir-sind-jacobs beraten wir Sie persönlich', 'Bei wir-sind-jacobs beraten wir Sie persönlich'],
    ['Direkt bei uns im wir-sind-jacobs', 'Direkt bei wir-sind-jacobs'],
    ['Bei uns im Autohaus Jacobs', 'Bei wir-sind-jacobs'],
    ['Probefahrt beim wir-sind-jacobs', 'Probefahrt bei wir-sind-jacobs'],
    ['In unserem wir-sind-jacobs', 'Bei wir-sind-jacobs'],
    ['Willkommen im Autohaus wir-sind-jacobs', 'Willkommen bei wir-sind-jacobs'],
    ['Das wir-sind-jacobs ist Ihr kompetenter Partner', 'wir-sind-jacobs ist Ihr kompetenter Partner'],
    ['Wenden Sie sich direkt an das wir-sind-jacobs', 'Wenden Sie sich direkt an wir-sind-jacobs'],
    ['Wenden Sie sich direkt an unser wir-sind-jacobs', 'Wenden Sie sich direkt an wir-sind-jacobs'],
    ['Bei uns, dem wir-sind-jacobs, entdecken', 'Bei wir-sind-jacobs entdecken'],
  ])('uses grammatically correct wording: %s', (headline, expected) => {
    expect(normalizeLandingDealerWording({ hero: { headline } }, paul).hero.headline).toBe(expected);
  });
  it('leaves other profiles unchanged', () => {
    const input = { hero: { headline: 'Autohaus Jacobs' } };
    expect(normalizeLandingDealerWording(input, '753b5f67-58ad-493f-a031-200016d23a95')).toBe(input);
    expect(landingDealerName(undefined, 'Autohaus Jacobs')).toBe('Autohaus Jacobs');
  });
});