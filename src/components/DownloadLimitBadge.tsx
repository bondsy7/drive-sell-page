import { Download } from 'lucide-react';
import { useDownloadLimit } from '@/hooks/useDownloadLimit';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function DownloadLimitBadge() {
  const { hasLimit, remaining, monthlyLimit, periodEnd, loading } = useDownloadLimit();
  if (loading || !hasLimit) return null;

  const exhausted = remaining <= 0;
  const low = !exhausted && remaining <= Math.max(5, Math.floor(monthlyLimit * 0.1));

  const style = exhausted
    ? 'bg-destructive/15 text-destructive'
    : low
    ? 'bg-amber-500/15 text-amber-500'
    : 'bg-emerald-500/15 text-emerald-500';

  const endLabel = periodEnd
    ? new Date(periodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-semibold ${style}`}>
          <Download className="w-3 h-3" />
          <span>{remaining}</span>
          <span className="hidden sm:inline text-[10px] opacity-75">/ {monthlyLimit}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs space-y-0.5">
        <div>Downloads verbleibend: {remaining} / {monthlyLimit}</div>
        {endLabel && <div>Zurücksetzung am {endLabel}</div>}
      </TooltipContent>
    </Tooltip>
  );
}
