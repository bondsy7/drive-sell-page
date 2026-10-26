import { describe, it, expect } from 'vitest';
import { buildFragment, buildSeo, financingStatus, matchVehicles, normalizeVehicle } from '../../supabase/functions/api-landingpages/landing-api';

const doc = `<!DOCTYPE html><html lang="de"><head><title>x</title>
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
<style>
    *{margin:0}
    body{color:#000}
</style>
<script type="application/ld+json">{"a":1}</script></head><body>
<form action="https://x/functions/v1/submit-lead" method="post"><input name="n"></form>
<section id="live-fahrzeuge" class="" data-live-inventory="{}"><div class="lp-live-inner"><div class="lp-live-head"><h2 class="lp-live-title">Bestand</h2></div><a>Frozen Car</a></div></section>
<section id="lp-finanzierung"><li>¹ alt</li></section>
<script>window.ok=1</script></body></html>`;

describe('api-landingpages fragment', () => {
  const html = buildFragment(doc, 'abc', 'https://api/abc/inventory');
  it('has no document tags', () => {
    expect(html).not.toMatch(/<html|<head|<body|<!DOCTYPE/i);
  });
  it('keeps form action and scripts', () => {
    expect(html).toContain('action="https://x/functions/v1/submit-lead"');
    expect(html).toContain('window.ok=1');
    expect(html).toContain('application/ld+json');
  });
  it('replaces frozen vehicles with a live container', () => {
    expect(html).not.toContain('Frozen Car');
    expect(html).toContain('data-autohaus-live-inventory="abc"');
    expect(html).toContain('data-inventory-endpoint="https://api/abc/inventory"');
    expect(html).not.toContain('¹ alt');
  });
  it('scopes global css', () => {
    expect(html).not.toMatch(/\n\s*body\{/);
    expect(html).toContain('.autohaus-ai-landingpage{color:#000}');
  });
});

describe('api-landingpages seo', () => {
  it('robots follow status', () => {
    expect(buildSeo({}, {}, 'published', 't').robots).toBe('index,follow');
    expect(buildSeo({}, {}, 'draft', 't').robots).toBe('noindex,nofollow');
    expect(buildSeo({}, {}, 'archived', 't').robots).toBe('noindex,nofollow');
  });
});

describe('api-landingpages inventory', () => {
  const raws = [
    { id: 1, interneNummer: 'K1', price: 3789000, used: false, vehicleModel: { brand: { name: 'Kia' }, model: 'EV4' },
      financing: { monthlyRate: 432, termInMonths: 48, downPayment: 0, effectiveInterestRate: 5.99, nominalInterestRate: 5.83, totalAmount: 30000 } },
    { id: 2, price: 100, used: true, vehicleModel: { brand: { name: 'Kia' }, model: 'Ceed' } },
  ];
  it('filters by model and builds detail url from internal number', () => {
    const v = matchVehicles(raws, { enabled: true, mode: 'filter', model: 'EV4', cardDesign: { detailUrlTemplate: 'https://d/?n={internalNumber}' } });
    expect(v.map(x => x.id)).toEqual(['1']);
    expect(v[0].priceEur).toBe(37890);
    expect(v[0].detailUrl).toBe('https://d/?n=K1');
  });
  it('hides rate when bank is missing, shows with fallback bank', () => {
    const v = normalizeVehicle(raws[0]);
    expect(financingStatus(v).showRate).toBe(false);
    expect(financingStatus(v).missing).toEqual(['bank']);
    expect(financingStatus(v, 'Kia Finance').showRate).toBe(true);
  });
});
