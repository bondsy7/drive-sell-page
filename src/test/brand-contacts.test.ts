import { describe, it, expect } from 'vitest';
import { contactsForBrand, injectBrandContacts } from '@/lib/brand-contacts';
const list = [
  { id: '1', brand: 'KIA', name: 'Anna', email: 'a@x.de', phone: '0711' },
  { id: '2', brand: 'Škoda', name: 'Ben', email: '', phone: '' },
];
describe('brand contacts', () => {
  it('matches brand case-insensitive', () => { expect(contactsForBrand(list, 'Kia').map(c => c.id)).toEqual(['1']); expect(contactsForBrand(list, 'SKODA').map(c => c.id)).toEqual(['2']); });
  it('keeps catalog keys chosen from the Marke dropdown', () => {
    const dropdownPick = { id: '3', brand: 'CAN-AM', name: 'Jens', email: 'j@x.de', phone: '' };
    expect(contactsForBrand([...list, dropdownPick], 'CAN-AM').map(c => c.id)).toEqual(['3']);
    expect(contactsForBrand([...list, dropdownPick], 'can am').map(c => c.id)).toEqual(['3']);
    expect(contactsForBrand([...list, dropdownPick], 'Can-Am').map(c => c.id)).toEqual(['3']);
  });
  it('injects only into contact section', () => {
    const page = { sections: [{ id: 'a', type: 'text', headline: 'Design', content: 'x' }, { id: 'b', type: 'cta', headline: 'Kontakt', content: '<p>Hi</p>' }] };
    const out = injectBrandContacts(page, contactsForBrand(list, 'kia'));
    expect(out.sections[0].content).toBe('x');
    expect(out.sections[1].content).toContain('Anna');
    expect(injectBrandContacts(out, contactsForBrand(list, 'kia')).sections[1].content.match(/Anna/g)?.length).toBe(1);
  });
});
