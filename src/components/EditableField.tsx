import React, { useState, useMemo } from 'react';
import { Pencil, X, Check } from 'lucide-react';

interface EditableFieldProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  multiline?: boolean;
  /** Fixed unit suffix shown outside the editable area, always visible */
  suffix?: string;
}

// Common automotive units to separate from editable values
const UNIT_PATTERNS = [
  /^(.+?)\s*(kWh\/100\s*km)$/i,
  /^(.+?)\s*(l\/100\s*km)$/i,
  /^(.+?)\s*(g\/km)$/i,
  /^(.+?)\s*(km\/h)$/i,
  /^(.+?)\s*(cm³)$/i,
  /^(.+?)\s*(kW\s*\(.*?\))$/i,
  /^(.+?)\s*(kW)$/i,
  /^(.+?)\s*(PS)$/i,
  /^(.+?)\s*(km\/Jahr)$/i,
  /^(.+?)\s*(km)$/i,
  /^(.+?)\s*(kg)$/i,
  /^(.+?)\s*(Nm)$/i,
  /^(.+?)\s*(€\/Jahr)$/i,
  /^(.+?)\s*(€\/Monat)$/i,
  /^(.+?)\s*(€\/l)$/i,
  /^(.+?)\s*(€\/kWh)$/i,
  /^(.+?)\s*(€)$/i,
  /^(.+?)\s*(%)$/i,
  /^(.+?)\s*(Monate)$/i,
  /^(.+?)\s*(Jahre)$/i,
];

function splitValueAndUnit(raw: string, fixedSuffix?: string): { numericPart: string; unit: string } {
  if (!raw) return { numericPart: '', unit: fixedSuffix || '' };
  const trimmed = raw.trim();
  
  // If a fixed suffix is provided, strip it from the value if present
  if (fixedSuffix) {
    const escaped = fixedSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixRegex = new RegExp(`^(.+?)\\s*${escaped}$`, 'i');
    const match = trimmed.match(suffixRegex);
    if (match) {
      return { numericPart: match[1].trim(), unit: fixedSuffix };
    }
    // Also try the auto-detect patterns for kW(PS) special case
    for (const pattern of UNIT_PATTERNS) {
      const m = trimmed.match(pattern);
      if (m) {
        return { numericPart: m[1].trim(), unit: m[2].trim() };
      }
    }
    return { numericPart: trimmed, unit: fixedSuffix };
  }
  
  for (const pattern of UNIT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { numericPart: match[1].trim(), unit: match[2].trim() };
    }
  }
  return { numericPart: trimmed, unit: '' };
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onChange, className = '', multiline = false, suffix }) => {
  const [editing, setEditing] = useState(false);
  const { numericPart, unit } = useMemo(() => splitValueAndUnit(value, suffix), [value, suffix]);
  const [draft, setDraft] = useState(numericPart);

  const handleSave = () => {
    let newValue: string;
    const effectiveUnit = unit;
    if (effectiveUnit) {
      // Special case: kW (XX PS) — recalculate PS from kW
      const kwPsMatch = effectiveUnit.match(/^kW\s*\(\d+\s*PS\)$/i);
      if (kwPsMatch) {
        const kw = parseFloat(draft.replace(',', '.'));
        const ps = isNaN(kw) ? 0 : Math.round(kw * 1.35962);
        newValue = `${draft} kW (${ps} PS)`;
      } else {
        newValue = draft ? `${draft} ${effectiveUnit}` : '';
      }
    } else {
      newValue = draft;
    }
    onChange(newValue);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(numericPart);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        {multiline ? (
          <textarea
            className="bg-background border border-border rounded px-2 py-0.5 text-[inherit] w-full min-w-[120px] min-h-[60px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel();
            }}
          />
        ) : (
          <input
            className="bg-background border border-border rounded px-2 py-0.5 text-[inherit] w-auto min-w-[60px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            style={{ width: `${Math.max(draft.length, 4) * 8 + 16}px` }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
        )}
        {unit && <span className="text-muted-foreground text-xs font-normal whitespace-nowrap">{unit}</span>}
        <button onClick={handleSave} className="text-accent hover:text-accent/80">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  // Display: show value or dash, plus unit always
  const displayValue = numericPart || '–';
  const displayText = unit ? `${displayValue} ${unit}` : displayValue;

  return (
    <span
      className={`group cursor-pointer hover:text-accent transition-colors ${className}`}
      onClick={() => { setDraft(numericPart); setEditing(true); }}
      title="Klicken zum Bearbeiten"
    >
      {displayText}
      <Pencil className="w-3 h-3 ml-1 inline opacity-0 group-hover:opacity-60 transition-opacity" />
    </span>
  );
};

export default EditableField;
