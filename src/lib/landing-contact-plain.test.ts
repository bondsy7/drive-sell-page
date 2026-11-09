import { describe, it, expect } from 'vitest';
import { isContactSection, plainContactContent, contactBodyClass } from './landing-contact-plain';

describe('isContactSection', () => {
  it('erkennt Kontakt-Überschriften', () => {
    expect(isContactSection('Kontakt')).toBe(true);
    expect(isContactSection('Ihr Kontakt zu uns')).toBe(true);
    expect(isContactSection('<b>Kontakt</b> aufnehmen')).toBe(true);
  });

  it('lässt andere Überschriften unberührt', () => {
    expect(isContactSection('Ausstattung')).toBe(false);
    expect(isContactSection('')).toBe(false);
    expect(isContactSection(null)).toBe(false);
  });
});

describe('plainContactContent', () => {
  it('wandelt Listen im Kontakt-Abschnitt in Absätze um', () => {
    const html = '<p>Rufen Sie uns an:</p><ul><li>Telefon: 0123</li><li>Mail: a@b.de</li></ul>';
    const out = plainContactContent('Kontakt', html);
    expect(out).not.toMatch(/<\/?(ul|ol|li)[\s>]/i);
    expect(out).toContain('<p>Telefon: 0123</p>');
    expect(out).toContain('<p>Mail: a@b.de</p>');
  });

  it('lässt Listen in anderen Abschnitten stehen', () => {
    const html = '<ul><li>Punkt</li></ul>';
    expect(plainContactContent('Ausstattung', html)).toBe(html);
  });

  it('zentriert nur den Kontakt-Abschnitt', () => {
    expect(contactBodyClass('Kontakt')).toBe('lp-body-html lp-contact-plain');
    expect(contactBodyClass('Highlights')).toBe('lp-body-html');
  });
});
