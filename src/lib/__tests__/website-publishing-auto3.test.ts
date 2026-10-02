import { describe, it, expect } from 'vitest';
import { buildAuto3JobDraft, buildSnapshot, selectAuto3JobImages } from '../website-publishing';

const base = 'https://x.supabase.co/storage/v1/object/public/vehicle-images/u/auto3-jobs/v1/j1/';
const a = (id: string, url: string) => ({ id, url });

describe('Auto3 OneShot → Website draft', () => {
  const assets = [
    a('rear', base + 'ext_rear.png'), a('m', base + 'master.png'), a('f34', base + 'ext_34_front_right.png'),
    a('other', 'https://x.supabase.co/storage/v1/object/public/vehicle-images/u/manual.png'),
    a('signed', 'https://x.supabase.co/storage/v1/object/sign/vehicle-images/u/auto3-jobs/v1/j1/ext_front.png?token=abc'),
    a('banner', 'https://x.supabase.co/storage/v1/object/public/banners/u/v1/b.png'),
    a('video', base + 'clip.mp4'),
  ];
  it('selects only this run’s public images in sensible order', () => {
    expect(selectAuto3JobImages(assets, 'v1', 'j1').map((x) => x.id)).toEqual(['m', 'f34', 'rear']);
  });
  it('defaults to AI cover + Nur AI without publishing', () => {
    const d = buildAuto3JobDraft(selectAuto3JobImages(assets, 'v1', 'j1'));
    expect(d).toMatchObject({ coverMode: 'ai', galleryMode: 'replace', coverId: 'm' });
    expect(d.items).toHaveLength(3);
  });
  it('refuses signed URLs in a snapshot', () => {
    expect(() => buildSnapshot({ coverMode: 'ai', galleryMode: 'replace', coverUrl: assets[4].url, items: [] })).toThrow();
  });
});
