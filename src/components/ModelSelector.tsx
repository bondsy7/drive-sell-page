import { useCredits } from '@/hooks/useCredits';
import { Sparkles, Zap, Crown } from 'lucide-react';

export type ModelTier = 'schnell' | 'qualitaet' | 'premium';

interface ModelSelectorProps {
  actionType: string;
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
}

const TIERS: { id: ModelTier; label: string; sublabel: string; icon?: React.ReactNode }[] = [
  { id: 'schnell', label: 'Schnell', sublabel: 'schnell & günstig', icon: <Zap className="w-3 h-3" /> },
  { id: 'qualitaet', label: 'Qualität', sublabel: 'ausgewogen', icon: <Sparkles className="w-3 h-3" /> },
  { id: 'premium', label: 'Premium', sublabel: 'beste Ergebnisse', icon: <Crown className="w-3 h-3" /> },
];

export default function ModelSelector({ actionType, value, onChange }: ModelSelectorProps) {
  const { getCost } = useCredits();

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
      {TIERS.map((tier) => {
        const cost = getCost(actionType, tier.id);
        const isActive = value === tier.id;
        return (
          <button
            key={tier.id}
            onClick={() => onChange(tier.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isActive
                ? tier.id === 'premium'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tier.icon}
            {tier.label}
            <span className="text-[10px] opacity-70">({cost} Cr.)</span>
          </button>
        );
      })}
    </div>
  );
}
