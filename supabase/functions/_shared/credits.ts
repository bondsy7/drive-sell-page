// Shared credit helpers for edge functions
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DeductResult {
  success: boolean;
  balance: number;
  cost: number;
  error?: string;
}

/**
 * Deduct credits via the DB function.
 * Throws on insufficient credits.
 */
export async function deductCredits(
  adminSupabase: SupabaseClient,
  userId: string,
  amount: number,
  actionType: string,
  model?: string,
  description?: string,
): Promise<DeductResult> {
  const { data, error } = await adminSupabase.rpc("deduct_credits", {
    _user_id: userId,
    _amount: amount,
    _action_type: actionType,
    _model: model || null,
    _description: description || null,
  });

  if (error) throw new Error(`Credit deduction failed: ${error.message}`);

  const result = data as DeductResult;
  if (!result.success) {
    throw new Error(
      result.error === "insufficient_credits"
        ? `Nicht genug Credits. Guthaben: ${result.balance}, Kosten: ${result.cost}`
        : result.error || "Credit deduction failed",
    );
  }

  return result;
}

/**
 * Check if user has enough credits without deducting.
 */
export async function checkCredits(
  adminSupabase: SupabaseClient,
  userId: string,
  requiredAmount: number,
): Promise<{ allowed: boolean; balance: number }> {
  const { data } = await adminSupabase
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const balance = data?.balance ?? 0;
  return { allowed: balance >= requiredAmount, balance };
}
