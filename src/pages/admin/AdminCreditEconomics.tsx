import { useEffect, useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATALOG, VK_PER_CREDIT, USD_TO_EUR, CATEGORY_META, FX_SOURCE,
  OPENAI_25_ESTIMATES, OPENAI_25_OUTPUT_FORMAT,
  calcOpenAi25Cost, breakEvenCredits, recommendedCredits,
  effectiveCredits, ekEur, vkEur, margeEur, formatEur,
  type Category, type OpenAi25Model,
} from "@/lib/credit-economics";
import { useCredits } from "@/hooks/useCredits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface MeasuredRow { tier: string | null; total_ek_usd: number | null; measurement_status: string }


function OpenAi25Simulator({ costs }: { costs: Record<string, Record<string, number>> }) {
  const [model, setModel] = useState<OpenAi25Model>("sunburst");
  const [refs, setRefs] = useState(4);
  const [outs, setOuts] = useState(8);
  const [promptTokens, setPromptTokens] = useState<number>(OPENAI_25_ESTIMATES.promptTokens);
  const [refTokens, setRefTokens] = useState<number>(OPENAI_25_ESTIMATES.imageInputTokensPerReference);
  const [outTokens, setOutTokens] = useState<number>(OPENAI_25_ESTIMATES.outputImageTokens);
  const [fxBufferPct, setFxBufferPct] = useState(0);
  const [measured, setMeasured] = useState<MeasuredRow[] | null>(null);

  useEffect(() => {
    let active = true;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    supabase
      .from("api_cost_events")
      .select("tier, total_ek_usd, measurement_status")
      .gte("created_at", since)
      .in("tier", ["flare", "sunburst"])
      .limit(2000)
      .then(({ data }) => { if (active) setMeasured((data as MeasuredRow[]) || []); });
    return () => { active = false; };
  }, []);

  const r = useMemo(() => calcOpenAi25Cost({
    model, referenceCount: refs, outputCount: outs,
    promptTokens, imageInputTokensPerReference: refTokens,
    outputImageTokens: outTokens, fxBufferPct,
  }), [model, refs, outs, promptTokens, refTokens, outTokens, fxBufferPct]);

  const configuredCredits = costs?.["image_remaster"]?.[model] ?? (model === "flare" ? 8 : 8);
  const ekPer = r.perOutputEur;

  const scenarios = (["basis", "topup"] as const).map((tierKey) => {
    const vk = vkEur(configuredCredits, tierKey);
    return {
      tierKey,
      vk,
      marge: vk - ekPer,
      margePct: vk > 0 ? ((vk - ekPer) / vk) * 100 : 0,
      breakEven: breakEvenCredits(ekPer, tierKey),
      rec70: recommendedCredits(ekPer, 0.70, tierKey),
      rec80: recommendedCredits(ekPer, 0.80, tierKey),
      rec85: recommendedCredits(ekPer, 0.85, tierKey),
    };
  });
  const anyLoss = scenarios.some((s) => s.marge < 0);

  const relevant = (measured || []).filter((m) => m.tier === model && typeof m.total_ek_usd === "number");
  const byStatus = (s: string) => relevant.filter((m) => m.measurement_status === s);
  const measuredRows = byStatus("measured");
  const partialRows = byStatus("partial");
  const estimatedRows = byStatus("estimated");
  const avg = (rows: MeasuredRow[]) =>
    rows.length ? rows.reduce((a, m) => a + (m.total_ek_usd || 0), 0) / rows.length : null;
  const measuredAvg = avg(measuredRows);
  const partialAvg = avg(partialRows);
  const measuredP95 = measuredRows.length >= 5
    ? [...measuredRows].map((m) => m.total_ek_usd || 0).sort((a, b) => a - b)[
        Math.min(measuredRows.length - 1, Math.ceil(measuredRows.length * 0.95) - 1)
      ]
    : null;


  const numField = (label: string, value: number, set: (n: number) => void, min: number, max: number, tag?: string) => (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">
        {label} {tag && <Badge variant="outline" className="text-[9px] ml-1">{tag}</Badge>}
      </Label>
      <Input type="number" min={min} max={max} value={value} className="h-8 text-xs"
        onChange={(e) => set(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))} />
    </div>
  );

  return (
    <Card className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">OpenAI Responses Kosten-Simulator (x Referenzen → y Bilder)</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            Ausgabe fix <strong>{OPENAI_25_OUTPUT_FORMAT.quality} / {OPENAI_25_OUTPUT_FORMAT.size}</strong>.
            Tokenpreise = <Badge variant="outline" className="text-[9px]">offizieller Tarif</Badge> (10.09.2026).
            Tokenmengen = <Badge variant="secondary" className="text-[9px]">Schätzung</Badge>, bis echte Usage vorliegt.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Referenz-Bild-Input fällt bei beiden Modellen pro erzeugtem Bild erneut an.
            {" "}Transferpfad: <strong>{r.transferNote}</strong>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Luna-Kosten sind bis zur echten Responses-Usage eine Näherung und werden
            nach echten Requests durch <code>data.usage</code> ersetzt.
          </p>

        </div>
        <div className="flex gap-2">
          {(["flare", "sunburst"] as const).map((m) => (
            <button key={m} onClick={() => setModel(m)}
              className={`px-3 py-1.5 text-xs rounded-md border transition ${model === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
              {m === "flare" ? "Flare" : "Sunburst"}
              <span className="block text-[10px] opacity-70">Responses + Luna + file_id</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {numField("Referenzbilder x", refs, setRefs, 1, 16)}
        {numField("Erzeugte Bilder y", outs, setOuts, 1, 30)}
        {numField("Prompt-Tokens", promptTokens, setPromptTokens, 100, 60000, "Annahme")}
        {numField("Image-Input/Ref.", refTokens, setRefTokens, 100, 20000, "Schätzung")}
        {numField("Output-Image-Tokens", outTokens, setOutTokens, 100, 20000, "Schätzung")}
        {numField("FX-Puffer %", fxBufferPct, setFxBufferPct, 0, 10)}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/50 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">GPT-Image Text-Input</span><span className="tabular-nums">${r.textInputUsd.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Referenz-Bild-Input (x·y)</span><span className="tabular-nums">${r.referenceImageInputUsd.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Bild-Output</span><span className="tabular-nums">${r.imageOutputUsd.toFixed(4)}</span></div>
          <div className="flex justify-between font-medium"><span>OpenAI Image Modellkosten</span><span className="tabular-nums">${r.imageModelUsd.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Luna-Orchestrator</span><span className="tabular-nums">${r.orchestratorUsd.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Datei-Transfer intern (einmaliger file_id-Upload)</span><span className="tabular-nums">${r.referenceUploadUsd.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">interner Overhead (× {outs} Requests, kein OpenAI-Entgelt)</span><span className="tabular-nums">${r.overheadUsd.toFixed(4)}</span></div>
          <div className="border-t border-border/40 mt-2 pt-2 flex justify-between font-semibold">
            <span>Gesamt-EK</span><span className="tabular-nums">${r.totalUsd.toFixed(4)} · {formatEur(r.totalEur)}</span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">EK pro erzeugtem Bild</span><span className="tabular-nums font-medium">{formatEur(ekPer)}</span></div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Kurs: {FX_SOURCE}{fxBufferPct > 0 ? ` + ${fxBufferPct}% Kalkulationspuffer (separat)` : ""}.
          </p>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            {measured === null ? <p>Messdaten werden geladen…</p> : (
              <>
                <p>
                  {measuredAvg === null
                    ? "Noch keine vollständig gemessenen 2.5-Kosten; Simulator/teilgemessene Daten verfügbar."
                    : `Vollständig gemessen (30 Tage, n=${measuredRows.length}): Ø $${measuredAvg.toFixed(4)} EK/Bild${measuredP95 !== null ? ` · P95 $${measuredP95.toFixed(4)}` : ""}.`}
                </p>
                <p>
                  Teilgemessen (nicht im Ø): n={partialRows.length}
                  {partialAvg !== null ? ` · Ø $${partialAvg.toFixed(4)}` : ""} ·
                  {" "}rein geschätzt: n={estimatedRows.length} (keine echte Usage).
                </p>
              </>
            )}
          </div>

        </div>

        <div className="rounded-lg border border-border/50 p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Produktiv konfigurierte Credits (image_remaster · {model})</span>
            <span className="font-semibold tabular-nums">{configuredCredits} Cr</span>
          </div>
          {scenarios.map((s) => (
            <div key={s.tierKey} className="rounded-md bg-muted/40 p-3 space-y-1">
              <div className="text-xs font-medium">
                {s.tierKey === "basis" ? "Basis-Abo 0,49 €/Cr" : "Top-Up 0,50 €/Cr"}
              </div>
              <div className="flex justify-between text-xs"><span>VK je Bild</span><span className="tabular-nums">{formatEur(s.vk)}</span></div>
              <div className={`flex justify-between text-xs font-medium ${s.marge >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                <span>Marge</span><span className="tabular-nums">{formatEur(s.marge)} · {s.margePct.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-xs"><span>Break-even</span><span className="tabular-nums">{s.breakEven} Cr</span></div>
              <div className="flex justify-between text-xs">
                <span>Empfohlen 70 / 80 / 85 %</span>
                <span className="tabular-nums">{s.rec70} / {s.rec80} / {s.rec85} Cr</span>
              </div>
            </div>
          ))}
          {anyLoss && (
            <div className="text-xs font-semibold text-destructive">
              ⚠️ Die konfigurierten {configuredCredits} Cr decken die Kosten in mindestens einem Szenario nicht.
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            VK-Rechnung derzeit auf angegebenem Tarifpreis (490 € / 100 €); USt.-Behandlung nicht abgezogen.
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function AdminCreditEconomics() {
  const { costs } = useCredits();
  const [credits, setCredits] = useState(200);
  const [vkTier, setVkTier] = useState<keyof typeof VK_PER_CREDIT>("basis");
  const [filter, setFilter] = useState<Category | "all">("all");

  const rows = useMemo(() => {
    return CATALOG.map((t) => {
      const c = effectiveCredits(t, costs);
      return {
        t,
        credits: c,
        ek: ekEur(t),
        vkBasis: vkEur(c, "basis"),
        vkTopup: vkEur(c, "topup"),
        margeBasis: margeEur(t, c, "basis"),
        marginPctBasis: (margeEur(t, c, "basis") / vkEur(c, "basis")) * 100,
      };
    });
  }, [costs]);

  const filteredRows = filter === "all" ? rows : rows.filter((r) => r.t.category === filter);
  const lossActions = rows.filter((r) => r.margeBasis < 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Credit-Ökonomie</h1>
        <p className="text-muted-foreground text-sm mt-1">
          EK = echte API-Kosten (Gemini, OpenAI Image, Veo 3.1, Ideogram, OUTVIN) +
          interne Kalkulationsannahmen: Overhead $0,014 je Aktion (Stripe, Resend,
          Edge-Compute, Egress, File-API-Quota) und Bild-Transfer $0,0005 je transportiertem Bild.
          Beides sind <strong>eigene interne Annahmen, keine OpenAI-API-Gebühren</strong>;
          der OpenAI-2.5-Simulator rechnet Requests und Referenztransfers modellabhängig hoch.
          VK = Preis pro Credit. Worst-Case basiert auf dem Basis-Abo ({formatEur(VK_PER_CREDIT.basis)}/Cr).
          Kurs USD→EUR: {USD_TO_EUR.toFixed(5)} ({FX_SOURCE}).
        </p>

        <p className="text-[11px] text-muted-foreground/70 mt-2">
          <strong>Nur ZWEI Tarife</strong> – totale Transparenz:
          Basis-Abo 1000 Cr → 490 € (0,49 €/Cr) · Top-Up 200 Cr → 100 € (0,50 €/Cr).
          Aktionen sind günstig kalkuliert (mehr Generierungen pro Abo);
          Landingpages bewusst hochpreisiger (Premium-Produkt).
        </p>
      </div>

      {lossActions.length > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="text-sm font-semibold text-destructive mb-1">
            ⚠️ {lossActions.length} Aktion(en) im Minus (Basis-Abo, 0,49 €/Cr)
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {lossActions.map((r) => (
              <li key={r.t.id}>
                {r.t.icon} {r.t.label}: EK {formatEur(r.ek)} · VK {formatEur(r.vkBasis)} · Marge {formatEur(r.margeBasis)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <OpenAi25Simulator costs={costs} />

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
            {(["basis", "topup"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setVkTier(k)}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${
                  vkTier === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                }`}
              >
                {k === "basis" ? "Basis-Abo (1000 Cr / 490 €)" : "Top-Up (200 Cr / 100 €)"}
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
                <th className="text-right p-3">VK Basis</th>
                <th className="text-right p-3">VK Top-Up</th>
                <th className="text-right p-3">Marge Basis</th>
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
                  <td className="p-3 text-right tabular-nums">{formatEur(r.vkBasis)}</td>
                  <td className="p-3 text-right tabular-nums">{formatEur(r.vkTopup)}</td>
                  <td className={`p-3 text-right tabular-nums font-medium ${r.margeBasis >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatEur(r.margeBasis)}
                  </td>
                  <td className="p-3 text-right">
                    <Badge variant={r.marginPctBasis >= 50 ? "default" : r.marginPctBasis >= 0 ? "secondary" : "destructive"}>
                      {r.marginPctBasis.toFixed(0)}%
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
          Im EK enthalten: alle API-Calls + Overhead $0,014 (Stripe, Resend, Edge-Compute, Egress)
          + $0,0005 pro transportiertem Bild (Gemini-File-API-Upload, Supabase-Storage-Egress).
        </p>
      </div>
    </div>
  );
}
