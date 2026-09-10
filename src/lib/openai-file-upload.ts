import { supabase } from '@/integrations/supabase/client';

export interface OpenAIFileRef {
  /** OpenAI file id (file_...) */
  fileId: string;
  mimeType: string;
}

interface UploadInput {
  id?: string;
  imageBase64: string;
  mimeType?: string;
  displayName?: string;
}

/** Tiers that route to the OpenAI Responses API image path (Sunburst test track). */
export const OPENAI_FILE_TIERS = ['sunburst'] as const;

/** True when the selected model tier must use OpenAI Files instead of Gemini File API. */
export function tierUsesOpenAIFiles(tier?: string | null): boolean {
  return !!tier && (OPENAI_FILE_TIERS as readonly string[]).includes(tier);
}

/**
 * Upload base64 images ONCE to the OpenAI Files API (purpose=vision) through the
 * `upload-to-openai-files` edge function. The OpenAI key never touches the browser.
 *
 * Returns file refs in the exact input order, or `null` when the upload failed or
 * was only partially successful (callers then fall back to base64).
 */
export async function uploadToOpenAIFiles(
  inputs: UploadInput[],
): Promise<OpenAIFileRef[] | null> {
  if (!inputs || inputs.length === 0) return [];

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const payload = inputs.map((it, i) => ({
      id: it.id || `f${i}`,
      imageBase64: it.imageBase64,
      mimeType: it.mimeType,
      displayName: it.displayName,
    }));

    const { data, error } = await supabase.functions.invoke('upload-to-openai-files', {
      body: { images: payload },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || !data?.files || !Array.isArray(data.files)) {
      console.warn('[openai-file-upload] failed, falling back to base64:', error?.message);
      return null;
    }

    const byId: Record<string, OpenAIFileRef> = {};
    for (const f of data.files) {
      if (f?.id && f?.fileId) byId[f.id] = { fileId: f.fileId, mimeType: f.mimeType || 'image/jpeg' };
    }

    const out: OpenAIFileRef[] = [];
    for (const it of payload) {
      const ref = byId[it.id];
      if (!ref) return null; // partial failure — caller falls back to base64
      out.push(ref);
    }
    return out;
  } catch (e) {
    console.warn('[openai-file-upload] error', e);
    return null;
  }
}
