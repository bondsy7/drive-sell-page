import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import LandingRenderer from '@/components/landing/LandingRenderer';
import type { LandingPageContent } from '@/lib/landing-page-builder';

const content: LandingPageContent = {
  meta: { title: 'Peaq', description: '', h1: 'Peaq' },
  hero: { headline: 'Erste Zeile\nZweite Zeile', subheadline: 'Untertitel', ctaText: 'Anfragen' },
  sections: [],
  textFrames: { 'hero.headline': { widthPct: 60, offsetPct: 10 } },
};

function renderEditor(editable = true, onUpdateHero = vi.fn()) {
  const onTextFrameChange = vi.fn();
  const rendered = render(<LandingRenderer
    content={content}
    images={{}}
    dealer={{ name: 'Händler' }}
    brand="Škoda"
    model="Peaq"
    editable={editable}
    onUpdateHero={onUpdateHero}
    onTextFrameChange={onTextFrameChange}
  />);
  return { ...rendered, onTextFrameChange };
}

describe('Landingpage-Textbearbeitung', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  });
  afterAll(() => vi.unstubAllGlobals());

  it('übernimmt gespeicherte Breite und Offset im Bearbeitungs- und Ansichtsmodus', () => {
    const editor = renderEditor(true);
    const frame = editor.container.querySelector<HTMLElement>('[data-text-frame="hero.headline"]');
    expect(frame?.style.width).toBe('60%');
    expect(frame?.style.marginLeft).toBe('10%');
    expect(frame?.querySelectorAll('[data-text-edge]')).toHaveLength(2);
    editor.unmount();

    const preview = renderEditor(false);
    const previewFrame = preview.container.querySelector<HTMLElement>('[data-text-frame="hero.headline"]');
    expect(previewFrame?.style.width).toBe('60%');
    expect(previewFrame?.style.marginLeft).toBe('10%');
    expect(previewFrame?.querySelectorAll('[data-text-edge]')).toHaveLength(0);
  });

  it('lässt Enter in der Überschrift zu und speichert den manuellen Umbruch', () => {
    const onUpdateHero = vi.fn();
    const editor = renderEditor(true, onUpdateHero);
    const headline = editor.getByRole('heading', { level: 1 });
    expect(headline.style.whiteSpace).toBe('pre-line');
    expect(fireEvent.keyDown(headline, { key: 'Enter' })).toBe(true);
    (headline as HTMLElement).innerText = 'Erste Zeile\nZweite Zeile\nDritte Zeile';
    fireEvent.blur(headline);
    expect(onUpdateHero).toHaveBeenCalledWith('headline', 'Erste Zeile\nZweite Zeile\nDritte Zeile');
  });
});
