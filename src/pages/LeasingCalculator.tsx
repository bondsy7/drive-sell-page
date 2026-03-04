import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function parseGermanNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[€%\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatEuro(num: number): string {
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatEuroInput(str: string): string {
  if (!str.trim()) return '';
  const num = parseGermanNumber(str);
  if (num === 0) return '0,00';
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface LeasingFactorRating {
  label: string;
  color: string;
  icon: React.ReactNode;
}

function rateLeasingFactor(factor: number): LeasingFactorRating {
  if (factor <= 0) return { label: '–', color: 'text-muted-foreground', icon: <Minus className="w-4 h-4" /> };
  if (factor < 0.7) return { label: 'Sehr gut', color: 'text-green-600', icon: <TrendingDown className="w-4 h-4" /> };
  if (factor <= 1.0) return { label: 'Gut', color: 'text-emerald-600', icon: <TrendingDown className="w-4 h-4" /> };
  if (factor <= 1.3) return { label: 'OK', color: 'text-yellow-600', icon: <Minus className="w-4 h-4" /> };
  return { label: 'Teuer', color: 'text-red-600', icon: <TrendingUp className="w-4 h-4" /> };
}

const LeasingCalculator = () => {
  const [price, setPrice] = useState('');
  const [residualValue, setResidualValue] = useState('');
  const [specialPayment, setSpecialPayment] = useState('');
  const [months, setMonths] = useState('48');
  const [interestRate, setInterestRate] = useState('');

  const result = useMemo(() => {
    const p = parseGermanNumber(price);
    const rv = parseGermanNumber(residualValue);
    const sp = parseGermanNumber(specialPayment);
    const m = parseInt(months) || 0;
    const rate = parseGermanNumber(interestRate) / 100;

    if (p <= 0 || m <= 0) return null;

    // Praxisformel: Rate = (P - RW - SZ) / n + (P + RW) / 2 * (Zins / 12)
    const depreciation = (p - rv - sp) / m;
    const interest = ((p + rv) / 2) * (rate / 12);
    const monthlyRate = depreciation + interest;

    // Leasingfaktor = Rate / Bruttolistenpreis * 100
    const leasingFactor = p > 0 ? (monthlyRate / p) * 100 : 0;

    return {
      monthlyRate: Math.max(0, monthlyRate),
      depreciation,
      interest,
      leasingFactor,
      totalCost: Math.max(0, monthlyRate) * m + sp,
    };
  }, [price, residualValue, specialPayment, months, interestRate]);

  const rating = result ? rateLeasingFactor(result.leasingFactor) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <Calculator className="w-6 h-6 text-accent" />
          <h1 className="text-xl font-bold text-foreground font-['Space_Grotesk']">Leasing-Rechner</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-['Space_Grotesk']">Fahrzeugdaten eingeben</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">Fahrzeugpreis (brutto)</Label>
                <div className="relative">
                  <Input
                    id="price"
                    placeholder="z.B. 52.990"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    onBlur={() => setPrice(formatEuroInput(price))}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="residual">Restwert</Label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs">Der kalkulierte Fahrzeugwert am Ende der Laufzeit. Je höher, desto niedriger die Rate.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative">
                  <Input
                    id="residual"
                    placeholder="z.B. 20.000"
                    value={residualValue}
                    onChange={e => setResidualValue(e.target.value)}
                    onBlur={() => setResidualValue(formatEuroInput(residualValue))}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="special">Sonderzahlung</Label>
                <div className="relative">
                  <Input
                    id="special"
                    placeholder="z.B. 0"
                    value={specialPayment}
                    onChange={e => setSpecialPayment(e.target.value)}
                    onBlur={() => setSpecialPayment(formatEuroInput(specialPayment))}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="months">Laufzeit</Label>
                <div className="relative">
                  <Input
                    id="months"
                    placeholder="48"
                    value={months}
                    onChange={e => setMonths(e.target.value)}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Monate</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="interest">Zinssatz (p.a.)</Label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs">Jährlicher Zinssatz in Prozent. Typisch: 1–5 %.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative">
                  <Input
                    id="interest"
                    placeholder="z.B. 3,99"
                    value={interestRate}
                    onChange={e => setInterestRate(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && result.monthlyRate > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Rate */}
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Monatliche Leasingrate</p>
                <p className="text-4xl font-bold text-foreground font-['Space_Grotesk']">
                  {formatEuro(result.monthlyRate)}
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Abschreibung (Wertverlust)</span>
                    <span className="font-medium text-foreground">{formatEuro(Math.max(0, result.depreciation))}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Zinsanteil</span>
                    <span className="font-medium text-foreground">{formatEuro(result.interest)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-muted-foreground">
                    <span>Gesamtkosten über Laufzeit</span>
                    <span className="font-medium text-foreground">{formatEuro(result.totalCost)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leasing Factor */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-muted-foreground">Leasingfaktor</p>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-[260px]">
                      <p className="text-xs">Leasingfaktor = Rate / Bruttolistenpreis × 100. Je niedriger, desto besser das Angebot.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-4xl font-bold text-foreground font-['Space_Grotesk']">
                  {result.leasingFactor.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {rating && (
                  <div className={`mt-2 flex items-center gap-1.5 ${rating.color}`}>
                    {rating.icon}
                    <span className="font-semibold text-sm">{rating.label}</span>
                  </div>
                )}

                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bewertungstabelle</p>
                  {[
                    { range: 'unter 0,7', label: 'Sehr gut', active: result.leasingFactor < 0.7 },
                    { range: '0,7 – 1,0', label: 'Gut', active: result.leasingFactor >= 0.7 && result.leasingFactor <= 1.0 },
                    { range: '1,0 – 1,3', label: 'OK', active: result.leasingFactor > 1.0 && result.leasingFactor <= 1.3 },
                    { range: 'über 1,5', label: 'Teuer', active: result.leasingFactor > 1.5 },
                  ].map(row => (
                    <div
                      key={row.range}
                      className={`flex justify-between text-sm px-3 py-1.5 rounded-md transition-colors ${
                        row.active ? 'bg-accent/10 font-semibold text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <span>{row.range}</span>
                      <span>{row.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Formula explanation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-['Space_Grotesk']">Berechnungsformel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="bg-muted rounded-lg p-4 font-mono text-xs text-foreground text-center">
              Rate = (Preis − Restwert − Sonderzahlung) / Laufzeit + (Preis + Restwert) / 2 × Zinssatz / 12
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-foreground mb-1">Teil 1 – Abschreibung</p>
                <p>Der monatliche Wertverlust: (Preis − Restwert − Sonderzahlung) geteilt durch die Laufzeit in Monaten.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Teil 2 – Zinsen</p>
                <p>Die Bank finanziert im Schnitt den mittleren Fahrzeugwert (Preis + Restwert) / 2. Darauf werden monatliche Zinsen berechnet.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LeasingCalculator;
