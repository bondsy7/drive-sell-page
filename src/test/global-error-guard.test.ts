import { describe, it, expect } from 'vitest';
import { isCreditErrorMessage } from '@/lib/global-error-guard';

describe('isCreditErrorMessage', () => {
  it('erkennt 402-insufficient_credits-Fehler der Serverfunktionen', () => {
    expect(
      isCreditErrorMessage('Edge function returned 402: Error, {"error":"insufficient_credits","balance":5,"cost":8}'),
    ).toBe(true);
    expect(isCreditErrorMessage('insufficient_credits')).toBe(true);
    expect(isCreditErrorMessage('Nicht genug Credits (Guthaben 0, benötigt 3).')).toBe(true);
  });

  it('lässt andere Fehler unangetastet', () => {
    expect(isCreditErrorMessage('Netzwerkfehler')).toBe(false);
    expect(isCreditErrorMessage('Hero-Generierung fehlgeschlagen')).toBe(false);
    expect(isCreditErrorMessage(null)).toBe(false);
    expect(isCreditErrorMessage(undefined)).toBe(false);
  });
});
