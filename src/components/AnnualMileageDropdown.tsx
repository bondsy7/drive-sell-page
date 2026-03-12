import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MILEAGES = [
  { value: '5000', label: '5.000 km' },
  { value: '7500', label: '7.500 km' },
  { value: '10000', label: '10.000 km' },
  { value: '15000', label: '15.000 km' },
  { value: '20000', label: '20.000 km' },
  { value: '25000', label: '25.000 km' },
  { value: '30000', label: '30.000 km' },
] as const;

interface Props {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

const AnnualMileageDropdown: React.FC<Props> = ({ value, onChange, className }) => {
  // Parse number from value like "10.000 km/Jahr" or "10000"
  const numStr = (value || '').replace(/[.\s]/g, '').replace(/km.*/, '').trim();
  const matched = MILEAGES.find(m => m.value === numStr)?.value || '';

  return (
    <Select value={matched} onValueChange={(v) => {
      const m = MILEAGES.find(x => x.value === v);
      onChange(m ? `${m.label}/Jahr` : v);
    }}>
      <SelectTrigger className={`h-7 text-xs font-semibold border-border/60 bg-background ${className || ''}`}>
        <SelectValue placeholder="Fahrleistung wählen" />
      </SelectTrigger>
      <SelectContent>
        {MILEAGES.map((m) => (
          <SelectItem key={m.value} value={m.value} className="text-xs">
            {m.label}/Jahr
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AnnualMileageDropdown;
