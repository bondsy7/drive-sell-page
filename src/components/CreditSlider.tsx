import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { CATALOG, effectiveCredits, type ActionTier } from "@/lib/credit-economics";
import { useCredits } from "@/hooks/useCredits";

// Reihenfolge & Auswahl für Kunden-Ansicht (keine internen Stufen)
const CUSTOMER_KEYS: Array<{ action: string; tier: string }> = [
  { action: "image_generate", tier: "schnell" },
  { action: "image_generate", tier: "qualitaet" },
  { action: "image_generate", tier: "ultra" }, // Banner == ultra
  { action: "image_remaster", tier: "qualitaet" },
  { action: "spin360_generate", tier: "standard" },
  { action: "video_generate", tier: "standard" },
  { action: "landing_page_export", tier: "standard" },
];

function pick(action: string, tier: string): ActionTier | undefined {
  return CATALOG.find((t) => t.action === action && t.tier === tier);
}

export default function CreditSlider({
  defaultCredits = 50,
  min = 5,
  max = 500,
}: { defaultCredits?: number; min?: number; max?: number }) {
  const [credits, setCredits] = useState(defaultCredits);
  const { costs } = useCredits();

  const items = useMemo(() => {
    return CUSTOMER_KEYS.map((k) => pick(k.action, k.tier)).filter(Boolean) as ActionTier[];
  }, []);

  return (
    <Card className="p-6 md:p-8 bg-card border-border/50 rounded-2xl">
      <div className="space-y-2">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Was kann ich mit Credits machen?
        </h3>
        <p className="text-sm text-muted-foreground">
          Schieb den Regler – siehe sofort, wie viele Inhalte du erstellen kannst.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Credits</span>
          <span className="text-4xl font-bold tabular-nums text-foreground">{credits}</span>
        </div>
        <Slider
          value={[credits]}
          min={min}
          max={max}
          step={5}
          onValueChange={(v) => setCredits(v[0])}
          className="my-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((t) => {
          const c = effectiveCredits(t, costs);
          const possible = Math.floor(credits / c);
          return (
            <div
              key={`${t.action}-${t.tier}`}
              className="flex items-center gap-4 p-4 rounded-xl bg-background/60 border border-border/40 hover:border-border transition"
            >
              <div className="text-3xl shrink-0">{t.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{t.label}</div>
                <div className="text-xs text-muted-foreground">{c} Credits / Stück</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold tabular-nums text-primary">{possible}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  möglich
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-6 leading-relaxed">
        Angaben gerundet. Tatsächlicher Verbrauch hängt vom gewählten Qualitäts-Modell ab.
        Aktuelle Preise siehe Tabelle in den Plänen.
      </p>
    </Card>
  );
}
