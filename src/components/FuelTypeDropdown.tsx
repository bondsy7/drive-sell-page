import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FUEL_TYPES = [
  'Benzin',
  'Diesel',
  'Elektro',
  'Plug-in-Hybrid (Benzin)',
  'Plug-in-Hybrid (Diesel)',
  'Hybrid (Benzin)',
  'Hybrid (Diesel)',
  'Erdgas (CNG)',
  'Autogas (LPG)',
  'Wasserstoff',
] as const;

interface FuelTypeDropdownProps {
  value: string;
  onChange: (val: string) => void;
}

const FuelTypeDropdown: React.FC<FuelTypeDropdownProps> = ({ value, onChange }) => {
  // Find the best match or use value as-is
  const normalized = FUEL_TYPES.find(
    (ft) => ft.toLowerCase() === (value || '').toLowerCase()
  ) || value;

  return (
    <Select value={normalized} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs font-semibold border-border/60 bg-background w-[180px]">
        <SelectValue placeholder="Kraftstoff wählen" />
      </SelectTrigger>
      <SelectContent>
        {FUEL_TYPES.map((ft) => (
          <SelectItem key={ft} value={ft} className="text-xs">
            {ft}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default FuelTypeDropdown;
