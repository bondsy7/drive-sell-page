import { supabase } from "@/integrations/supabase/client";

export async function reframeImageForFormat(
  imageDataUrl: string,
  targetWidth: number,
  targetHeight: number,
): Promise<{ imageDataUrl: string; width: number; height: number; resolution: string }> {
  const { data, error } = await supabase.functions.invoke("reframe-banner-image", {
    body: { imageDataUrl, targetWidth, targetHeight },
  });
  if (error) throw error;
  return data as any;
}
