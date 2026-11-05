// Optional seasonal/aktion theme layered ON TOP of the chosen showroom/scene (e.g. "Showroom 1 + Black Friday").
// The theme only decorates the environment – the vehicle itself must stay 100 % identical.

export type SeasonalThemeId = 'none' | 'black-friday' | 'christmas' | 'halloween' | 'new-year' | 'easter' | 'spring' | 'summer' | 'custom';

export const SEASONAL_THEMES: { id: SeasonalThemeId; label: string; prompt: string }[] = [
  { id: 'none', label: 'Kein Thema', prompt: '' },
  { id: 'black-friday', label: 'Black Friday', prompt: 'Black Friday sale atmosphere: dark, premium mood with black and gold accents, subtle hanging "BLACK FRIDAY" signage on the back wall, black balloons and elegant gold light accents in the background.' },
  { id: 'christmas', label: 'Weihnachten', prompt: 'Christmas atmosphere: a tastefully decorated Christmas tree, warm fairy lights, red and gold baubles and subtle garlands in the background, cozy warm light accents.' },
  { id: 'halloween', label: 'Halloween', prompt: 'Halloween atmosphere: carved glowing pumpkins on the floor at the sides, subtle orange and purple accent lights, a few cobweb decorations in the corners – playful but classy.' },
  { id: 'new-year', label: 'Silvester / Neujahr', prompt: 'New Year\'s Eve atmosphere: gold and silver balloons, festive confetti on the floor at the sides, sparkling string lights and a subtle "Happy New Year" signage on the back wall.' },
  { id: 'easter', label: 'Ostern', prompt: 'Easter atmosphere: spring flower arrangements, pastel decorated Easter eggs and subtle Easter decorations at the sides of the room.' },
  { id: 'spring', label: 'Frühling', prompt: 'Spring atmosphere: fresh blooming flower arrangements and green plants in the background, bright fresh daylight mood.' },
  { id: 'summer', label: 'Sommer', prompt: 'Summer atmosphere: bright warm sunny mood, subtle summer decorations such as potted palms and light summer accents in the background.' },
  { id: 'custom', label: 'Eigenes Thema …', prompt: '' },
];

export function resolveThemePrompt(id: SeasonalThemeId | string | undefined, custom?: string): string {
  if (!id || id === 'none') return '';
  if (id === 'custom') return (custom || '').trim().slice(0, 500);
  return SEASONAL_THEMES.find((t) => t.id === id)?.prompt || '';
}

/** Prompt block appended after the scene/showroom instructions. Empty string when no theme is chosen. */
export function buildThemeBlock(id: SeasonalThemeId | string | undefined, custom?: string): string {
  const theme = resolveThemePrompt(id, custom);
  if (!theme) return '';
  return `\n\n<SEASONAL_THEME_OVERLAY>
Keep the chosen showroom/scene as the base environment and ADD this seasonal decoration on top of it:
${theme}
RULES: Decorations belong to the room/background and floor edges only. Never place anything on, in front of or overlapping the vehicle. The vehicle (paint, wheels, badges, trim, lights, interior) stays 100 % identical to the reference. No price, no offer text and no dealer text unless explicitly requested.
</SEASONAL_THEME_OVERLAY>`;
}
