import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BackgroundSwapFlow from '@/components/BackgroundSwapFlow';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/lib/image-compress', () => ({
  fileToBase64: async (file: File) => `data:image/png;base64,${file.name}`,
  compressImageForAI: async (value: string) => value,
}));
vi.mock('@/components/ImagePreviewLightbox', () => ({ default: () => null }));
vi.mock('@/components/AiDisclosureBadge', () => ({ default: () => null }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function upload(slot: string, name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Hochladen: ${slot}` }));
  fireEvent.change(screen.getByLabelText('Perspektiv-Foto auswählen'), {
    target: { files: [new File(['original'], name, { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('button', { name: `Ändern: ${slot}` }).hasAttribute('disabled')).toBe(false));
}

describe('Freisteller: unabhängige Original-Uploads', () => {
  it('ein einzelnes Foto genügt, auch im sonst empfohlenen Front-Slot; es wird als eigener Auftrag verarbeitet', async () => {
    invoke.mockResolvedValue({ data: { image: 'data:image/png;base64,result' }, error: null });
    render(<BackgroundSwapFlow onBack={vi.fn()} onComplete={vi.fn()} />);
    await upload('Front', 'front.png');
    fireEvent.click(screen.getByRole('button', { name: 'Freistellen', exact: true }));
    const start = screen.getByRole('button', { name: /Hintergrund tauschen \(/ });
    expect(start.hasAttribute('disabled')).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(start);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith('remove-background', expect.objectContaining({
      body: expect.objectContaining({ image: 'data:image/png;base64,front.png', mode: 'transparent' }),
    }));
    await screen.findByRole('button', { name: /In Galerie speichern/ });
  });

  it('mehrere Perspektiven werden unabhängig verarbeitet, kein Foto dient nur als Referenz', async () => {
    invoke.mockResolvedValue({ data: { image: 'data:image/png;base64,result' }, error: null });
    render(<BackgroundSwapFlow onBack={vi.fn()} onComplete={vi.fn()} />);
    await upload('Seite rechts', 'right.png');
    await upload('Heck', 'rear.png');
    fireEvent.click(screen.getByRole('button', { name: 'Freistellen', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: /Hintergrund tauschen \(/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls.map(call => call[1].body.image)).toEqual([
      'data:image/png;base64,right.png', 'data:image/png;base64,rear.png',
    ]);
    await screen.findByRole('button', { name: /In Galerie speichern/ });
  });

  it('Foto austauschen ersetzt das Original statt einen zweiten Auftrag anzulegen; Entfernen leert das Feld', async () => {
    invoke.mockResolvedValue({ data: { image: 'data:image/png;base64,result' }, error: null });
    render(<BackgroundSwapFlow onBack={vi.fn()} onComplete={vi.fn()} />);
    await upload('Front', 'old.png');
    fireEvent.click(screen.getByRole('button', { name: 'Ändern: Front' }));
    fireEvent.change(screen.getByLabelText('Perspektiv-Foto auswählen'), {
      target: { files: [new File(['replacement'], 'new.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ändern: Front' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Freistellen', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: /Hintergrund tauschen \(/ }));
    await screen.findByRole('button', { name: /In Galerie speichern/ });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body.image).toBe('data:image/png;base64,new.png');
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen: Front' }));
    expect(screen.getByRole('button', { name: 'Hochladen: Front' }).hasAttribute('disabled')).toBe(false);
  });
});