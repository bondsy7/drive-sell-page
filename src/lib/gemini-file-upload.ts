import { supabase } from '@/integrations/supabase/client';

export interface GeminiFileRef {
  uri: string;
  mimeType: string;
}

interface UploadInput {
  id?: string;
  imageBase64: string;
  /** Optional explicit mime, e.g. "application/pdf" */
  mimeType?: string;
  displayName?: string;
}

/**
 * Upload one or more base64 payloads (images or PDFs) to the Gemini File API
 * via the `upload-to-gemini-files` edge function. Returns reusable file URIs
 * so subsequent edge function calls can avoid sending base64 in the request body.
 *
 * Falls back to returning `null` when upload fails — callers can then send
 * the original base64 as before.
 */
export async function uploadToGeminiFiles(
  inputs: UploadInput[],
): Promise<GeminiFileRef[] | null> {
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

    const { data, error } = await supabase.functions.invoke('upload-to-gemini-files', {
      body: { images: payload },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || !data?.files || !Array.isArray(data.files)) {
      console.warn('[gemini-file-upload] failed, falling back to base64:', error?.message);
      return null;
    }

    // Preserve order according to inputs
    const byId: Record<string, GeminiFileRef> = {};
    for (const f of data.files) {
      byId[f.id] = { uri: f.uri, mimeType: f.mimeType };
    }
    const out: GeminiFileRef[] = [];
    for (const it of payload) {
      const ref = byId[it.id];
      if (!ref) return null; // partial failure — caller falls back
      out.push(ref);
    }
    return out;
  } catch (e) {
    console.warn('[gemini-file-upload] error', e);
    return null;
  }
}
