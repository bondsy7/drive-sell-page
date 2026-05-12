import React from "react";
import { LAYOUT_TEMPLATES } from "../data/layoutTemplates";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

const LayoutTemplatePicker: React.FC<Props> = ({ selectedId, onSelect }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {LAYOUT_TEMPLATES.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => onSelect(t.id)}
        className={`text-left p-3 rounded-lg border transition-all ${
          selectedId === t.id
            ? "border-accent bg-accent/10"
            : "border-border bg-card hover:border-accent/50"
        }`}
      >
        <div className="text-sm font-semibold text-foreground">{t.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
      </button>
    ))}
  </div>
);

export default LayoutTemplatePicker;
