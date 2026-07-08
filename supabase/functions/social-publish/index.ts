// Publishes a banner image to Instagram (Business) and/or a Facebook Page.
// Organic posting only. No paid ads. Structured to be extended later
// (carousels, reels, scheduled, boost, Marketing API campaigns).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";


const IG_GRAPH_VERSION = "v21.0";
const FB_GRAPH_VERSION = "v25.0";
const INSTAGRAM_GRAPH = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;
const FACEBOOK_GRAPH = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

type Platform = "instagram" | "facebook";

type MediaType = "image" | "video";

interface PublishPayload {
  bannerPath?: string;      // legacy: storage path inside `banners` bucket
  mediaPath?: string;       // preferred: storage path (banners or vehicle-images)
  bannerName?: string;
  mediaName?: string;
  imageUrl?: string;        // legacy alias for mediaUrl (image)
  mediaUrl?: string;        // public https url meta can fetch (image or video)
  mediaType?: MediaType;    // defaults to "image"
  caption: string;
  platforms: Platform[];
  vehicleId?: string | null;
}


interface PlatformResult {
  platform: Platform;
  status: "success" | "failed";
  postId?: string;
  containerId?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: claimsData, error: claimsErr } = await admin.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsErr || !userId) return json({ error: "unauthorized" }, 401);

    // ── Load per-user credentials ────────────────────────────
    const { data: credRows } = await admin.rpc("get_social_credentials_for_user", { _user_id: userId });
    const cred = Array.isArray(credRows) ? credRows[0] : credRows;
    const igUserId: string | undefined = cred?.ig_user_id ?? undefined;
    const metaAccessToken: string | undefined = cred?.ig_access_token ?? undefined;
    const fbPageId: string | undefined = cred?.fb_page_id ?? undefined;
    const fbPageToken: string | undefined = cred?.fb_page_token ?? undefined;

    const igConfigured = !!(igUserId && metaAccessToken);
    const fbConfigured = !!(fbPageId && fbPageToken);

    // ── Status check (no tokens exposed) ─────────────────────
    const rawBody = await req.text();
    const parsedBody = rawBody ? (() => { try { return JSON.parse(rawBody); } catch { return null; } })() : null;
    if (parsedBody && parsedBody.action === "status") {
      return json({
        instagram: { configured: igConfigured, accountId: igUserId ?? null },
        facebook: { configured: fbConfigured, pageId: fbPageId ?? null },
      });
    }

    // ── Test connection ──────────────────────────────────────
    if (parsedBody && parsedBody.action === "test") {
      const platform = parsedBody.platform as Platform;
      if (platform === "instagram") {
        if (!igConfigured) return json({ ok: false, error: "Instagram nicht konfiguriert" });
        const v = await validateInstagramUser(igUserId!, metaAccessToken!);
        return json(v.ok ? { ok: true } : { ok: false, error: v.error });
      }
      if (platform === "facebook") {
        if (!fbConfigured) return json({ ok: false, error: "Facebook nicht konfiguriert" });
        const v = await validateFacebookPage(fbPageId!, fbPageToken!);
        return json(v.ok ? { ok: true, name: v.name } : { ok: false, error: v.error });
      }
      return json({ ok: false, error: "unknown_platform" }, 400);
    }

    // ── Input ────────────────────────────────────────────────
    const body = parsedBody as PublishPayload | null;
    if (!body) return json({ error: "invalid_body" }, 400);

    const mediaType: MediaType = body.mediaType === "video" ? "video" : "image";
    const mediaPath = body.mediaPath ?? body.bannerPath ?? "";
    const mediaName = body.mediaName ?? body.bannerName ?? null;
    const mediaUrl = body.mediaUrl ?? body.imageUrl ?? "";
    const { caption, platforms, vehicleId } = body;

    if (!mediaPath || !mediaUrl || !Array.isArray(platforms) || platforms.length === 0) {
      return json({ error: "missing_fields" }, 400);
    }
    if (!/^https:\/\//i.test(mediaUrl)) {
      return json({ error: "media_url_must_be_public_https" }, 400);
    }
    const validPlatforms: Platform[] = platforms.filter(
      (p) => p === "instagram" || p === "facebook",
    );
    if (validPlatforms.length === 0) return json({ error: "no_valid_platform" }, 400);

    // Ownership check: media path must start with `${userId}/`
    if (!mediaPath.startsWith(`${userId}/`)) {
      return json({ error: "forbidden" }, 403);
    }

    // Gate: refuse if user hasn't configured the requested platform
    if (validPlatforms.includes("instagram") && !igConfigured) {
      return json({ error: "instagram_not_configured" }, 400);
    }
    if (validPlatforms.includes("facebook") && !fbConfigured) {
      return json({ error: "facebook_not_configured" }, 400);
    }

    const results: PlatformResult[] = [];

    // ── Instagram ────────────────────────────────────────────
    if (validPlatforms.includes("instagram")) {
      const res = mediaType === "video"
        ? await publishInstagramVideo({ igUserId, accessToken: metaAccessToken, videoUrl: mediaUrl, caption })
        : await publishInstagram({ igUserId, accessToken: metaAccessToken, imageUrl: mediaUrl, caption });
      results.push({ platform: "instagram", ...res });
      await logPublication(admin, {
        userId, vehicleId: vehicleId ?? null,
        bannerPath: mediaPath, bannerName: mediaName, bannerUrl: mediaUrl,
        platform: "instagram", caption, result: res,
      });
    }

    // ── Facebook Page ────────────────────────────────────────
    if (validPlatforms.includes("facebook")) {
      const res = mediaType === "video"
        ? await publishFacebookVideo({ pageId: fbPageId, accessToken: fbPageToken, videoUrl: mediaUrl, caption })
        : await publishFacebookPage({ pageId: fbPageId, accessToken: fbPageToken, imageUrl: mediaUrl, caption });
      results.push({ platform: "facebook", ...res });
      await logPublication(admin, {
        userId, vehicleId: vehicleId ?? null,
        bannerPath: mediaPath, bannerName: mediaName, bannerUrl: mediaUrl,
        platform: "facebook", caption, result: res,
      });
    }

    const anySuccess = results.some((r) => r.status === "success");
    return json({ ok: anySuccess, results }, anySuccess ? 200 : 502);
  } catch (e) {
    console.error("social-publish error", e);
    return json({ error: "internal_error", detail: String((e as Error)?.message ?? e) }, 500);
  }
});


// ────────────────────────────────────────────────────────────
// Instagram Content Publishing
// ────────────────────────────────────────────────────────────
async function publishInstagram(opts: {
  igUserId?: string;
  accessToken?: string;
  imageUrl: string;
  caption: string;
}): Promise<Omit<PlatformResult, "platform">> {
  if (!opts.accessToken) return { status: "failed", error: "META_ACCESS_TOKEN nicht konfiguriert" };
  if (!opts.igUserId) return { status: "failed", error: "META_IG_USER_ID nicht konfiguriert" };

  // 1. Validate Instagram user against the Instagram API host. Tokens created
  // through "Instagram API → API setup with Instagram login" are not valid on
  // the Facebook/Page Graph host.
  const validation = await validateInstagramUser(opts.igUserId, opts.accessToken);
  if (!validation.ok) return { status: "failed", error: validation.error };

  // 2. Create media container
  const containerRes = await fetch(`${INSTAGRAM_GRAPH}/${opts.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      image_url: opts.imageUrl,
      caption: opts.caption,
      access_token: opts.accessToken,
    }),
  });
  const containerJson = await containerRes.json().catch(() => ({}));
  if (!containerRes.ok || !containerJson.id) {
    return {
      status: "failed",
      error: humanizeMetaError(containerJson, "Instagram Container fehlgeschlagen"),
    };
  }
  const creationId = containerJson.id as string;

  // Poll container status until FINISHED (Meta needs to fetch the image)
  const finished = await waitForContainer(creationId, opts.accessToken);
  if (!finished.ok) {
    return { status: "failed", containerId: creationId, error: finished.error };
  }

  // 3. Publish
  const publishRes = await fetch(`${INSTAGRAM_GRAPH}/${opts.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: opts.accessToken,
    }),
  });
  const publishJson = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok || !publishJson.id) {
    return {
      status: "failed",
      containerId: creationId,
      error: humanizeMetaError(publishJson, "Instagram Veröffentlichung fehlgeschlagen"),
    };
  }
  return { status: "success", postId: publishJson.id as string, containerId: creationId };
}

async function validateInstagramUser(
  igUserId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = new URL(`${INSTAGRAM_GRAPH}/${igUserId}`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.id) return { ok: true };

  return {
    ok: false,
    error: humanizeMetaError(
      j,
      "Instagram Token oder META_IG_USER_ID konnte nicht validiert werden",
      "instagram",
    ),
  };
}

async function validateFacebookPage(
  pageId: string,
  accessToken: string,
): Promise<{ ok: true; name?: string } | { ok: false; error: string }> {
  const url = new URL(`${FACEBOOK_GRAPH}/${pageId}`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.id) return { ok: true, name: j.name };
  return { ok: false, error: humanizeMetaError(j, "Facebook Page konnte nicht validiert werden") };
}

async function waitForContainer(
  creationId: string,
  accessToken: string,
  maxAttempts = 8,
  delayMs = 1500,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const res = await fetch(
      `${INSTAGRAM_GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
    );
    const j = await res.json().catch(() => ({}));
    if (j.status_code === "FINISHED") return { ok: true };
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") {
      return { ok: false, error: humanizeMetaError(j, "Container-Status: " + j.status_code, "instagram") };
    }
  }
  return { ok: false, error: "Timeout: Instagram konnte das Medium nicht rechtzeitig verarbeiten" };
}


// ────────────────────────────────────────────────────────────
// Facebook Page Photo
// ────────────────────────────────────────────────────────────
async function publishFacebookPage(opts: {
  pageId?: string;
  accessToken?: string;
  imageUrl: string;
  caption: string;
}): Promise<Omit<PlatformResult, "platform">> {
  if (!opts.accessToken) return { status: "failed", error: "META_PAGE_ACCESS_TOKEN nicht konfiguriert" };
  if (!opts.pageId) return { status: "failed", error: "META_FACEBOOK_PAGE_ID nicht konfiguriert" };

  const res = await fetch(`${FACEBOOK_GRAPH}/${opts.pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: opts.imageUrl,
      caption: opts.caption,
      published: true,
      access_token: opts.accessToken,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.id) {
    return {
      status: "failed",
      error: humanizeMetaError(j, "Facebook Veröffentlichung fehlgeschlagen"),
    };
  }
  return { status: "success", postId: (j.post_id as string) || (j.id as string) };
}

// ────────────────────────────────────────────────────────────
// Instagram Reel (Video)
// ────────────────────────────────────────────────────────────
async function publishInstagramVideo(opts: {
  igUserId?: string;
  accessToken?: string;
  videoUrl: string;
  caption: string;
}): Promise<Omit<PlatformResult, "platform">> {
  if (!opts.accessToken) return { status: "failed", error: "Instagram Access Token nicht konfiguriert" };
  if (!opts.igUserId) return { status: "failed", error: "Instagram User ID nicht konfiguriert" };

  const validation = await validateInstagramUser(opts.igUserId, opts.accessToken);
  if (!validation.ok) return { status: "failed", error: validation.error };

  // 1. Create Reels container
  const containerRes = await fetch(`${INSTAGRAM_GRAPH}/${opts.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "REELS",
      video_url: opts.videoUrl,
      caption: opts.caption,
      access_token: opts.accessToken,
    }),
  });
  const containerJson = await containerRes.json().catch(() => ({}));
  if (!containerRes.ok || !containerJson.id) {
    return { status: "failed", error: humanizeMetaError(containerJson, "Instagram Video-Container fehlgeschlagen", "instagram") };
  }
  const creationId = containerJson.id as string;

  // 2. Poll — videos need longer than photos
  const finished = await waitForContainer(creationId, opts.accessToken, 30, 3000);
  if (!finished.ok) return { status: "failed", containerId: creationId, error: finished.error };

  // 3. Publish
  const publishRes = await fetch(`${INSTAGRAM_GRAPH}/${opts.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: opts.accessToken }),
  });
  const publishJson = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok || !publishJson.id) {
    return { status: "failed", containerId: creationId, error: humanizeMetaError(publishJson, "Instagram Reel-Veröffentlichung fehlgeschlagen", "instagram") };
  }
  return { status: "success", postId: publishJson.id as string, containerId: creationId };
}

// ────────────────────────────────────────────────────────────
// Facebook Page Video
// ────────────────────────────────────────────────────────────
async function publishFacebookVideo(opts: {
  pageId?: string;
  accessToken?: string;
  videoUrl: string;
  caption: string;
}): Promise<Omit<PlatformResult, "platform">> {
  if (!opts.accessToken) return { status: "failed", error: "Facebook Page Access Token nicht konfiguriert" };
  if (!opts.pageId) return { status: "failed", error: "Facebook Page ID nicht konfiguriert" };

  const res = await fetch(`${FACEBOOK_GRAPH}/${opts.pageId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      file_url: opts.videoUrl,
      description: opts.caption,
      access_token: opts.accessToken,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.id) {
    return { status: "failed", error: humanizeMetaError(j, "Facebook Video-Veröffentlichung fehlgeschlagen") };
  }
  return { status: "success", postId: j.id as string };
}


// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function humanizeMetaError(payload: any, fallback: string, mode: Platform | "meta" = "meta"): string {
  const err = payload?.error;
  if (!err) return fallback;
  const code = err.code;
  const sub = err.error_subcode;
  const msg = err.message || err.error_user_msg || fallback;
  if (code === 190 && mode === "instagram") {
    return "Instagram Access Token ungültig, abgelaufen oder nicht für META_IG_USER_ID berechtigt. Bitte META_ACCESS_TOKEN und META_IG_USER_ID prüfen.";
  }
  if (code === 190) return "Meta Access Token ungültig oder abgelaufen. Bitte Token erneuern.";
  if (code === 200 || code === 10) return `Berechtigung fehlt: ${msg}`;
  if (code === 100 && /image/i.test(msg)) return `Bild nicht erreichbar oder ungültig: ${msg}`;
  return `${msg}${sub ? ` (subcode ${sub})` : ""}`;
}

async function logPublication(
  admin: any,
  args: {
    userId: string;
    vehicleId: string | null;
    bannerPath: string;
    bannerName: string | null;
    bannerUrl: string;
    platform: Platform;
    caption: string;
    result: Omit<PlatformResult, "platform">;
  },
) {
  try {
    await admin.from("social_publications").insert({
      user_id: args.userId,
      vehicle_id: args.vehicleId,
      banner_path: args.bannerPath,
      banner_name: args.bannerName,
      banner_url: args.bannerUrl,
      platform: args.platform,
      status: args.result.status,
      caption: args.caption,
      meta_post_id: args.result.postId ?? null,
      meta_container_id: args.result.containerId ?? null,
      error_message: args.result.error ?? null,
    });
  } catch (e) {
    console.error("logPublication failed", e);
  }
}
