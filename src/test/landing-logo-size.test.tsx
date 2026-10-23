import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingLogo from '@/components/landing/LandingLogo';
import { resolveLandingLogoHeight } from '@/lib/landing-logo-size';
import { recordChange, undoChange } from '@/lib/landing-element-editing';

describe('Landingpage logo editing', () => {
  it('opens the selected logo control only in editing mode and commits its new size', () => {
    const resize = vi.fn();
    render(<LandingLogo id="header.brand" src="/logo.png" alt="Skoda" editable onResize={resize} />);
    expect(screen.queryByRole('slider')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(resize).toHaveBeenCalledWith('header.brand', 31);
  });
  it('stores individual placement sizes and restores the previous sizes on undo', () => {
    const initial = { logoSizes: { 'header.brand': 30, 'contact.dealer': 56 } };
    const next = { logoSizes: { ...initial.logoSizes, 'header.brand': 80 } };
    const saved = JSON.parse(JSON.stringify(next));
    expect(resolveLandingLogoHeight(saved.logoSizes, 'header.brand')).toBe(80);
    expect(resolveLandingLogoHeight(saved.logoSizes, 'contact.dealer')).toBe(56);
    expect(undoChange(recordChange({ current: initial, past: [] }, next)).current).toEqual(initial);
  });
  it('does not expose editing controls on the delivered page', () => {
    render(<LandingLogo id="contact.dealer" src="/logo.png" alt="Händler" sizes={{ 'contact.dealer': 90 }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});