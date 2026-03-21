// cleanup-orphaned-storage: Removes storage files not referenced in any DB table
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/auth.ts";

const DRY_RUN = true; // Set to false when ready to actually delete

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run ?? DRY_RUN;
    const adminSupabase = createAdminClient();

    // 1. Collect all referenced URLs from database
    const referencedUrls = new Set<string>();

    // project_images.image_url
    const { data: imgUrls } = await adminSupabase
      .from("project_images")
      .select("image_url")
      .not("image_url", "is", null);
    imgUrls?.forEach((r) => r.image_url && referencedUrls.add(r.image_url));

    // projects.main_image_url
    const { data: projUrls } = await adminSupabase
      .from("projects")
      .select("main_image_url")
      .not("main_image_url", "is", null);
    projUrls?.forEach((r) => r.main_image_url && referencedUrls.add(r.main_image_url));

    // profiles.logo_url
    const { data: logoUrls } = await adminSupabase
      .from("profiles")
      .select("logo_url")
      .not("logo_url", "is", null);
    logoUrls?.forEach((r) => r.logo_url && referencedUrls.add(r.logo_url));

    // spin360 images
    const { data: spinSrc } = await adminSupabase
      .from("spin360_source_images")
      .select("image_url");
    spinSrc?.forEach((r) => referencedUrls.add(r.image_url));

    const { data: spinGen } = await adminSupabase
      .from("spin360_generated_frames")
      .select("image_url");
    spinGen?.forEach((r) => referencedUrls.add(r.image_url));

    const { data: spinCan } = await adminSupabase
      .from("spin360_canonical_images")
      .select("image_url");
    spinCan?.forEach((r) => referencedUrls.add(r.image_url));

    console.log(`Referenced URLs in DB: ${referencedUrls.size}`);

    // 2. List all files in vehicle-images bucket
    const orphanPaths: string[] = [];
    const bucketName = "vehicle-images";

    // List top-level folders (user IDs)
    const { data: topLevel } = await adminSupabase.storage
      .from(bucketName)
      .list("", { limit: 1000 });

    for (const folder of topLevel || []) {
      if (folder.id) continue; // it's a file at root level, skip
      const userId = folder.name;

      // List sub-folders
      const { data: subItems } = await adminSupabase.storage
        .from(bucketName)
        .list(userId, { limit: 1000 });

      for (const sub of subItems || []) {
        const subPath = `${userId}/${sub.name}`;
        if (sub.id) {
          // It's a file
          const { data: urlData } = adminSupabase.storage
            .from(bucketName)
            .getPublicUrl(subPath);
          const baseUrl = urlData.publicUrl.split("?")[0];
          if (!referencedUrls.has(baseUrl)) {
            orphanPaths.push(subPath);
          }
        } else {
          // It's a sub-folder, list its contents
          const { data: files } = await adminSupabase.storage
            .from(bucketName)
            .list(subPath, { limit: 1000 });

          for (const file of files || []) {
            if (!file.id) continue;
            const filePath = `${subPath}/${file.name}`;
            const { data: urlData } = adminSupabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);
            const baseUrl = urlData.publicUrl.split("?")[0];
            if (!referencedUrls.has(baseUrl)) {
              orphanPaths.push(filePath);
            }
          }
        }
      }
    }

    console.log(`Orphaned files found: ${orphanPaths.length}`);

    let deleted = 0;
    if (!dryRun && orphanPaths.length > 0) {
      // Delete in batches of 100
      for (let i = 0; i < orphanPaths.length; i += 100) {
        const batch = orphanPaths.slice(i, i + 100);
        const { error } = await adminSupabase.storage
          .from(bucketName)
          .remove(batch);
        if (error) {
          console.error(`Batch delete error:`, error.message);
        } else {
          deleted += batch.length;
        }
      }
    }

    return jsonResponse({
      dry_run: dryRun,
      referenced_urls: referencedUrls.size,
      orphaned_files: orphanPaths.length,
      deleted,
      sample_orphans: orphanPaths.slice(0, 10),
      message: dryRun
        ? `Trockenlauf: ${orphanPaths.length} verwaiste Dateien gefunden.`
        : `${deleted} verwaiste Dateien gelöscht.`,
    });
  } catch (e) {
    console.error("cleanup-orphaned-storage error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error");
  }
});
