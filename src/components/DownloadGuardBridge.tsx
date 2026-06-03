import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDownloadLimit } from '@/hooks/useDownloadLimit';
import { configureDownloadGuard } from '@/lib/download-guard';

/**
 * Bridge component: keeps the global download guard in sync with the current
 * user + download-limit context. Renders nothing.
 */
export default function DownloadGuardBridge() {
  const { user } = useAuth();
  const { hasLimit, remaining, monthlyLimit, applyConsumed } = useDownloadLimit();

  useEffect(() => {
    configureDownloadGuard({
      userId: user?.id ?? null,
      hasLimit,
      remaining,
      monthlyLimit,
      onUpdate: applyConsumed,
    });
  }, [user?.id, hasLimit, remaining, monthlyLimit, applyConsumed]);

  return null;
}
