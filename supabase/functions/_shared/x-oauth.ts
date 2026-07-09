// X.com (Twitter) OAuth 1.0a User Context helper.
// Uses app-level env vars: X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.
// - Text tweets & tweets with media_ids: POST https://api.x.com/2/tweets
// - Media upload (image): POST https://upload.twitter.com/1.1/media/upload.json (multipart)
// - Media upload (video): chunked INIT / APPEND / FINALIZE / STATUS on same endpoint
//
// The Bearer Token is intentionally NOT used for posting (app-only Bearer tokens
// cannot post on behalf of a user; that would produce 401 Unauthorized).

const API_BASE = "https://api.x.com/2";
const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const VERIFY_URL = "https://api.x.com/1.1/account/verify_credentials.json";
const STATUS_UPDATE_URL = "https://api.x.com/1.1/statuses/update.json";

export interface XCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

type XFailure = { ok: false; error: string; status?: number; stage?: string };

export function loadXCreds(): XCreds | null {
  const apiKey = Deno.env.get("X_API_KEY");
  const apiSecret = Deno.env.get("X_API_KEY_SECRET");
  const accessToken = Deno.env.get("X_ACCESS_TOKEN");
  const accessTokenSecret = Deno.env.get("X_ACCESS_TOKEN_SECRET");
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

// RFC 3986 percent-encoding
function pctEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

async function hmacSha1Base64(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Build OAuth 1.0a Authorization header.
 * `signatureParams` should include any query-string params AND form-urlencoded body params.
 * For multipart/form-data or JSON bodies, pass an empty object — body content is NOT signed.
 */
async function buildAuthHeader(
  method: string,
  url: string,
  signatureParams: Record<string, string>,
  creds: XCreds,
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  // Combine oauth params + request params (query + form body), sort, encode
  const allParams: Record<string, string> = { ...signatureParams, ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(allParams[k])}`)
    .join("&");

  // Base URL = scheme + host + path (no query)
  const u = new URL(url);
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;

  const signatureBase = [
    method.toUpperCase(),
    pctEncode(baseUrl),
    pctEncode(paramString),
  ].join("&");

  const signingKey = `${pctEncode(creds.apiSecret)}&${pctEncode(creds.accessTokenSecret)}`;
  const signature = await hmacSha1Base64(signingKey, signatureBase);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerString = "OAuth " + Object.keys(headerParams)
    .sort()
    .map((k) => `${pctEncode(k)}="${pctEncode(headerParams[k])}"`)
    .join(", ");

  return headerString;
}

// ────────────────────────────────────────────────────────────
// Credentials test
// ────────────────────────────────────────────────────────────
export async function verifyCredentials(
  creds: XCreds,
): Promise<{ ok: true; screenName?: string; userId?: string } | XFailure> {
  const url = `${VERIFY_URL}?skip_status=true&include_entities=false`;
  const auth = await buildAuthHeader("GET", url, {
    skip_status: "true",
    include_entities: "false",
  }, creds);
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, stage: "verify_credentials", error: humanizeXError(res.status, body, "verify_credentials") };
  }
  const j: any = await res.json().catch(() => ({}));
  return { ok: true, screenName: j.screen_name, userId: j.id_str };
}

// ────────────────────────────────────────────────────────────
// Image upload (single request)
// ────────────────────────────────────────────────────────────
export async function uploadImage(
  creds: XCreds,
  imageUrl: string,
): Promise<{ ok: true; mediaId: string } | XFailure> {
  const fetched = await fetchMedia(imageUrl);
  if (!fetched.ok) return { ok: false, error: fetched.error };

  // multipart body is NOT signed; signatureParams stays empty
  const auth = await buildAuthHeader("POST", UPLOAD_URL, {}, creds);
  const form = new FormData();
  form.append("media", new Blob([fetched.bytes], { type: fetched.mime }));

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: auth },
    body: form,
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.media_id_string) {
    return { ok: false, status: res.status, stage: "media_upload_image", error: humanizeXError(res.status, JSON.stringify(j), "media_upload_image") };
  }
  return { ok: true, mediaId: j.media_id_string };
}

// ────────────────────────────────────────────────────────────
// Video upload (chunked INIT/APPEND/FINALIZE/STATUS)
// ────────────────────────────────────────────────────────────
export async function uploadVideo(
  creds: XCreds,
  videoUrl: string,
): Promise<{ ok: true; mediaId: string } | XFailure> {
  const fetched = await fetchMedia(videoUrl, 512 * 1024 * 1024);
  if (!fetched.ok) return { ok: false, error: fetched.error };
  const bytes = fetched.bytes;
  const mime = fetched.mime.startsWith("video/") ? fetched.mime : "video/mp4";
  const totalBytes = bytes.length;

  // INIT — signed form-urlencoded
  const initParams: Record<string, string> = {
    command: "INIT",
    total_bytes: String(totalBytes),
    media_type: mime,
    media_category: "tweet_video",
  };
  const initAuth = await buildAuthHeader("POST", UPLOAD_URL, initParams, creds);
  const initRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: initAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(initParams).toString(),
  });
  const initJson: any = await initRes.json().catch(() => ({}));
  if (!initRes.ok || !initJson.media_id_string) {
    return { ok: false, status: initRes.status, stage: "media_upload_video_init", error: humanizeXError(initRes.status, JSON.stringify(initJson), "media_upload_video_init") };
  }
  const mediaId = initJson.media_id_string as string;

  // APPEND — multipart, one chunk at a time (~4 MB per chunk)
  const CHUNK = 4 * 1024 * 1024;
  let segmentIndex = 0;
  for (let off = 0; off < totalBytes; off += CHUNK) {
    const chunk = bytes.subarray(off, Math.min(off + CHUNK, totalBytes));
    // For multipart, signature params are the URL query params only (none here);
    // Twitter docs: form fields for APPEND are NOT part of the signature.
    const auth = await buildAuthHeader("POST", UPLOAD_URL, {}, creds);
    const form = new FormData();
    form.append("command", "APPEND");
    form.append("media_id", mediaId);
    form.append("segment_index", String(segmentIndex));
    form.append("media", new Blob([chunk], { type: "application/octet-stream" }));
    const appendRes = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: auth },
      body: form,
    });
    if (!appendRes.ok) {
      const body = await appendRes.text().catch(() => "");
      return { ok: false, status: appendRes.status, stage: "media_upload_video_append", error: humanizeXError(appendRes.status, body, "media_upload_video_append") };
    }
    // 2xx returns empty body on APPEND — nothing to parse
    await appendRes.text().catch(() => "");
    segmentIndex++;
  }

  // FINALIZE — signed form-urlencoded
  const finParams: Record<string, string> = { command: "FINALIZE", media_id: mediaId };
  const finAuth = await buildAuthHeader("POST", UPLOAD_URL, finParams, creds);
  const finRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: finAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(finParams).toString(),
  });
  const finJson: any = await finRes.json().catch(() => ({}));
  if (!finRes.ok) {
    return { ok: false, status: finRes.status, stage: "media_upload_video_finalize", error: humanizeXError(finRes.status, JSON.stringify(finJson), "media_upload_video_finalize") };
  }

  // STATUS — poll if async processing required
  if (finJson?.processing_info) {
    const ok = await pollVideoStatus(creds, mediaId, finJson.processing_info);
    if (!ok.ok) return ok;
  }

  return { ok: true, mediaId };
}

async function pollVideoStatus(
  creds: XCreds,
  mediaId: string,
  initialInfo: any,
): Promise<{ ok: true } | XFailure> {
  let info = initialInfo;
  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    const state = info?.state;
    if (state === "succeeded") return { ok: true };
    if (state === "failed") {
      const err = info?.error;
      return { ok: false, error: err?.message || err?.name || "Video-Verarbeitung fehlgeschlagen" };
    }
    const wait = Math.max(1, Number(info?.check_after_secs ?? 3)) * 1000;
    await new Promise((r) => setTimeout(r, wait));

    const params: Record<string, string> = { command: "STATUS", media_id: mediaId };
    const url = `${UPLOAD_URL}?${new URLSearchParams(params).toString()}`;
    const auth = await buildAuthHeader("GET", url, params, creds);
    const res = await fetch(url, { headers: { Authorization: auth } });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, stage: "media_upload_video_status", error: humanizeXError(res.status, JSON.stringify(j), "media_upload_video_status") };
    info = j?.processing_info ?? { state: "succeeded" };
  }
  return { ok: false, error: "Timeout: X.com Video-Verarbeitung dauerte zu lange" };
}

// ────────────────────────────────────────────────────────────
// Post tweet (X API v2)
// ────────────────────────────────────────────────────────────
export async function postTweet(
  creds: XCreds,
  text: string,
  mediaIds: string[] = [],
): Promise<{ ok: true; postId: string; url: string } | XFailure> {
  const url = `${API_BASE}/tweets`;
  // JSON body — not signed. Only oauth_* params contribute to signature.
  const auth = await buildAuthHeader("POST", url, {}, creds);
  const body: any = { text };
  if (mediaIds.length > 0) body.media = { media_ids: mediaIds };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j?.data?.id) {
    const v2ErrorBody = JSON.stringify(j);
    console.warn(`[x-oauth] stage=create_tweet_v2 status=${res.status} body=${sanitizeForLog(v2ErrorBody)}`);

    // Some X app/API combinations still accept OAuth 1.0a credentials for media
    // upload and credential verification, but reject POST /2/tweets with 403.
    // In that case, fall back to the classic OAuth 1.0a status endpoint using
    // the same already-uploaded media_ids.
    if (res.status === 403 || res.status === 401) {
      const fallback = await postStatusV1(creds, text, mediaIds);
      if (fallback.ok) return fallback;
      return {
        ...fallback,
        error: `${fallback.error} Vorheriger /2/tweets Fehler: ${humanizeXError(res.status, v2ErrorBody, "create_tweet")}`,
      };
    }

    return { ok: false, status: res.status, stage: "create_tweet", error: humanizeXError(res.status, v2ErrorBody, "create_tweet") };
  }
  const postId = j.data.id as string;
  return { ok: true, postId, url: `https://x.com/i/web/status/${postId}` };
}

async function postStatusV1(
  creds: XCreds,
  text: string,
  mediaIds: string[] = [],
): Promise<{ ok: true; postId: string; url: string } | XFailure> {
  const params: Record<string, string> = { status: text };
  if (mediaIds.length > 0) params.media_ids = mediaIds.join(",");

  const auth = await buildAuthHeader("POST", STATUS_UPDATE_URL, params, creds);
  const res = await fetch(STATUS_UPDATE_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const raw = await res.text().catch(() => "");
  let j: any = {};
  try { j = raw ? JSON.parse(raw) : {}; } catch { /* non-json */ }

  if (!res.ok || !j?.id_str) {
    console.warn(`[x-oauth] stage=create_tweet_v1_fallback status=${res.status} body=${sanitizeForLog(raw)}`);
    return { ok: false, status: res.status, stage: "create_tweet_v1_fallback", error: humanizeXError(res.status, raw || JSON.stringify(j), "create_tweet_v1_fallback") };
  }

  const postId = j.id_str as string;
  return { ok: true, postId, url: `https://x.com/i/web/status/${postId}` };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
async function fetchMedia(
  url: string,
  maxBytes = 32 * 1024 * 1024,
): Promise<{ ok: true; bytes: Uint8Array; mime: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `Medium konnte nicht geladen werden (HTTP ${res.status})` };
    const mime = res.headers.get("content-type") || "application/octet-stream";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      return { ok: false, error: `Datei zu groß für X.com (${(buf.length / 1024 / 1024).toFixed(1)} MB)` };
    }
    return { ok: true, bytes: buf, mime };
  } catch (e) {
    return { ok: false, error: `Medium konnte nicht geladen werden: ${(e as Error).message}` };
  }
}

function humanizeXError(status: number, body: string, stage?: string): string {
  // Never surface raw tokens or full auth headers. body may contain provider messages.
  const safe = body.slice(0, 400);
  const providerMessage = extractProviderMessage(safe);
  if (status === 401) return `X.com Authentifizierung fehlgeschlagen (401).${providerMessage ? ` ${providerMessage}` : " Bitte X_API_KEY / X_ACCESS_TOKEN prüfen — Bearer Token darf für Posts nicht verwendet werden."}`;
  if (status === 403) {
    if (/duplicate/i.test(safe)) return "X.com hat den Post als Duplikat abgelehnt (403).";
    if (/453/.test(safe) || /subset of (X API )?v2 endpoints/i.test(safe)) return "X.com API-Zugang verweigert (403/453). Dein Developer-Account hat aktuell nur Zugriff auf einen Teil der X-Endpoints; bitte im X Developer Portal API-Plan/Projektzugriff für Post-Erstellung prüfen.";
    if (/unsupported authentication/i.test(safe)) return "X.com lehnt die Authentifizierungsart für diesen Endpoint ab (403). Der OAuth‑1.0a-Fallback wurde versucht; falls es weiter fehlschlägt, benötigt die App OAuth 2.0 User Context mit tweet.write/media.write.";
    if (/write/i.test(safe) || /permission/i.test(safe)) return 'X.com App hat keine Schreibrechte (403). Im Developer Portal auf „Read and Write" umstellen und Access Token neu erzeugen.';
    if (stage?.startsWith("media_upload")) {
      return "X.com Media-Upload verweigert (403). Der Account-Token ist gültig, aber X blockiert den Bild/Video-Upload für diese App bzw. diesen API-Zugang. Prüfe im X Developer Portal zusätzlich den API-Plan/Produktzugriff für Media Upload; reine Textposts können trotzdem funktionieren.";
    }
    if (stage === "create_tweet") {
      return `X.com Tweet-Erstellung verweigert (403). Token ist gültig, aber X erlaubt dieser App aktuell kein Schreiben über /2/tweets oder hat den Inhalt blockiert.${providerMessage ? ` ${providerMessage}` : ""}`;
    }
    return `X.com Zugriff verweigert (403). Token ist gültig, aber X blockiert diese Aktion für App/API-Zugang oder Inhalt.${providerMessage ? ` ${providerMessage}` : ""}`;
  }
  if (status === 429) return "X.com Rate Limit erreicht (429). Bitte später erneut versuchen.";
  if (status === 413) return "X.com: Datei zu groß.";
  if (status >= 500) return `X.com Server-Fehler (${status}).`;
  try {
    const j = JSON.parse(safe);
    const msg = j?.detail || j?.title || j?.errors?.[0]?.message || j?.errors?.[0]?.detail || j?.error || j?.errors?.[0]?.code;
    if (msg) return `X.com: ${String(msg).slice(0, 200)}`;
  } catch { /* not json */ }
  return `X.com Fehler (${status}).`;
}

function extractProviderMessage(body: string): string | null {
  try {
    const j = JSON.parse(body);
    const err = Array.isArray(j?.errors) ? j.errors[0] : null;
    const msg = j?.detail || err?.detail || err?.message || j?.title || j?.error || j?.message;
    return msg ? `X meldet: ${String(msg).slice(0, 220)}` : null;
  } catch {
    return body && !/[A-Za-z0-9_-]{24,}/.test(body) ? `X meldet: ${body.slice(0, 220)}` : null;
  }
}

function sanitizeForLog(body: string): string {
  return body
    .slice(0, 700)
    .replace(/oauth_[a-z_]+="[^"]+"/gi, '$&'.replace(/"[^"]+"/, '"[redacted]"'))
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
}
