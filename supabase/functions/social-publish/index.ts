// Publishes a banner image to Instagram (Business) and/or a Facebook Page.
// Organic posting only. No paid ads. Structured to be extended later
// (carousels, reels, scheduled, boost, Marketing API campaigns).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getSecret } from "../_shared/get-secret.ts";

const GRAPH_VERSION = "v21.0";
const INSTAGRAM_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;
const FACEBOOK_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

type Platform = "instagram" | "facebook";

interface PublishPayload {
  bannerPath: string;      // storage path inside `banners` bucket
  bannerName?: string;
  imageUrl: string;        // public https url meta can fetch
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

    // ── Status check (no tokens exposed) ─────────────────────
    const rawBody = await req.text();
    const parsedBody = rawBody ? (() => { try { return JSON.parse(rawBody); } catch { return null; } })() : null;
    if (parsedBody && parsedBody.action === "status") {
      const [igTok, igId, fbId, fbTok] = await Promise.all([
        getSecret("META_ACCESS_TOKEN", admin),
        getSecret("META_IG_USER_ID", admin),
        getSecret("META_FACEBOOK_PAGE_ID", admin),
        getSecret("META_PAGE_ACCESS_TOKEN", admin),
      ]);
      return json({
        instagram: { configured: !!(igTok && igId) },
        facebook: { configured: !!(fbId && fbTok) },
      });
    }

    // ── Input ────────────────────────────────────────────────
    const body = parsedBody as PublishPayload | null;
    if (!body) return json({ error: "invalid_body" }, 400);

    const { bannerPath, bannerName, imageUrl, caption, platforms, vehicleId } = body;
    if (!bannerPath || !imageUrl || !Array.isArray(platforms) || platforms.length === 0) {
      return json({ error: "missing_fields" }, 400);
    }
    if (!/^https:\/\//i.test(imageUrl)) {
      return json({ error: "image_url_must_be_public_https" }, 400);
    }
    const validPlatforms: Platform[] = platforms.filter(
      (p) => p === "instagram" || p === "facebook",
    );
    if (validPlatforms.length === 0) return json({ error: "no_valid_platform" }, 400);

    // Ownership check: banner path must start with `${userId}/`
    if (!bannerPath.startsWith(`${userId}/`)) {
      return json({ error: "forbidden" }, 403);
    }

    // ── Secrets ──────────────────────────────────────────────
    const metaAccessToken = await getSecret("META_ACCESS_TOKEN", admin);
    const igUserId = await getSecret("META_IG_USER_ID", admin);
    const fbPageId = await getSecret("META_FACEBOOK_PAGE_ID", admin);
    const fbPageToken = await getSecret("META_PAGE_ACCESS_TOKEN", admin);

    const results: PlatformResult[] = [];

    // ── Instagram ────────────────────────────────────────────
    if (validPlatforms.includes("instagram")) {
      const res = await publishInstagram({
        igUserId,
        accessToken: metaAccessToken,
        imageUrl,
        caption,
      });
      results.push({ platform: "instagram", ...res });
      await logPublication(admin, {
        userId,
        vehicleId: vehicleId ?? null,
        bannerPath,
        bannerName: bannerName ?? null,
        bannerUrl: imageUrl,
        platform: "instagram",
        caption,
        result: res,
      });
    }

    // ── Facebook Page ────────────────────────────────────────
    if (validPlatforms.includes("facebook")) {
      const res = await publishFacebookPage({
        pageId: fbPageId,
        accessToken: fbPageToken,
        imageUrl,
        caption,
      });
      results.push({ platform: "facebook", ...res });
      await logPublication(admin, {
        userId,
        vehicleId: vehicleId ?? null,
        bannerPath,
        bannerName: bannerName ?? null,
        bannerUrl: imageUrl,
        platform: "facebook",
        caption,
        result: res,
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

async function waitForContainer(
  creationId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxAttempts = 8;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(
      `${INSTAGRAM_GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
    );
    const j = await res.json().catch(() => ({}));
    if (j.status_code === "FINISHED") return { ok: true };
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") {
      return { ok: false, error: humanizeMetaError(j, "Container-Status: " + j.status_code, "instagram") };
    }
  }
  return { ok: false, error: "Timeout: Instagram konnte das Bild nicht rechtzeitig laden" };
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
