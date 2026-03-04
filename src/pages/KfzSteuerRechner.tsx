import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatEuro(num: number): string {
  return Math.floor(num).toLocaleString('de-DE') + ' €';
}

function blockCalculation(entry: number, divisor: number, taxRate: number): number {
  return Math.ceil(entry / divisor) * taxRate;
}

function getTaxForCo2(co2: number, rate: number, free: number): number {
  return co2 > free ? (co2 - free) * rate / 100 : 0;
}

function getTaxWithCo2(hubraum: number, taxRate: number, co2: number, co2Rate: number, free: number): number {
  return blockCalculation(hubraum, 100, taxRate) / 100 + getTaxForCo2(co2, co2Rate, free);
}

interface CalcResult {
  steuer: number;
  hubraumAnteil: number;
  co2Anteil: number;
  hinweis?: string;
}

function berechne(hubraum: number, co2: number, antrieb: 'benzin' | 'diesel', jahr: number): CalcResult | null {
  if (hubraum <= 0 && co2 <= 0) return null;

  const baseRate = antrieb === 'diesel' ? 950 : 200;
  const hubraumAnteil = blockCalculation(hubraum, 100, baseRate) / 100;

  if (jahr >= 2021) {
    // Formel 4 mit progressiver Staffelung
    const stufen = [
      { rate: 200, free: 95 },
      { rate: 20, free: 115 },
      { rate: 30, free: 135 },
      { rate: 40, free: 155 },
      { rate: 50, free: 175 },
      { rate: 60, free: 195 },
    ];
    let co2Anteil = 0;
    for (const s of stufen) {
      co2Anteil += getTaxForCo2(co2, s.rate, s.free);
    }
    const steuer = Math.floor(hubraumAnteil + co2Anteil);
    return {
      steuer,
      hubraumAnteil: Math.floor(hubraumAnteil),
      co2Anteil: Math.floor(co2Anteil),
      hinweis: co2 <= 95 ? 'CO₂-Wert unter Freibetrag (95 g/km).' : undefined,
    };
  }

  if (jahr >= 2014) {
    // Formel 4 ohne Staffelung
    const co2Anteil = getTaxForCo2(co2, 200, 95);
    const steuer = Math.floor(hubraumAnteil + co2Anteil);
    return { steuer, hubraumAnteil: Math.floor(hubraumAnteil), co2Anteil: Math.floor(co2Anteil) };
  }

  if (jahr >= 2009) {
    // Formel 3
    const free = jahr >= 2012 ? 110 : 120;
    const co2Anteil = getTaxForCo2(co2, 200, free);
    const steuer = Math.floor(hubraumAnteil + co2Anteil);
    return { steuer, hubraumAnteil: Math.floor(hubraumAnteil), co2Anteil: Math.floor(co2Anteil) };
  }

  // Vor 2009 – nur Hubraum
  return { steuer: Math.floor(hubraumAnteil), hubraumAnteil: Math.floor(hubraumAnteil), co2Anteil: 0, hinweis: 'Für Fahrzeuge vor 2009 wird nur der Hubraum-Anteil berechnet.' };
}

const KfzSteuerRechner = () => {
  const [hubraum, setHubraum] = useState('');
  const [co2, setCo2] = useState('');
  const [antrieb, setAntrieb] = useState<'benzin' | 'diesel'>('benzin');
  const [jahr, setJahr] = useState('2024');

  const result = useMemo(() => {
    const h = parseInt(hubraum) || 0;
    const c = parseInt(co2) || 0;
    const j = parseInt(jahr) || 2024;
    return berechne(h, c, antrieb, j);
  }, [hubraum, co2, antrieb, jahr]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <FileText className="w-6 h-6 text-accent" />
          <h1 className="text-xl font-bold text-foreground font-['Space_Grotesk']">Kfz-Steuer-Rechner</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-['Space_Grotesk']">Fahrzeugdaten eingeben</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ks-hubraum">Hubraum</Label>
                <div className="relative">
                  <Input id="ks-hubraum" placeholder="z.B. 1498" value={hubraum} onChange={e => setHubraum(e.target.value.replace(/\D/g, ''))} className="pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">cm³</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="ks-co2">CO₂-Emissionen (WLTP)</Label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs">WLTP-Wert aus dem Fahrzeugschein (Feld V.7).</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative">
                  <Input id="ks-co2" placeholder="z.B. 130" value={co2} onChange={e => setCo2(e.target.value.replace(/\D/g, ''))} className="pr-14" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">g/km</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kraftstoffart</Label>
                <Select value={antrieb} onValueChange={(v) => setAntrieb(v as 'benzin' | 'diesel')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="benzin">Benzin / Otto</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ks-jahr">Erstzulassung (Jahr)</Label>
                <Input id="ks-jahr" placeholder="2024" value={jahr} onChange={e => setJahr(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {result && result.steuer > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">Jährliche Kfz-Steuer</p>
                <p className="text-4xl font-bold text-foreground font-['Space_Grotesk']">{formatEuro(result.steuer)}</p>
                {result.hinweis && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{result.hinweis}</p>
                )}
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Hubraum-Anteil</span>
                    <span className="font-medium text-foreground">{formatEuro(result.hubraumAnteil)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CO₂-Anteil</span>
                    <span className="font-medium text-foreground">{formatEuro(result.co2Anteil)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-muted-foreground">
                    <span>Monatlich</span>
                    <span className="font-medium text-foreground">{(result.steuer / 12).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-3">Aufschlüsselung</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Hubraum-Anteil</span>
                      <span>{result.hubraumAnteil > 0 && result.steuer > 0 ? Math.round(result.hubraumAnteil / result.steuer * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-accent/60" style={{ width: `${result.steuer > 0 ? (result.hubraumAnteil / result.steuer * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>CO₂-Anteil</span>
                      <span>{result.co2Anteil > 0 && result.steuer > 0 ? Math.round(result.co2Anteil / result.steuer * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-destructive/50" style={{ width: `${result.steuer > 0 ? (result.co2Anteil / result.steuer * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  {antrieb === 'benzin' ? 'Basissatz Benzin: 2,00 €/100 cm³' : 'Basissatz Diesel: 9,50 €/100 cm³'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-['Space_Grotesk']">Berechnungsgrundlage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="bg-muted rounded-lg p-4 font-mono text-xs text-foreground text-center">
              Steuer = Hubraum-Anteil + CO₂-Anteil (+ progressive Zuschläge ab 2021)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-foreground mb-1">Hubraum-Anteil</p>
                <p>Hubraum (aufgerundet auf 100 cm³) × Basissatz. Benzin: 2,00 €, Diesel: 9,50 € je 100 cm³.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">CO₂-Anteil (ab 2021)</p>
                <p>Progressive Staffelung: 2,00 €/g über 95, +0,20 €/g über 115, +0,30 €/g über 135, +0,40 €/g über 155, +0,50 €/g über 175, +0,60 €/g über 195 g/km.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default KfzSteuerRechner;
