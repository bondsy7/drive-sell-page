import React, { useEffect, useRef } from 'react';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { Crown, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSelectableModelTiers, resolveSelectableModelTier } from '@/lib/model-choice';
import { useGenerationPreferences } from '@/hooks/useGenerationPreferences';
import { toast } from 'sonner';

export type ModelTier = 'schnell' | 'qualitaet' | 'premium' | 'turbo' | 'ultra' | 'neu' | 'flare' | 'sunburst' | 'nb21';

interface ModelSelectorProps {
  actionType: string;
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
}

const tierIcon = (id: string): React.ReactNode =>
  id === 'premium' ? <Crown className="w-3 h-3" /> : id === 'flare' ? <Flame className="w-3 h-3" /> : undefined;

export default function ModelSelector({ actionType, value, onChange }: ModelSelectorProps) {
  const { getCost } = useCredits();
  const { user } = useAuth();
  const email = user?.email;
  const preferences = useGenerationPreferences();
  const restored = useRef('');
  useEffect(() => {
    if (!user || !preferences.isSuccess) return;
    const key = `${user.id}:${actionType}`;
    if (restored.current === key) return;
    restored.current = key;
    const saved = preferences.data?.find(p => p.preference_key === `last:model:${actionType}`)?.settings.modelTier;
    if (saved) onChange(resolveSelectableModelTier(saved, email, actionType) as ModelTier);
  }, [user?.id, actionType, preferences.isSuccess, preferences.data, email, onChange]);

  // Öffentlich Premium/Advanced; der zentrale Testaccount sieht alle unterstützten Tiers.
  const visibleTiers = getSelectableModelTiers(actionType, email);

  // Hidden legacy choices are not selectable for new work; saved wire IDs stay valid.
  useEffect(() => {
    const selected = resolveSelectableModelTier(value, email, actionType);
    if (value !== selected) onChange(selected as ModelTier);
  }, [value, email, actionType, onChange]);

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
                onClick={() => {
                  onChange(tier.id as ModelTier);
                  preferences.save(`last:model:${actionType}`, { modelTier: tier.id }).catch(() => toast.error('Qualitätsstufe konnte nicht gespeichert werden.'));
                }}
                className={`h-auto flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? tier.id === 'flare'
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tierIcon(tier.id)}
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
