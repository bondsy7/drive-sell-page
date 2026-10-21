import React, { useEffect } from 'react';
import { useCredits } from '@/hooks/useCredits';
import { Crown, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveSelectableModelTier } from '@/lib/model-choice';

export type ModelTier = 'schnell' | 'qualitaet' | 'premium' | 'turbo' | 'ultra' | 'neu' | 'flare' | 'sunburst' | 'nb21';

interface ModelSelectorProps {
  actionType: string;
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
}

const TIERS: { id: ModelTier; label: string; sublabel: string; icon?: React.ReactNode; group: string }[] = [
  { id: 'premium', label: 'Premium', sublabel: 'Standard', icon: <Crown className="w-3 h-3" />, group: 'A' },
  { id: 'flare', label: 'Advanced', sublabel: 'Upgrade', icon: <Flame className="w-3 h-3" />, group: 'A' },
];

export const ADMIN_ONLY_TIERS: ModelTier[] = [];

export default function ModelSelector({ actionType, value, onChange }: ModelSelectorProps) {
  const { getCost } = useCredits();

  const visibleTiers = TIERS;

  // Hidden legacy choices are not selectable for new work; saved wire IDs stay valid.
  useEffect(() => {
    const selected = resolveSelectableModelTier(value);
    if (value !== selected) onChange(selected);
  }, [value, onChange]);




  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-0.5 rounded-lg bg-muted p-1">
        {visibleTiers.map((tier, i) => {
          const cost = getCost(actionType, tier.id);
          const isActive = value === tier.id;
          const showDivider = i > 0 && visibleTiers[i - 1].group !== tier.group;
          return (
            <React.Fragment key={tier.id}>
              {showDivider && <div className="h-5 w-px shrink-0 bg-border mx-0.5" />}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(tier.id)}
                className={`h-auto flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? tier.id === 'flare'
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tier.icon}
                {tier.label}
                <span className="text-[10px] opacity-70">({cost} Cr.)</span>
              </Button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
