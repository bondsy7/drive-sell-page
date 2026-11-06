import { describe, it, expect } from 'vitest';
import { pickManufacturerLogo } from './manufacturer-logo-match';

const logos = [
  { name: 'bmw-alpina', url: 'alpina' },
  { name: 'bmw-m', url: 'm' },
  { name: 'bmw', url: 'bmw' },
  { name: 'vw', url: 'vw' },
];

describe('pickManufacturerLogo', () => {
  it('BMW gets the exact BMW logo, never Alpina or M', () => {
    expect(pickManufacturerLogo(logos, 'BMW')?.url).toBe('bmw');
  });
  it('Volkswagen resolves via alias', () => {
    expect(pickManufacturerLogo(logos, 'Volkswagen')?.url).toBe('vw');
  });
  it('without an exact file the closest partial wins', () => {
    expect(pickManufacturerLogo(logos.filter(l => l.name !== 'bmw'), 'BMW')?.url).toBe('m');
  });
});

import { isOutdoorScene } from './remaster-prompt';
describe('isOutdoorScene', () => {
  it('DEKRA lot is outdoor, showroom is not', () => {
    expect(isOutdoorScene('dealer-lot-dekra')).toBe(true);
    expect(isOutdoorScene('showroom-1')).toBe(false);
  });
});
