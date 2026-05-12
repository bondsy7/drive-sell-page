import React from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  history: string[];
  current?: string;
  onRollback: () => void;
  onPick: (url: string) => void;
  onClear: () => void;
}

const ReframeHistoryStrip: React.FC<Props> = ({ history, current, onRollback, onPick, onClear }) => {
  if (history.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-accent" />
          <h3 className="text-sm font-semibold">Reframe-Historie</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
            {history.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onRollback} title="Letzten Reframe rückgängig machen">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Zurück
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear} title="Historie leeren">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[...history].reverse().map((url, i) => {
          const isCurrent = url === current;
          return (
            <button
              key={`${i}-${url.slice(0, 20)}`}
              onClick={() => onPick(url)}
              className={`flex-shrink-0 w-20 h-20 rounded-md border overflow-hidden bg-background ${
                isCurrent ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/40"
              }`}
              title={`Version ${history.length - i}`}
            >
              <img src={url} alt={`Reframe ${i}`} className="w-full h-full object-cover" />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Klicke auf einen Eintrag, um diese Version zurück in die Vorschau zu laden.
      </p>
    </div>
  );
};

export default ReframeHistoryStrip;
