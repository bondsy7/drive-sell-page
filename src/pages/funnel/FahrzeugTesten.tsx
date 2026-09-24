import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Upload, X, ShieldCheck, CheckCircle2, Clock, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
    if (goals.length === 0) next.goals = 'Bitte mindestens ein Ziel auswählen.';
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

  return (
    <FunnelLayout ctaHref="/fahrzeug-testen" ctaLabel="Fahrzeug testen" showMobileCta={false}>
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">1</span><span className="text-foreground">Fahrzeug einreichen</span><span className="h-px flex-1 bg-border"/><span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">2</span><span>Angaben ergänzen</span><span className="h-px flex-1 bg-border"/><CheckCircle2 className="h-5 w-5"/><span>Ergebnis erhalten</span></div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Kostenloser Fahrzeugtest</p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold text-foreground sm:text-4xl">Sehen Sie, wie Ihr Fahrzeug professionell präsentiert werden kann.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Firma, E-Mail, Ziel und ein Fahrzeugfoto genügen. Weitere Angaben können Sie im nächsten Schritt ergänzen.</p>

        <form
          onSubmit={handleSubmit}
          onFocus={() => trackFunnelEvent('form_start', { funnel_type: 'vehicle_test' })}
          noValidate
          className="mt-8 grid items-start gap-7 lg:grid-cols-[1.18fr_.82fr]"
        >
          <div className="hidden" aria-hidden="true">
            <label htmlFor="company_website_confirm">Bitte leer lassen</label>
            <input id="company_website_confirm" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>

          <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <fieldset>
            <legend className="px-1 text-sm font-semibold text-foreground">Ihr Autohaus</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="company_name">Autohaus / Unternehmen *</Label>
                <Input id="company_name" value={company} onChange={(e) => { setCompany(e.target.value); clearError('company_name'); }} maxLength={160} autoComplete="organization" />
                {fieldError('company_name')}
              </div>
              <div>
                <Label htmlFor="business_email">Geschäftliche E-Mail *</Label>
                <Input id="business_email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearError('business_email'); }} maxLength={255} autoComplete="email" />
                {fieldError('business_email')}
              </div>
            </div>
          </fieldset>

          <fieldset className="border-t border-border pt-5">
            <legend className="px-1 text-sm font-semibold text-foreground">Was soll besser werden? *</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {GOAL_OPTIONS.map((g) => (
                <label key={g.value} htmlFor={`goal-${g.value}`} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground has-[:checked]:border-accent">
                  <Checkbox
                    id={`goal-${g.value}`}
                    checked={goals.includes(g.value)}
                    onCheckedChange={(c) => { setGoals((p) => (c === true ? [...p, g.value] : p.filter((x) => x !== g.value))); clearError('goals'); }}
                  />
                  {g.label}
                </label>
              ))}
            </div>
            {fieldError('goals')}
          </fieldset>

          <fieldset className="border-t border-border pt-5">
            <legend className="px-1 text-sm font-semibold text-foreground">Fahrzeugbild *</legend>
            <p className="mt-2 text-xs text-muted-foreground">JPG, PNG oder WebP · maximal 8 MB</p>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              <div className="mt-4 flex items-center gap-4 rounded-lg bg-secondary/55 p-3">
                <img src={preview} alt="Vorschau des hochgeladenen Fahrzeugbildes" className="h-28 w-36 rounded-md border border-border object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">{file ? Math.round(file.size / 1024) : 0} KB</p>
                  <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 px-2" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                    <X className="mr-1 h-4 w-4" /> Entfernen
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" className="mt-4 h-24 w-full border-dashed bg-secondary/30" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-5 w-5 text-accent" /> Fahrzeugbild auswählen oder hier ablegen
              </Button>
            )}
            {fieldError('image')}
          </fieldset>

          <div className="grid gap-3 border-t border-border pt-5 text-sm text-muted-foreground sm:grid-cols-2">
            <p className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> Das Bild wird nicht öffentlich gespeichert und nur zur Bearbeitung Ihrer Testanfrage verwendet.</p>
            <p className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> Wir melden uns in der Regel innerhalb eines Werktags per E-Mail.</p>
            <p className="sm:col-span-2">
              Details in unserer{' '}
              <a href="/datenschutz" target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">Datenschutzerklärung</a>.
            </p>
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Angebot ausschließlich für gewerbliche Fahrzeughändler.
            </p>
            <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
               {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet …</> : <>Kostenlosen Test starten <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <BeforeAfterShowcase compact />
            <div className="rounded-lg border border-accent/25 bg-accent/5 p-5">
              <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent"/><h2 className="font-bold">Das erhalten Sie</h2></div>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">{['Einschätzung anhand eines echten Bestandsfahrzeugs','Passender Workflow für Ihre Ziele und Kanäle','Unverbindlicher nächster Schritt per E-Mail'].map((item)=><li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent"/>{item}</li>)}</ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground"><p className="font-semibold text-foreground">Für gewerbliche Fahrzeughändler</p><p className="mt-2 leading-6">Ihre Angaben werden ausschließlich für die Bearbeitung der Anfrage und die anschließende schriftliche Kontaktaufnahme verwendet.</p></div>
          </aside>
        </form>
      </div>
    </FunnelLayout>
  );
}
