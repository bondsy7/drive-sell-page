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