/** Landing-page marketing wording only; never mutate URLs, IDs or legal/profile data. */
const PAUL_USER_ID = 'd75734d2-9add-443b-9d3d-d1a0c8acbefa';
const TEXT_FIELDS = new Set(['title', 'description', 'ogTitle', 'ogDescription', 'h1', 'headline', 'subheadline', 'ctaText', 'content', 'name', 'text', 'keywords']);

export function landingDealerName(userId: string | undefined, fallback: string): string {
  return userId === PAUL_USER_ID ? 'wir-sind-jacobs' : fallback;
}

export function normalizeLandingDealerWording<T>(value: T, userId: string | undefined): T {
  if (userId !== PAUL_USER_ID) return value;
  const visit = (entry: unknown, key = ''): unknown => {
    if (typeof entry === 'string') return TEXT_FIELDS.has(key)
      ? entry.split(/(<[^>]*>)/g).map(part => part.startsWith('<') ? part : part.replace(/\bAutohaus\s+Jacobs\b/gi, 'wir-sind-jacobs')).join('')
      : entry;
    if (Array.isArray(entry)) return entry.map(item => visit(item, key));
    if (entry && typeof entry === 'object') return Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, visit(v, k)]));
    return entry;
  };
  return visit(value) as T;
}