import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingSectionResize, { LandingSectionSizeContext } from '@/components/landing/LandingSectionResize';

describe('section resizing commits', () => {
  it('commits the content floor once after dragging, not each movement', () => {
    const onResize = vi.fn();
    const view = render(<LandingSectionSizeContext.Provider value={{ onResize }}>
      <LandingSectionResize id="hero" editable><section>Content</section></LandingSectionResize>
    </LandingSectionSizeContext.Provider>);
    const wrapper = view.container.firstElementChild as HTMLElement;
    wrapper.getBoundingClientRect = () => ({ height: 600 } as DOMRect);
    const button = view.getByRole('button', { name: 'Abschnittshöhe unten ändern' });
    button.setPointerCapture = vi.fn();
    button.hasPointerCapture = () => false;
    // jsdom has no native PointerEvent; provide real pointer coordinates.
    const pointer = (target: EventTarget, type: string, y: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, button: 0, clientY: y });
      fireEvent(target, event);
    };
    pointer(button, 'pointerdown', 600);
    pointer(window, 'pointermove', -300);
    expect(onResize).not.toHaveBeenCalled();
    pointer(window, 'pointerup', -300);
    expect(onResize).toHaveBeenCalledExactlyOnceWith('hero', 600);
  });
  it('does not save a cancelled drag', () => {
    const onResize = vi.fn();
    const view = render(<LandingSectionSizeContext.Provider value={{ onResize }}>
      <LandingSectionResize id="cancel-test" editable><section /></LandingSectionResize>
    </LandingSectionSizeContext.Provider>);
    const wrapper = view.container.firstElementChild as HTMLElement;
    wrapper.getBoundingClientRect = () => ({ height: 600 } as DOMRect);
    const button = view.getAllByRole('button', { name: 'Abschnittshöhe oben ändern' }).at(-1);
    if (!button) throw new Error('Missing resize control');
    button.setPointerCapture = vi.fn();
    button.hasPointerCapture = () => false;
    fireEvent.pointerDown(button, { button: 0 });
    fireEvent.pointerCancel(window);
    expect(onResize).not.toHaveBeenCalled();
  });
});