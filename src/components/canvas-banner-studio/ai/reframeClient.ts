import { supabase } from "@/integrations/supabase/client";

const REFRAME_TIMEOUT_MS = 135_000;

function getReframeErrorMessage(error: unknown): string {
  const anyError = error as any;
  const raw = anyError?.context?.error ?? anyError?.message ?? anyError?.error ?? "Reframe fehlgeschlagen";

  if (typeof raw === "string" && (raw.includes("IDLE_TIMEOUT") || raw.includes("Request idle timeout"))) {
    return "Ideogram antwortet aktuell zu langsam. Bitte gleich nochmal versuchen oder den manuellen Crop nutzen.";
  }

  if (typeof raw === "object" && raw?.error) return String(raw.error);
  return String(raw);
}

export async function reframeImageForFormat(
  imageDataUrl: string,
  targetWidth: number,
  targetHeight: number,
): Promise<{ imageDataUrl: string; width: number; height: number; resolution: string }> {
  const invokePromise = supabase.functions.invoke("reframe-banner-image", {
    body: { imageDataUrl, targetWidth, targetHeight },
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(new Error("Ideogram antwortet aktuell zu langsam. Bitte gleich nochmal versuchen oder den manuellen Crop nutzen."));
    }, REFRAME_TIMEOUT_MS);
  });

  const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
  if (error) throw new Error(getReframeErrorMessage(error));
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as any;
}
