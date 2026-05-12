import React from "react";
import { BANNER_FORMATS } from "../data/formats";
import { Check } from "lucide-react";

interface Props {
  selectedIds: string[];
  activeId: string;
  onToggle: (id: string) => void;
  onSetActive: (id: string) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  social: "Social Media",
  display: "Display Ads",
  website: "Website",
};

const FormatPicker: React.FC<Props> = ({ selectedIds, activeId, onToggle, onSetActive }) => {
  const grouped = BANNER_FORMATS.reduce<Record<string, typeof BANNER_FORMATS>>((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{CATEGORY_LABEL[cat] ?? cat}</h4>
          <div className="grid grid-cols-2 gap-2">
            {items.map((f) => {
              const selected = selectedIds.includes(f.id);
              const active = activeId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    if (!selected) onToggle(f.id);
                    onSetActive(f.id);
                  }}
                  className={`relative text-left p-3 rounded-lg border transition-all ${
                    active
                      ? "border-accent bg-accent/10"
                      : selected
                      ? "border-border bg-card"
                      : "border-border/60 bg-card/40 hover:border-accent/50"
                  }`}
                >
                  {selected && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <div className="text-sm font-semibold text-foreground pr-5">{f.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {f.width} × {f.height}
                  </div>
                  {selected && !active && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(f.id);
                      }}
                      className="text-[10px] text-muted-foreground underline mt-1"
                    >
                      entfernen
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FormatPicker;
