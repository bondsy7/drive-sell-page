export interface ManufacturerLogoStorageFile {
  name: string;
  updated_at?: string | null;
  created_at?: string | null;
}

/**
 * Public storage URLs are cached. The object timestamp makes every replacement
 * a new URL while keeping the stable filename used for brand matching.
 */
export function versionedManufacturerLogoUrl(
  publicUrl: string,
  file: Pick<ManufacturerLogoStorageFile, 'updated_at' | 'created_at'>,
): string {
  const timestamp = Date.parse(file.updated_at || file.created_at || '');
  if (!Number.isFinite(timestamp)) return publicUrl;
  const url = new URL(publicUrl);
  url.searchParams.set('v', String(timestamp));
  return url.toString();
}
