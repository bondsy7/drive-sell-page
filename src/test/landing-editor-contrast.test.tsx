import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import LandingElementBox from '@/components/landing/LandingElementBox';
import { editorControlColors, editorControlStyle, isLightSurface } from '@/lib/landing-theme';

// Vorgabe: Das Löschkreuz darf auf hellen Flächen (z. B. weißer Kopfzeile) nicht
// verschwinden – weiße Pille auf Weiß war kaum zu sehen.
describe('Kontrast der Editor-Löschkreuze', () => {
  it('helle Flächen gelten als hell, dunkle und unparsable nicht', () => {
    expect(isLightSurface('#ffffff')).toBe(true);
    expect(isLightSurface('#0b1220')).toBe(false);
    expect(isLightSurface('rgba(255,255,255,0.8)')).toBe(false);
  });

  it('auf Weiß wird die Pille dunkel mit hellem Label', () => {
    expect(editorControlColors('#ffffff')).toEqual({ background: '#0f172a', foreground: '#ffffff' });
  });

  it('auf Dunkel bleibt die Pille weiß', () => {
    expect(editorControlColors('#0b1220')).toEqual({ background: '#ffffff', foreground: '#0f172a' });
  });

  it('unbekannte Flächen erben die Standardfarbe', () => {
    expect(editorControlStyle(undefined)).toBeUndefined();
    expect(editorControlStyle('rgba(1,2,3,0.5)')).toBeUndefined();
  });

  it('der Wrapper setzt surface-abhängige Farben für alle Controls darin', () => {
    const light = render(
      <LandingElementBox editable onDelete={() => {}} controlOn="#ffffff">
        <p>x</p>
      </LandingElementBox>,
    );
    const wrapper = light.container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--lp-editor-control-bg')).toBe('#0f172a');
    expect(wrapper.style.getPropertyValue('--lp-editor-control-fg')).toBe('#ffffff');

    const dark = render(
      <LandingElementBox editable onDelete={() => {}} controlOn="#0b1220">
        <p>x</p>
      </LandingElementBox>,
    );
    const darkWrapper = dark.container.firstElementChild as HTMLElement;
    expect(darkWrapper.style.getPropertyValue('--lp-editor-control-bg')).toBe('#ffffff');
    expect(darkWrapper.style.getPropertyValue('--lp-editor-control-fg')).toBe('#0f172a');
  });
});
