export type ExportSessionState = {
  revoked_at: string | null;
  expires_at: string;
};

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export function isExportSessionActive(
  session: ExportSessionState,
  now: Date = new Date(),
): boolean {
  if (session.revoked_at) return false;
  const expiresAt = Date.parse(session.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function normalizeSize(value: unknown): number {
  const size = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isSafeInteger(size) || size < 0) return 0;
  return size;
}

export function normalizeEtag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  return normalized || null;
}
