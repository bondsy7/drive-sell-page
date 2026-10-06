import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, X, ShieldCheck, CheckCircle2, Lock, ArrowRight, CloudUpload,
  User, Target, Camera, FileText, Trophy, Building2, Zap,
  Share2, PlayCircle, LayoutTemplate, Layers3, Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';
import { appendAttribution } from '@/lib/funnel-submit';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import { supabase } from '@/integrations/supabase/client';
import { GOAL_OPTIONS, MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '@/lib/b2b-funnel-options';
import BeforeAfterShowcase from '@/components/funnel/BeforeAfterShowcase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/** Auswahl-Kacheln „Was möchten Sie verbessern?" – Werte identisch mit GOAL_OPTIONS (Lead-Funktion). */
const GOAL_META: Record<string, { label: string; sub: string; icon: typeof Camera }> = {
  'fahrzeugbilder': { label: 'Fahrzeugbilder', sub: 'Professionell & einheitlich', icon: Camera },
  'showroom': { label: 'Einheitlicher Showroom', sub: 'Corporate Look für alle Standorte', icon: Layers3 },
  'schneller-online': { label: 'Schneller online', sub: 'Fahrzeuge in Minuten statt Stunden', icon: Zap },
  'social-banner': { label: 'Social Media & Banner', sub: 'Content für alle Kanäle', icon: Share2 },
  'video': { label: 'Video', sub: 'Automatische Fahrzeugvideos', icon: PlayCircle },
'landingpages': { label: 'Landingpages', sub: 'Verkaufsstarke Fahrzeugseiten', icon: LayoutTemplate },
  'multi-standort': { label: 'Standortübergreifender Prozess', sub: 'Einheitliche Abläufe für alle Standorte', icon: Building2 },
};

const RECEIVE_STEPS = [
  { title: 'Ein konkretes Beispiel-Ergebnis', text: 'Ihr Fahrzeug in professioneller Qualität – angezeigt im autohaus.ai Look.' },
  { title: 'Eine kurze Prozesseinschätzung', text: 'Wie Sie autohaus.ai in Ihrem Autohaus einsetzen können – individuell auf Ihre Situation.' },
  { title: 'Eine Empfehlung für Ihren Einsatzfall', text: 'Konkrete nächste Schritte und Antworten auf Ihre Fragen im weiteren schriftlichen Austausch.' },
];

const TRUST_POINTS = [
  'Ihre Daten werden vertraulich behandelt und nicht an Dritte weitergegeben.',
  'Das hochgeladene Fahrzeugbild wird ausschließlich für die Angebotserstellung verwendet und nicht veröffentlicht.',
  'Sie erhalten in der Regel innerhalb eines Werktags eine persönliche Rückmeldung.',
];

/** Schritt 1: nur das Nötigste, um den Test zu starten. Weitere Angaben folgen auf der Danke-Seite. */
export default function FahrzeugTesten() {
  usePageMeta({
    title: 'autohaus.ai mit einem Fahrzeug testen',
    description: 'Laden Sie ein Fahrzeugfoto aus Ihrem Bestand hoch und testen Sie autohaus.ai als gewerblicher Fahrzeughändler.',
    canonicalPath: '/fahrzeug-testen',
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    captureAttribution(searchParams.get('source') ? `lp_${searchParams.get('source')}` : undefined);
  }, [searchParams]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clearError = (k: string) => setErrors((p) => ({ ...p, [k]: '' }));

  const handleFile = (selected: File | null) => {
    if (!selected) { setFile(null); return; }
    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      setErrors((p) => ({ ...p, image: 'Bitte eine JPG-, PNG- oder WebP-Datei auswählen.' }));
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setErrors((p) => ({ ...p, image: 'Die Datei darf maximal 8 MB groß sein.' }));
      return;
    }
    clearError('image');
    setFile(selected);
    trackFunnelEvent('vehicle_test_started', { step: 'image_selected' });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!company.trim()) next.company_name = 'Bitte Autohaus oder Unternehmen angeben.';
    if (!EMAIL_RE.test(email.trim())) next.business_email = 'Bitte eine gültige geschäftliche E-Mail angeben.';
    if (!file) next.image = 'Bitte ein Fahrzeugbild hochladen.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      toast({ title: 'Bitte Angaben prüfen', description: 'Einige Pflichtfelder fehlen oder sind ungültig.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('funnel_type', 'vehicle_test');
      body.append('company_name', company.trim());
      body.append('business_email', email.trim());
      body.append('goals', JSON.stringify(goals));
      if (note.trim()) body.append('note', note.trim());
      body.append('company_website_confirm', honeypot);
      body.append('image', file as File);
      appendAttribution(body);

      const { data, error } = await supabase.functions.invoke('submit-b2b-lead', { body });
      const p = data as { success?: boolean; leadId?: string; token?: string; error?: string } | null;
      if (error || !p?.success) {
        let msg = p?.error;
        try {
          const ctx = (error as { context?: Response } | null)?.context;
          if (!msg && ctx && typeof ctx.json === 'function') msg = (await ctx.json())?.error;
        } catch { /* ignore */ }
        toast({ title: 'Senden nicht möglich', description: msg || 'Bitte versuchen Sie es in einem Moment erneut.', variant: 'destructive' });
        return;
      }
      // Nur bei erfolgreichem Speichern: Lead-Conversion (einmal pro Lead)
      if (p.leadId) {
        trackFunnelEvent('generate_lead', { funnel_type: 'vehicle_test' }, { eventId: `generate_lead:${p.leadId}`, leadId: p.leadId });
      }
      navigate(`/fahrzeug-testen/danke?lead=${p.leadId ?? ''}&t=${p.token ?? ''}`);
    } catch {
      toast({ title: 'Senden nicht möglich', description: 'Bitte versuchen Sie es in einem Moment erneut.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (k: string) =>
    errors[k] ? <p className="mt-1 text-xs font-medium text-destructive">{errors[k]}</p> : null;

  const cardHeader = (Icon: typeof User, title: string, hint?: string, required?: boolean) => (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-bold leading-tight">{title}{required ? ' *' : ''}</h2>
        {hint && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  return (
    <FunnelLayout ctaHref="/fahrzeug-testen" ctaLabel="Fahrzeug testen" showMobileCta={false}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="max-w-3xl font-display text-3xl font-bold text-foreground sm:text-4xl">Testen Sie autohaus.ai mit einem echten Fahrzeug aus Ihrem Bestand.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Geben Sie uns ein paar Details zu Ihrem Autohaus und laden Sie ein Fahrzeugbild hoch – mehr ist nicht nötig. Wir erstellen daraus ein professionelles Ergebnis und besprechen im nächsten Schritt die weiteren Möglichkeiten.</p>

        <form
          onSubmit={handleSubmit}
          onFocus={() => trackFunnelEvent('form_start', { funnel_type: 'vehicle_test' })}
          noValidate
          className="mt-8 grid items-start gap-6 lg:grid-cols-[1.15fr_.85fr]"
        >
          <div className="hidden" aria-hidden="true">
            <label htmlFor="company_website_confirm">Bitte leer lassen</label>
            <input id="company_website_confirm" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>

          <div className="space-y-5">
            {/* Ihre Informationen */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              {cardHeader(User, 'Ihre Informationen', 'Alle mit * markierten Felder sind erforderlich.', false)}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="company_name">Autohaus / Unternehmen *</Label>
                  <Input id="company_name" placeholder="z. B. Autohaus Müller GmbH" value={company} onChange={(e) => { setCompany(e.target.value); clearError('company_name'); }} maxLength={160} autoComplete="organization" />
                  {fieldError('company_name')}
                </div>
                <div>
                  <Label htmlFor="business_email">Geschäftliche E-Mail *</Label>
                  <Input id="business_email" type="email" placeholder="name@autohaus.de" value={email} onChange={(e) => { setEmail(e.target.value); clearError('business_email'); }} maxLength={255} autoComplete="email" />
                  {fieldError('business_email')}
                </div>
              </div>
            </section>

            {/* Was möchten Sie verbessern? */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              {cardHeader(Target, 'Was möchten Sie verbessern?', 'Wählen Sie alle Bereiche aus, die für Sie relevant sind. So können wir uns optimal vorbereiten.')}
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {GOAL_OPTIONS.map((g) => {
                  const meta = GOAL_META[g.value];
                  const checked = goals.includes(g.value);
                  const GoalIcon = meta?.icon ?? CheckCircle2;
                  return (
                    <label
                      key={g.value}
                      htmlFor={`goal-${g.value}`}
                      className={`relative cursor-pointer rounded-lg border p-3.5 pr-9 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5 ${checked ? 'border-accent bg-accent/5' : 'border-border bg-background hover:border-accent/40'}`}
                    >
                      <Checkbox
                        id={`goal-${g.value}`}
                        className="absolute right-3 top-3"
                        checked={checked}
                        onCheckedChange={(c) => { setGoals((p) => (c === true ? [...p, g.value] : p.filter((x) => x !== g.value))); }}
                      />
                      <GoalIcon className={`h-5 w-5 ${checked ? 'text-accent' : 'text-foreground/70'}`} />
                      <p className="mt-2 text-sm font-bold leading-tight">{meta?.label ?? g.label}</p>
                      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{meta?.sub}</p>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Fahrzeugbild hochladen */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              {cardHeader(Camera, 'Fahrzeugbild hochladen', 'Laden Sie ein Bild aus Ihrem Bestand hoch. Wir zeigen Ihnen, was daraus möglich ist.', true)}
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0] ?? null); }}
                  className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 p-5 text-center transition-colors hover:border-accent/50"
                >
                  <CloudUpload className="h-8 w-8 text-accent" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">Bild hierher ziehen oder klicken</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG oder WebP (max. 8 MB)</span>
                </button>
                {preview && file ? (
                  <div className="flex flex-col justify-between rounded-lg border border-border bg-secondary/30 p-3">
                    <div className="relative overflow-hidden rounded-md border border-border">
                      <img src={preview} alt="Vorschau des hochgeladenen Fahrzeugbildes" className="h-32 w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Bild entfernen"
                        onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-card transition-colors hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-40 items-center justify-center rounded-lg border border-border bg-secondary/20 p-5 text-center text-xs text-muted-foreground">
                    Ihr Fahrzeugbild erscheint hier zur Kontrolle.
                  </div>
                )}
              </div>
              {fieldError('image')}
            </section>

            {/* Besonderheiten / Ziel */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              {cardHeader(FileText, 'Besonderheiten / Ziel (optional)', 'Gibt es etwas, das wir bei der Erstellung besonders berücksichtigen sollen?')}
              <div className="mt-4">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  placeholder="z. B. bestimmte Marke, Zielgruppen, spezielle Anforderungen …"
                  rows={3}
                  maxLength={500}
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{note.length}/500</p>
              </div>
            </section>

            {/* Datenschutz & Einverständnis */}
            <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Lock className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-sm font-bold">Datenschutz & Einverständnis</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Mit dem Klick auf „Kostenlosen Test starten" stimmen Sie der Verarbeitung Ihrer Angaben zur Kontaktaufnahme und Angebotserstellung zu. Weitere Informationen finden Sie in unserer{' '}
                    <a href="/datenschutz" target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">Datenschutzerklärung</a>.
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-center">
                <Button type="submit" size="lg" disabled={submitting} className="w-full lg:w-auto">
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet …</> : <>Kostenlosen Test starten <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">Dauert nur eine Minute · Rückmeldung innerhalb eines Werktags</p>
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            {/* Was Sie erhalten */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              {cardHeader(Trophy, 'Was Sie erhalten', 'Auf Basis Ihrer Angaben erstellen wir für Sie:')}
              <ol className="mt-5 space-y-4">
                {RECEIVE_STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-display text-sm font-bold text-accent">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold leading-tight">{s.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <BeforeAfterShowcase compact />

            {/* Ihr Vertrauen ist uns wichtig */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
              {cardHeader(ShieldCheck, 'Ihr Vertrauen ist uns wichtig')}
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {TRUST_POINTS.map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t}</li>)}
              </ul>
            </section>

            <figure className="rounded-lg border border-accent/25 bg-accent/5 p-5">
              <Quote className="h-6 w-6 text-accent/40" aria-hidden="true" />
              <blockquote className="mt-2 text-sm italic leading-6 text-foreground">„Wir sparen enorm viel Zeit und haben endlich eine einheitliche Aufnahmequalität über alle Standorte hinweg."</blockquote>
              <figcaption className="mt-3 text-xs text-muted-foreground"><span className="font-bold text-foreground">Thomas R.</span> · Geschäftsführer, Mehrmarken-Autohaus</figcaption>
            </figure>
          </aside>
        </form>
      </div>
    </FunnelLayout>
  );
}
