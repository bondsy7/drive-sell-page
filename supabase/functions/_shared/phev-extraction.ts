export type PhevConsumption = {
  isPluginHybrid?: boolean;
  consumptionCombinedDischarged?: string;
  co2EmissionsDischarged?: string;
  co2ClassDischarged?: string;
  [key: string]: unknown;
};

export const PHEV_DISCHARGED_FIELDS = [
  "consumptionCombinedDischarged",
  "co2EmissionsDischarged",
] as const;

export function missingPhevDischargedFields(consumption: PhevConsumption): string[] {
  if (!consumption.isPluginHybrid) return [];
  return PHEV_DISCHARGED_FIELDS.filter((field) => {
    const value = consumption[field];
    return typeof value !== "string" || value.trim() === "";
  });
}

/** Fill only missing document values; never overwrite an existing extraction. */
export function mergeMissingPhevValues(
  consumption: PhevConsumption,
  extracted: Record<string, unknown>,
): string[] {
  const merged: string[] = [];
  for (const field of [...PHEV_DISCHARGED_FIELDS, "co2ClassDischarged"] as const) {
    const current = consumption[field];
    if (typeof current === "string" && current.trim() !== "") continue;
    const candidate = extracted?.[field];
    if (typeof candidate !== "string" || candidate.trim() === "" || candidate.length > 120) continue;
    consumption[field] = candidate.trim();
    merged.push(field);
  }
  return merged;
}
