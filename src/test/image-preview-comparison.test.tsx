// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImagePreviewLightbox from '@/components/ImagePreviewLightbox';

vi.mock('@/lib/download-file', () => ({ downloadMediaFile: vi.fn() }));
afterEach(cleanup);

describe('Image preview comparison', () => {
  it('switches the large image between the matching original and remastered result', () => {
    render(<ImagePreviewLightbox open initialIndex={0} onClose={() => {}} images={[
      { id: 'seat', label: 'Fahrersitz', src: '/remastered.jpg', originalSrc: '/original.jpg' },
    ]} />);
    expect(screen.getByAltText('Fahrersitz – Remastered').getAttribute('src')).toBe('/remastered.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Original anzeigen' }));
    expect(screen.getByAltText('Fahrersitz – Original').getAttribute('src')).toBe('/original.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Remastered anzeigen' }));
    expect(screen.getByAltText('Fahrersitz – Remastered').getAttribute('src')).toBe('/remastered.jpg');
  });

  it('keeps images without an original available without comparison controls', () => {
    render(<ImagePreviewLightbox open initialIndex={0} onClose={() => {}} images={[
      { id: 'single', label: 'Fahrzeug', src: '/single.jpg' },
    ]} />);
    expect(screen.getByAltText('Fahrzeug').getAttribute('src')).toBe('/single.jpg');
    expect(screen.queryByRole('button', { name: 'Original anzeigen' })).toBeNull();
  });
});