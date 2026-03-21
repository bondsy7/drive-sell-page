import { describe, it, expect } from 'vitest';
import { getVehicleField, getImageSrc } from '@/components/dashboard/types';

describe('getVehicleField', () => {
  it('retrieves nested value', () => {
    const vd = { vehicle: { brand: 'BMW', model: 'X5' } };
    expect(getVehicleField(vd, 'vehicle', 'brand')).toBe('BMW');
  });

  it('returns empty string for missing path', () => {
    const vd = { vehicle: { brand: 'BMW' } };
    expect(getVehicleField(vd, 'vehicle', 'color')).toBe('');
  });

  it('returns empty string for non-string value', () => {
    const vd = { vehicle: { price: 42000 } };
    expect(getVehicleField(vd, 'vehicle', 'price')).toBe('');
  });

  it('handles empty object', () => {
    expect(getVehicleField({}, 'a', 'b')).toBe('');
  });
});

describe('getImageSrc', () => {
  it('prefers image_url when available', () => {
    const img = { id: '1', project_id: 'p1', image_base64: 'abc', image_url: 'https://example.com/img.jpg', perspective: null, gallery_folder: null, created_at: '' };
    expect(getImageSrc(img)).toBe('https://example.com/img.jpg');
  });

  it('handles data: prefix in base64', () => {
    const img = { id: '1', project_id: 'p1', image_base64: 'data:image/png;base64,abc', image_url: null, perspective: null, gallery_folder: null, created_at: '' };
    expect(getImageSrc(img)).toBe('data:image/png;base64,abc');
  });

  it('wraps raw base64 with data prefix', () => {
    const img = { id: '1', project_id: 'p1', image_base64: 'iVBOR...', image_url: null, perspective: null, gallery_folder: null, created_at: '' };
    expect(getImageSrc(img)).toBe('data:image/png;base64,iVBOR...');
  });
});
