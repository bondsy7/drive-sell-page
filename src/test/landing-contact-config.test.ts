import { describe, it, expect } from 'vitest';
import { sanitizeContactFormConfig, defaultContactFormConfig, isValidRecipientEmail } from '@/lib/landing-contact-config';
import { buildContactFormHTML } from '@/lib/templates/shared';

const fallback = defaultContactFormConfig('Škoda Karoq', 'info@autohaus.de');

describe('Kontaktformular-Konfiguration', () => {
  it('übernimmt eine eigene Empfängeradresse statt der Profiladresse', () => {
    const c = sanitizeContactFormConfig({ recipientEmail: 'skoda@autohaus.de', subject: 'Karoq', heading: 'Hallo', intro: '' }, fallback);
    expect(c.recipientEmail).toBe('skoda@autohaus.de');
    expect(c.subject).toBe('Karoq');
  });
  it('verwirft ungültige oder mehrfache Empfänger', () => {
    expect(isValidRecipientEmail('a@b.de, c@d.de')).toBe(false);
    expect(sanitizeContactFormConfig({ recipientEmail: 'kaputt' }, fallback).recipientEmail).toBe('info@autohaus.de');
  });
  it('schreibt den Empfänger nie in die öffentliche Seite und maskiert Texte', () => {
    const html = buildContactFormHTML({ dealerUserId: 'u', supabaseUrl: 'x', vehicleTitle: 'T', heading: '<b>Hi</b>', intro: 'Text' });
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;');
    expect(html).not.toContain('skoda@autohaus.de');
  });
});
