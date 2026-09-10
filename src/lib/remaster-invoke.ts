import { supabase } from '@/integrations/supabase/client';
import type { VehicleClassContext } from '@/config/vehicle-class-types';
import type { WheelAnalysis } from '@/types/wheel-reference';
import type { OpenAIFileRef } from '@/lib/openai-file-upload';

export interface RemasterInvokePayload {
  /** Optional: omitted whenever an OpenAI file id carries the same asset. */
  imageBase64?: string | null;
  /** Neutral perspective role of the primary vehicle reference (never brand/model text). */
  mainImageRole?: string;
  vehicleDescription?: string;
  modelTier?: string;
  dynamicPrompt?: string;
  /**
   * Verbindlicher Fahrzeugklassen-Kontext. Fehlt er, behandelt die Edge Function
   * den Request als 'car' (Rückwärtskompatibilität für Altdaten).
   */
  classContext?: VehicleClassContext | null;
  additionalImages?: string[];
  /** Perspective roles aligned with additionalImages. */
  additionalImageRoles?: string[];
  /** Pre-uploaded Gemini File API URIs – used INSTEAD of additionalImages when available */
  additionalFileUris?: { uri: string; mimeType: string }[];
  /** Perspective roles aligned with additionalFileUris. */
  additionalFileUriRoles?: string[];
  /** Pre-uploaded main image file URI */
  mainImageFileUri?: { uri: string; mimeType: string } | null;
  /**
   * Dedizierte Felgenreferenz – eigenständige, hoch priorisierte Bildquelle.
   * NIEMALS in additionalImages verstecken.
   */
  wheelReferenceBase64?: string | null;
  wheelReferenceFileUri?: { uri: string; mimeType: string } | null;
  wheelReferenceAnalysis?: WheelAnalysis | null;
  customShowroomBase64?: string | null;
  customShowroomFileUri?: { uri: string; mimeType: string } | null;
  customPlateImageBase64?: string | null;
  customPlateImageFileUri?: { uri: string; mimeType: string } | null;
  dealerLogoUrl?: string | null;
  dealerLogoBase64?: string | null;
  dealerLogoFileUri?: { uri: string; mimeType: string } | null;
  manufacturerLogoUrl?: string | null;
  manufacturerLogoBase64?: string | null;
  manufacturerLogoFileUri?: { uri: string; mimeType: string } | null;

  /**
   * OpenAI Files API references (purpose=vision). Only used by OpenAI/Responses
   * tiers (Sunburst). Gemini flows ignore these fields completely.
   */
  mainImageOpenAIFile?: OpenAIFileRef | null;
  additionalOpenAIFiles?: OpenAIFileRef[];
  additionalOpenAIFileRoles?: string[];
  wheelReferenceOpenAIFile?: OpenAIFileRef | null;
  customShowroomOpenAIFile?: OpenAIFileRef | null;
  customPlateOpenAIFile?: OpenAIFileRef | null;
  manufacturerLogoOpenAIFile?: OpenAIFileRef | null;
  dealerLogoOpenAIFile?: OpenAIFileRef | null;
}

/**
 * file-id-first guard: strips base64 for every asset that already has an OpenAI
 * file id, so the same image is never transferred twice. Exported for tests.
 */
export function stripRedundantBase64(body: RemasterInvokePayload): RemasterInvokePayload {
  const out = { ...body };
  if (out.mainImageOpenAIFile?.fileId) out.imageBase64 = null;
  if (out.customShowroomOpenAIFile?.fileId) out.customShowroomBase64 = null;
  if (out.customPlateOpenAIFile?.fileId) out.customPlateImageBase64 = null;
  if (out.manufacturerLogoOpenAIFile?.fileId) { out.manufacturerLogoBase64 = null; out.manufacturerLogoUrl = null; }
  if (out.dealerLogoOpenAIFile?.fileId) { out.dealerLogoBase64 = null; out.dealerLogoUrl = null; }
  if (out.wheelReferenceOpenAIFile?.fileId) out.wheelReferenceBase64 = null;
  // Additional/supporting references are NOT touched here: PipelineContext filters
  // them identity- and position-aware, so `additionalImages` only ever contains the
  // assets whose OpenAI upload failed. This generic guard must not guess by length —
  // a mixed case (3 file ids + 1 base64 fallback) is valid and must survive.
  return out;
}

export async function invokeRemasterVehicleImage(rawBody: RemasterInvokePayload) {
  const body = stripRedundantBase64(rawBody);
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
