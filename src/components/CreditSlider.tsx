import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CREDIT_ITEMS } from "@/lib/credit-prices";

const ITEMS = PRODUCT_CREDIT_ITEMS.filter((i) => i.inCalculator);

const DEFAULT_MIX: Record<string, number> = {
  vehicle: 50,
  social: 15,
  banner: 10,
  landing: 15,
  video: 10,
  "single-image": 0,
};

export default function CreditSlider({
  defaultCredits = 1000,
  min = 100,
  max = 4000,
}: { defaultCredits?: number; min?: number; max?: number }) {
  const [credits, setCredits] = useState(defaultCredits);

  const [mix, setMix] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    ITEMS.forEach((i) => (init[i.key] = DEFAULT_MIX[i.key] ?? 0));
    return init;
  });

  const rows = useMemo(
    () =>
      ITEMS.map((item) => {
        const pct = mix[item.key] || 0;
        const allocated = Math.floor((credits * pct) / 100);
        return {
          item,
          pct,
          allocated,
          count: Math.floor(allocated / item.credits),
        };
      }),
    [credits, mix],
  );

  const usedCredits = rows.reduce((s, r) => s + r.count * r.item.credits, 0);

  // Auto-Balance: Summe bleibt immer 100 %
  const setPct = (target: string, newVal: number) => {
    setMix((m) => {
      const clamped = Math.max(0, Math.min(100, newVal));
      const remaining = 100 - clamped;
      const others = ITEMS.map((i) => i.key).filter((k) => k !== target);
      const othersSum = others.reduce((s, k) => s + (m[k] || 0), 0);
      const next: Record<string, number> = { [target]: clamped };
      if (othersSum === 0) {
        const share = remaining / others.length;
        others.forEach((k) => (next[k] = share));
      } else {
        others.forEach((k) => {
          next[k] = ((m[k] || 0) / othersSum) * remaining;
        });
      }
      const rounded: Record<string, number> = {};
      let sum = 0;
      ITEMS.forEach((i) => {
        rounded[i.key] = Math.round(next[i.key] || 0);
        sum += rounded[i.key];
      });
      const diff = 100 - sum;
      if (diff !== 0) {
        const biggest = others.reduce((a, b) => (rounded[a] >= rounded[b] ? a : b));
        rounded[biggest] = Math.max(0, rounded[biggest] + diff);
      }
      return rounded;
    });
  };

  return (
    <Card className="p-6 md:p-8 bg-card border-border/50 rounded-2xl">
      <div className="space-y-2">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Was kann ich mit meinen Credits machen?
        </h3>
        <p className="text-sm text-muted-foreground">
          Budget einstellen, Prozente verteilen – du siehst sofort, wie viele Fahrzeuge, Posts,
          Banner, Landingpages und Videos damit möglich sind.
        </p>
      </div>

      {/* Budget */}
      <div className="mt-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Credit-Budget</span>
          <span className="text-4xl font-bold tabular-nums text-foreground">{credits}</span>
        </div>
        <Slider
          value={[credits]}
          min={min}
          max={max}
          step={50}
          onValueChange={(v) => setCredits(v[0])}
          className="my-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}</span><span>{max}</span>
        </div>
      </div>

      {/* Verteilung */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Aufteilung
          </h4>
          <Badge variant="outline" className="text-[10px]">
            Summe: 100% (Auto-Balance)
          </Badge>
        </div>

        {rows.map((r) => (
          <div
            key={r.item.key}
            className={`p-4 rounded-xl border border-border/40 bg-gradient-to-br ${r.item.color}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{r.item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{r.item.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.item.credits} Credits · {r.item.hint}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold tabular-nums leading-none">{r.count}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {r.item.unit}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[r.pct]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => setPct(r.item.key, v[0])}
                className="flex-1"
              />
              <span className="text-xs font-mono w-14 text-right tabular-nums">{r.pct}%</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              ≈ {r.allocated} Credits zugeteilt
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Verplant</span>
          <span className="font-semibold tabular-nums">{usedCredits} Credits</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-muted-foreground">Rest</span>
          <span className="font-semibold tabular-nums">{credits - usedCredits} Credits</span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-4 leading-relaxed">
        Preise je Leistung: Fahrzeugserie 16 · Social-Post 5 · Banner 5 · Landingpage 19 · Video 17 ·
        Einzelbild 1 Credit. Nicht verbrauchte Paket-Credits verfallen zum Ende des Abrechnungsmonats,
        separat nachgekaufte Credits bleiben erhalten.
      </p>
    </Card>
  );
}
