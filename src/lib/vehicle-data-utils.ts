/**
 * Shared helpers for the "vehicle as single source of truth" workflow.
 *
 * - Pseudo-VIN generation when no real VIN is known yet
 *   (so originals/banners/videos never end up unattached).
 * - Deep merge of vehicle_data with conflict detection so the user can
 *   decide whether to overwrite values that already exist.
 */

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

export function isValidVin(v: string | null | undefined): boolean {
  return !!v && VIN_REGEX.test(v.trim());
}

/** Slug helper – lowercase ascii, dashes only. */
function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/**
 * Build a stable placeholder identifier for vehicles without a known VIN.
 * Format: NOVIN-<brand-model>-<YYYYMMDD-HHmm>
 * Always 17+ chars but starts with `NOVIN-` so it can be filtered out and
 * later replaced via real VIN lookup.
 */
export function generatePlaceholderVin(input: {
  brand?: string | null;
  model?: string | null;
  title?: string | null;
  date?: Date;
}): string {
  const d = input.date ?? new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const name = slug([input.brand, input.model, input.title].filter(Boolean).join(' ')) || 'fahrzeug';
  return `NOVIN-${name}-${stamp}`;
}

export function isPlaceholderVin(v: string | null | undefined): boolean {
  return !!v && v.startsWith('NOVIN-');
}

// ─── Deep merge with conflict detection ──────────────────────────────────

export interface MergeConflict {
  path: string;
  existing: unknown;
  incoming: unknown;
}

export interface MergeResult<T> {
  /** Merged data – existing values are kept when both sides have a value
   *  unless `overwriteConflicts` is true. */
  merged: T;
  /** Fields where both sides have differing non-empty values. */
  conflicts: MergeConflict[];
  /** Fields filled from incoming because existing was empty. */
  filled: string[];
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
};

/**
 * Merge `incoming` into `existing`. Existing non-empty values win unless
 * `overwriteConflicts` is true. Conflicts are reported so the UI can ask.
 */
export function mergeVehicleData<T extends Record<string, unknown>>(
  existing: T | null | undefined,
  incoming: Partial<T> | null | undefined,
  options: { overwriteConflicts?: boolean } = {},
): MergeResult<T> {
  const conflicts: MergeConflict[] = [];
  const filled: string[] = [];
  const overwrite = !!options.overwriteConflicts;

  const walk = (a: unknown, b: unknown, path: string): unknown => {
    if (isEmpty(b)) return a;
    if (isEmpty(a)) {
      filled.push(path || '(root)');
      return b;
    }
    if (isPlainObject(a) && isPlainObject(b)) {
      const out: Record<string, unknown> = { ...a };
      for (const key of Object.keys(b)) {
        out[key] = walk(a[key], b[key], path ? `${path}.${key}` : key);
      }
      return out;
    }
    // Scalar / array conflict
    const equal = JSON.stringify(a) === JSON.stringify(b);
    if (!equal) {
      conflicts.push({ path: path || '(root)', existing: a, incoming: b });
      return overwrite ? b : a;
    }
    return a;
  };

  const merged = walk(existing ?? {}, incoming ?? {}, '') as T;
  return { merged, conflicts, filled };
}
