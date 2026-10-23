/**
 * Credit costs for AI work inside the landing-page editor.
 *
 * Every new AI calculation costs real API money, so each option in the image
 * dialog and the bulk run must show its price before the user clicks. The
 * deduction itself happens server-side in the edge functions; these helpers
 * only mirror that pricing so the interface can promise the right number.
 */
import { resolveRemasterCost } from '../../supabase/functions/_shared/remaster-cost';

export type CreditCosts = Record<string, Record<string, number>>;

/** Tier the landing-page editor always requests from the image functions. */
export const LANDING_IMAGE_TIER = 'schnell';

export type LandingPaidAction = 'image_generate' | 'image_remaster';

/** Cost of one AI image; falls back to 1 credit while the cost table is still loading. */
export function landingImageCost(
  costs: CreditCosts,
  action: LandingPaidAction,
  tier: string = LANDING_IMAGE_TIER,
): number {
  if (action === 'image_remaster') return resolveRemasterCost(costs, tier) || 1;
  return costs[action]?.[tier] ?? 1;
}

export function creditLabel(credits: number): string {
  return `${credits} ${credits === 1 ? 'Credit' : 'Credits'}`;
}

export interface BulkCreditPlan {
  imageCount: number;
  costPerImage: number;
  totalCost: number;
  balance: number;
  /** Credits still missing for this run; 0 means the balance covers it. */
  missing: number;
  canRun: boolean;
}

/** Price of "generate all images" before it is started. */
export function planBulkImageRun(imageCount: number, costPerImage: number, balance: number): BulkCreditPlan {
  const totalCost = Math.max(0, imageCount) * Math.max(0, costPerImage);
  const missing = Math.max(0, totalCost - Math.max(0, balance));
  return {
    imageCount: Math.max(0, imageCount),
    costPerImage,
    totalCost,
    balance,
    missing,
    canRun: imageCount > 0 && missing === 0,
  };
}

/**
 * Reads the "insufficient_credits" reply of an edge function. supabase.functions.invoke
 * hides a non-2xx body behind error.context, so it has to be unpacked here.
 */
export async function readInsufficientCredits(error: unknown): Promise<{ balance: number; cost: number } | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!context || typeof context.json !== 'function') return null;
  try {
    const body = await context.json() as { error?: string; balance?: number; cost?: number } | null;
    if (body?.error !== 'insufficient_credits') return null;
    return { balance: Number(body.balance) || 0, cost: Number(body.cost) || 0 };
  } catch {
    return null;
  }
}
