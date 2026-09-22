import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import PublicHeader from '@/components/public/PublicHeader';
import SiteFooter from '@/components/legal/SiteFooter';
import { ALL_INCL_PACKAGES, FOTO_PACKAGES, STRIPE_PRICES } from '@/lib/stripe-plans';
import { Check, ChevronLeft, CreditCard, Loader2, Lock, ShieldCheck, Building2, FileText } from 'lucide-react';
import { toast } from 'sonner';

const euro = (cents: number) =>
  (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

type Offer = {
  slug: string;
  name: string;
  subtitle: string;
  priceCents: number;
  bullets: string[];
};

const OFFERS: Offer[] = [
  ...ALL_INCL_PACKAGES.map((p) => ({
    slug: p.slug,
    name: p.name,
    subtitle: 'All-Incl-Marketing',
    priceCents: p.priceCents,
    bullets: [`${p.credits.toLocaleString('de-DE')} Credits/Monat`, `${p.vehiclesPerMonth} Fahrzeuge/Monat`, ...p.included.slice(0, 2)],
  })),
  ...FOTO_PACKAGES.map((p) => ({
    slug: p.slug,
    name: `Fotoservice ${p.vehicles} Fahrzeug${p.vehicles > 1 ? 'e' : ''}`,
    subtitle: 'Fotoservice',
    priceCents: p.monthlyCents,
    bullets: [`${p.credits.toLocaleString('de-DE')} Credits/Monat`, `${euro(p.pricePerVehicleCents)} je Fahrzeug`, '16 Perspektiven je Fahrzeug'],
  })),
];

const STEPS = ['Tarif wählen', 'Unternehmensdaten', 'Zahlung', 'Start'];

const Checkout = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [slug, setSlug] = useState<string>(params.get('plan') || 'advanced');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [payment, setPayment] = useState<'card' | 'sepa' | 'invoice'>('card');
  const [firstBooking, setFirstBooking] = useState<boolean | null>(null);

  const offer = useMemo(() => OFFERS.find((o) => o.slug === slug) ?? OFFERS[1], [slug]);
  const net = offer.priceCents;
  const vat = Math.round(net * 0.19);

  useEffect(() => {
    if (!user) return;
    setEmail((e) => e || user.email || '');
    supabase
      .from('profiles')
      .select('company_name, contact_name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCompany((v) => v || data.company_name || '');
        setContact((v) => v || data.contact_name || '');
        setPhone((v) => v || data.phone || '');
        setEmail((v) => v || data.email || user.email || '');
      });
    supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => setFirstBooking(error ? null : (data?.length ?? 0) === 0));
  }, [user]);

  const dataComplete = company.trim().length > 1 && contact.trim().length > 1 && /\S+@\S+\.\S+/.test(email);

  const saveProfile = async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ company_name: company.trim(), contact_name: contact.trim(), phone: phone.trim(), email: email.trim() })
      .eq('user_id', user.id);
  };

  const startCheckout = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/checkout?plan=${slug}`)}`);
      return;
    }
    if (payment === 'invoice') {
      window.location.href = `mailto:info@breadcrumb.de?subject=${encodeURIComponent(
        `Rechnungskauf ${offer.name} – ${company}`,
      )}&body=${encodeURIComponent(
        `Tarif: ${offer.name}\nUnternehmen: ${company}\nAnsprechpartner: ${contact}\nE-Mail: ${email}\nTelefon: ${phone}`,
      )}`;
      return;
    }
    const priceId = STRIPE_PRICES[slug]?.monthly;
    if (!priceId) {
      toast.error('Für diesen Tarif ist keine Online-Buchung hinterlegt.');
      return;
    }
    setLoading(true);
    try {
      await saveProfile();
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { priceId } });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
      setStep(4);
    } catch (err: any) {
      toast.error('Fehler beim Checkout: ' + (err?.message || 'Unbekannter Fehler'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link to="/pricing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Zurück zu den Preisen
        </Link>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">In 4 Schritten starten</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">In wenigen Minuten einsatzbereit.</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Tarif wählen, Unternehmensdaten prüfen, Zahlung abschließen – danach kannst du sofort loslegen.
        </p>

        {/* Stepper */}
        <ol className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : done
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : n}
                </span>
                <span className={`text-sm ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Schritt 1 */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span className="text-primary">1.</span> Tarif wählen
              </h2>
              {step === 1 ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {OFFERS.map((o) => {
                      const selected = o.slug === slug;
                      return (
                        <button
                          key={o.slug}
                          type="button"
                          onClick={() => setSlug(o.slug)}
                          className={`rounded-lg border p-4 text-left transition-all ${
                            selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{o.subtitle}</p>
                              <p className="font-semibold">{o.name}</p>
                            </div>
                            {selected && <Check className="h-5 w-5 text-primary" />}
                          </div>
                          <p className="mt-2 text-xl font-bold">
                            {euro(o.priceCents)} <span className="text-sm font-normal text-muted-foreground">/ Monat netto</span>
                          </p>
                          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                            {o.bullets.map((b) => (
                              <li key={b} className="flex items-start gap-2">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {b}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                  <Button className="mt-5" onClick={() => setStep(2)}>
                    Weiter zu den Unternehmensdaten
                  </Button>
                </>
              ) : (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm">
                  <span>
                    <strong>{offer.name}</strong> · {euro(offer.priceCents)} / Monat netto
                  </span>
                  <button type="button" className="text-primary hover:underline" onClick={() => setStep(1)}>
                    Ändern
                  </button>
                </div>
              )}
            </section>

            {/* Schritt 2 */}
            <section className={`rounded-xl border bg-card p-6 shadow-sm ${step === 2 ? 'border-primary/40' : 'border-border'}`}>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5 text-primary" /> 2. Unternehmensdaten
              </h2>
              {step >= 2 ? (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    autohaus.ai ist ein Angebot ausschließlich für Unternehmer im Sinne des § 14 BGB.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="company">Unternehmensname *</Label>
                      <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Autohaus Müller GmbH" />
                    </div>
                    <div>
                      <Label htmlFor="contact">Ansprechpartner *</Label>
                      <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Max Mustermann" />
                    </div>
                    <div>
                      <Label htmlFor="email">E-Mail-Adresse *</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@autohaus-mueller.de" />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefon</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 89 1234567" />
                    </div>
                  </div>
                  {step === 2 && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button disabled={!dataComplete} onClick={() => setStep(3)}>
                        Weiter zur Zahlung
                      </Button>
                      <Button variant="ghost" onClick={() => setStep(1)}>
                        Zurück
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Wird nach der Tarifauswahl ausgefüllt.</p>
              )}
            </section>

            {/* Schritt 3 */}
            <section className={`rounded-xl border bg-card p-6 shadow-sm ${step === 3 ? 'border-primary/40' : 'border-border'}`}>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CreditCard className="h-5 w-5 text-primary" /> 3. Zahlung
              </h2>
              {step >= 3 ? (
                <>
                  <div className="mt-4 space-y-2">
                    {[
                      { key: 'card' as const, label: 'Kreditkarte', hint: 'Sofort freigeschaltet' },
                      { key: 'sepa' as const, label: 'SEPA-Lastschrift', hint: 'Im sicheren Zahlungsfenster wählbar' },
                      { key: 'invoice' as const, label: 'Rechnung (nur Business)', hint: 'Auf Anfrage – wir melden uns schriftlich' },
                    ].map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setPayment(m.key)}
                        className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                          payment === m.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-medium">{m.label}</span>
                          <span className="block text-xs text-muted-foreground">{m.hint}</span>
                        </span>
                        <span
                          className={`h-4 w-4 rounded-full border-2 ${
                            payment === m.key ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 flex items-start gap-3 text-sm">
                    <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
                    <span>
                      Ich akzeptiere die{' '}
                      <Link to="/agb" className="text-primary hover:underline" target="_blank">
                        AGB
                      </Link>{' '}
                      und habe die{' '}
                      <Link to="/datenschutz" className="text-primary hover:underline" target="_blank">
                        Datenschutzerklärung
                      </Link>{' '}
                      zur Kenntnis genommen.
                    </span>
                  </label>

                  <Button className="mt-5 w-full" size="lg" disabled={!terms || loading} onClick={startCheckout}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird vorbereitet …
                      </>
                    ) : payment === 'invoice' ? (
                      'Rechnungskauf anfragen'
                    ) : (
                      'Jetzt kostenpflichtig bestellen'
                    )}
                  </Button>
                  <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Sichere SSL-Verschlüsselung · Zahlung über Stripe
                  </p>
                  <button type="button" className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setStep(2)}>
                    Zurück zu den Unternehmensdaten
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Verfügbar, sobald deine Unternehmensdaten vollständig sind.</p>
              )}
            </section>

            {/* Schritt 4 */}
            {step === 4 && (
              <section className="rounded-xl border border-primary/40 bg-primary/5 p-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Check className="h-5 w-5 text-primary" /> 4. Start
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Das Zahlungsfenster wurde in einem neuen Tab geöffnet. Nach Abschluss werden deine Credits automatisch gutgeschrieben.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => navigate('/dashboard')}>Zum Dashboard</Button>
                  <Button variant="outline" onClick={startCheckout}>
                    Zahlungsfenster erneut öffnen
                  </Button>
                </div>
              </section>
            )}
          </div>

          {/* Bestellübersicht */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">4. Bestellübersicht</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{offer.name}</span>
                  <span className="font-medium">{euro(net)}</span>
                </div>
                {firstBooking !== false && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Einrichtung (einmalig, nur Erstbuchung)</span>
                    <span>990,00 €</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Zwischensumme</span>
                  <span>{euro(net)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>MwSt. (19 %)</span>
                  <span>{euro(vat)}</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-bold">
                  <span>Gesamt / Monat</span>
                  <span>{euro(net + vat)}</span>
                </div>
              </div>

              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> 12 Monate Laufzeit, danach monatlich kündbar
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Sofort einsatzbereit
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Alle Preise netto zzgl. USt.
                </li>
              </ul>

              <div className="mt-5 flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Sichere Zahlung</p>
                  Verschlüsselt und PCI-konform über Stripe.
                </div>
              </div>

              <Link
                to="/pricing"
                className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <FileText className="h-3.5 w-3.5" /> Vertrag als PDF auf der Preisseite
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Checkout;
