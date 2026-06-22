import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATALOG, CATEGORY_META, effectiveCredits, type ActionTier, type Category,
} from "@/lib/credit-economics";
import { useCredits } from "@/hooks/useCredits";

// Eine Repräsentations-Aktion pro Kategorie (für Mix-Auflösung):
// nimmt die "mittlere" / verbreitetste Variante.
const REPR_PER_CATEGORY: Partial<Record<Category, string>> = {
  image:    "image-qualitaet",
  remaster: "remaster-qualitaet",
  banner:   "banner-studio-qualitaet",
  video:    "video-standard",
  landing:  "landing-standard",
  damage:   "damage-analysis",
  analysis: "pdf-analysis",
};

const MIX_CATEGORIES: Category[] = ["image", "remaster", "banner", "video", "landing", "damage", "analysis"];

export default function CreditSlider({
  defaultCredits = 200,
  min = 10,
  max = 1000,
}: { defaultCredits?: number; min?: number; max?: number }) {
  const [credits, setCredits] = useState(defaultCredits);
  const { costs } = useCredits();

  // Prozent-Verteilung pro Kategorie (Default: nur "image" voll)
  const [mix, setMix] = useState<Record<Category, number>>(() => {
    const init: Record<string, number> = {};
    MIX_CATEGORIES.forEach((c) => (init[c] = 0));
    init.image = 40;
    init.remaster = 30;
    init.banner = 15;
    init.video = 10;
    init.landing = 5;
    return init as Record<Category, number>;
  });

  const total = 100;

  const reprMap = useMemo(() => {
    const m: Partial<Record<Category, ActionTier>> = {};
    MIX_CATEGORIES.forEach((c) => {
      const id = REPR_PER_CATEGORY[c];
      m[c] = CATALOG.find((t) => t.id === id);
    });
    return m;
  }, []);

  // Aufteilung der Credits gemäß Mix → Anzahl Stück pro Kategorie
  const rows = MIX_CATEGORIES.map((c) => {
    const tier = reprMap[c];
    if (!tier) return null;
    const pct = (mix[c] || 0) / total;
    const allocated = Math.floor(credits * pct);
    const perItem = effectiveCredits(tier, costs);
    const count = Math.floor(allocated / perItem);
    return { cat: c, tier, pct: Math.round(pct * 100), allocated, perItem, count };
  }).filter(Boolean) as Array<{ cat: Category; tier: ActionTier; pct: number; allocated: number; perItem: number; count: number }>;

  // Auto-Balance: erhöht der Nutzer einen Wert, schrumpfen die anderen
  // proportional, sodass die Summe immer = 100 % bleibt.
  const setPct = (target: Category, newVal: number) => {
    setMix((m) => {
      const clamped = Math.max(0, Math.min(100, newVal));
      const remaining = 100 - clamped;
      const others = MIX_CATEGORIES.filter((c) => c !== target);
      const othersSum = others.reduce((s, c) => s + (m[c] || 0), 0);
      const next: Record<string, number> = { [target]: clamped };
      if (othersSum === 0) {
        // Gleichmäßig auf alle anderen verteilen
        const share = remaining / others.length;
        others.forEach((c) => (next[c] = share));
      } else {
        others.forEach((c) => {
          next[c] = ((m[c] || 0) / othersSum) * remaining;
        });
      }
      // Auf ganze Zahlen runden, Rest dem größten "other" zuschlagen
      const rounded: Record<string, number> = {};
      let sumRounded = 0;
      MIX_CATEGORIES.forEach((c) => {
        rounded[c] = Math.round(next[c] || 0);
        sumRounded += rounded[c];
      });
      const diff = 100 - sumRounded;
      if (diff !== 0) {
        const biggestOther = others.reduce((a, b) =>
          (rounded[a] >= rounded[b] ? a : b),
        );
        rounded[biggestOther] = Math.max(0, rounded[biggestOther] + diff);
      }
      return rounded as Record<Category, number>;
    });
  };


  return (
    <Card className="p-6 md:p-8 bg-card border-border/50 rounded-2xl">
      <div className="space-y-2">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Was kann ich mit meinen Credits machen?
        </h3>
        <p className="text-sm text-muted-foreground">
          Stell oben dein Budget ein, dann verteil unten die Prozente auf die Bereiche – du siehst live, wie viele Inhalte rauskommen.
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
          step={10}
          onValueChange={(v) => setCredits(v[0])}
          className="my-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}</span><span>{max}</span>
        </div>
      </div>

      {/* Mix-Allokator */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Aufteilung
          </h4>
          <Badge variant="outline" className="text-[10px]">
            Summe: 100% (Auto-Balance)
          </Badge>
        </div>

        {rows.map((r) => {
          const meta = CATEGORY_META[r.cat];
          return (
            <div
              key={r.cat}
              className={`p-4 rounded-xl border border-border/40 bg-gradient-to-br ${meta.color}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.tier.label} · {r.perItem} Cr/Stück
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold tabular-nums leading-none">{r.count}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                    Stück
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[mix[r.cat] || 0]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setPct(r.cat, v[0])}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-14 text-right tabular-nums">
                  {r.pct}%
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                ≈ {r.allocated} Credits zugeteilt
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-6 leading-relaxed">
        Hinweis: Eine Landingpage erzeugt automatisch 6–8 KI-Bilder, eine Schadensanalyse
        beinhaltet annotierte Fotos. Tatsächlicher Verbrauch hängt vom gewählten Qualitäts-Modell ab.
      </p>
    </Card>
  );
}
