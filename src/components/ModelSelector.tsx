import React, { useEffect } from 'react';
import { useCredits } from '@/hooks/useCredits';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Sparkles, Zap, Crown, Rocket, Diamond, BadgePlus, Flame, Sun } from 'lucide-react';

export type ModelTier = 'schnell' | 'qualitaet' | 'premium' | 'turbo' | 'ultra' | 'neu' | 'flare' | 'sunburst';

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
  { id: 'flare', label: 'Flare', sublabel: 'GPT Image 2.5 Flare', icon: <Flame className="w-3 h-3" />, group: 'B' },
  { id: 'sunburst', label: 'Sunburst (Test)', sublabel: 'OpenAI GPT Image 2.5 Sunburst', icon: <Sun className="w-3 h-3" />, group: 'B' },
];

// OpenAI-Testmodelle: aktuell nur für Admins sichtbar/änderbar
export const ADMIN_ONLY_TIERS: ModelTier[] = ['neu', 'flare', 'sunburst'];

export default function ModelSelector({ actionType, value, onChange }: ModelSelectorProps) {
  const { getCost } = useCredits();
  const isAdmin = useIsAdmin();

  const visibleTiers = isAdmin ? TIERS : TIERS.filter((t) => !ADMIN_ONLY_TIERS.includes(t.id));

  // Falls ein Admin-only-Modell aktiv ist, aber der Nutzer kein Admin ist: auf Standard zurückfallen
  useEffect(() => {
    if (!isAdmin && ADMIN_ONLY_TIERS.includes(value)) {
      onChange('qualitaet');
    }
  }, [isAdmin, value, onChange]);


  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted flex-wrap">
        {visibleTiers.map((tier, i) => {
          const cost = getCost(actionType, tier.id);
          const isActive = value === tier.id;
          const showDivider = i > 0 && visibleTiers[i - 1].group !== tier.group;
          return (
            <React.Fragment key={tier.id}>
              {showDivider && <div className="w-px h-5 bg-border mx-0.5" />}
              <button
                onClick={() => onChange(tier.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? tier.id === 'premium' || tier.id === 'ultra' || tier.id === 'neu' || tier.id === 'flare' || tier.id === 'sunburst'
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
