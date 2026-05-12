import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, RotateCcw, Crosshair } from "lucide-react";
import type { BannerComposition, BannerFormat } from "../state/types";

interface Props {
  selectedLayerId?: string;
  composition: BannerComposition;
  format: BannerFormat;
  onReorder: (id: string, dir: "forward" | "backward") => void;
  onCenter: (id: string) => void;
  onReset: () => void;
}

const LayerOrderControls: React.FC<Props> = ({
  selectedLayerId, composition, format, onReorder, onCenter, onReset,
}) => {
  const layer = composition.layers.find((l) => l.id === selectedLayerId);
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="text-xs text-muted-foreground">
        {layer ? `Ausgewählt: ${layer.id}` : "Klicke ein Element auf der Vorschau, um es zu bearbeiten."}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!layer} onClick={() => layer && onCenter(layer.id)}>
          <Crosshair className="w-3.5 h-3.5 mr-1" /> Zentrieren
        </Button>
        <Button size="sm" variant="outline" disabled={!layer} onClick={() => layer && onReorder(layer.id, "forward")}>
          <ArrowUp className="w-3.5 h-3.5 mr-1" /> Vorne
        </Button>
        <Button size="sm" variant="outline" disabled={!layer} onClick={() => layer && onReorder(layer.id, "backward")}>
          <ArrowDown className="w-3.5 h-3.5 mr-1" /> Hinten
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Layout zurücksetzen
        </Button>
      </div>
      {layer && (
        <div className="text-xs text-muted-foreground">
          Position: {Math.round(layer.x)} / {Math.round(layer.y)} (0,0 = oben links · {format.width}×{format.height})
        </div>
      )}
    </div>
  );
};

export default LayerOrderControls;
