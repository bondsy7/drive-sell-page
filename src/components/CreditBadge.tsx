import { Zap, Crown, Star, Rocket } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="w-3 h-3" />,
  starter: <Star className="w-3 h-3" />,
  pro: <Rocket className="w-3 h-3" />,
  enterprise: <Crown className="w-3 h-3" />,
};

const PLAN_BADGE_STYLES: Record<string, string> = {
  free: 'bg-muted/80 text-muted-foreground hover:bg-muted',
  starter: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25',
  pro: 'bg-accent/15 text-accent hover:bg-accent/25',
  enterprise: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
};

export default function CreditBadge() {
  const { balance, loading: creditsLoading } = useCredits();
  const { planSlug, planName, billingCycle, periodEnd, loading: subLoading } = useSubscription();

  if (creditsLoading && subLoading) return null;

  const slug = planSlug || 'free';
  const icon = PLAN_ICONS[slug] || PLAN_ICONS.free;
  const style = PLAN_BADGE_STYLES[slug] || PLAN_BADGE_STYLES.free;

  const tooltipLines = [
    `Plan: ${planName || 'Free'}`,
    `Credits: ${balance}`,
  ];
  if (billingCycle) tooltipLines.push(`Zyklus: ${billingCycle === 'yearly' ? 'Jährlich' : 'Monatlich'}`);
  if (periodEnd) {
    const endDate = new Date(periodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    tooltipLines.push(`Gültig bis: ${endDate}`);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/pricing"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${style}`}
        >
          {icon}
          <span>{balance}</span>
          {slug !== 'free' && (
            <span className="text-[10px] opacity-75 uppercase tracking-wider">{slug}</span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs space-y-0.5">
        {tooltipLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
