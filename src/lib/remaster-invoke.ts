import { supabase } from '@/integrations/supabase/client';
import type { VehicleClassContext } from '@/config/vehicle-class-types';
import type { WheelAnalysis } from '@/types/wheel-reference';

export interface RemasterInvokePayload {
  imageBase64: string;
  vehicleDescription?: string;
  modelTier?: string;
  dynamicPrompt?: string;
  /**
   * Verbindlicher Fahrzeugklassen-Kontext. Fehlt er, behandelt die Edge Function
   * den Request als 'car' (Rückwärtskompatibilität für Altdaten).
   */
  classContext?: VehicleClassContext | null;
  additionalImages?: string[];
  /** Pre-uploaded Gemini File API URIs – used INSTEAD of additionalImages when available */
  additionalFileUris?: { uri: string; mimeType: string }[];
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
