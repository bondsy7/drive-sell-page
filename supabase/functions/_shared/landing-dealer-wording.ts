/** Landing-page marketing wording only; never mutate URLs, IDs or legal/profile data. */
const PAUL_USER_ID = 'd75734d2-9add-443b-9d3d-d1a0c8acbefa';
const PAUL_DEALER_NAME = 'wir-sind-jacobs';
const JACOBS_NAME_PATTERN = String.raw`(?:Autohaus\s+Jacobs|Autohaus\s+wir-sind-jacobs|wir-sind-jacobs)`;
const TEXT_FIELDS = new Set(['title', 'description', 'ogTitle', 'ogDescription', 'h1', 'headline', 'subheadline', 'ctaText', 'content', 'name', 'text', 'keywords']);

export function landingDealerName(userId: string | undefined, fallback: string): string {
  return userId === PAUL_USER_ID ? PAUL_DEALER_NAME : fallback;
}

function normalizePaulWording(text: string): string {
  const atJacobs = (match: string) => `${/^[A-ZÄÖÜ]/.test(match) ? 'Bei' : 'bei'} ${PAUL_DEALER_NAME}`;
  return text
    .replace(new RegExp(String.raw`\bbei\s+uns\s*,?\s*dem\s+${JACOBS_NAME_PATTERN}\s*,?`, 'gi'), atJacobs)
    .replace(new RegExp(String.raw`\bbei\s+uns\s+(?:im|beim|in\s+unserem)\s+${JACOBS_NAME_PATTERN}`, 'gi'), atJacobs)
    .replace(new RegExp(String.raw`\b(?:im|beim|in\s+unserem)\s+${JACOBS_NAME_PATTERN}`, 'gi'), atJacobs)
    .replace(new RegExp(String.raw`\b(?:der|die|das|dem|den|des|ein|eine|einem|einen|einer|eines|unser|unsere|unserem|unseren|unserer|ihr|ihre|ihrem|ihren|ihrer)\s+${JACOBS_NAME_PATTERN}`, 'gi'), PAUL_DEALER_NAME)
    .replace(/\bAutohaus\s+(?:Jacobs|wir-sind-jacobs)\b/gi, PAUL_DEALER_NAME);
}

export function normalizeLandingDealerWording<T>(value: T, userId: string | undefined): T {
  if (userId !== PAUL_USER_ID) return value;
  const visit = (entry: unknown, key = ''): unknown => {
    if (typeof entry === 'string') return TEXT_FIELDS.has(key)
      ? entry.split(/(<[^>]*>)/g).map(part => part.startsWith('<') ? part : normalizePaulWording(part)).join('')
      : entry;
    if (Array.isArray(entry)) return entry.map(item => visit(item, key));
    if (entry && typeof entry === 'object') return Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, visit(v, k)]));
    return entry;
  };
  return visit(value) as T;
}