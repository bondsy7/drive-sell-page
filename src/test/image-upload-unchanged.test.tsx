import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImageUploadRemaster from '@/components/ImageUploadRemaster';

const { remasterInvoke, geminiUpload, openAIUpload } = vi.hoisted(() => ({
  remasterInvoke: vi.fn(),
  geminiUpload: vi.fn(),
  openAIUpload: vi.fn(),
}));

vi.mock('@/components/RemasterOptions', () => ({
  default: ({ config, onChange }: any) => (
    <div>
      <button type="button" onClick={() => onChange({ ...config, scene: 'none' })}>Keine Änderung auswählen</button>
      <button type="button" onClick={() => onChange({ ...config, scene: 'showroom-1' })}>Showroom auswählen</button>
    </div>
  ),
}));
vi.mock('@/components/ImagePreviewLightbox', () => ({ default: () => null }));
vi.mock('@/lib/image-compress', () => ({
  fileToBase64: async (file: File) => `data:${file.type};base64,ORIGINAL-${file.name}`,
  compressImageForAI: async (value: string) => value.replace('ORIGINAL-', 'KI-KOMPRIMIERT-'),
}));
vi.mock('@/lib/remaster-invoke', () => ({ invokeRemasterVehicleImage: remasterInvoke }));
vi.mock('@/lib/remaster-prompt', () => ({
  buildMasterPrompt: () => 'Test-Prompt',
  fetchPromptOverrides: async () => ({}),
}));
vi.mock('@/lib/gemini-file-upload', () => ({ uploadToGeminiFiles: geminiUpload }));
vi.mock('@/lib/openai-file-upload', () => ({
  uploadToOpenAIFiles: openAIUpload,
  tierUsesOpenAIFiles: () => false,
}));
vi.mock('@/lib/detect-branding', () => ({ detectVehicleBranding: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function uploadFiles(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe('PDF-Angebotsseite: eigene Fotos ohne Änderung', () => {
  it('übernimmt exakt die Originaldateien in ihrer Reihenfolge und ruft keine KI auf', async () => {
    const onComplete = vi.fn();
    const { container } = render(
      <ImageUploadRemaster vehicleDescription="Volkswagen Golf" onComplete={onComplete} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keine Änderung auswählen' }));
    uploadFiles(container, [
      new File(['erste Originaldatei'], 'front.jpg', { type: 'image/jpeg' }),
      new File(['zweite Originaldatei'], 'seite.png', { type: 'image/png' }),
    ]);
    await waitFor(() => expect(screen.getAllByAltText('Fahrzeug')).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: 'Bilder unverändert übernehmen' }));

    expect(onComplete).toHaveBeenCalledWith(
      'data:image/jpeg;base64,ORIGINAL-front.jpg',
      ['data:image/png;base64,ORIGINAL-seite.png'],
      ['data:image/jpeg;base64,ORIGINAL-front.jpg', 'data:image/png;base64,ORIGINAL-seite.png'],
    );
    expect(remasterInvoke).not.toHaveBeenCalled();
    expect(geminiUpload).not.toHaveBeenCalled();
    expect(openAIUpload).not.toHaveBeenCalled();
  });

  it('verwendet bei einem echten Remastering weiterhin die KI-Arbeitskopie', async () => {
    geminiUpload.mockResolvedValue([null]);
    remasterInvoke.mockResolvedValue({ data: { imageBase64: 'data:image/webp;base64,REMASTERT' }, error: null });
    const onComplete = vi.fn();
    const { container } = render(
      <ImageUploadRemaster vehicleDescription="Volkswagen Golf" onComplete={onComplete} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Showroom auswählen' }));
    uploadFiles(container, [new File(['Originaldatei'], 'front.jpg', { type: 'image/jpeg' })]);
    await screen.findByAltText('Fahrzeug');
    fireEvent.click(screen.getByRole('button', { name: 'Bilder remastern' }));
    await screen.findByRole('button', { name: 'Weiter zur Landing Page' });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter zur Landing Page' }));

    expect(remasterInvoke).toHaveBeenCalledWith(expect.objectContaining({
      imageBase64: 'data:image/jpeg;base64,KI-KOMPRIMIERT-front.jpg',
    }));
    expect(onComplete).toHaveBeenCalledWith(
      'data:image/webp;base64,REMASTERT',
      [],
      ['data:image/jpeg;base64,ORIGINAL-front.jpg'],
    );
  });
});
