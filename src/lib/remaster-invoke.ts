import { supabase } from '@/integrations/supabase/client';

export interface RemasterInvokePayload {
  imageBase64: string;
  vehicleDescription?: string;
  modelTier?: string;
  dynamicPrompt?: string;
  additionalImages?: string[];
  customShowroomBase64?: string | null;
  customPlateImageBase64?: string | null;
  dealerLogoUrl?: string | null;
  dealerLogoBase64?: string | null;
  manufacturerLogoUrl?: string | null;
  manufacturerLogoBase64?: string | null;
  /** Pre-uploaded Gemini File API URIs – when set, corresponding base64 fields are ignored */
  fileUris?: Record<string, { uri: string; mimeType: string }>;
}

export async function invokeRemasterVehicleImage(body: RemasterInvokePayload) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Nicht eingeloggt');
  }

  return supabase.functions.invoke('remaster-vehicle-image', {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

/**
 * Pre-upload images to Gemini File API for pipeline use.
 * Returns a map of key → { uri, mimeType } that can be passed to remaster calls.
 * This eliminates redundant base64 transfers across pipeline jobs.
 */
export async function uploadPipelineImages(
  images: Array<{ key: string; base64: string }>
): Promise<Record<string, { uri: string; mimeType: string }>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Nicht eingeloggt');
  }

  const { data, error } = await supabase.functions.invoke('upload-pipeline-images', {
    body: { images },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('[uploadPipelineImages] Error:', error);
    throw error;
  }

  return data?.fileUris || {};
}
