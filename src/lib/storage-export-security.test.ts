import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  isExportSessionActive,
  normalizeEtag,
  normalizeSize,
} from '../../supabase/functions/storage-export/security';

describe('storage export security', () => {
  it('accepts only an unrevoked session whose expiry is still in the future', () => {
    const now = new Date('2026-11-17T10:00:00.000Z');
    expect(isExportSessionActive({ revoked_at: null, expires_at: '2026-11-17T14:00:00.000Z' }, now)).toBe(true);
    expect(isExportSessionActive({ revoked_at: '2026-11-17T09:00:00.000Z', expires_at: '2026-11-17T14:00:00.000Z' }, now)).toBe(false);
    expect(isExportSessionActive({ revoked_at: null, expires_at: '2026-11-17T10:00:00.000Z' }, now)).toBe(false);
    expect(isExportSessionActive({ revoked_at: null, expires_at: 'invalid' }, now)).toBe(false);
  });

  it('compares equal hashes and rejects different values and lengths', () => {
    expect(constantTimeEqual('a'.repeat(64), 'a'.repeat(64))).toBe(true);
    expect(constantTimeEqual('a'.repeat(64), 'b'.repeat(64))).toBe(false);
    expect(constantTimeEqual('a'.repeat(64), 'a'.repeat(63))).toBe(false);
  });

  it('normalizes storage sizes without accepting negative or unsafe values', () => {
    expect(normalizeSize(123)).toBe(123);
    expect(normalizeSize('456')).toBe(456);
    expect(normalizeSize(-1)).toBe(0);
    expect(normalizeSize(Number.MAX_SAFE_INTEGER + 1)).toBe(0);
    expect(normalizeSize(undefined)).toBe(0);
  });

  it('normalizes quoted and weak ETags without treating them as SHA-256', () => {
    expect(normalizeEtag('"0123456789abcdef0123456789abcdef"')).toBe('0123456789abcdef0123456789abcdef');
    expect(normalizeEtag('W/"abc-1"')).toBe('abc-1');
    expect(normalizeEtag('')).toBeNull();
  });
});
