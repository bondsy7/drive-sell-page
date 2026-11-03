import { describe, it, expect } from 'vitest';
import { galleryRunKey, galleryRunSegment } from '@/lib/gallery-run';

describe('gallery runs', () => {
  it('separates the same VIN by run start', () => {
    const a = galleryRunKey({ id: '1', gallery_folder: 'VIN1', pipeline_run_at: '2026-09-29T09:52:00Z' });
    const b = galleryRunKey({ id: '2', gallery_folder: 'VIN1', pipeline_run_at: '2026-11-02T14:37:00Z' });
    expect(a).not.toBe(b);
  });
  it('keeps regenerations of one run together', () => {
    const run = '2026-11-02T14:37:00Z';
    expect(galleryRunKey({ id: '1', gallery_folder: 'VIN1', pipeline_run_at: run }))
      .toBe(galleryRunKey({ id: '2', gallery_folder: 'VIN1', pipeline_run_at: run }));
  });
  it('gives each run its own storage segment', () => {
    expect(galleryRunSegment('2026-11-02T14:37:05.123Z')).toBe('run-20261102143705');
  });
});
