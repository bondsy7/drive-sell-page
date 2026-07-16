import React from 'react';

interface Props {
  value?: '' | 'netto' | 'brutto';
  onChange: (v: '' | 'netto' | 'brutto') => void;
  className?: string;
}

/**
 * Kleines Netto/Brutto Auswahlfeld, das direkt hinter jeder Rate steht.
 * Zeigt in Ansicht/Export klein ", netto" oder ", brutto" hinter dem Betrag an.
 */
const RateTypeSelect: React.FC<Props> = ({ value, onChange, className = '' }) => {
  const v = value === 'netto' || value === 'brutto' ? value : '';
  return (
    <select
      value={v}
      onChange={(e) => onChange(e.target.value as '' | 'netto' | 'brutto')}
      onClick={(e) => e.stopPropagation()}
      title="Steuerangabe der Rate"
      className={
        'ml-1 h-6 rounded-md border border-border bg-background/80 px-1.5 text-[11px] font-medium text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ' +
        className
      }
    >
      <option value="">– netto/brutto –</option>
      <option value="netto">netto</option>
      <option value="brutto">brutto</option>
    </select>
  );
};

export default RateTypeSelect;
