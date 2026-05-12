import React, { useEffect, useState } from "react";
import { getFormatById } from "../data/formats";
import type { BannerTextFields, StudioState } from "../state/types";
import { renderCompositionToDataURL } from "../export/renderComposition";

interface Props {
  state: StudioState;
  textFields: BannerTextFields;
  onActivate: (formatId: string) => void;
}

const MultiFormatPreview: React.FC<Props> = ({ state, textFields, onActivate }) => {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const next: Record<string, string> = {};
      for (const id of state.selectedFormatIds) {
        const f = getFormatById(id);
        const comp = state.compositions[id];
        if (!comp) continue;
        try {
          next[id] = await renderCompositionToDataURL(f, comp, textFields, "png");
        } catch (e) {
          console.warn("thumb render failed", id, e);
        }
        if (cancelled) return;
      }
      if (!cancelled) {
        setThumbs(next);
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // Re-render on text/composition changes too.
  }, [state.selectedFormatIds, state.compositions, textFields]);

  if (state.selectedFormatIds.length === 0) {
    return <div className="text-sm text-muted-foreground">Keine Formate ausgewählt.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Vorschau aller Formate</h3>
        {loading && <span className="text-xs text-muted-foreground">Aktualisiere…</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {state.selectedFormatIds.map((id) => {
          const f = getFormatById(id);
          const isActive = state.activeFormatId === id;
          const aspect = f.width / f.height;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onActivate(id)}
              className={`group text-left rounded-lg border overflow-hidden bg-card transition-all ${
                isActive ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-accent/50"
              }`}
            >
              <div
                className="w-full bg-muted/40 flex items-center justify-center"
                style={{ aspectRatio: `${aspect}` }}
              >
                {thumbs[id] ? (
                  <img src={thumbs[id]} alt={f.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">rendere…</span>
                )}
              </div>
              <div className="p-2">
                <div className="text-xs font-semibold text-foreground truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {f.width} × {f.height}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MultiFormatPreview;
