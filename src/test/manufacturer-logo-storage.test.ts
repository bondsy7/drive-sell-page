import { describe, expect, it } from 'vitest';
import { versionedManufacturerLogoUrl } from '@/lib/manufacturer-logo-storage';

const publicUrl = 'https://example.test/storage/v1/object/public/manufacturer-logos/svg/kia.svg';

describe('manufacturer logo replacement URLs', () => {
  it('changes the public URL when an existing logo is replaced', () => {
    const before = versionedManufacturerLogoUrl(publicUrl, {
      updated_at: '2026-11-18T13:39:00.000Z',
    });
    const after = versionedManufacturerLogoUrl(publicUrl, {
      updated_at: '2026-11-18T13:40:11.329983+00:00',
    });

    expect(after).not.toBe(before);
    expect(after).toContain('/svg/kia.svg?v=');
  });

  it('prefers the replacement timestamp over the original creation timestamp', () => {
    const url = versionedManufacturerLogoUrl(publicUrl, {
      created_at: '2026-03-10T12:59:33.679162+00:00',
      updated_at: '2026-11-18T13:40:11.329983+00:00',
    });

    expect(url).toBe(`${publicUrl}?v=${Date.parse('2026-11-18T13:40:11.329983+00:00')}`);
  });
});
