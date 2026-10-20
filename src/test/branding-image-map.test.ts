import { describe, expect, it } from 'vitest';
import { brandingImageRoleNote, brandingRoleOfLabel, buildBrandingImageMap } from '../../supabase/functions/_shared/branding-asset-scope';

const BLUEPRINT = 'VEHICLE BLUEPRINT – primary';
const PLATE = 'LICENSE PLATE – immutable asset';
const DEALER = 'DEALER LOGO – immutable brand asset';
const MANU = 'MANUFACTURER LOGO – immutable brand asset';

describe('branding image map', () => {
  it('plate image is assigned only to plates, dealer logo only to the wall', () => {
    const map = buildBrandingImageMap([BLUEPRINT, PLATE, 'SHOWROOM – scene', DEALER])!;
    expect(map).toContain('REAR WALL PANEL: shows ONLY IMAGE 4.');
    expect(map).toContain('LICENCE PLATES: show ONLY IMAGE 2 on every visible plate holder.');
    expect(map).toContain('IMAGE 2 never appears on the wall.');
    expect(map).toContain('IMAGE 4 never appears on a plate.');
  });

  it('plate without selected logo keeps the wall empty', () => {
    expect(buildBrandingImageMap([BLUEPRINT, PLATE])).toContain('REAR WALL PANEL: NO logo at all.');
  });

  it('both logos go on the wall, never on the plate', () => {
    const map = buildBrandingImageMap([BLUEPRINT, PLATE, MANU, DEALER])!;
    expect(map).toContain('shows ONLY IMAGE 3 and IMAGE 4.');
  });

  it('signage inside reference photos is never branding', () => {
    const map = buildBrandingImageMap([BLUEPRINT, 'Vehicle reference – rear', PLATE])!;
    expect(map).toContain('inside IMAGE 1 and IMAGE 2');
    expect(brandingRoleOfLabel(BLUEPRINT)).toBe('reference');
  });

  it('no branding assets leaves unbranded requests unchanged', () => {
    expect(buildBrandingImageMap([BLUEPRINT, 'SHOWROOM – scene'])).toBeNull();
  });

  it('plate role note forbids the wall even if it looks like a logo', () => {
    expect(brandingImageRoleNote(PLATE)).toMatch(/NEVER on the wall/);
    expect(brandingImageRoleNote(DEALER)).toMatch(/NEVER on a licence plate/);
  });
});
