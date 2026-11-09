/**
 * Kontakt-Abschnitte zeigen standardmäßig reinen zentrierten Text ohne
 * Aufzählungspunkte. Die Umwandlung passiert beim Rendern (Editor, Vorschau
 * und HTML-Export teilen diese Funktion), der gespeicherte Inhalt bleibt
 * unverändert, bis er im Editor bearbeitet wird.
 */

/** True, wenn die Abschnittsüberschrift ein Kontakt-Abschnitt ist. */
export function isContactSection(headline: string | null | undefined, type?: string, id?: string): boolean {
  const plain = (headline || '').replace(/<[^>]*>/g, '').trim();
  return /kontakt/i.test(plain) || /^(cta|contact|kontakt)$/i.test(type || '') || /^(contact|kontakt)(?:[-_]|$)/i.test(id || '');
}

/**
 * Wandelt Listen im Kontakt-Abschnitt in einfache Absätze um.
 * Andere Abschnitte bleiben unverändert.
 */
export function plainContactContent(
  headline: string | null | undefined,
  content: string | null | undefined,
  type?: string,
  id?: string,
): string {
  if (!content || !isContactSection(headline, type, id)) return content || '';
  return content
    .replace(/<\/?(?:ul|ol)[^>]*>/gi, '')
    .replace(/<li[^>]*>/gi, '<p>')
    .replace(/<\/li>/gi, '</p>');
}

/** CSS-Klasse für den Abschnittstext (zentriert im Kontakt-Abschnitt). */
export function contactBodyClass(headline: string | null | undefined, type?: string, id?: string): string {
  return isContactSection(headline, type, id) ? 'lp-body-html lp-contact-plain' : 'lp-body-html';
}
