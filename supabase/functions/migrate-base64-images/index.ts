// migrate-base64-images: Moves base64 image data from project_images to Storage URLs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest, createAdminClient } from "../_shared/auth.ts";

const BATCH_SIZE = 10;

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user } = await authenticateRequest(req);
    const adminSupabase = createAdminClient();

    // Find images with base64 data but no storage URL
    const { data: images, error } = await adminSupabase
      .from("project_images")
      .select("id, project_id, image_base64, user_id")
      .eq("user_id", user.id)
      .is("image_url", null)
      .not("image_base64", "eq", "")
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!images || images.length === 0) {
      return jsonResponse({ migrated: 0, message: "Keine Base64-Bilder zum Migrieren gefunden." });
    }

    let migrated = 0;
    let failed = 0;

    for (const img of images) {
      try {
        // Decode base64
        let base64Data = img.image_base64;
        let mimeType = "image/png";
        if (base64Data.startsWith("data:")) {
          const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }
        }

        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const ext = mimeType.includes("webp") ? "webp" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
        const storagePath = `${img.user_id}/${img.project_id || "standalone"}/${img.id}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await adminSupabase.storage
          .from("vehicle-images")
          .upload(storagePath, binaryData, { contentType: mimeType, upsert: true });

        if (uploadError) {
          console.error(`Upload failed for ${img.id}:`, uploadError.message);
          failed++;
          continue;
        }

        // Get public URL
        const { data: urlData } = adminSupabase.storage
          .from("vehicle-images")
          .getPublicUrl(storagePath);

        // Update record with URL (keep base64 for now as fallback)
        const { error: updateError } = await adminSupabase
          .from("project_images")
          .update({ image_url: urlData.publicUrl })
          .eq("id", img.id);

        if (updateError) {
          console.error(`Update failed for ${img.id}:`, updateError.message);
          failed++;
          continue;
        }

        migrated++;
      } catch (e) {
        console.error(`Migration error for ${img.id}:`, e);
        failed++;
      }
    }

    // Count remaining
    const { count } = await adminSupabase
      .from("project_images")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("image_url", null)
      .not("image_base64", "eq", "");

    return jsonResponse({
      migrated,
      failed,
      remaining: (count ?? 0) - migrated,
      message: `${migrated} Bilder migriert, ${failed} fehlgeschlagen.`,
    });
  } catch (e) {
    console.error("migrate-base64-images error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
