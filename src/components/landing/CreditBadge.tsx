import React from 'react';
import { creditLabel } from '@/lib/landing-credit-costs';

/**
 * Small pill that names the credit price of an action before it is started.
 * Free options stay discreet on purpose: only paid AI work should stand out.
 */
const CreditBadge: React.FC<{ credits: number; className?: string }> = ({ credits, className = '' }) => {
  const free = credits <= 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        free ? 'border-border bg-muted text-muted-foreground' : 'border-primary/30 bg-primary/10 text-primary'
      } ${className}`}
    >
      {free ? 'Kostenlos' : creditLabel(credits)}
    </span>
  );
};

export default CreditBadge;
