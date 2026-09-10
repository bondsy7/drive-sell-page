import { describe, it, expect } from 'vitest';
import { stripRedundantBase64 } from '@/lib/remaster-invoke';

const B64 = 'data:image/png;base64,AAAA';

describe('file-id-first payload guard', () => {
  it('removes base64 for every asset that has an OpenAI file id', () => {
    const out = stripRedundantBase64({
      imageBase64: B64,
      customShowroomBase64: B64,
      customPlateImageBase64: B64,
      manufacturerLogoBase64: B64,
      dealerLogoBase64: B64,
      wheelReferenceBase64: B64,
      mainImageOpenAIFile: { fileId: 'file_1', mimeType: 'image/png' },
      customShowroomOpenAIFile: { fileId: 'file_2', mimeType: 'image/png' },
      customPlateOpenAIFile: { fileId: 'file_3', mimeType: 'image/png' },
      manufacturerLogoOpenAIFile: { fileId: 'file_4', mimeType: 'image/png' },
      dealerLogoOpenAIFile: { fileId: 'file_5', mimeType: 'image/png' },
      wheelReferenceOpenAIFile: { fileId: 'file_6', mimeType: 'image/png' },
    });
    expect(JSON.stringify(out)).not.toContain('data:image');
  });

  it('keeps base64 when no OpenAI file id exists (Gemini/fallback path)', () => {
    const out = stripRedundantBase64({ imageBase64: B64, customShowroomBase64: B64 });
    expect(out.imageBase64).toBe(B64);
    expect(out.customShowroomBase64).toBe(B64);
  });
});
