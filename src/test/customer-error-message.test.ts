import { describe, expect, it } from 'vitest';
import { customerErrorMessage } from '@/lib/customer-error-message';

describe('customerErrorMessage', () => {
  it('übersetzt bekannte Anmeldefehler', () => {
    expect(customerErrorMessage(new Error('Invalid login credentials')))
      .toBe('E-Mail-Adresse oder Passwort sind nicht korrekt.');
  });

  it('verbirgt unbekannte englische Technikfehler', () => {
    expect(customerErrorMessage(new Error('Unknown server error')))
      .toBe('Ein unerwarteter Fehler ist aufgetreten.');
  });

  it('behält verständliche deutsche Hinweise bei', () => {
    expect(customerErrorMessage(new Error('Bitte prüfen Sie Ihre Eingabe.')))
      .toBe('Bitte prüfen Sie Ihre Eingabe.');
  });
});