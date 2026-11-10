import { describe, it, expect } from 'vitest';
import { contactsForBrand, contactBrands, injectBrandContacts, readBrandContacts } from '@/lib/brand-contacts';
const list = [
  { id: '1', brand: 'KIA', brands: ['KIA'], name: 'Anna', email: 'a@x.de', phone: '0711' },
  { id: '2', brand: 'Škoda', brands: ['Škoda'], name: 'Ben', email: '', phone: '' },
];
describe('brand contacts', () => {
  it('matches brand case-insensitive', () => { expect(contactsForBrand(list, 'Kia').map(c => c.id)).toEqual(['1']); expect(contactsForBrand(list, 'SKODA').map(c => c.id)).toEqual(['2']); });
  it('keeps catalog keys chosen from the Marke dropdown', () => {
    const dropdownPick = { id: '3', brand: 'CAN-AM', brands: ['CAN-AM'], name: 'Jens', email: 'j@x.de', phone: '' };
    expect(contactsForBrand([...list, dropdownPick], 'CAN-AM').map(c => c.id)).toEqual(['3']);
    expect(contactsForBrand([...list, dropdownPick], 'can am').map(c => c.id)).toEqual(['3']);
    expect(contactsForBrand([...list, dropdownPick], 'Can-Am').map(c => c.id)).toEqual(['3']);
  });
  it('finds one contact for every brand it was assigned to', () => {
    const multi = { id: '4', brand: 'KIA, Citroën', brands: ['KIA', 'Citroën'], name: 'Mia', email: 'm@x.de', phone: '' };
    const all = [...list, multi];
    expect(contactsForBrand(all, 'kia').map(c => c.id)).toEqual(['1', '4']);
    expect(contactsForBrand(all, 'CITROEN').map(c => c.id)).toEqual(['4']);
    expect(contactsForBrand(all, 'citroen').map(c => c.id)).toEqual(['4']);
    expect(contactsForBrand(all, 'skoda').map(c => c.id)).toEqual(['2']);
    expect(contactBrands(all)).toEqual(['KIA', 'Škoda', 'Citroën']);
  });
  it('reads stored rows with several brands and old single-brand rows', () => {
    const stored = readBrandContacts({ brandContacts: [
      { id: 'a', brands: ['KIA', 'kia ', 'Citroën'], name: 'Mia', email: 'm@x.de', phone: '' },
      { id: 'b', brand: 'DS Automobiles', name: 'Tom', email: '', phone: '' },
    ] });
    expect(stored.find(c => c.id === 'a')!.brands).toEqual(['KIA', 'Citroën']);
    expect(stored.find(c => c.id === 'a')!.brand).toBe('KIA, Citroën');
    expect(stored.find(c => c.id === 'b')!.brands).toEqual(['DS Automobiles']);
    expect(contactsForBrand(stored, 'citroen').map(c => c.id)).toEqual(['a']);
    expect(contactsForBrand(stored, 'ds automobiles').map(c => c.id)).toEqual(['b']);
  });
  it('injects only into contact section', () => {
    const page = { sections: [{ id: 'a', type: 'text', headline: 'Design', content: 'x' }, { id: 'b', type: 'cta', headline: 'Kontakt', content: '<p>Hi</p>' }] };
    const out = injectBrandContacts(page, contactsForBrand(list, 'kia'));
    expect(out.sections[0].content).toBe('x');
    expect(out.sections[1].content).toContain('Anna');
    expect(injectBrandContacts(out, contactsForBrand(list, 'kia')).sections[1].content.match(/Anna/g)?.length).toBe(1);
  });
});
