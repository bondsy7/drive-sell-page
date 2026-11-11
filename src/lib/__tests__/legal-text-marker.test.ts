import { describe, expect, it } from 'vitest';
import { buildLegalTextHTML } from '@/lib/templates/shared';

const dealer = {
  leasingBank: 'Test Leasing GmbH',
  leasingLegalText: 'Leasingtext der {bank_name}.',
  financingBank: '',
  financingLegalText: '',
  defaultLegalText: 'Allgemeine Pflichthinweise.',
} as any;

describe('Banktext-Fußnote', () => {
  it('stellt bei Leasing immer eine hochgestellte 1 vor den Banktext', () => {
    const html = buildLegalTextHTML({ category: 'Leasing', dealer } as any);
    expect(html).toContain('<sup style="font-size:9px;vertical-align:super">1</sup> Leasingtext der Test Leasing GmbH.');
  });

  it('stellt die hochgestellte 1 auch vor sonstige Pflichthinweise', () => {
    const html = buildLegalTextHTML({ category: 'Kauf', dealer } as any);
    expect(html).toContain('<sup style="font-size:9px;vertical-align:super">1</sup> Allgemeine Pflichthinweise.');
  });
});
