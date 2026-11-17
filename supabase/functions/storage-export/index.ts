import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { authenticateRequest, createAdminClient } from "../_shared/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { constantTimeEqual, isExportSessionActive, normalizeEtag, normalizeSize } from "./security.ts";

const SESSION_LIFETIME_MS = 4 * 60 * 60 * 1000;
const SIGNED_URL_LIFETIME_SECONDS = 10 * 60;
const MAX_SIGN_BATCH = 25;

const fileSchema = z.object({
  bucket: z.string().min(1).max(255),
  path: z.string().min(1).max(4096),
});

const requestSchema = z.object({
  action: z.enum(["create_session", "list_buckets", "scan_page", "db_inventory_page", "sign", "revoke"]),
  exportId: z.string().uuid().optional(),
  exportSecret: z.string().min(32).max(128).optional(),
  bucket: z.string().min(1).max(255).optional(),
  prefix: z.string().max(4096).optional(),
  offset: z.number().int().min(0).max(100_000_000).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  files: z.array(fileSchema).min(1).max(MAX_SIGN_BATCH).optional(),
});

type ExportRequest = z.infer<typeof requestSchema>;
type AdminClient = Awaited<ReturnType<typeof authenticateRequest>>["adminSupabase"];

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requireAdmin(client: AdminClient, userId: string): Promise<void> {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("ADMIN_REQUIRED");
}

async function authorizeSession(adminSupabase: AdminClient, body: ExportRequest) {
  if (!body.exportId || !body.exportSecret) throw new Error("SESSION_INVALID");
  const { data: session, error } = await adminSupabase
    .from("storage_export_sessions")
    .select("id, admin_user_id, secret_hash, expires_at, revoked_at")
    .eq("id", body.exportId)
    .maybeSingle();
  if (error || !session || !isExportSessionActive(session)) throw new Error("SESSION_INVALID");
  const suppliedHash = await sha256Hex(body.exportSecret);
  if (!constantTimeEqual(suppliedHash, session.secret_hash)) throw new Error("SESSION_INVALID");
  await requireAdmin(adminSupabase, session.admin_user_id);
  await adminSupabase
    .from("storage_export_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", session.id);
  return session;
}

function requiredBucket(body: ExportRequest): string {
  if (!body.bucket) throw new Error("VALIDATION_ERROR");
  return body.bucket;
}

async function signFiles(adminSupabase: AdminClient, files: Array<{ bucket: string; path: string }>) {
  const expiresAt = new Date(Date.now() + SIGNED_URL_LIFETIME_SECONDS * 1000).toISOString();
  const signed: Array<{ bucket: string; path: string; url: string; expiresAt: string }> = [];
  for (let index = 0; index < files.length; index += 5) {
    const group = files.slice(index, index + 5);
    const results = await Promise.all(group.map(async (file) => {
      const { data, error } = await adminSupabase.storage
        .from(file.bucket)
        .createSignedUrl(file.path, SIGNED_URL_LIFETIME_SECONDS);
      if (error || !data?.signedUrl) throw new Error("SIGN_FAILED");
      return { ...file, url: data.signedUrl, expiresAt };
    }));
    signed.push(...results);
  }
  return signed;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return errorResponse("Methode nicht erlaubt.", 405);

  let event = "unknown";
  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse("Ungültige Exportanfrage.", 400);
    const body = parsed.data;
    event = body.action;

    if (body.action === "create_session") {
      const { user, adminSupabase } = await authenticateRequest(req);
      await requireAdmin(adminSupabase, user.id);
      const exportSecret = randomSecret();
      const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
      const { data: session, error } = await adminSupabase
        .from("storage_export_sessions")
        .insert({
          admin_user_id: user.id,
          secret_hash: await sha256Hex(exportSecret),
          expires_at: expiresAt,
        })
        .select("id, expires_at")
        .single();
      if (error || !session) throw new Error("SESSION_CREATE_FAILED");
      console.log(`[storage-export] event=session_created admin=${user.id}`);
      return jsonResponse({ exportId: session.id, exportSecret, expiresAt: session.expires_at });
    }

    const adminSupabase = createAdminClient();
    const session = await authorizeSession(adminSupabase, body);

    if (body.action === "revoke") {
      const { error } = await adminSupabase
        .from("storage_export_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", session.id)
        .is("revoked_at", null);
      if (error) throw new Error("REVOKE_FAILED");
      console.log(`[storage-export] event=session_revoked export=${session.id}`);
      return jsonResponse({ success: true });
    }

    if (body.action === "list_buckets") {
      const [{ data: apiBuckets, error: apiError }, { data: databaseBuckets, error: databaseError }] = await Promise.all([
        adminSupabase.storage.listBuckets(),
        adminSupabase.rpc("storage_export_db_buckets"),
      ]);
      if (apiError || databaseError) throw new Error("BUCKET_LIST_FAILED");
      return jsonResponse({
        buckets: (apiBuckets ?? []).map((bucket) => ({
          id: bucket.id,
          name: bucket.name,
          public: bucket.public,
          createdAt: bucket.created_at,
          updatedAt: bucket.updated_at,
        })).sort((a, b) => a.id.localeCompare(b.id)),
        databaseBuckets: databaseBuckets ?? [],
      });
    }

    if (body.action === "scan_page") {
      const bucket = requiredBucket(body);
      const prefix = body.prefix ?? "";
      const limit = body.limit ?? 1000;
      const offset = body.offset ?? 0;
      const { data, error } = await adminSupabase.storage.from(bucket).list(prefix, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error("SCAN_FAILED");
      const entries = (data ?? []).map((item) => ({
        name: item.name,
        path: prefix ? `${prefix}/${item.name}` : item.name,
        isFolder: item.id === null,
        id: item.id,
        size: normalizeSize(item.metadata?.size),
        mimetype: typeof item.metadata?.mimetype === "string" ? item.metadata.mimetype : null,
        etag: normalizeEtag(item.metadata?.eTag),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
      return jsonResponse({ entries, offset, limit, hasMore: entries.length === limit });
    }

    if (body.action === "db_inventory_page") {
      const bucket = requiredBucket(body);
      const { data, error } = await adminSupabase.rpc("storage_export_db_inventory", {
        _bucket_id: bucket,
        _offset: body.offset ?? 0,
        _limit: body.limit ?? 1000,
      });
      if (error) throw new Error("DB_INVENTORY_FAILED");
      return jsonResponse({ entries: data ?? [] });
    }

    if (body.action === "sign") {
      if (!body.files?.length) throw new Error("VALIDATION_ERROR");
      const signed = await signFiles(adminSupabase, body.files);
      console.log(`[storage-export] event=urls_signed export=${session.id} count=${signed.length}`);
      return jsonResponse({ signed });
    }

    return errorResponse("Ungültige Exportaktion.", 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    console.error(`[storage-export] event=${event} result=error code=${code}`);
    if (code === "Not authenticated") return errorResponse("Anmeldung erforderlich.", 401);
    if (code === "ADMIN_REQUIRED") return errorResponse("Administratorberechtigung erforderlich.", 403);
    if (code === "SESSION_INVALID") return errorResponse("Exportsitzung ungültig, abgelaufen oder widerrufen.", 401);
    if (code === "VALIDATION_ERROR") return errorResponse("Ungültige Exportanfrage.", 400);
    return errorResponse("Die Exportanfrage konnte nicht verarbeitet werden.", 500);
  }
});
