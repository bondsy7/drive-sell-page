// Serverseitige Paketgrenzen: Fotoservice-Pakete dürfen ausschließlich
// Fahrzeugbilder und deren Perspektiven erzeugen.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const FOTO_PLAN_ACTIONS = new Set<string>([
  "image_generate",
  "image_remaster",
  "image_analysis",
  "vin_ocr",
  "pdf_analysis",
  "credit_refund",
]);

/** Aktueller Tarif-Slug des Nutzers, oder null wenn kein aktives Abo. */
export async function getPlanSlug(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data: sub } = await admin
      .from("user_subscriptions")
      .select("plan_id, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub || sub.status === "cancelled") return null;
    const { data: plan } = await admin
      .from("subscription_plans")
      .select("slug")
      .eq("id", sub.plan_id)
      .maybeSingle();
    return (plan?.slug as string) ?? null;
  } catch (_e) {
    return null;
  }
}

/** true, wenn der Tarif die Tätigkeit abdeckt. */
export function planAllowsAction(planSlug: string | null, actionType: string): boolean {
  if (planSlug && planSlug.startsWith("foto")) {
    return FOTO_PLAN_ACTIONS.has(actionType);
  }
  return true;
}
