export interface ManufacturerLogoFile {
  name: string;
  updated_at?: string | null;
  created_at?: string | null;
}

/** Cache-bust replaced objects without changing their stable brand filename. */
export function versionedManufacturerLogoUrl(
  publicUrl: string,
  file?: ManufacturerLogoFile,
): string {
  const timestamp = Date.parse(file?.updated_at || file?.created_at || "");
  if (!Number.isFinite(timestamp)) return publicUrl;
  const url = new URL(publicUrl);
  url.searchParams.set("v", String(timestamp));
  return url.toString();
}

export interface ManufacturerLogoMatch {
  name: string;
  folder: "" | "svg";
}

const BRAND_LOGO_ALIASES: Record<string, string[]> = {
  volkswagen: ["vw"],
  vw: ["volkswagen"],
  mercedesbenz: ["mercedes", "mb"],
  mercedes: ["mercedesbenz", "mb"],
  bmw: ["bayerischemotorenwerke"],
  dsautomobiles: ["ds"],
  ds: ["dsautomobiles"],
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/[-_\s]+/g, "").replace(/é/g, "e");

/** Current vector artwork wins over legacy raster files with the same brand name. */
export function selectManufacturerLogo(
  rootFiles: ManufacturerLogoFile[],
  svgFiles: ManufacturerLogoFile[],
  brand: string,
): ManufacturerLogoMatch | null {
  const brandNorm = normalize(brand);
  const allKeys = [brandNorm, ...(BRAND_LOGO_ALIASES[brandNorm] || [])];
  const matchFile = (
    files: ManufacturerLogoFile[],
    folder: "" | "svg",
  ): ManufacturerLogoMatch | null => {
    for (const file of files || []) {
      const fileBrand = normalize(file.name.replace(/\.[^.]+$/, ""));
      if (allKeys.some((key) => fileBrand === key)) {
        return { name: file.name, folder };
      }
    }
    return null;
  };

  return matchFile(svgFiles, "svg") || matchFile(rootFiles, "");
}
