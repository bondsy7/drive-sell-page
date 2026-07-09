// Publishes a banner image to Auto3 (dev-api.autoversus.de / api.auto3.de)
// - Auth: user JWT (getClaims), owner-only
// - Loads dealer's auto3_account_email from profiles
// - Downloads banner file from Supabase Storage and posts multipart to Auto3
// - Persists result in banner_publications (idempotent via client_reference_id)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const AUTO3_BASE = Deno.env.get("AUTO3_API_BASE_URL") || "https://dev-api.autoversus.de";
const AUTO3_KEY = Deno.env.get("PDF_ANZEIGE_AUTO3_API_KEY") || "";

interface Body {
  bannerPath: string;              // storage path in 'banners' bucket (e.g. "<uid>/xyz.webp")
  bannerUrl?: string;              // public URL for logging
  caption?: string;
  channels?: string[];             // override profile default
  title?: string;
  position?: number;
  ctaUrl?: string;
  active?: boolean;
  targetEmailOverride?: string;    // optional escape hatch
}

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    if (!AUTO3_KEY) return errorResponse("Auto3 API key not configured on server", 500);

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return errorResponse("Unauthorized", 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: claimsData, error: claimsErr } = await sb.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return errorResponse("Unauthorized", 401);
    const userId = claimsData.claims.sub as string;

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body?.bannerPath) return errorResponse("bannerPath is required", 400);

    // Load profile config
    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("auto3_account_email, auto3_channels_default, auto3_default_caption, auto3_default_cta_url")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) return errorResponse(profileErr.message, 500);

    const targetEmail = (body.targetEmailOverride?.trim() || profile?.auto3_account_email?.trim() || "");
    if (!targetEmail) {
      return errorResponse("Auto3-Konto nicht konfiguriert. Bitte im Profil die Auto3-Login-E-Mail hinterlegen.", 400);
    }

    const channels: string[] = (body.channels?.length ? body.channels : profile?.auto3_channels_default) || [
      "website", "instagram", "facebook",
    ];
    const caption = (body.caption ?? profile?.auto3_default_caption ?? "").toString();
    const ctaUrl = body.ctaUrl ?? profile?.auto3_default_cta_url ?? undefined;

    // Owner-check: bannerPath must start with "<userId>/"
    if (!body.bannerPath.startsWith(`${userId}/`)) {
      return errorResponse("Forbidden: banner does not belong to user", 403);
    }

    // Download banner bytes from storage
    const { data: fileBlob, error: dlErr } = await sb.storage.from("banners").download(body.bannerPath);
    if (dlErr || !fileBlob) return errorResponse(`Banner konnte nicht geladen werden: ${dlErr?.message || "not found"}`, 404);

    // Generate stable client_reference_id per (user, banner)
    const clientReferenceId = `pdf-${userId.slice(0, 8)}-${body.bannerPath.replace(/[^a-zA-Z0-9-_]/g, "_").slice(-40)}-${Date.now()}`;

    // Persist pending row
    const { data: pubRow, error: insErr } = await sb
      .from("banner_publications")
      .insert({
        user_id: userId,
        banner_path: body.bannerPath,
        banner_url: body.bannerUrl || null,
        target_email: targetEmail,
        client_reference_id: clientReferenceId,
        channels,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr) return errorResponse(insErr.message, 500);

    // Build multipart form
    const form = new FormData();
    form.append("account_email", targetEmail);
    form.append("client_reference_id", clientReferenceId);
    if (caption) form.append("caption", caption);
    form.append("channels", channels.join(","));
    if (body.title) form.append("title", body.title);
    if (typeof body.position === "number") form.append("position", String(body.position));
    if (ctaUrl) form.append("cta_url", ctaUrl);
    if (typeof body.active === "boolean") form.append("active", String(body.active));

    const filename = body.bannerPath.split("/").pop() || "banner.png";
    form.append("file", fileBlob, filename);

    // Call Auto3
    const auto3Res = await fetch(`${AUTO3_BASE}/v1/vehicle/social/post`, {
      method: "POST",
      headers: {
        "X-Auto3-Api-Key": AUTO3_KEY,
      },
      body: form,
    });

    const contentType = auto3Res.headers.get("content-type") || "";
    const responseData = contentType.includes("application/json")
      ? await auto3Res.json().catch(() => ({}))
      : { raw: await auto3Res.text().catch(() => "") };

    let overallStatus: string = "failed";
    if (auto3Res.status === 201) {
      overallStatus = (responseData?.status as string) || "success";
    } else if (auto3Res.status === 409) {
      overallStatus = "duplicate";
    } else {
      overallStatus = "failed";
    }

    const errorMsg = auto3Res.ok
      ? null
      : (responseData?.message || responseData?.error || `HTTP ${auto3Res.status}`);

    await sb
      .from("banner_publications")
      .update({
        status: overallStatus,
        response: responseData,
        error: errorMsg,
      })
      .eq("id", pubRow.id);

    return jsonResponse({
      ok: auto3Res.ok || auto3Res.status === 409,
      httpStatus: auto3Res.status,
      status: overallStatus,
      publicationId: pubRow.id,
      clientReferenceId,
      channels,
      auto3: responseData,
    }, auto3Res.ok || auto3Res.status === 409 ? 200 : 502);
  } catch (e) {
    console.error("[publish-banner-to-auto3] error", e);
    return errorResponse((e as Error).message || "Unknown error", 500);
  }
});
