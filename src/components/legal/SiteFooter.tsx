import { Link } from 'react-router-dom';
import { openConsentSettings } from '@/lib/consent';
import { LEGAL } from '@/lib/legal-config';

const LINKS = [
  { to: '/impressum', label: 'Impressum' },
  { to: '/datenschutz', label: 'Datenschutz' },
  { to: '/agb', label: 'AGB' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/avv', label: 'AVV' },
  { to: '/toms', label: 'TOMs' },
  { to: '/unterauftragsverarbeiter', label: 'Unterauftragsverarbeiter' },
  { to: '/ki-transparenz', label: 'KI-Transparenz' },
];

interface SiteFooterProps {
  /** Kompakte Variante für den eingeloggten Produktbereich. */
  compact?: boolean;
}

export default function SiteFooter({ compact = false }: SiteFooterProps) {
  return (
    <footer
      className={`border-t border-border bg-card/40 ${compact ? 'py-4' : 'py-8'}`}
      aria-label="Rechtliche Informationen"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-xs text-muted-foreground sm:px-6">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Rechtliche Seiten">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={openConsentSettings}
            className="rounded-md underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cookie-Einstellungen
          </button>
        </nav>
        {!compact && (
          <p>
            AUTO3 ist ein Produkt der {LEGAL.company}. Angebot ausschließlich für Unternehmer
            i. S. d. § 14 BGB, juristische Personen des öffentlichen Rechts und
            öffentlich-rechtliche Sondervermögen.
          </p>
        )}
        <p>© {new Date().getFullYear()} AUTO3 · ein Produkt der {LEGAL.company}</p>
      </div>
    </footer>
  );
}
