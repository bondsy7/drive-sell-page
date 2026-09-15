import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Upload, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution, getAttribution, ATTRIBUTION_PARAMS } from '@/lib/funnel-attribution';
import { supabase } from '@/integrations/supabase/client';
import {
  VOLUME_OPTIONS, LOCATION_OPTIONS, ROLE_OPTIONS, GOAL_OPTIONS,
  MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES,
} from '@/lib/b2b-funnel-options';

interface FormState {
  company_name: string;
  first_name: string;
  last_name: string;
  business_email: string;
  website: string;
  phone: string;
  monthly_vehicle_volume: string;
  location_count: string;
  role: string;
  note: string;
}

const EMPTY_FORM: FormState = {
  company_name: '',
  first_name: '',
  last_name: '',
  business_email: '',
  website: '',
  phone: '',
  monthly_vehicle_volume: '',
  location_count: '',
  role: '',
  note: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export default function FahrzeugTesten() {
  usePageMeta({
    title: 'Autohaus.ai mit einem Fahrzeug testen',
    description: 'Laden Sie ein Fahrzeugfoto aus Ihrem Bestand hoch und testen Sie Autohaus.ai als gewerblicher Fahrzeughändler.',
    canonicalPath: '/fahrzeug-testen',
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const toggleGoal = (value: string, checked: boolean) => {
    setGoals((prev) => (checked ? [...prev, value] : prev.filter((g) => g !== value)));
  };

  const handleFile = (selected: File | null) => {
    if (!selected) { setFile(null); return; }
    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      setErrors((prev) => ({ ...prev, image: 'Bitte eine JPG-, PNG- oder WebP-Datei auswählen.' }));
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setErrors((prev) => ({ ...prev, image: 'Die Datei darf maximal 8 MB groß sein.' }));
      return;
    }
    setErrors((prev) => ({ ...prev, image: '' }));
    setFile(selected);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.company_name.trim()) next.company_name = 'Bitte Autohaus oder Unternehmen angeben.';
    if (!form.first_name.trim()) next.first_name = 'Bitte Vornamen angeben.';
    if (!form.last_name.trim()) next.last_name = 'Bitte Nachnamen angeben.';
    if (!EMAIL_RE.test(form.business_email.trim())) next.business_email = 'Bitte eine gültige geschäftliche E-Mail angeben.';
    if (!form.website.trim()) next.website = 'Bitte Website angeben.';
    if (!form.monthly_vehicle_volume) next.monthly_vehicle_volume = 'Bitte Fahrzeugvolumen auswählen.';
    if (!form.location_count) next.location_count = 'Bitte Anzahl Standorte auswählen.';
    if (!form.role) next.role = 'Bitte Rolle auswählen.';
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
      const attribution = getAttribution();
      const body = new FormData();
      (Object.keys(form) as (keyof FormState)[]).forEach((key) => body.append(key, form[key].trim()));
      body.append('goals', JSON.stringify(goals));
      body.append('company_website_confirm', honeypot);
      body.append('image', file as File);
      for (const key of ATTRIBUTION_PARAMS) {
        const value = attribution[key];
        if (value) body.append(key, value);
      }
      if (attribution.landing_page) body.append('landing_page', attribution.landing_page);
      if (attribution.first_referrer) body.append('first_referrer', attribution.first_referrer);
      body.append('source_label', attribution.source_label || 'paid_funnel');

      const { data, error } = await supabase.functions.invoke('submit-b2b-lead', { body });
      const payload = data as { success?: boolean; leadId?: string; error?: string } | null;

      if (error || !payload?.success) {
        toast({
          title: 'Senden nicht möglich',
          description: payload?.error || 'Bitte versuchen Sie es in einem Moment erneut.',
          variant: 'destructive',
        });
        return;
      }

      navigate(`/fahrzeug-testen/danke${payload.leadId ? `?lead=${payload.leadId}` : ''}`);
    } catch {
      toast({ title: 'Senden nicht möglich', description: 'Bitte versuchen Sie es in einem Moment erneut.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? <p className="mt-1 text-xs font-medium text-destructive">{errors[key]}</p> : null;

  return (
    <FunnelLayout ctaHref="/fahrzeug-testen" ctaLabel="Fahrzeug testen" showMobileCta={false}>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Testen Sie Autohaus.ai mit einem echten Fahrzeug.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Laden Sie ein Fahrzeugfoto aus Ihrem Bestand hoch und senden Sie uns die wichtigsten Angaben zu Ihrem
          Autohaus. So können wir den Test passend zu Ihrem Einsatz beurteilen.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
          {/* Honeypot */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="company_website_confirm">Bitte leer lassen</label>
            <input
              id="company_website_confirm"
              name="company_website_confirm"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <fieldset className="rounded-xl border border-border bg-card p-5">
            <legend className="px-1 text-sm font-semibold text-foreground">Ihr Autohaus</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="company_name">Autohaus / Unternehmen *</Label>
                <Input id="company_name" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} maxLength={160} autoComplete="organization" required />
                {fieldError('company_name')}
              </div>
              <div>
                <Label htmlFor="first_name">Vorname *</Label>
                <Input id="first_name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} maxLength={80} autoComplete="given-name" required />
                {fieldError('first_name')}
              </div>
              <div>
                <Label htmlFor="last_name">Nachname *</Label>
                <Input id="last_name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} maxLength={80} autoComplete="family-name" required />
                {fieldError('last_name')}
              </div>
              <div>
                <Label htmlFor="business_email">Geschäftliche E-Mail *</Label>
                <Input id="business_email" type="email" value={form.business_email} onChange={(e) => set('business_email', e.target.value)} maxLength={255} autoComplete="email" required />
                {fieldError('business_email')}
              </div>
              <div>
                <Label htmlFor="website">Website *</Label>
                <Input id="website" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="www.ihr-autohaus.de" maxLength={300} autoComplete="url" required />
                {fieldError('website')}
              </div>
              <div>
                <Label htmlFor="phone">Telefonnummer (optional)</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} autoComplete="tel" />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-border bg-card p-5">
            <legend className="px-1 text-sm font-semibold text-foreground">Einsatz &amp; Rolle</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="monthly_vehicle_volume">Monatliches Fahrzeugvolumen *</Label>
                <Select value={form.monthly_vehicle_volume} onValueChange={(v) => set('monthly_vehicle_volume', v)}>
                  <SelectTrigger id="monthly_vehicle_volume"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
                  <SelectContent>
                    {VOLUME_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldError('monthly_vehicle_volume')}
              </div>
              <div>
                <Label htmlFor="location_count">Anzahl Standorte *</Label>
                <Select value={form.location_count} onValueChange={(v) => set('location_count', v)}>
                  <SelectTrigger id="location_count"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldError('location_count')}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="role">Rolle / Funktion *</Label>
                <Select value={form.role} onValueChange={(v) => set('role', v)}>
                  <SelectTrigger id="role"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldError('role')}
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-border bg-card p-5">
            <legend className="px-1 text-sm font-semibold text-foreground">Fahrzeugbild *</legend>
            <p className="mt-2 text-xs text-muted-foreground">JPG, PNG oder WebP · maximal 8 MB</p>

            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            {preview ? (
              <div className="mt-4 flex items-center gap-4">
                <img src={preview} alt="Vorschau des hochgeladenen Fahrzeugbildes" className="h-24 w-32 rounded-lg border border-border object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">{file ? Math.round(file.size / 1024) : 0} KB</p>
                  <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 px-2" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                    <X className="mr-1 h-4 w-4" /> Entfernen
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" className="mt-4 w-full sm:w-auto" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Fahrzeugbild auswählen
              </Button>
            )}
            {fieldError('image')}
          </fieldset>

          <fieldset className="rounded-xl border border-border bg-card p-5">
            <legend className="px-1 text-sm font-semibold text-foreground">Optionale Angaben</legend>
            <p className="mt-3 text-sm font-medium text-foreground">Was soll verbessert werden?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {GOAL_OPTIONS.map((g) => (
                <label key={g.value} htmlFor={`goal-${g.value}`} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground has-[:checked]:border-accent">
                  <Checkbox id={`goal-${g.value}`} checked={goals.includes(g.value)} onCheckedChange={(c) => toggleGoal(g.value, c === true)} />
                  {g.label}
                </label>
              ))}
            </div>

            <div className="mt-5">
              <Label htmlFor="note">Worauf sollen wir beim Test besonders achten?</Label>
              <Textarea id="note" value={form.note} onChange={(e) => set('note', e.target.value.slice(0, 500))} maxLength={500} rows={4} />
              <p className="mt-1 text-right text-xs text-muted-foreground">{form.note.length} / 500</p>
            </div>
          </fieldset>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Informationen zur Verarbeitung Ihrer Angaben zur Bearbeitung der Testanfrage finden Sie in unserer{' '}
              <a href="/datenschutz" target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
                Datenschutzerklärung
              </a>
              .
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Angebot ausschließlich für gewerbliche Fahrzeughändler.
            </p>
            <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet …</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Fahrzeug einreichen</>}
            </Button>
          </div>
        </form>
      </div>
    </FunnelLayout>
  );
}
