// migrate-base64-images: Cron-compatible batch migration of base64 → Storage URLs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/auth.ts";

const BATCH_SIZE = 10;

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const adminSupabase = createAdminClient();

    // Find images with base64 data but no storage URL (across all users)
    const { data: images, error } = await adminSupabase
      .from("project_images")
      .select("id, project_id, image_base64, user_id")
      .is("image_url", null)
      .not("image_base64", "eq", "")
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!images || images.length === 0) {
      console.log("migrate-base64-images: No images to migrate.");
      return jsonResponse({ migrated: 0, remaining: 0, message: "Keine Base64-Bilder zum Migrieren." });
    }

    let migrated = 0;
    let failed = 0;

    for (const img of images) {
      try {
        let base64Data = img.image_base64;
        let mimeType = "image/png";
        if (base64Data.startsWith("data:")) {
          const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }
        }

        // Chunked base64 decode to avoid stack overflow on large images
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const binaryData = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          binaryData[i] = binaryString.charCodeAt(i);
        }

        const ext = mimeType.includes("webp") ? "webp" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
        const storagePath = `${img.user_id}/${img.project_id || "standalone"}/${img.id}.${ext}`;

        const { error: uploadError } = await adminSupabase.storage
          .from("vehicle-images")
          .upload(storagePath, binaryData, { contentType: mimeType, upsert: true });

        if (uploadError) {
          console.error(`Upload failed for ${img.id}:`, uploadError.message);
          failed++;
          continue;
        }

        const { data: urlData } = adminSupabase.storage
          .from("vehicle-images")
          .getPublicUrl(storagePath);

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
      .is("image_url", null)
      .not("image_base64", "eq", "");

    const remaining = count ?? 0;
    console.log(`migrate-base64-images: ${migrated} migrated, ${failed} failed, ${remaining} remaining.`);

    return jsonResponse({ migrated, failed, remaining, message: `${migrated} migriert, ${failed} fehlgeschlagen, ${remaining} verbleibend.` });
  } catch (e) {
    console.error("migrate-base64-images error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
