import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATALOG, VK_PER_CREDIT, USD_TO_EUR,
  effectiveCredits, ekEur, vkEur, margeEur, formatEur,
} from "@/lib/credit-economics";
import { useCredits } from "@/hooks/useCredits";

export default function AdminCreditEconomics() {
  const { costs } = useCredits();
  const [credits, setCredits] = useState(50);
  const [vkTier, setVkTier] = useState<keyof typeof VK_PER_CREDIT>("best");

  const rows = useMemo(() => {
    return CATALOG.map((t) => {
      const c = effectiveCredits(t, costs);
      return {
        t,
        credits: c,
        ek: ekEur(t),
        vkBest: vkEur(c, "best"),
        vkMid: vkEur(c, "mid"),
        vkWorst: vkEur(c, "worst"),
        margeBest: margeEur(t, c, "best"),
        marginPctBest: (margeEur(t, c, "best") / vkEur(c, "best")) * 100,
      };
    });
  }, [costs]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Credit-Ökonomie</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Interne Ansicht: EK = echte API-Kosten · VK = Verkaufspreis pro Credit-Pack ·
          Marge Worst-Case basiert auf dem günstigsten 200er-Pack ({formatEur(VK_PER_CREDIT.best)} /
          Credit). Kurs USD→EUR: {USD_TO_EUR}.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Credits-Simulation</div>
            <div className="text-4xl font-bold tabular-nums">{credits}</div>
          </div>
          <div className="flex-1 max-w-xl">
            <Slider
              value={[credits]}
              min={5}
              max={500}
              step={5}
              onValueChange={(v) => setCredits(v[0])}
            />
          </div>
          <div className="flex gap-2">
            {(["best", "mid", "worst"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setVkTier(k)}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${
                  vkTier === k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                {k === "best" ? "200-Pack" : k === "mid" ? "50-Pack" : "10-Pack"}
                <span className="block text-[10px] opacity-70">
                  {formatEur(VK_PER_CREDIT[k])}/Cr
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {CATALOG.slice(0, 8).map((t) => {
            const c = effectiveCredits(t, costs);
            const possible = Math.floor(credits / c);
            const ek = ekEur(t) * possible;
            const vk = vkEur(c, vkTier) * possible;
            return (
              <div
                key={`${t.action}-${t.tier}-${t.label}`}
                className="p-3 rounded-lg bg-background/60 border border-border/40"
              >
                <div className="text-xs text-muted-foreground">{t.icon} {t.label}</div>
                <div className="text-2xl font-bold tabular-nums mt-1">{possible}</div>
                <div className="text-[10px] text-muted-foreground">
                  EK {formatEur(ek)} · VK {formatEur(vk)}
                </div>
                <div className={`text-[10px] font-medium ${vk - ek >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  Marge {formatEur(vk - ek)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">Aktion</th>
                <th className="text-left p-3">Modell</th>
                <th className="text-right p-3">Credits</th>
                <th className="text-right p-3">EK</th>
                <th className="text-right p-3">VK 200</th>
                <th className="text-right p-3">VK 50</th>
                <th className="text-right p-3">VK 10</th>
                <th className="text-right p-3">Marge 200</th>
                <th className="text-right p-3">Marge %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.t.action}-${r.t.tier}-${r.t.label}`} className="border-t border-border/30">
                  <td className="p-3">
                    <div className="font-medium">{r.t.icon} {r.t.label}</div>
                    <div className="text-[10px] text-muted-foreground">{r.t.produces}</div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.t.model}
                    <div className="text-[10px] opacity-70">{r.t.source}</div>
                  </td>
                  <td className="p-3 text-right tabular-nums">{r.credits}</td>
                  <td className="p-3 text-right tabular-nums">{formatEur(r.ek)}</td>
                  <td className="p-3 text-right tabular-nums">{formatEur(r.vkBest)}</td>
                  <td className="p-3 text-right tabular-nums">{formatEur(r.vkMid)}</td>
                  <td className="p-3 text-right tabular-nums">{formatEur(r.vkWorst)}</td>
                  <td className={`p-3 text-right tabular-nums font-medium ${r.margeBest >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatEur(r.margeBest)}
                  </td>
                  <td className="p-3 text-right">
                    <Badge variant={r.marginPctBest >= 50 ? "default" : r.marginPctBest >= 0 ? "secondary" : "destructive"}>
                      {r.marginPctBest.toFixed(0)}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          Quellen: <a className="underline" href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">ai.google.dev/gemini-api/docs/pricing</a>,
          {" "}<a className="underline" href="https://openai.com/api/pricing" target="_blank" rel="noreferrer">openai.com/api/pricing</a>.
        </p>
        <p>
          Nicht enthalten: Stripe-Gebühren (~1,5 % + 0,25 €), Supabase-Storage/Egress, Resend-Mails.
          Bei externen Kosten (z. B. DAT/VIN-Lookups) bitte Quelle nachreichen.
        </p>
      </div>
    </div>
  );
}
