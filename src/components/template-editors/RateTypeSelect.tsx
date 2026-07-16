import React from 'react';

interface Props {
  value?: '' | 'netto' | 'brutto';
  onChange: (v: '' | 'netto' | 'brutto') => void;
  className?: string;
  /**
   * Wenn true, wird das Feld nur als kleiner Suffix im Stil von "inkl. MwSt."
   * dargestellt (kein Rahmen, gleiche Textgröße/Farbe). Wird direkt hinter der
   * Rate angezeigt und ergibt visuell ", brutto" bzw. ", netto".
   */
  inline?: boolean;
}

/**
 * Kleines Netto/Brutto Auswahlfeld, das direkt hinter jeder Rate steht.
 * Zeigt in Ansicht/Export klein ", netto" oder ", brutto" hinter dem Betrag an.
 */
const RateTypeSelect: React.FC<Props> = ({ value, onChange, className = '', inline = true }) => {
  const v = value === 'netto' || value === 'brutto' ? value : '';

  if (inline) {
    // Native-Select wird als kleiner Inline-Text im Stil von "inkl. MwSt." dargestellt.
    // Kein Rahmen, kein Hintergrund – der Nutzer klickt einfach auf den Text.
    return (
      <select
        value={v}
        onChange={(e) => onChange(e.target.value as '' | 'netto' | 'brutto')}
        onClick={(e) => e.stopPropagation()}
        title="Steuerangabe der Rate (netto/brutto)"
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
          lineHeight: 'inherit',
        }}
        className={'rate-type-inline ' + className}
      >
        <option value="" disabled hidden>netto/brutto?</option>
        <option value="netto">netto</option>
        <option value="brutto">brutto</option>
      </select>
    );
  }

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
      <option value="" disabled hidden>– wählen –</option>
      <option value="netto">netto</option>
      <option value="brutto">brutto</option>
    </select>
  );
};

export default RateTypeSelect;
