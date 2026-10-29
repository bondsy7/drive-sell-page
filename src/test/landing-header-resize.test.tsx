import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import LandingHeaderResize from '@/components/landing/LandingHeaderResize';
import { LandingSectionSizeContext } from '@/components/landing/LandingSectionResize';
import { buildLandingPageHTML, type LandingPageContent } from '@/lib/landing-page-builder';

const baseContent = (): LandingPageContent => ({
  meta: { title: 'T', description: 'D', h1: 'H' },
  hero: { headline: 'Head', subheadline: 'Sub', ctaText: 'CTA' },
  sections: [{ id: 'sec1', type: 'benefits', headline: 'Sek-Kopf', content: 'Sek-Text', bgStyle: 'white' }],
});

describe('Höhe der Kopfzeile', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
  afterAll(() => vi.unstubAllGlobals());

  it('reserves the saved height in the editor and offers a drag handle', () => {
    const resize = vi.fn();
    render(
      <LandingSectionSizeContext.Provider value={{ heights: { header: 140 }, onResize: resize }}>
        <LandingHeaderResize editable><span>Logo</span></LandingHeaderResize>
      </LandingSectionSizeContext.Provider>,
    );
    expect(screen.getByRole('banner').style.minHeight).toBe('140px');
    expect(screen.getByRole('button', { name: 'Höhe der Kopfzeile ändern' })).toBeTruthy();
  });

  it('keeps the saved height on the delivered page without showing a handle', () => {
    render(
      <LandingSectionSizeContext.Provider value={{ heights: { header: 140 } }}>
        <LandingHeaderResize editable={false}><span>Logo</span></LandingHeaderResize>
      </LandingSectionSizeContext.Provider>,
    );
    expect(screen.getByRole('banner').style.minHeight).toBe('140px');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('never lets the header shrink below the minimum height', () => {
    const resize = vi.fn();
    render(
      <LandingSectionSizeContext.Provider value={{ heights: { header: 140 }, onResize: resize }}>
        <LandingHeaderResize editable><span>Logo</span></LandingHeaderResize>
      </LandingSectionSizeContext.Provider>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Höhe der Kopfzeile ändern' }), { key: 'ArrowUp' });
    expect(resize).toHaveBeenCalledWith('header', 64);
  });

  it('carries the saved height into the exported HTML and omits it when unset', () => {
    const sized = buildLandingPageHTML({ ...baseContent(), sectionHeights: { header: 140 } }, {}, { name: 'Händler' }, 'Kia', 'EV4');
    expect(sized).toContain('padding:14px 0;min-height:140px');
    const plain = buildLandingPageHTML(baseContent(), {}, { name: 'Händler' }, 'Kia', 'EV4');
    expect(plain).toContain('padding:14px 0"');
    expect(plain).not.toContain('min-height:140px');
  });
});
