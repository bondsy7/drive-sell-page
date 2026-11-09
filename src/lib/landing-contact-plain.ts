/**
 * Kontakt-Abschnitte zeigen standardmäßig reinen zentrierten Text ohne
 * Aufzählungspunkte. Die Umwandlung passiert beim Rendern (Editor, Vorschau
 * und HTML-Export teilen diese Funktion), der gespeicherte Inhalt bleibt
 * unverändert, bis er im Editor bearbeitet wird.
 */

/** True, wenn die Abschnittsüberschrift ein Kontakt-Abschnitt ist. */
export function isContactSection(headline: string | null | undefined): boolean {
  if (!headline) return false;
  const plain = headline.replace(/<[^>]*>/g, '').trim();
  return /kontakt/i.test(plain);
}

/**
 * Wandelt Listen im Kontakt-Abschnitt in einfache Absätze um.
 * Andere Abschnitte bleiben unverändert.
 */
export function plainContactContent(
  headline: string | null | undefined,
  content: string | null | undefined,
): string {
  if (!content || !isContactSection(headline)) return content || '';
  return content
    .replace(/<\/?(?:ul|ol)[^>]*>/gi, '')
    .replace(/<li[^>]*>/gi, '<p>')
    .replace(/<\/li>/gi, '</p>');
}

/** CSS-Klasse für den Abschnittstext (zentriert im Kontakt-Abschnitt). */
export function contactBodyClass(headline: string | null | undefined): string {
  return isContactSection(headline) ? 'lp-body-html lp-contact-plain' : 'lp-body-html';
}
