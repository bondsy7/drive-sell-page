export type AutopilotDecision = "notify_only" | "draft" | "queue";

export function isDemoCustomer(customer: { name?: string | null; email?: string | null }): boolean {
  return (customer.name || "").trim().toUpperCase().includes("[DEMO]")
    || (customer.email || "").trim().toLowerCase().endsWith(".invalid");
}

export function isDemoEmailContent(subject?: string | null, body?: string | null): boolean {
  return `${subject || ""}\n${body || ""}`.toUpperCase().includes("[DEMO]");
}

export function resolveAutopilotDecision(options: {
  mode?: string | null;
  stage: string;
  autoReplyStages?: string[] | null;
  demoKnowledgeActive: boolean;
  demoCustomer: boolean;
}): AutopilotDecision {
  if ((options.mode || "approval") === "off") return "notify_only";
  if (options.demoKnowledgeActive || options.demoCustomer) return "draft";
  if (options.mode === "full_auto" && (options.autoReplyStages || []).includes(options.stage)) return "queue";
  return "draft";
}

export async function hasActiveDemoKnowledge(adminSupabase: any, userId: string): Promise<boolean> {
  const { count, error } = await adminSupabase.from("sales_knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("source_type", "demo_seed");
  if (error) {
    console.error("DEMO-Wissensprüfung fehlgeschlagen; Versand wird vorsorglich blockiert", error);
    return true;
  }
  return (count || 0) > 0;
}
