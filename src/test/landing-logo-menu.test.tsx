import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import LandingElementBox from '@/components/landing/LandingElementBox';
import { LogoSizeControl } from '@/components/landing/LandingLogo';

describe('Logo-Bearbeitungsmenü', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
  afterAll(() => vi.unstubAllGlobals());

  it('opens beside the logo instead of over it', () => {
    render(
      <LandingElementBox
        editable
        inline
        menuSide="right"
        label="Herstellerlogo löschen"
        colorControl={<LogoSizeControl id="header.brand" alt="Herstellerlogo" sizes={{ 'header.brand': 71 }} />}
      >
        <img alt="Herstellerlogo" src="/logo.png" />
      </LandingElementBox>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Herstellerlogo bearbeiten' }));
    const menu = document.querySelector('.lp-edit-menu');
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute('data-side')).toBe('right');
  });

  it('keeps opening downwards for normal content elements', () => {
    render(
      <LandingElementBox editable label="Text löschen" colorControl={<LogoSizeControl id="header.brand" alt="Herstellerlogo" />}>
        <p>Fließtext</p>
      </LandingElementBox>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Text bearbeiten' }));
    const menu = document.querySelector('.lp-edit-menu');
    expect(menu?.getAttribute('data-side')).toBe('bottom');
  });
});
