type Row = Record<string, any>;

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

/** German customer-facing transmission label from the Auto3 listing record. */
export function auto3TransmissionLabel(r: Row): string | null {
  if (typeof r.vehicleModel?.automatic === "boolean") {
    return r.vehicleModel.automatic ? "Automatik" : "Schaltgetriebe";
  }

  const candidates = [r.transmission, r.vehicleModel?.transmission];
  const technical = r.technicalData && typeof r.technicalData === "object" ? r.technicalData as Row : {};
  for (const [key, value] of Object.entries(technical)) {
    if (/^(getriebeart|getriebe)$/i.test(key.trim())) candidates.push(value);
  }

  for (const candidate of candidates) {
    const label = text(candidate);
    if (!label) continue;
    const code = label.toLowerCase().replace(/[\s-]+/g, "_");
    if (["automatic", "automatik", "automatic_transmission"].includes(code)) return "Automatik";
    if (["manual", "schaltgetriebe", "manual_transmission"].includes(code)) return "Schaltgetriebe";
    return label;
  }
  return null;
}
