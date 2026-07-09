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

export interface XCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

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
): Promise<{ ok: true; screenName?: string; userId?: string } | { ok: false; error: string; status?: number }> {
  const url = `${VERIFY_URL}?skip_status=true&include_entities=false`;
  const auth = await buildAuthHeader("GET", url, {
    skip_status: "true",
    include_entities: "false",
  }, creds);
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: humanizeXError(res.status, body) };
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
): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
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
    return { ok: false, error: humanizeXError(res.status, JSON.stringify(j)) };
  }
  return { ok: true, mediaId: j.media_id_string };
}

// ────────────────────────────────────────────────────────────
// Video upload (chunked INIT/APPEND/FINALIZE/STATUS)
// ────────────────────────────────────────────────────────────
export async function uploadVideo(
  creds: XCreds,
  videoUrl: string,
): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
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
    return { ok: false, error: humanizeXError(initRes.status, JSON.stringify(initJson)) };
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
      return { ok: false, error: humanizeXError(appendRes.status, body) };
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
    return { ok: false, error: humanizeXError(finRes.status, JSON.stringify(finJson)) };
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
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    if (!res.ok) return { ok: false, error: humanizeXError(res.status, JSON.stringify(j)) };
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
): Promise<{ ok: true; postId: string; url: string } | { ok: false; error: string }> {
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
    return { ok: false, error: humanizeXError(res.status, JSON.stringify(j)) };
  }
  const postId = j.data.id as string;
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

function humanizeXError(status: number, body: string): string {
  // Never surface raw tokens or full auth headers. body may contain provider messages.
  const safe = body.slice(0, 400);
  if (status === 401) return "X.com Authentifizierung fehlgeschlagen (401). Bitte X_API_KEY / X_ACCESS_TOKEN prüfen — Bearer Token darf für Posts nicht verwendet werden.";
  if (status === 403) {
    if (/duplicate/i.test(safe)) return "X.com hat den Post als Duplikat abgelehnt (403).";
    if (/write/i.test(safe) || /permission/i.test(safe)) return 'X.com App hat keine Schreibrechte (403). Im Developer Portal auf „Read and Write" umstellen und Access Token neu erzeugen.';
    return "X.com Zugriff verweigert (403).";
  }
  if (status === 429) return "X.com Rate Limit erreicht (429). Bitte später erneut versuchen.";
  if (status === 413) return "X.com: Datei zu groß.";
  if (status >= 500) return `X.com Server-Fehler (${status}).`;
  try {
    const j = JSON.parse(safe);
    const msg = j?.detail || j?.title || j?.errors?.[0]?.message || j?.error;
    if (msg) return `X.com: ${String(msg).slice(0, 200)}`;
  } catch { /* not json */ }
  return `X.com Fehler (${status}).`;
}
