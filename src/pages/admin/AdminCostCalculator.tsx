import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, TrendingDown, Users, Server, HardDrive } from "lucide-react";

// ---------- Konstanten (EUR) ----------
const USD_EUR = 0.92;

// Preis pro Aktion (EK in €) – aus kosten-skalierung-chef-report.md
const ACTION_EK: Record<string, { label: string; ekEur: number; vkEur: number; storageMb: number }> = {
  image:   { label: "Bild (Nano Banana 2)",   ekEur: 0.039 * USD_EUR, vkEur: 0.49, storageMb: 0.6 },
  banner:  { label: "Banner Studio komplett", ekEur: 0.10  * USD_EUR, vkEur: 0.98, storageMb: 0.4 },
  video:   { label: "Video 8s (Veo 3.1)",     ekEur: 3.20  * USD_EUR, vkEur: 8.82, storageMb: 4   },
  landing: { label: "Landing Page (7 Bilder)",ekEur: 0.36  * USD_EUR, vkEur: 4.90, storageMb: 3   },
  pdf:     { label: "PDF-Analyse + VIN",      ekEur: 0.48  * USD_EUR, vkEur: 5.88, storageMb: 2   },
  song:    { label: "Song / Musik",           ekEur: 0.06  * USD_EUR, vkEur: 0.49, storageMb: 1   },
  damage:  { label: "Schadensanalyse",        ekEur: 0.05  * USD_EUR, vkEur: 0.49, storageMb: 0.6 },
};

// Cloud
const STORAGE_EUR_PER_GB = 0.021 * USD_EUR;
const EGRESS_EUR_PER_GB  = 0.09  * USD_EUR;
const OVERHEAD_EUR       = 0.014 * USD_EUR; // pro Aktion

// Fixkosten
const FIX_LOVABLE_PRO = 92;
const FIX_DOMAIN      = 2;

// Personalrollen (€/Monat brutto Vollkosten)
const ROLES = [
  { key: "founder",   label: "Gründer / GF",       cost: 6500 },
  { key: "dev",       label: "Full-Stack Dev",     cost: 8500 },
  { key: "support",   label: "Support-Mitarbeiter",cost: 4500 },
  { key: "onboard",   label: "Onboarding / CS",    cost: 4800 },
  { key: "marketing", label: "Marketing",          cost: 5500 },
  { key: "booking",   label: "Buchhaltung",        cost: 4500 },
  { key: "dsb",       label: "Externer DSB",       cost:  250 },
];

// Preset-Personalstände nach Kundenanzahl
function autoStaff(customers: number): Record<string, number> {
  if (customers <= 25)  return { founder: 1, dev: 0,   support: 0,   onboard: 0,   marketing: 0,   booking: 0,   dsb: 1 };
  if (customers <= 50)  return { founder: 1, dev: 0,   support: 0.5, onboard: 0,   marketing: 0,   booking: 0,   dsb: 1 };
  if (customers <= 100) return { founder: 1, dev: 0.5, support: 1,   onboard: 0,   marketing: 0,   booking: 0,   dsb: 1 };
  if (customers <= 200) return { founder: 1, dev: 1,   support: 1,   onboard: 0.5, marketing: 0.5, booking: 0,   dsb: 1 };
  if (customers <= 500) return { founder: 1, dev: 1,   support: 2,   onboard: 1,   marketing: 1,   booking: 0.5, dsb: 1 };
  return                       { founder: 1, dev: 2,   support: 3,   onboard: 2,   marketing: 1,   booking: 1,   dsb: 1 };
}

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmt2 = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export default function AdminCostCalculator() {
  // Basiseinstellungen
  const [customers, setCustomers] = useState(100);
  const [pricePerCustomer, setPricePerCustomer] = useState(490);
  const [imagesPerVehicle, setImagesPerVehicle] = useState(12);
  const [vkPerImage, setVkPerImage] = useState(0.49);
  const [staffPerVehicle, setStaffPerVehicle] = useState(0.5);

  // Aktions-Mix pro Kunde/Monat
  const [mix, setMix] = useState({
    image: 400,
    banner: 100,
    video: 20,
    landing: 30,
    pdf: 20,
    song: 10,
    damage: 5,
  });

  // Egress-Multiplikator (wie oft wird jedes File geladen)
  const [egressReads, setEgressReads] = useState(10);

  // Auto vs. manuell Personal
  const [autoStaffing, setAutoStaffing] = useState(true);
  const preset = autoStaff(customers);
  const [manualStaff, setManualStaff] = useState<Record<string, number>>(preset);
  const staff = autoStaffing ? preset : manualStaff;

  // ---- Berechnungen ----
  const calc = useMemo(() => {
    // pro Kunde
    let ekPerCustomer = 0;
    let storagePerCustomerMb = 0;
    let actionsPerCustomer = 0;
    for (const [k, count] of Object.entries(mix)) {
      const cfg = ACTION_EK[k];
      ekPerCustomer += (cfg.ekEur + OVERHEAD_EUR) * count;
      storagePerCustomerMb += cfg.storageMb * count;
      actionsPerCustomer += count;
    }
    const revenuePerCustomer = pricePerCustomer;

    // Skaliert
    const revenue = revenuePerCustomer * customers;
    const apiCost = ekPerCustomer * customers;

    // Storage kumulativ Monat 12 ~ 12x monatlicher Zuwachs (vereinfacht)
    const storageGbMonth = (storagePerCustomerMb * customers) / 1024;
    const storageCumulativeGb = storageGbMonth * 12;
    const storageCost = storageCumulativeGb * STORAGE_EUR_PER_GB;
    const egressCost  = storageGbMonth * egressReads * EGRESS_EUR_PER_GB;

    const fixCost = FIX_LOVABLE_PRO + FIX_DOMAIN;

    // Personal
    const staffLines = ROLES.map((r) => ({
      ...r,
      fte: staff[r.key] || 0,
      total: (staff[r.key] || 0) * r.cost,
    }));
    const staffCost = staffLines.reduce((s, l) => s + l.total, 0);

    const totalCost = apiCost + storageCost + egressCost + fixCost + staffCost;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      ekPerCustomer, actionsPerCustomer, storagePerCustomerMb,
      revenue, apiCost, storageCost, egressCost, fixCost, staffCost,
      staffLines, totalCost, profit, margin,
      storageCumulativeGb, storageGbMonth,
    };
  }, [customers, pricePerCustomer, mix, egressReads, staff]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="w-7 h-7 text-accent" /> Kostenrechner
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tools, Modelle, Cloud <em>und</em> Personal – frei parametrisierbar.
        </p>
      </div>

      {/* KPI Zusammenfassung */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Umsatz / Monat</div>
          <div className="text-2xl font-bold tabular-nums">{fmt(calc.revenue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Gesamtkosten / Monat</div>
          <div className="text-2xl font-bold tabular-nums">{fmt(calc.totalCost)}</div>
        </Card>
        <Card className={`p-4 ${calc.profit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-destructive/10"}`}>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {calc.profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            Gewinn / Monat
          </div>
          <div className={`text-2xl font-bold tabular-nums ${calc.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {fmt(calc.profit)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Marge</div>
          <div className="text-2xl font-bold tabular-nums">{calc.margin.toFixed(1)} %</div>
        </Card>
      </div>

      {/* Kosten pro Fahrzeugvolumen */}
      {(() => {
        const totalActions = Math.max(1, customers * calc.actionsPerCustomer);
        const ekPerImage = ACTION_EK.image.ekEur + OVERHEAD_EUR;
        const staffPerImage = calc.staffCost / totalActions;
        const serverPerImage = (calc.storageCost + calc.egressCost + calc.fixCost) / totalActions;
        const roundVk = (n: number) => {
          if (n < 10) return Math.ceil(n * 2) / 2;
          if (n < 100) return Math.ceil(n);
          if (n < 1000) return Math.ceil(n / 10) * 10;
          if (n < 10000) return Math.ceil(n / 100) * 100;
          return Math.ceil(n / 1000) * 1000;
        };
        const rows = [
          { label: "1 Fahrzeug", fz: 1 },
          { label: "/ Tag", fz: 100 },
          { label: "/ Woche", fz: 500 },
          { label: "/ Monat", fz: 2000 },
          { label: "/ Jahr", fz: 25000 },
        ].map((r) => {
          const bilder = r.fz * imagesPerVehicle;
          const credits = bilder; // 1 Credit / Bild
          const eurCredits = bilder * ekPerImage;
          const eurStaff = bilder * staffPerImage;
          const eurServer = bilder * serverPerImage;
          const summeEk = eurCredits + eurStaff + eurServer;
          const vk = bilder * vkPerImage;
          return { ...r, bilder, credits, eurCredits, eurStaff, eurServer, summeEk, vk, vkRund: roundVk(vk) };
        });
        return (
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4" /> Kosten pro Fahrzeugvolumen</div>
                <div className="text-[11px] text-muted-foreground">
                  Kalkuliert auf Basis der aktuellen Parameter · Kostenstellen anteilig auf Bild-Basis
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div>
                  <Label className="text-[10px]">Bilder / Fahrzeug</Label>
                  <Input type="number" className="h-8 w-20" value={imagesPerVehicle}
                    onChange={(e) => setImagesPerVehicle(Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label className="text-[10px]">VK / Bild (€)</Label>
                  <Input type="number" step="0.01" className="h-8 w-20" value={vkPerImage}
                    onChange={(e) => setVkPerImage(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-2 font-semibold">Fahrzeugvolumen</th>
                    <th className="text-right p-2 font-semibold">Anzahl Bilder</th>
                    <th className="text-right p-2 font-semibold">Credit-Volumen</th>
                    <th className="text-right p-2 font-semibold" colSpan={3}>Kostenstelle anteilig</th>
                    <th className="text-right p-2 font-semibold">Summe EK</th>
                    <th className="text-right p-2 font-semibold">VK</th>
                    <th className="text-right p-2 font-semibold">VK gerundet</th>
                  </tr>
                  <tr className="border-b text-[10px] text-muted-foreground">
                    <th></th><th></th><th></th>
                    <th className="text-right p-1">€/Credits</th>
                    <th className="text-right p-1">€/Mitarbeiter</th>
                    <th className="text-right p-1">€/Server</th>
                    <th></th><th></th><th></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium">{r.label} <span className="text-muted-foreground/70">({r.fz.toLocaleString("de-DE")} Fz)</span></td>
                      <td className="text-right p-2">{r.bilder.toLocaleString("de-DE")}</td>
                      <td className="text-right p-2">{r.credits.toLocaleString("de-DE")}</td>
                      <td className="text-right p-2">{fmt2(r.eurCredits)}</td>
                      <td className="text-right p-2">{fmt2(r.eurStaff)}</td>
                      <td className="text-right p-2">{fmt2(r.eurServer)}</td>
                      <td className="text-right p-2 font-semibold">{fmt2(r.summeEk)}</td>
                      <td className="text-right p-2">{fmt2(r.vk)}</td>
                      <td className="text-right p-2 font-bold text-emerald-600">{fmt(r.vkRund)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-muted-foreground pt-1 border-t">
              Basis pro Bild: EK-Credits {fmt2(ekPerImage)} · Mitarbeiter-Anteil {fmt2(staffPerImage)} · Server-Anteil {fmt2(serverPerImage)}
              · Verteilung auf {totalActions.toLocaleString("de-DE")} Aktionen/Monat ({customers} Kunden × {calc.actionsPerCustomer} Aktionen)
            </div>
          </Card>
        );
      })()}

      <div className="grid md:grid-cols-2 gap-6">

        {/* Linke Spalte: Inputs */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold"><Users className="w-4 h-4" /> Kunden & Preis</div>
            <div>
              <Label className="text-xs">Kundenanzahl: <span className="font-bold">{customers}</span></Label>
              <Slider value={[customers]} min={1} max={2000} step={1} onValueChange={(v) => setCustomers(v[0])} />
              <div className="flex gap-1 mt-2">
                {[1, 10, 25, 50, 100, 250, 500, 1000, 2000].map((n) => (
                  <button key={n} onClick={() => setCustomers(n)}
                    className="px-2 py-0.5 text-[10px] rounded border hover:bg-accent hover:text-accent-foreground">
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Preis pro Kunde / Monat (€)</Label>
              <Input type="number" value={pricePerCustomer} onChange={(e) => setPricePerCustomer(Number(e.target.value) || 0)} />
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Server className="w-4 h-4" /> Nutzung pro Kunde / Monat</div>
            {Object.entries(ACTION_EK).map(([k, cfg]) => (
              <div key={k} className="grid grid-cols-[1fr_auto_80px] items-center gap-2">
                <div className="text-xs">{cfg.label}
                  <span className="text-muted-foreground/70 ml-1">
                    · EK {fmt2(cfg.ekEur)} · VK {fmt2(cfg.vkEur)}
                  </span>
                </div>
                <Slider className="w-32" value={[mix[k as keyof typeof mix]]} min={0} max={k === "video" ? 100 : 1000} step={k === "video" ? 1 : 10}
                  onValueChange={(v) => setMix((m) => ({ ...m, [k]: v[0] }))} />
                <Input type="number" className="h-8" value={mix[k as keyof typeof mix]}
                  onChange={(e) => setMix((m) => ({ ...m, [k]: Number(e.target.value) || 0 }))} />
              </div>
            ))}
            <div className="text-[11px] text-muted-foreground pt-1 border-t">
              Aktionen/Kunde: <b>{calc.actionsPerCustomer}</b> · EK/Kunde: <b>{fmt2(calc.ekPerCustomer)}</b> · Storage/Kunde: <b>{calc.storagePerCustomerMb.toFixed(0)} MB/Monat</b>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><HardDrive className="w-4 h-4" /> Cloud & Egress</div>
            <div>
              <Label className="text-xs">Downloads pro File / Monat: <span className="font-bold">{egressReads}×</span></Label>
              <Slider value={[egressReads]} min={0} max={50} step={1} onValueChange={(v) => setEgressReads(v[0])} />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Storage kumulativ M12: <b>{calc.storageCumulativeGb.toFixed(1)} GB</b> · Egress-Traffic: <b>{(calc.storageGbMonth * egressReads).toFixed(1)} GB/Monat</b>
            </div>
          </Card>
        </div>

        {/* Rechte Spalte: Personal + Aufschlüsselung */}
        <div className="space-y-6">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold"><Users className="w-4 h-4" /> Personal</div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={autoStaffing} onChange={(e) => setAutoStaffing(e.target.checked)} />
                Auto-Empfehlung nach Kundenanzahl
              </label>
            </div>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <div key={r.key} className="grid grid-cols-[1fr_120px_100px] items-center gap-2">
                  <div className="text-xs">{r.label}
                    <span className="text-muted-foreground/70 ml-1">· {fmt(r.cost)}/FTE</span>
                  </div>
                  <Input type="number" step="0.5" min="0" disabled={autoStaffing}
                    value={staff[r.key] || 0}
                    onChange={(e) => setManualStaff((s) => ({ ...s, [r.key]: Number(e.target.value) || 0 }))}
                    className="h-8" />
                  <div className="text-xs tabular-nums text-right">{fmt((staff[r.key] || 0) * r.cost)}</div>
                </div>
              ))}
            </div>
            <div className="text-xs pt-2 border-t flex justify-between">
              <span className="text-muted-foreground">Personalkosten gesamt</span>
              <span className="font-bold">{fmt(calc.staffCost)}</span>
            </div>
          </Card>

          <Card className="p-5 space-y-2">
            <div className="font-semibold">Kostenaufschlüsselung / Monat</div>
            {[
              { label: "API / Modellkosten", v: calc.apiCost, color: "bg-blue-500" },
              { label: "Storage (kumulativ M12)", v: calc.storageCost, color: "bg-purple-500" },
              { label: "Egress / Bandbreite", v: calc.egressCost, color: "bg-cyan-500" },
              { label: "Fixkosten (Lovable + Domain)", v: calc.fixCost, color: "bg-slate-500" },
              { label: "Personal", v: calc.staffCost, color: "bg-orange-500" },
            ].map((row) => {
              const pct = calc.totalCost > 0 ? (row.v / calc.totalCost) * 100 : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{row.label}</span>
                    <span className="tabular-nums font-medium">{fmt(row.v)} <Badge variant="outline" className="ml-1">{pct.toFixed(0)}%</Badge></span>
                  </div>
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 mt-2 border-t flex justify-between text-sm font-bold">
              <span>Gesamt</span>
              <span className="tabular-nums">{fmt(calc.totalCost)}</span>
            </div>
          </Card>

          <Card className="p-5">
            <div className="font-semibold mb-2">Deckungsbeitrag pro Kunde</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-muted-foreground">Umsatz</div>
                <div className="text-sm font-bold">{fmt(pricePerCustomer)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Variable Kosten</div>
                <div className="text-sm font-bold">{fmt2(calc.ekPerCustomer)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">DB pro Kunde</div>
                <div className={`text-sm font-bold ${pricePerCustomer - calc.ekPerCustomer >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {fmt2(pricePerCustomer - calc.ekPerCustomer)}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-3 pt-3 border-t">
              Break-Even (Fix + Personal): <b>{Math.ceil((calc.fixCost + calc.staffCost) / Math.max(0.01, pricePerCustomer - calc.ekPerCustomer))}</b> Kunden
              bei aktuellem Mix.
            </div>
          </Card>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Quellen: Lovable Cloud (Supabase Pro) Storage $0,021/GB, Egress $0,09/GB · Google Gemini, OpenAI, Veo 3.1, Ideogram (offizielle API-Preise, Kurs USD→EUR {USD_EUR}) · Personalkosten = Vollkosten (brutto + AG-Anteil + Overhead), Werte aus Marktrecherche Berlin/NRW 2026.
      </div>
    </div>
  );
}
