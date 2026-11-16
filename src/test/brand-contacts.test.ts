import { describe, it, expect } from 'vitest';
import { contactsForBrand, contactBrands, injectBrandContacts, injectBrandContactsIntoSection, mergeBrandContacts, readBrandContacts } from '@/lib/brand-contacts';
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
  it('aktualisiert nur die gewählte bestehende Kontaktsection ohne doppelten Block', () => {
    const contacts = [{ ...list[1], imageUrl: 'https://x.de/ben.jpg' }];
    const page = { sections: [
      { id: 'a', type: 'cta', headline: 'Kontakt A', content: '<p>Text A</p>' },
      { id: 'b', type: 'cta', headline: 'Kontakt B', content: '<p>Text B</p>' },
    ] };
    const once = injectBrandContactsIntoSection(page, 'b', contacts);
    const twice = injectBrandContactsIntoSection(once, 'b', contacts);
    expect(twice.sections[0].content).toBe('<p>Text A</p>');
    expect(twice.sections[1].content).toContain('<p>Text B</p><div data-brand-contacts="1">');
    expect(twice.sections[1].content).toContain('https://x.de/ben.jpg');
    expect(twice.sections[1].content.match(/data-brand-contacts/g)).toHaveLength(1);
  });
  it('behält beim Profilabgleich alle nicht bearbeiteten Marken und Personen', () => {
    const merged = mergeBrandContacts(list, [{ ...list[1], imageUrl: 'https://x.de/ben.jpg' }]);
    expect(merged[0]).toEqual(list[0]);
    expect(merged[1].imageUrl).toBe('https://x.de/ben.jpg');
    expect(merged).toHaveLength(2);
  });
});

import { brandContactsHtml as _html, injectBrandContacts as _inject } from '@/lib/brand-contacts';
describe('Ansprechpartner-Bild', () => {
  const c = { id: '1', brand: 'Skoda', brands: ['Skoda'], name: 'Max', email: 'm@x.de', phone: '1', imageUrl: 'https://x.de/a.jpg' };
  it('rendert Bild links neben Kontaktdaten', () => {
    const h = _html([c]);
    expect(h.indexOf('<img src="https://x.de/a.jpg"')).toBeLessThan(h.indexOf('Max'));
  });
  it('verwirft javascript-Links', () => {
    expect(_html([{ ...c, imageUrl: 'javascript:alert(1)' }])).not.toContain('<img');
  });
  it('ersetzt vorhandenen Block vollständig', () => {
    const page = { sections: [{ id: 'kontakt', type: 'cta', headline: 'Kontakt', content: 'X' }] };
    const twice = _inject(_inject(page, [c]), [c]);
    expect(twice.sections[0].content.match(/data-brand-contacts/g)).toHaveLength(1);
    expect(twice.sections[0].content).not.toContain('</span></div><!--/brand-contacts--></span>');
  });
});
