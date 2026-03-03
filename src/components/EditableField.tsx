import React, { useState } from 'react';
import { Pencil, X, Check } from 'lucide-react';

interface EditableFieldProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  multiline?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onChange, className = '', multiline = false }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        {multiline ? (
          <textarea
            className="bg-background border border-border rounded px-2 py-0.5 text-sm w-full min-w-[120px] min-h-[60px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            }}
          />
        ) : (
          <input
            className="bg-background border border-border rounded px-2 py-0.5 text-sm w-auto min-w-[80px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onChange(draft); setEditing(false); }
              if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            }}
          />
        )}
        <button onClick={() => { onChange(draft); setEditing(false); }} className="text-accent hover:text-accent/80">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`group cursor-pointer hover:text-accent transition-colors ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Klicken zum Bearbeiten"
    >
      {value || '–'}
      <Pencil className="w-3 h-3 ml-1 inline opacity-0 group-hover:opacity-60 transition-opacity" />
    </span>
  );
};

export default EditableField;
