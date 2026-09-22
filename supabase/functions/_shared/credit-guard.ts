// Einheitliche Credit-Absicherung für Edge Functions.
// Regel: Keine KI-Generierung ohne vorherigen Credit-Abzug.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlanSlug, planAllowsAction } from "./plan-scope.ts";

/**
 * Mindestpreise je Aktionsart (in Credits, 1 Credit = 0,50 € Verkaufserlös).
 * Greift, wenn in admin_settings.credit_costs kein Eintrag hinterlegt ist.
 * Die Werte liegen bewusst deutlich über dem Anbieter-Einkaufspreis inkl.
 * Wiederholungsfaktor, damit keine Aktion in die Verlustzone laufen kann.
 */
export const MIN_CREDIT_COST: Record<string, number> = {
  image_generate: 2,
  image_remaster: 2,
  image_analysis: 1,
  text_generate: 1,
  chat_message: 1,
  banner_reframe: 3,
  pdf_analysis: 1,
  vin_ocr: 1,
  landing_page_export: 19,
  music_generate: 5,
  spin360_analysis: 1,
  spin360_normalize: 2,
  spin360_generate: 12,
  spin360_export: 1,
};

/** Absoluter Notfallwert, falls eine unbekannte Aktion auftaucht. */
const FALLBACK_COST = 3;

export interface CreditCharge {
  userId: string;
  cost: number;
  admin: SupabaseClient;
  /** Rückbuchung bei technischem Totalausfall (kein Ergebnis geliefert). */
  refund: (reason: string) => Promise<void>;
}

export class CreditError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly balance = 0) {
    super(message);
  }
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function resolveCost(
  admin: SupabaseClient,
  actionType: string,
  tier: string,
): Promise<number> {
  let configured: number | undefined;
  try {
    const { data } = await admin
      .from("admin_settings")
      .select("value")
      .eq("key", "credit_costs")
      .single();
    const costs = (data?.value ?? {}) as Record<string, Record<string, number>>;
    configured = costs?.[actionType]?.[tier] ?? costs?.[actionType]?.["schnell"];
  } catch (_e) {
    configured = undefined;
  }
  const floor = MIN_CREDIT_COST[actionType] ?? FALLBACK_COST;
  return Math.max(floor, configured ?? 0);
}

/**
 * Authentifiziert den Aufruf und zieht die Credits VOR dem Anbieteraufruf ab.
 * Wirft einen CreditError bei fehlender Anmeldung oder zu wenig Guthaben.
 */
export async function chargeCredits(
  req: Request,
  actionType: string,
  options: { tier?: string; description?: string; model?: string; amount?: number } = {},
): Promise<CreditCharge> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new CreditError("Nicht authentifiziert", 401, "unauthorized");

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: claims, error: authError } = await userClient.auth.getClaims(token);
  const userId = claims?.claims?.sub as string | undefined;
  if (authError || !userId) throw new CreditError("Nicht authentifiziert", 401, "unauthorized");

  const admin = adminClient();

  // Paketgrenze: Fotoservice-Pakete decken nur Fahrzeugbilder/Perspektiven ab.
  const planSlug = await getPlanSlug(admin, userId);
  if (!planAllowsAction(planSlug, actionType)) {
    throw new CreditError(
      "Diese Funktion ist im gebuchten Fotoservice-Paket nicht enthalten. Sie ist in den All-Incl-Marketing-Paketen verfügbar.",
      403,
      "not_in_plan",
    );
  }

  const tier = options.tier || "schnell";
  const cost = options.amount ?? await resolveCost(admin, actionType, tier);

  const { data, error } = await admin.rpc("deduct_credits", {
    _user_id: userId,
    _amount: cost,
    _action_type: actionType,
    _model: options.model ?? tier,
    _description: options.description ?? `${actionType} (${tier})`,
  });

  if (error) {
    throw new CreditError(`Credit-Abzug fehlgeschlagen: ${error.message}`, 500, "credit_error");
  }

  const result = data as { success?: boolean; balance?: number; error?: string } | null;
  if (!result?.success) {
    throw new CreditError(
      `Nicht genügend Credits. Benötigt: ${cost}, verfügbar: ${result?.balance ?? 0}.`,
      402,
      "insufficient_credits",
      result?.balance ?? 0,
    );
  }

  return {
    userId,
    cost,
    admin,
    refund: async (reason: string) => {
      try {
        await admin.rpc("add_credits", {
          _user_id: userId,
          _amount: cost,
          _action_type: "credit_refund",
          _description: `Rückbuchung ${actionType}: ${reason}`,
        });
      } catch (e) {
        console.error("[credit-guard] Rückbuchung fehlgeschlagen", e);
      }
    },
  };
}

/** Wandelt einen CreditError in eine JSON-Antwort mit CORS-Headern. */
export function creditErrorResponse(e: unknown, corsHeaders: Record<string, string>): Response | null {
  if (!(e instanceof CreditError)) return null;
  return new Response(
    JSON.stringify({ error: e.message, code: e.code, balance: e.balance }),
    { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
