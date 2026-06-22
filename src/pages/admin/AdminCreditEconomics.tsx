import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATALOG, VK_PER_CREDIT, USD_TO_EUR, CATEGORY_META,
  effectiveCredits, ekEur, vkEur, margeEur, formatEur,
  type Category,
} from "@/lib/credit-economics";
import { useCredits } from "@/hooks/useCredits";

export default function AdminCreditEconomics() {
  const { costs } = useCredits();
  const [credits, setCredits] = useState(200);
  const [vkTier, setVkTier] = useState<keyof typeof VK_PER_CREDIT>("best");
  const [filter, setFilter] = useState<Category | "all">("all");

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

  const filteredRows = filter === "all" ? rows : rows.filter((r) => r.t.category === filter);
  const lossActions = rows.filter((r) => r.margeBest < 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Credit-Ökonomie</h1>
        <p className="text-muted-foreground text-sm mt-1">
          EK = echte API-Kosten (Gemini, OpenAI, Veo, Ideogram, OUTVIN) · VK = Pack-Preis pro Credit ·
          Worst-Case basiert auf 200er-Pack ({formatEur(VK_PER_CREDIT.best)}/Cr). Kurs USD→EUR: {USD_TO_EUR}.
        </p>
      </div>

      {lossActions.length > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="text-sm font-semibold text-destructive mb-1">
            ⚠️ {lossActions.length} Aktion(en) im Minus (200er-Pack)
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {lossActions.map((r) => (
              <li key={r.t.id}>
                {r.t.icon} {r.t.label}: EK {formatEur(r.ek)} · VK {formatEur(r.vkBest)} · Marge {formatEur(r.margeBest)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Sim-Block */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Credits-Simulation</div>
            <div className="text-4xl font-bold tabular-nums">{credits}</div>
          </div>
          <div className="flex-1 max-w-xl">
            <Slider value={[credits]} min={10} max={1000} step={10} onValueChange={(v) => setCredits(v[0])} />
          </div>
          <div className="flex gap-2">
            {(["best", "mid", "worst"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setVkTier(k)}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${
                  vkTier === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                }`}
              >
                {k === "best" ? "200-Pack" : k === "mid" ? "50-Pack" : "10-Pack"}
                <span className="block text-[10px] opacity-70">{formatEur(VK_PER_CREDIT[k])}/Cr</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Kategorie-Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 text-xs rounded-full border ${filter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
        >
          Alle ({rows.length})
        </button>
        {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
          const count = rows.filter((r) => r.t.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1 text-xs rounded-full border ${filter === c ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {CATEGORY_META[c].icon} {CATEGORY_META[c].label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabelle */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">Aktion</th>
                <th className="text-left p-3">Modell / EK-Setup</th>
                <th className="text-right p-3">Cr</th>
                <th className="text-right p-3">EK</th>
                <th className="text-right p-3">VK 200</th>
                <th className="text-right p-3">VK 50</th>
                <th className="text-right p-3">VK 10</th>
                <th className="text-right p-3">Marge 200</th>
                <th className="text-right p-3">%</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.t.id} className="border-t border-border/30">
                  <td className="p-3">
                    <div className="font-medium">{r.t.icon} {r.t.label}</div>
                    <div className="text-[10px] text-muted-foreground">{r.t.produces}</div>
                    <Badge variant="outline" className="text-[9px] mt-1">
                      {CATEGORY_META[r.t.category].label}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.t.model}
                    <div className="text-[10px] opacity-70 mt-0.5">{r.t.ekBreakdown}</div>
                    <div className="text-[10px] opacity-50 italic">{r.t.source}</div>
                  </td>
                  <td className="p-3 text-right tabular-nums font-semibold">{r.credits}</td>
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
          {" "}<a className="underline" href="https://openai.com/api/pricing" target="_blank" rel="noreferrer">openai.com/api/pricing</a>,
          {" "}<a className="underline" href="https://about.ideogram.ai/api-pricing" target="_blank" rel="noreferrer">ideogram.ai/api-pricing</a>.
        </p>
        <p>
          Nicht enthalten: Stripe-Gebühren (~1,5 % + 0,25 €), Supabase-Storage/Egress, Resend-Mails, Vercel-Hosting.
        </p>
      </div>
    </div>
  );
}
