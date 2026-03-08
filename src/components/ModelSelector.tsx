import { useCredits } from '@/hooks/useCredits';
import { Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  actionType: string;
  value: 'standard' | 'pro';
  onChange: (tier: 'standard' | 'pro') => void;
}

export default function ModelSelector({ actionType, value, onChange }: ModelSelectorProps) {
  const { getCost } = useCredits();
  const standardCost = getCost(actionType, 'standard');
  const proCost = getCost(actionType, 'pro');

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted">
      <button
        onClick={() => onChange('standard')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          value === 'standard'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Standard
        <span className="text-[10px] text-muted-foreground">({standardCost} Cr.)</span>
      </button>
      <button
        onClick={() => onChange('pro')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          value === 'pro'
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Sparkles className="w-3 h-3" />
        Pro
        <span className="text-[10px] opacity-80">({proCost} Cr.)</span>
      </button>
    </div>
  );
}
