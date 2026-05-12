import { supabase } from "@/integrations/supabase/client";

/**
 * Lädt ein eigenes CI-Logo (PNG/JPG/SVG/WebP) in den `logos`-Bucket unter
 * `{userId}/ci-{timestamp}.{ext}` und gibt die öffentliche URL zurück.
 *
 * Bucket `logos` ist public; RLS erlaubt nur den Upload in den eigenen Ordner.
 */
export async function uploadCustomCiLogo(
  file: File,
  userId: string,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/ci-${Date.now()}.${ext}`;
  const contentType =
    file.type ||
    (ext === "svg" ? "image/svg+xml"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "webp" ? "image/webp"
      : "image/png");

  const { error } = await supabase.storage
    .from("logos")
    .upload(path, file, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw error;

  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return data.publicUrl;
}
