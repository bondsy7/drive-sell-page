/**
 * Descriptive, unique alt text for landing page section images.
 * Shared by React renderer and HTML export so SEO output stays identical.
 */
export function landingImageAlt(vehicleName: string, headline: string | undefined, index = 0): string {
  const name = (vehicleName || '').replace(/\s+/g, ' ').trim();
  const head = (headline || '').replace(/\s+/g, ' ').trim();
  const base = head && name && !head.toLowerCase().includes(name.toLowerCase())
    ? `${name} – ${head}`
    : head || name || 'Fahrzeugbild';
  return index > 0 ? `${base} (Bild ${index + 1})` : base;
}
