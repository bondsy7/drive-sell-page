import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HoverZoomImage from '@/components/home/HoverZoomImage';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 450,
    width: 600, height: 450, toJSON() {},
  });
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(180);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(180);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Homepage look zoom click control', () => {
  for (const category of ['Showroom', 'Outdoor', 'Branding', 'Kennzeichen']) {
    it(`${category}: tracks the pointer only between first and second clicks`, () => {
      render(<HoverZoomImage src="/car.jpg" alt="Fahrzeug" label={category} />);
      const control = screen.getByRole('button');
      const detail = screen.getByAltText('Vergrößerter Ausschnitt: Fahrzeug');
      const initialPosition = detail.style.left;
      fireEvent.pointerMove(control, { clientX: 100, clientY: 100 });
      expect(detail.style.left).toBe(initialPosition);

      fireEvent.click(control);
      fireEvent.pointerMove(control, { clientX: 100, clientY: 100 });
      expect(detail.style.left).not.toBe(initialPosition);
      const activePosition = detail.style.left;
      fireEvent.pointerMove(control, { clientX: 400, clientY: 200 });
      expect(detail.style.left).not.toBe(activePosition);

      fireEvent.click(control);
      const stoppedPosition = detail.style.left;
      fireEvent.pointerMove(control, { clientX: 200, clientY: 300 });
      expect(detail.style.left).toBe(stoppedPosition);
    });
  }
});