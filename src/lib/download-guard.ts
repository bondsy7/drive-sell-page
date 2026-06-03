import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Global download guard.
 *
 * Monkey-patches `HTMLAnchorElement.prototype.click` so every download triggered
 * via the classic `<a download>` pattern is counted against the user's monthly
 * download quota (table `user_download_limits`). Users without a quota row are
 * unlimited and pass through untouched.
 */

type LimitState = {
  hasLimit: boolean;
  remaining: number;
  monthlyLimit: number;
};

let installed = false;
let currentUserId: string | null = null;
let cache: LimitState = { hasLimit: false, remaining: Infinity, monthlyLimit: 0 };
let onUpdate: ((info: { used: number; remaining: number; monthly_limit: number; period_end: string }) => void) | null = null;

export function configureDownloadGuard(opts: {
  userId: string | null;
  hasLimit: boolean;
  remaining: number;
  monthlyLimit: number;
  onUpdate?: (info: { used: number; remaining: number; monthly_limit: number; period_end: string }) => void;
}) {
  currentUserId = opts.userId;
  cache = {
    hasLimit: opts.hasLimit,
    remaining: opts.hasLimit ? opts.remaining : Infinity,
    monthlyLimit: opts.monthlyLimit,
  };
  onUpdate = opts.onUpdate ?? null;
  install();
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    // Only intercept actual downloads
    const isDownload =
      this.hasAttribute('download') ||
      (this.href && (this.href.startsWith('blob:') || this.href.startsWith('data:')));

    if (!isDownload || !currentUserId || !cache.hasLimit) {
      return originalClick.apply(this, arguments as any);
    }

    if (cache.remaining <= 0) {
      toast.error(
        `Download-Kontingent erschöpft (0 / ${cache.monthlyLimit}). Bitte Admin kontaktieren.`,
      );
      return; // block
    }

    // Optimistic decrement then fire-and-forget RPC
    cache.remaining = Math.max(0, cache.remaining - 1);

    supabase.rpc('consume_download', { _user_id: currentUserId }).then(({ data, error }) => {
      if (error) {
        // Revert optimistic on hard error
        cache.remaining = Math.min(cache.monthlyLimit, cache.remaining + 1);
        return;
      }
      const d: any = data;
      if (d && typeof d === 'object') {
        if (d.success === false) {
          toast.error(`Download-Kontingent erschöpft (0 / ${d.monthly_limit}).`);
          cache.remaining = 0;
        } else if (d.limited) {
          cache.remaining = d.remaining;
          cache.monthlyLimit = d.monthly_limit;
          onUpdate?.({
            used: d.used,
            remaining: d.remaining,
            monthly_limit: d.monthly_limit,
            period_end: d.period_end,
          });
        }
      }
    });

    return originalClick.apply(this, arguments as any);
  };
}
