import React, { useState, useMemo } from 'react';
import { Banknote, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppHeader from '@/components/AppHeader';

function parseGermanNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[€%\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
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

const FinancingCalculator = () => {
  const [price, setPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [finalPayment, setFinalPayment] = useState('');
  const [months, setMonths] = useState('48');
  const [interestRate, setInterestRate] = useState('');

  const result = useMemo(() => {
    const p = parseGermanNumber(price);
    const dp = parseGermanNumber(downPayment);
    const fp = parseGermanNumber(finalPayment);
    const n = parseInt(months) || 0;
    const annual = parseGermanNumber(interestRate) / 100;
    if (p <= 0 || n <= 0) return null;

    const credit = p - dp;
    if (credit <= 0) return null;

    const i = annual / 12;
    let monthlyRate: number;

    if (fp > 0) {
      const pvFinal = fp / Math.pow(1 + i, n);
      const adjustedCredit = credit - pvFinal;
      if (i <= 0) { monthlyRate = adjustedCredit / n; }
      else { monthlyRate = (adjustedCredit * i) / (1 - Math.pow(1 + i, -n)); }
    } else {
      if (i <= 0) { monthlyRate = credit / n; }
      else { monthlyRate = (credit * i) / (1 - Math.pow(1 + i, -n)); }
    }

    const totalPaid = monthlyRate * n + dp + fp;
    const totalInterest = totalPaid - p;

    return {
      monthlyRate: Math.max(0, monthlyRate),
      credit,
      totalPaid,
      totalInterest: Math.max(0, totalInterest),
    };
  }, [price, downPayment, finalPayment, months, interestRate]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-['Space_Grotesk']">Fahrzeugdaten eingeben</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fp-price">Fahrzeugpreis</Label>
                <div className="relative">
                  <Input id="fp-price" placeholder="z.B. 52.990" value={price} onChange={e => setPrice(e.target.value)} onBlur={() => setPrice(formatEuroInput(price))} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-down">Anzahlung</Label>
                <div className="relative">
                  <Input id="fp-down" placeholder="z.B. 5.000" value={downPayment} onChange={e => setDownPayment(e.target.value)} onBlur={() => setDownPayment(formatEuroInput(downPayment))} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="fp-final">Schlussrate</Label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs">Bei Ballonfinanzierung: Schlussrate am Ende der Laufzeit. Leer lassen für klassische Finanzierung.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative">
                  <Input id="fp-final" placeholder="optional" value={finalPayment} onChange={e => setFinalPayment(e.target.value)} onBlur={() => setFinalPayment(formatEuroInput(finalPayment))} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-months">Laufzeit</Label>
                <div className="relative">
                  <Input id="fp-months" placeholder="48" value={months} onChange={e => setMonths(e.target.value)} className="pr-16" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Monate</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-rate">Zinssatz (p.a.)</Label>
                <div className="relative">
                  <Input id="fp-rate" placeholder="z.B. 3,99" value={interestRate} onChange={e => setInterestRate(e.target.value)} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {result && result.monthlyRate > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Monatliche Finanzierungsrate</p>
                <p className="text-4xl font-bold text-foreground font-['Space_Grotesk']">{formatEuro(result.monthlyRate)}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Kreditbetrag</span>
                    <span className="font-medium text-foreground">{formatEuro(result.credit)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Zinsen gesamt</span>
                    <span className="font-medium text-foreground">{formatEuro(result.totalInterest)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-muted-foreground">
                    <span>Gesamtkosten</span>
                    <span className="font-medium text-foreground">{formatEuro(result.totalPaid)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-3">Schnelle Händler-Faustregel</p>
                <p className="text-xs text-muted-foreground mb-4">Viele Autoverkäufer rechnen grob so:</p>
                <div className="space-y-2">
                  {[
                    { price: '10.000 €', rate: 'ca. 230 €' },
                    { price: '20.000 €', rate: 'ca. 460 €' },
                    { price: '30.000 €', rate: 'ca. 690 €' },
                    { price: '50.000 €', rate: 'ca. 1.150 €' },
                  ].map(row => (
                    <div key={row.price} className="flex justify-between text-sm px-3 py-1.5 rounded-md bg-muted/50 text-muted-foreground">
                      <span>{row.price}</span>
                      <span className="font-medium">{row.rate}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-['Space_Grotesk']">Berechnungsformel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="bg-muted rounded-lg p-4 font-mono text-xs text-foreground text-center">
              Rate = (Kreditbetrag × i) / (1 − (1 + i)⁻ⁿ)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-foreground mb-1">Annuitätenformel</p>
                <p>Kreditbetrag = Fahrzeugpreis − Anzahlung. i = Jahreszins / 12. n = Laufzeit in Monaten.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Ballonfinanzierung</p>
                <p>Bei einer Schlussrate wird deren Barwert vom Kreditbetrag abgezogen, bevor die Annuität berechnet wird.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FinancingCalculator;
