import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  { value: 'Leasing', label: 'Leasing' },
  { value: 'Finanzierung', label: 'Finanzierung' },
  { value: 'Barkauf', label: 'Barkauf' },
  { value: 'Neuwagen', label: 'Neuwagen' },
  { value: 'Gebrauchtwagen', label: 'Gebrauchtwagen' },
  { value: 'Tageszulassung', label: 'Tageszulassung' },
] as const;

interface CategoryDropdownProps {
  value: string;
  onChange: (val: string) => void;
}

const CategoryDropdown: React.FC<CategoryDropdownProps> = ({ value, onChange }) => {
  const normalized = CATEGORIES.find(
    (c) => c.value.toLowerCase() === (value || '').toLowerCase()
  )?.value || value;

  return (
    <Select value={normalized} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs font-semibold border-border/60 bg-background w-[180px]">
        <SelectValue placeholder="Kategorie wählen" />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((c) => (
          <SelectItem key={c.value} value={c.value} className="text-xs">
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CategoryDropdown;
