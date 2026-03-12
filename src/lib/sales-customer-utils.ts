export interface LeadForGrouping {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  vehicle_title: string | null;
  interested_test_drive?: boolean;
  interested_trade_in?: boolean;
  interested_leasing?: boolean;
  interested_financing?: boolean;
  interested_purchase?: boolean;
  created_at: string;
}

export interface CustomerLeadThread {
  key: string;
  displayName: string;
  email: string;
  phone: string | null;
  latestAt: string;
  latestMessage: string | null;
  vehicles: string[];
  intentTags: string[];
  totalInquiries: number;
  requests: LeadForGrouping[];
}

export const normalizeEmail = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

export const normalizePhone = (value: string | null | undefined) =>
  (value || "").replace(/[^\d+]/g, "");

export const inferIntentTags = (lead: LeadForGrouping): string[] => {
  const tags = new Set<string>();
  const text = (lead.message || "").toLowerCase();

  if (lead.interested_test_drive || text.includes("probefahrt")) tags.add("Probefahrt");
  if (lead.interested_trade_in || text.includes("inzahlung")) tags.add("Inzahlungnahme");
  if (lead.interested_leasing || text.includes("leasing")) tags.add("Leasing");
  if (lead.interested_financing || text.includes("finanz")) tags.add("Finanzierung");
  if (lead.interested_purchase || text.includes("kauf") || text.includes("barkauf")) tags.add("Kauf");

  if (text.includes("gewerbe") || text.includes("firma")) tags.add("Gewerbekunde");
  if (text.includes("privat")) tags.add("Privatkunde");
  if (text.includes("sofort") || text.includes("dringend") || text.includes("schnell")) tags.add("Zeitnaher Bedarf");

  return [...tags];
};

export const groupLeadsByCustomer = (leads: LeadForGrouping[]): CustomerLeadThread[] => {
  const groups = new Map<string, CustomerLeadThread>();

  for (const lead of leads) {
    const emailKey = normalizeEmail(lead.email);
    const phoneKey = normalizePhone(lead.phone);
    const key = emailKey || phoneKey || `lead-${lead.id}`;

    const existing = groups.get(key);
    const leadVehicle = lead.vehicle_title?.trim();
    const leadTags = inferIntentTags(lead);

    if (!existing) {
      groups.set(key, {
        key,
        displayName: lead.name,
        email: lead.email,
        phone: lead.phone,
        latestAt: lead.created_at,
        latestMessage: lead.message,
        vehicles: leadVehicle ? [leadVehicle] : [],
        intentTags: leadTags,
        totalInquiries: 1,
        requests: [lead],
      });
      continue;
    }

    existing.totalInquiries += 1;
    existing.requests.push(lead);

    if (new Date(lead.created_at).getTime() > new Date(existing.latestAt).getTime()) {
      existing.latestAt = lead.created_at;
      existing.latestMessage = lead.message;
      existing.displayName = lead.name;
      existing.email = lead.email;
      existing.phone = lead.phone;
    }

    if (leadVehicle && !existing.vehicles.includes(leadVehicle)) {
      existing.vehicles.push(leadVehicle);
    }

    for (const tag of leadTags) {
      if (!existing.intentTags.includes(tag)) {
        existing.intentTags.push(tag);
      }
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      requests: [...group.requests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      vehicles: group.vehicles.slice(0, 6),
      intentTags: group.intentTags.slice(0, 8),
    }))
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
};
