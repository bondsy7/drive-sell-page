import { describe, it, expect } from 'vitest';
import { selectMaster, selectInteriorReference } from '../../supabase/functions/_shared/auto3-master';
import { estimateJobCost, marketingFormFromDatasheet, DEFAULT_PROCESSING_SETTINGS, normalizeSettings, jobStatusLabel } from '@/lib/auto3-processing';

const a = (file: string, category: string, quality: number, vehicleComplete = true) => ({ file, category, quality, vehicleComplete });

describe('Auto3 master selection', () => {
  it('prefers a complete 3/4 front over higher-quality interior/detail shots', () => {
    const m = selectMaster([a('i.jpg', 'interior_front', 99), a('d.jpg', 'detail', 98), a('e.jpg', 'engine', 97), a('f.jpg', 'front_3_4', 80), a('s.jpg', 'side', 85)]);
    expect(m?.file).toBe('f.jpg');
  });
  it('never picks cropped or low-quality exteriors', () => {
    expect(selectMaster([a('x.jpg', 'front_3_4', 95, false), a('y.jpg', 'front', 20)])).toBeNull();
  });
  it('returns null when only interior/detail shots exist', () => {
    expect(selectMaster([a('i.jpg', 'cockpit', 90), a('d.jpg', 'detail', 90)])).toBeNull();
  });
  it('picks interior references only from interior shots', () => {
    expect(selectInteriorReference([a('f.jpg', 'front_3_4', 99), a('i.jpg', 'interior_front', 70)], 'interior-front')).toBe('i.jpg');
    expect(selectInteriorReference([a('f.jpg', 'front_3_4', 99)], 'interior-rear')).toBeNull();
  });
});

describe('Auto3 processing profile', () => {
  it('costs include master image plus perspectives, no banner/video by default', () => {
    const c = estimateJobCost(DEFAULT_PROCESSING_SETTINGS, () => 3);
    expect(c.images).toBeGreaterThan(1);
    expect(c.video).toBe(0);
    expect(c.total).toBe(c.imageCost);
  });
  it('banner form only uses datasheet values and leaves missing ones empty', () => {
    const f = marketingFormFromDatasheet({ brand: 'Volkswagen', model: 'Golf', price: '25680.00' }, normalizeSettings({}));
    expect(f.priceText).toBe('25.680 €');
    expect(f.legalText).toBe('');
    expect(f.subline).toBe('');
  });
  it('labels paused credit jobs clearly', () => {
    expect(jobStatusLabel({ status: 'paused', pause_reason: 'credits', progress_done: 0, progress_total: 0, progress_label: null })).toBe('Pausiert – Credits erforderlich');
  });
});
