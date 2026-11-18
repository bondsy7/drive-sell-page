import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveCanonicalBrand } from '@/lib/brand-aliases';

interface VehicleMake {
  key: string;
  models: { key: string }[];
}

const vehicleData = JSON.parse(readFileSync(
  'public/data/vehicle-makes-models.json',
  'utf8',
)) as { classes: { key: string; makes: VehicleMake[] }[] };
const carMakes = vehicleData.classes.find(c => c.key === 'Car')?.makes || [];

describe('DS Automobiles', () => {
  it('contains one brand with every merged model and no duplicate spellings', () => {
    const dsMakes = carMakes.filter(make => make.key === 'DS' || make.key === 'DS AUTOMOBILES');
    expect(dsMakes.map(make => make.key)).toEqual(['DS AUTOMOBILES']);
    expect(dsMakes[0].models.map(model => model.key)).toEqual([
      'DS 3',
      'DS 3 Crossback',
      'DS 4',
      'DS 4 Crossback',
      'DS 5',
      'DS 7',
      'DS 7 Crossback',
      'DS 9',
      'N°4',
      'N°7',
      'N°8',
      'ANDERE',
    ]);
  });

  it.each(['DS', 'DS Automobiles', 'DS AUTOMOBILES'])('resolves %s to the one canonical brand', input => {
    expect(resolveCanonicalBrand(input, carMakes.map(make => make.key))).toBe('DS AUTOMOBILES');
  });
});
