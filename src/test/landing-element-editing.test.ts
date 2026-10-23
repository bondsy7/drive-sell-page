import { describe, expect, it } from 'vitest';
import { removeLandingElement, isLandingElementRemoved, recordChange, undoChange } from '@/lib/landing-element-editing';
import type { LandingPageContent } from '@/lib/landing-page-builder';

const content: LandingPageContent = {
  meta: { title: 'Skoda', description: '', h1: 'Skoda' },
  hero: { headline: 'Skoda Octavia', subheadline: 'Unser Angebot', ctaText: 'Anfragen' },
  sections: [{ id: 'design', type: 'content', headline: 'Design', content: '<p>Innenraum</p>', bgStyle: 'white' }],
};
describe('Landingpage elements and undo', () => {
  it('removes only the selected header image, retaining original text', () => {
    const next = removeLandingElement(content, 'hero.image');
    expect(isLandingElementRemoved(next, 'hero.image')).toBe(true);
    expect(isLandingElementRemoved(next, 'hero.headline')).toBe(false);
    expect(next.hero.headline).toBe('Skoda Octavia');
    expect(content.removedElements).toBeUndefined();
  });
  it('persists section image deletion independently of its headline and body', () => {
    const saved = JSON.parse(JSON.stringify(removeLandingElement(content, 'design.image')));
    expect(isLandingElementRemoved(saved, 'design.image')).toBe(true);
    expect(saved.sections[0].content).toBe('<p>Innenraum</p>');
    expect(isLandingElementRemoved(saved, 'design.content')).toBe(false);
  });
  it('restores the exact prior page one step at a time', () => {
    const initial = { content, images: { hero: 'original.jpg' }, liveInventory: { enabled: true } };
    const first = recordChange({ current: initial, past: [] }, { ...initial, content: removeLandingElement(content, 'hero.image') });
    const second = recordChange(first, { ...first.current, images: { hero: 'replacement.jpg' } });
    const undone = undoChange(second);
    expect(undone.current.images.hero).toBe('original.jpg');
    expect(isLandingElementRemoved(undone.current.content, 'hero.image')).toBe(true);
    expect(undoChange(undone).current).toEqual(initial);
  });
  it('does not consume an undo step for unchanged data', () => {
    const state = { current: content, past: [] };
    expect(recordChange(state, { ...content })).toBe(state);
    expect(undoChange(state)).toBe(state);
  });
});