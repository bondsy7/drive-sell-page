import { ArrowRight, Bot, FileText, Scale, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/brand/BrandLogo';
import SiteFooter from '@/components/legal/SiteFooter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LEGAL, LEGAL_DOCUMENT_DATES } from '@/lib/legal-config';

interface LegalDocument {
  title: string;
  description: string;
  to: string;
  date: string;
}

interface LegalGroup {
  title: string;
  id: string;
  icon: typeof Scale;
  documents: LegalDocument[];
}

const GROUPS: LegalGroup[] = [
  {
    title: 'Vertrag & Nutzung',
    id: 'vertrag-nutzung',
    icon: Scale,
    documents: [
      {
        title: 'Allgemeine Geschäftsbedingungen (AGB)',
        description: 'Regelungen zu Leistungsumfang, Credits, Laufzeit, Pflichten und Haftung für Geschäftskunden.',
        to: '/agb',
        date: LEGAL_DOCUMENT_DATES.agb,
      },
      {
        title: 'Auftragsverarbeitungsvertrag (AVV)',
        description: 'Vertragliche Regelungen zur Verarbeitung personenbezogener Daten im Kundenauftrag.',
        to: '/avv',
        date: LEGAL_DOCUMENT_DATES.avv,
      },
    ],
  },
  {
    title: 'Datenschutz & Sicherheit',
    id: 'datenschutz-sicherheit',
    icon: ShieldCheck,
    documents: [
      {
        title: 'Datenschutzerklärung',
        description: 'Informationen zur Verarbeitung personenbezogener Daten bei der Nutzung von autohaus.ai.',
        to: '/datenschutz',
        date: LEGAL_DOCUMENT_DATES.privacy,
      },
      {
        title: 'Cookies & lokale Speicherung',
        description: 'Übersicht zu notwendigen Speicherungen sowie optionalen Analyse- und Marketingdiensten.',
        to: '/cookies',
        date: LEGAL_DOCUMENT_DATES.consent,
      },
      {
        title: 'Technische und organisatorische Maßnahmen (TOMs)',
        description: 'Dokumentation der Maßnahmen zum Schutz der im Auftrag verarbeiteten Daten.',
        to: '/toms',
        date: LEGAL_DOCUMENT_DATES.toms,
      },
      {
        title: 'Unterauftragsverarbeiter & weitere Empfänger',
        description: 'Übersicht der für Betrieb und Leistungserbringung eingesetzten Anbieter und Empfänger.',
        to: '/unterauftragsverarbeiter',
        date: LEGAL_DOCUMENT_DATES.subprocessors,
      },
    ],
  },
  {
    title: 'KI & Transparenz',
    id: 'ki-transparenz',
    icon: Bot,
    documents: [
      {
        title: 'KI-Transparenz',
        description: 'Informationen zur Kennzeichnung KI-generierter und KI-bearbeiteter Medien und Inhalte.',
        to: '/ki-transparenz',
        date: LEGAL_DOCUMENT_DATES.aiTransparency,
      },
    ],
  },
];

export default function Rechtliches() {
  usePageMeta({
    title: 'Rechtliches – Verträge, Datenschutz und KI-Transparenz | autohaus.ai',
    description: 'Zentrale Übersicht der Vertrags-, Datenschutz-, Sicherheits- und KI-Transparenzdokumente von autohaus.ai.',
    canonicalPath: '/rechtliches',
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-5xl">
          <header className="border-b border-border pb-8">
            <Link
              to="/"
              aria-label="autohaus.ai Startseite"
              className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <BrandLogo className="h-7" />
            </Link>
            <div className="mt-10 max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <FileText className="h-4 w-4" aria-hidden="true" /> Dokumentenübersicht
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Rechtliches</h1>
              <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                Zentrale Übersicht zu Vertrags-, Datenschutz- und Transparenzdokumenten für autohaus.ai,
                ein Produkt der {LEGAL.company}.
              </p>
              <p className="text-xs text-muted-foreground">Stand der Übersicht: {LEGAL_DOCUMENT_DATES.overview}</p>
            </div>
          </header>

          <div className="space-y-12 py-10 sm:py-12">
            {GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <section key={group.id} aria-labelledby={group.id}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2 id={group.id} className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                      {group.title}
                    </h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {group.documents.map((document) => (
                      <Link
                        key={document.to}
                        to={document.to}
                        className="group flex min-h-40 flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-6"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="font-display text-base font-semibold text-card-foreground sm:text-lg">{document.title}</h3>
                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{document.description}</p>
                        </div>
                        <p className="mt-5 text-xs text-muted-foreground">Stand: {document.date}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}