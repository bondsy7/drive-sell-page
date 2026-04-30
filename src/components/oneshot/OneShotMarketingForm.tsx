// OneShotMarketingForm – Step 2 of the OneShot Studio.
// Shows a complete Banner-style form with badges that indicate
// where each value came from (manual / datasheet / vin / image).

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, FileText, Hash, ScanLine, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketingForm, FieldSources, FieldSource } from './oneshot-types';

interface Props {
  form: MarketingForm;
  sources: FieldSources;
  onChange: (patch: Partial<MarketingForm>) => void;
  /** Manually mark a field as "user-edited" so the badge changes to manual. */
  onUserEdit: (field: keyof FieldSources) => void;
}

const OCCASIONS = [
  { id: 'buy', label: 'Kaufen' },
  { id: 'lease', label: 'Leasing' },
  { id: 'finance', label: 'Finanzieren' },
  { id: 'abo', label: 'Auto-Abo' },
  { id: 'special', label: 'Sonderaktion' },
  { id: 'launch', label: 'Neuwagen-Launch' },
];

const SCENES = [
  { id: 'showroom', label: 'Im Autohaus' },
  { id: 'city', label: 'In der Stadt' },
  { id: 'beach', label: 'Am Strand' },
  { id: 'mountain', label: 'Bergstraße' },
  { id: 'track', label: 'Rennstrecke' },
  { id: 'studio', label: 'Fotostudio' },
  { id: 'night', label: 'Nacht-Szene' },
];

const STYLES = [
  { id: 'premium', label: 'Seriös / Premium' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'bold', label: 'Verrückt / Auffällig' },
  { id: 'minimal', label: 'Minimalistisch' },
  { id: 'retro', label: 'Retro / Vintage' },
  { id: 'sport', label: 'Sportlich' },
];

const PRICE_DISPLAYS = [
  { id: 'sign', label: 'Preisschild' },
  { id: 'board', label: 'Tafel / Banner' },
  { id: 'neon', label: 'Neon-Schrift' },
  { id: 'stamp', label: 'Stempel' },
  { id: 'led', label: 'LED-Anzeige' },
  { id: 'ribbon', label: 'Banner-Schleife' },
];

const CTAS = ['Jetzt anfragen', 'Termin vereinbaren', 'Angebot sichern', 'Probefahrt buchen', 'Jetzt entdecken', 'Mehr erfahren'];

const HEADLINE_FONTS = [
  { id: 'modern-sans', label: 'Modern Sans' },
  { id: 'impact', label: 'Impact / Bold' },
  { id: 'condensed', label: 'Condensed Bold' },
  { id: 'elegant-serif', label: 'Elegant Serif' },
  { id: 'tech', label: 'Tech / Digital' },
  { id: 'brush', label: 'Brush / Handschrift' },
  { id: 'bmw', label: 'BMW Stil' },
  { id: 'mercedes', label: 'Mercedes Stil' },
  { id: 'audi', label: 'Audi Stil' },
  { id: 'vw', label: 'VW Stil' },
  { id: 'porsche', label: 'Porsche Stil' },
];

const SUBLINE_FONTS = [
  { id: 'match', label: 'Passend zur Headline' },
  { id: 'clean-sans', label: 'Clean Sans-Serif' },
  { id: 'thin-sans', label: 'Dünn & Elegant' },
  { id: 'medium-sans', label: 'Medium Sans' },
  { id: 'small-caps', label: 'Kapitälchen' },
  { id: 'mono', label: 'Monospace / Tech' },
];

const SourceBadge: React.FC<{ source: FieldSource }> = ({ source }) => {
  const map: Record<FieldSource, { icon: React.ReactNode; label: string; cls: string }> = {
    manual:    { icon: <PenLine className="w-2.5 h-2.5" />,  label: 'manuell',     cls: 'bg-muted text-muted-foreground' },
    datasheet: { icon: <FileText className="w-2.5 h-2.5" />, label: 'Datenblatt',  cls: 'bg-accent/15 text-accent' },
    vin:       { icon: <Hash className="w-2.5 h-2.5" />,     label: 'VIN',          cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    image:     { icon: <ScanLine className="w-2.5 h-2.5" />, label: 'aus Bild',     cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  };
  const { icon, label, cls } = map[source];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none', cls)}>
      {icon}{label}
    </span>
  );
};

const LabeledField: React.FC<{
  label: string;
  source: FieldSource;
  children: React.ReactNode;
}> = ({ label, source, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs font-medium">{label}</Label>
      <SourceBadge source={source} />
    </div>
    {children}
  </div>
);

const OneShotMarketingForm: React.FC<Props> = ({ form, sources, onChange, onUserEdit }) => {
  const set = <K extends keyof MarketingForm>(k: K, v: MarketingForm[K], src?: keyof FieldSources) => {
    onChange({ [k]: v } as Partial<MarketingForm>);
    if (src) onUserEdit(src);
  };

  return (
    <div className="space-y-6">
      {/* ── Fahrzeug-Stammdaten ── */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Fahrzeug</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledField label="Marke" source={sources.brand}>
            <Input
              value={form.brand}
              onChange={(e) => set('brand', e.target.value, 'brand')}
              placeholder="z.B. BMW"
              className="h-9 text-sm"
            />
          </LabeledField>
          <LabeledField label="Modell" source={sources.model}>
            <Input
              value={form.model}
              onChange={(e) => set('model', e.target.value, 'model')}
              placeholder="z.B. M3"
              className="h-9 text-sm"
            />
          </LabeledField>
          <LabeledField label="Variante / Ausstattung" source={sources.variant}>
            <Input
              value={form.variant}
              onChange={(e) => set('variant', e.target.value, 'variant')}
              placeholder="z.B. Competition"
              className="h-9 text-sm"
            />
          </LabeledField>
          <LabeledField label="Fahrzeugtitel (Banner)" source={sources.vehicleTitle}>
            <Input
              value={form.vehicleTitle}
              onChange={(e) => set('vehicleTitle', e.target.value, 'vehicleTitle')}
              placeholder="z.B. BMW M3 Competition"
              className="h-9 text-sm"
            />
          </LabeledField>
        </div>
      </section>

      {/* ── Angebot ── */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-semibold text-sm">Angebot</h3>

        <LabeledField label="Angebotstyp" source={sources.priceType}>
          <RadioGroup
            value={form.priceType}
            onValueChange={(v) => set('priceType', v as MarketingForm['priceType'], 'priceType')}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          >
            {(['buy', 'lease', 'finance', 'abo'] as const).map((p) => (
              <label
                key={p}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-xs transition-colors',
                  form.priceType === p ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50',
                )}
              >
                <RadioGroupItem value={p} className="sr-only" />
                {p === 'buy' ? 'Kaufen' : p === 'lease' ? 'Leasing' : p === 'finance' ? 'Finanzieren' : 'Auto-Abo'}
              </label>
            ))}
          </RadioGroup>
        </LabeledField>

        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="Preis / Rate (Anzeige)" source={sources.priceText}>
            <Input
              value={form.priceText}
              onChange={(e) => set('priceText', e.target.value, 'priceText')}
              placeholder="z.B. 49.900 € oder ab 549 €/mtl."
              className="h-9 text-sm"
            />
          </LabeledField>
          <LabeledField label="Monatsrate" source={sources.monthlyRate}>
            <Input
              value={form.monthlyRate}
              onChange={(e) => set('monthlyRate', e.target.value, 'monthlyRate')}
              placeholder="z.B. 549 €"
              className="h-9 text-sm"
            />
          </LabeledField>
          <LabeledField label="Laufzeit (Monate)" source={sources.duration}>
            <Input
              value={form.duration}
              onChange={(e) => set('duration', e.target.value, 'duration')}
              placeholder="z.B. 48"
              className="h-9 text-sm"
            />
          </LabeledField>
          <LabeledField label="Anzahlung" source={sources.downPayment}>
            <Input
              value={form.downPayment}
              onChange={(e) => set('downPayment', e.target.value, 'downPayment')}
              placeholder="z.B. 4.900 €"
              className="h-9 text-sm"
            />
          </LabeledField>
          <LabeledField label="Fahrleistung / Jahr" source={sources.mileage}>
            <Input
              value={form.mileage}
              onChange={(e) => set('mileage', e.target.value, 'mileage')}
              placeholder="z.B. 10.000 km"
              className="h-9 text-sm"
            />
          </LabeledField>
        </div>
      </section>

      {/* ── Banner-Stil ── */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-semibold text-sm">Banner-Stil</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Anlass</Label>
            <Select value={form.occasion} onValueChange={(v) => onChange({ occasion: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{OCCASIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Szene / Ort</Label>
            <Select value={form.scene} onValueChange={(v) => onChange({ scene: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{SCENES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stil</Label>
            <Select value={form.style} onValueChange={(v) => onChange({ style: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{STYLES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Headline-Schrift</Label>
            <Select value={form.headlineFont} onValueChange={(v) => onChange({ headlineFont: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{HEADLINE_FONTS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subline-Schrift</Label>
            <Select value={form.sublineFont} onValueChange={(v) => onChange({ sublineFont: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{SUBLINE_FONTS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Preisdarstellung</Label>
          <Select value={form.priceDisplay} onValueChange={(v) => onChange({ priceDisplay: v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{PRICE_DISPLAYS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <LabeledField label="Headline" source={sources.headline}>
          <Input
            value={form.headline}
            onChange={(e) => set('headline', e.target.value, 'headline')}
            placeholder="z.B. Jetzt zuschlagen!"
            className="h-9 text-sm"
          />
        </LabeledField>

        <LabeledField label="Subline" source={sources.subline}>
          <Input
            value={form.subline}
            onChange={(e) => set('subline', e.target.value, 'subline')}
            placeholder="z.B. Nur noch 3 verfügbar"
            className="h-9 text-sm"
          />
        </LabeledField>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Call-to-Action</Label>
            <Select value={form.ctaText} onValueChange={(v) => onChange({ ctaText: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CTAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Akzentfarbe</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                className="w-10 h-9 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={form.accentColor}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        <LabeledField label="Pflichtangaben / Fußzeile" source={sources.legalText}>
          <Textarea
            value={form.legalText}
            onChange={(e) => set('legalText', e.target.value, 'legalText')}
            placeholder="z.B. Rate: 549 €/mtl., Laufzeit: 48 Mon., Eff. Jahreszins: 3,99 %, Verbrauch komb.: 7,2 l/100km, CO₂: 165 g/km, Klasse: D"
            rows={3}
            className="text-sm"
          />
        </LabeledField>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" /> Freies Prompting (optional)
          </Label>
          <Textarea
            value={form.freePrompt}
            onChange={(e) => onChange({ freePrompt: e.target.value })}
            placeholder="z.B. Füge Rauch-Effekte hinzu, mache den Hintergrund dunkler …"
            rows={2}
            className="text-sm"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
          <span className="text-xs font-medium">Logo einblenden (Banner)</span>
          <Switch checked={form.showLogo} onCheckedChange={(v) => onChange({ showLogo: v })} />
        </div>
        {form.showLogo && (
          <RadioGroup
            value={form.logoSource}
            onValueChange={(v) => onChange({ logoSource: v as 'dealer' | 'manufacturer' })}
            className="flex gap-3 pl-1"
          >
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <RadioGroupItem value="dealer" /> Eigenes Logo
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <RadioGroupItem value="manufacturer" /> Hersteller-Logo
            </label>
          </RadioGroup>
        )}
      </section>
    </div>
  );
};

export default OneShotMarketingForm;
