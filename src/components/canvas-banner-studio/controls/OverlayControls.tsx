import React from "react";
import type { ImageFitMode, OverlayDirection } from "../state/types";
import { Label } from "@/components/ui/label";

interface Props {
  fit: ImageFitMode;
  direction: OverlayDirection;
  strength: number;
  onFit: (fit: ImageFitMode) => void;
  onOverlay: (dir: OverlayDirection, strength: number) => void;
}

const DIRECTIONS: { value: OverlayDirection; label: string }[] = [
  { value: "none", label: "Keiner" },
  { value: "left", label: "Links" },
  { value: "right", label: "Rechts" },
  { value: "top", label: "Oben" },
  { value: "bottom", label: "Unten" },
  { value: "full-soft", label: "Vollflächig weich" },
];

const OverlayControls: React.FC<Props> = ({ fit, direction, strength, onFit, onOverlay }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Bildanpassung</Label>
        <div className="flex gap-2">
          {(["cover", "contain"] as ImageFitMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onFit(m)}
              className={`flex-1 px-3 py-2 text-sm rounded-md border ${
                fit === m
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-accent/40"
              }`}
            >
              {m === "cover" ? "Füllen (Cover)" : "Einpassen (Contain)"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Abdunklung Richtung</Label>
        <div className="grid grid-cols-3 gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onOverlay(d.value, strength)}
              className={`px-2 py-2 text-xs rounded-md border ${
                direction === d.value
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-accent/40"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Stärke: {strength}%</Label>
        <input
          type="range"
          min={0}
          max={100}
          value={strength}
          onChange={(e) => onOverlay(direction, Number(e.target.value))}
          className="w-full accent-[hsl(var(--accent))]"
        />
      </div>
    </div>
  );
};

export default OverlayControls;
