import React from 'react';
import { useCredits } from '@/hooks/useCredits';
import { Sparkles, Zap, Crown, Rocket, Diamond, BadgePlus } from 'lucide-react';

export type ModelTier = 'schnell' | 'qualitaet' | 'premium' | 'turbo' | 'ultra' | 'neu';

interface ModelSelectorProps {
  actionType: string;
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
}

const TIERS: { id: ModelTier; label: string; sublabel: string; icon?: React.ReactNode; group: string }[] = [
  { id: 'schnell', label: 'Schnell', sublabel: 'schnell & günstig', icon: <Zap className="w-3 h-3" />, group: 'A' },
  { id: 'qualitaet', label: 'Qualität', sublabel: 'ausgewogen', icon: <Sparkles className="w-3 h-3" />, group: 'A' },
  { id: 'premium', label: 'Premium', sublabel: 'beste Ergebnisse', icon: <Crown className="w-3 h-3" />, group: 'A' },
  { id: 'turbo', label: 'Turbo', sublabel: 'schnell & kreativ', icon: <Rocket className="w-3 h-3" />, group: 'B' },
  { id: 'ultra', label: 'Ultra', sublabel: 'höchste Qualität', icon: <Diamond className="w-3 h-3" />, group: 'B' },
  { id: 'neu', label: 'Neu', sublabel: 'GPT Image 2', icon: <BadgePlus className="w-3 h-3" />, group: 'B' },
];

export default function ModelSelector({ actionType, value, onChange }: ModelSelectorProps) {
  const { getCost } = useCredits();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted flex-wrap">
        {TIERS.map((tier, i) => {
          const cost = getCost(actionType, tier.id);
          const isActive = value === tier.id;
          const showDivider = i > 0 && TIERS[i - 1].group !== tier.group;
          return (
            <React.Fragment key={tier.id}>
              {showDivider && <div className="w-px h-5 bg-border mx-0.5" />}
              <button
                onClick={() => onChange(tier.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? tier.id === 'premium' || tier.id === 'ultra' || tier.id === 'neu'
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tier.icon}
                {tier.label}
                <span className="text-[10px] opacity-70">({cost} Cr.)</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
