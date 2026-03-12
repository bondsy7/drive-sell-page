import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DURATIONS = ['6', '12', '24', '36', '48', '60'] as const;

interface Props {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

const LeasingDurationDropdown: React.FC<Props> = ({ value, onChange, className }) => {
  const numMatch = (value || '').match(/(\d+)/);
  const normalized = numMatch ? numMatch[1] : '';
  const matched = DURATIONS.find(d => d === normalized) || '';

  return (
    <Select value={matched} onValueChange={(v) => onChange(`${v} Monate`)}>
      <SelectTrigger className={`h-7 text-xs font-semibold border-border/60 bg-background ${className || ''}`}>
        <SelectValue placeholder="Laufzeit wählen" />
      </SelectTrigger>
      <SelectContent>
        {DURATIONS.map((d) => (
          <SelectItem key={d} value={d} className="text-xs">
            {d} Monate
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LeasingDurationDropdown;
