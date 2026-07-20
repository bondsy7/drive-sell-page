import { supabase } from '@/integrations/supabase/client';

export type DetectedBrandingKind =
  | 'lettering'
  | 'logo'
  | 'sign'
  | 'sticker'
  | 'banner'
  | 'external-accessory';

export interface DetectedBrandingItem {
  kind: DetectedBrandingKind;
  location: string;
  text: string | null;
  color: string | null;
  size: 'small' | 'medium' | 'large' | null;
}

/**
 * Map cleanup option value -> valid DetectedBrandingKind.
 * The keys must stay in sync with `CLEANUP_OPTIONS[].value` in remaster-prompt.ts.
 */
const CLEANUP_TO_KIND: Record<string, DetectedBrandingKind> = {
  lettering: 'lettering',
  logos: 'logo',
  signs: 'sign',
  stickers: 'sticker',
  banners: 'banner',
  'external-accessories': 'external-accessory',
};

export function cleanupItemsToKinds(cleanupItems: string[]): DetectedBrandingKind[] {
  return cleanupItems
    .map((c) => CLEANUP_TO_KIND[c])
    .filter((k): k is DetectedBrandingKind => !!k);
}

/**
 * Ask the vision model to enumerate every non-OEM element visible on the vehicle.
 * Returns [] on any failure so the remaster pipeline continues without a branding inventory.
 */
export async function detectVehicleBranding(
  imageBase64: string,
  imageFileUri?: { uri: string; mimeType: string } | null,
): Promise<DetectedBrandingItem[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return [];

    const body: Record<string, unknown> = {};
    if (imageFileUri?.uri) body.imageFileUri = imageFileUri;
    else body.imageBase64 = imageBase64;

    const { data, error } = await supabase.functions.invoke('detect-vehicle-branding', {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      console.warn('[detectVehicleBranding] invoke error:', error.message);
      return [];
    }
    const items = (data as { items?: DetectedBrandingItem[] })?.items;
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.warn('[detectVehicleBranding] exception:', e);
    return [];
  }
}
