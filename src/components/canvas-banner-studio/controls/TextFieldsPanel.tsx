import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BannerComposition, BannerLayer, BannerTextFieldKey, BannerTextFields, TextAlign } from "../state/types";
import { AlignCenter, AlignLeft, AlignRight, Bold, Eye, EyeOff } from "lucide-react";

const FIELDS: { key: BannerTextFieldKey; label: string; placeholder: string; layerId: string; multiline?: boolean }[] = [
  { key: "headline", label: "Headline", placeholder: "DER NEUE VW GOLF", layerId: "headline" },
  { key: "subline", label: "Subline", placeholder: "Jetzt sichern mit attraktiver Leasingrate", layerId: "subline" },
  { key: "price", label: "Preis / Rate", placeholder: "ab 249 € mtl.", layerId: "price" },
  { key: "cta", label: "Call-to-Action", placeholder: "Jetzt Angebot anfragen", layerId: "cta" },
  { key: "smallInfo", label: "Kleine Info", placeholder: "Nur für kurze Zeit verfügbar", layerId: "smallInfo" },
  { key: "legalText", label: "Rechtshinweis (Pflichtangaben)", placeholder: "Kraftstoffverbrauch …", layerId: "legal", multiline: true },
];

const COLOR_TOKENS: { token: string; label: string }[] = [
  { token: "background", label: "Hell" },
  { token: "foreground", label: "Dunkel" },
  { token: "accent", label: "Akzent" },
  { token: "primary", label: "Primary" },
];

interface Props {
  textFields: BannerTextFields;
  composition: BannerComposition;
  onChangeText: (key: BannerTextFieldKey, value: string) => void;
  onPatchLayer: (layerId: string, patch: Partial<BannerLayer>) => void;
}

const TextFieldsPanel: React.FC<Props> = ({ textFields, composition, onChangeText, onPatchLayer }) => {
  const layerById = (id: string) => composition.layers.find((l) => l.id === id);

  return (
    <div className="space-y-5">
      {FIELDS.map((f) => {
        const layer = layerById(f.layerId);
        if (!layer) return null;
        return (
          <div key={f.key} className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold">{f.label}</Label>
              <button
                type="button"
                onClick={() => onPatchLayer(layer.id, { visible: !layer.visible })}
                className="text-muted-foreground hover:text-foreground"
                aria-label={layer.visible ? "Ausblenden" : "Einblenden"}
              >
                {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            {f.multiline ? (
              <Textarea
                rows={3}
                value={textFields[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => onChangeText(f.key, e.target.value)}
              />
            ) : (
              <Input
                value={textFields[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => onChangeText(f.key, e.target.value)}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Größe</span>
                <input
                  type="range"
                  min={10}
                  max={Math.max(40, (layer.fontSize ?? 24) * 3)}
                  value={layer.fontSize ?? 24}
                  onChange={(e) => onPatchLayer(layer.id, { fontSize: Number(e.target.value) })}
                  className="accent-[hsl(var(--accent))]"
                />
                <span className="tabular-nums w-8 text-right">{layer.fontSize}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onPatchLayer(layer.id, { fontWeight: (layer.fontWeight ?? 400) >= 600 ? 400 : 800 })
                }
                className={`p-1.5 rounded border ${
                  (layer.fontWeight ?? 400) >= 600 ? "border-accent bg-accent/10" : "border-border"
                }`}
                aria-label="Fett"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <div className="flex gap-0.5 border border-border rounded">
                {(["left", "center", "right"] as TextAlign[]).map((a) => {
                  const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onPatchLayer(layer.id, { align: a })}
                      className={`p-1.5 ${layer.align === a ? "bg-accent/15 text-foreground" : "text-muted-foreground"}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1">
                {COLOR_TOKENS.map((c) => (
                  <button
                    key={c.token}
                    type="button"
                    onClick={() => onPatchLayer(layer.id, { color: c.token })}
                    title={c.label}
                    className={`w-6 h-6 rounded-full border-2 ${
                      layer.color === c.token ? "border-foreground" : "border-border"
                    }`}
                    style={{ background: `hsl(var(--${c.token}))` }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TextFieldsPanel;
