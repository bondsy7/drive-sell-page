import { describe, expect, it } from 'vitest';
import { buildSnapshot, dedupeItems, formatLiveStatus, hasUnpublishedChanges, isPublishableUrl, type WebsitePublication } from '../website-publishing';

const P = 'https://x.supabase.co/storage/v1/object/public/vehicle-images/u/auto3-jobs/v/j/';

describe('website publishing delivery rules', () => {
  it('rejects private, signed, banner and non-image assets', () => {
    expect(isPublishableUrl(P + 'master.png')).toBe(true);
    expect(isPublishableUrl('https://x/storage/v1/object/sign/vehicle-images/a.png?token=1')).toBe(false);
    expect(isPublishableUrl('https://x/storage/v1/object/public/originals/a.jpg')).toBe(false);
    expect(isPublishableUrl('https://x/storage/v1/object/public/banners/a.png')).toBe(false);
    expect(isPublishableUrl(P + 'video.mp4')).toBe(false);
    expect(isPublishableUrl('http://x/a.png')).toBe(false);
  });
  it('dedupes and sorts stably', () => {
    const items = [
      { assetId: 'b', url: P + 'b.png', sortOrder: 1 },
      { assetId: 'a', url: P + 'a.png', sortOrder: 0 },
      { assetId: 'c', url: P + 'c.png', sortOrder: 1 },
      { assetId: 'a2', url: P + 'a.png', sortOrder: 2 },
    ];
    expect(dedupeItems(items).map((i) => i.assetId)).toEqual(['a', 'b', 'c']);
    const s = buildSnapshot({ coverMode: 'ai', galleryMode: 'replace', coverUrl: P + 'a.png', items });
    expect(s.images).toEqual([{ url: P + 'a.png', sortOrder: 0 }, { url: P + 'b.png', sortOrder: 1 }, { url: P + 'c.png', sortOrder: 2 }]);
  });
  it('blocks publish with missing or invalid AI cover', () => {
    expect(() => buildSnapshot({ coverMode: 'ai', galleryMode: 'auto3', coverUrl: null, items: [] })).toThrow();
    expect(() => buildSnapshot({ coverMode: 'ai', galleryMode: 'auto3', coverUrl: P + 'x.mp4', items: [] })).toThrow();
  });
  it('formats live status and detects draft changes', () => {
    const pub = {
      status: 'live', version: 2, published_at: '2026-10-02T11:09:02Z', live_updated_at: '2026-10-02T11:09:02Z',
      live_snapshot: { coverMode: 'ai', galleryMode: 'replace', coverImageUrl: P + 'a.png', images: [{ url: P + 'a.png', sortOrder: 0 }] },
    } as unknown as WebsitePublication;
    const t = formatLiveStatus(pub);
    expect(t).toContain('Auto Schmitt · LIVE · Cover AI · Galerie Nur AI · 1 Bild · Version 2 · veröffentlicht');
    const same = { coverMode: 'ai' as const, galleryMode: 'replace' as const, coverUrl: P + 'a.png', items: [{ assetId: 'a', url: P + 'a.png', sortOrder: 0 }] };
    expect(hasUnpublishedChanges(pub, same)).toBe(false);
    expect(hasUnpublishedChanges(pub, { ...same, galleryMode: 'append' })).toBe(true);
    expect(formatLiveStatus({ ...pub, status: 'disabled' })).toContain('zurück auf Auto3');
  });
});
