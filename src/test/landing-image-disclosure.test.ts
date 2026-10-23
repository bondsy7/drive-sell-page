import { describe, expect, it } from 'vitest';
import { replaceLandingImage, shouldLabelLandingImage } from '@/lib/landing-image-disclosure';
import { getAiDisclosureKind } from '@/lib/ai-disclosure';
import { recordChange, undoChange } from '@/lib/landing-element-editing';
import type { LandingPageContent } from '@/lib/landing-page-builder';

const content: LandingPageContent = {
  meta: { title: 'Skoda', description: '', h1: 'Skoda' },
  hero: { headline: 'Skoda', subheadline: '', ctaText: '' }, sections: [],
};
const initial = { content, images: { hero: 'generated.png' } };

describe('Landingpage image disclosure rules', () => {
  it('uses AI Modified for landingpage images', () => {
    expect(getAiDisclosureKind('landing')).toBe('modified');
    expect(shouldLabelLandingImage(content, 'hero', initial.images.hero)).toBe(true);
  });
  it('exempts only the exact own uploaded image and persists that exemption', () => {
    const uploaded = JSON.parse(JSON.stringify(replaceLandingImage(initial, 'hero', 'own.png', 'upload')));
    expect(shouldLabelLandingImage(uploaded.content, 'hero', uploaded.images.hero)).toBe(false);
    expect(shouldLabelLandingImage(uploaded.content, 'hero', 'different.png')).toBe(true);
    expect(shouldLabelLandingImage(uploaded.content, 'section', 'own.png')).toBe(true);
  });
  it('marks regeneration, remastering and gallery replacements after an own upload', () => {
    const uploaded = replaceLandingImage(initial, 'hero', 'own.png', 'upload');
    const generated = replaceLandingImage(uploaded, 'hero', 'ai.png', 'ai');
    expect(shouldLabelLandingImage(generated.content, 'hero', generated.images.hero)).toBe(true);
  });
  it('restores image and disclosure together in one undo step', () => {
    const uploaded = replaceLandingImage(initial, 'hero', 'own.png', 'upload');
    const history = recordChange({ current: initial, past: [] }, uploaded);
    const restored = undoChange(history).current;
    expect(restored.images.hero).toBe('generated.png');
    expect(shouldLabelLandingImage(restored.content, 'hero', restored.images.hero)).toBe(true);
    const generatedHistory = recordChange(history, replaceLandingImage(uploaded, 'hero', 'ai.png', 'ai'));
    const ownRestored = undoChange(generatedHistory).current;
    expect(ownRestored.images.hero).toBe('own.png');
    expect(shouldLabelLandingImage(ownRestored.content, 'hero', ownRestored.images.hero)).toBe(false);
  });
});