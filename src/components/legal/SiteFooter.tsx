import { Link } from 'react-router-dom';
import { openConsentSettings } from '@/lib/consent';
import { LEGAL } from '@/lib/legal-config';
import BrandLogo from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';

const LINKS = [
  { to: '/impressum', label: 'Impressum' },
  { to: '/datenschutz', label: 'Datenschutz' },
  { to: '/agb', label: 'AGB' },
  { to: '/rechtliches', label: 'Rechtliches' },
];

interface SiteFooterProps {
  /** Kompakte Variante für den eingeloggten Produktbereich. */
  compact?: boolean;
}

export default function SiteFooter({ compact = false }: SiteFooterProps) {
  return (
    <footer
      className={`border-t border-border bg-card/40 ${compact ? 'py-4' : 'py-6'}`}
      aria-label="Rechtliche Informationen"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-xs text-muted-foreground sm:px-6">
        {!compact && <BrandLogo className="h-5" />}
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4" aria-label="Rechtliche Seiten">
          {LINKS.slice(0, 3).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-sm py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {link.label}
            </Link>
          ))}
          <Button
            type="button"
            variant="link"
            onClick={openConsentSettings}
            className="h-auto rounded-sm p-0 py-1 text-xs font-normal text-muted-foreground hover:text-foreground focus-visible:ring-offset-2"
          >
            Cookie-Einstellungen
          </Button>
          <Link
            to={LINKS[3].to}
            className="rounded-sm py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {LINKS[3].label}
          </Link>
        </nav>
        {!compact && (
          <p className="max-w-4xl leading-relaxed">
            autohaus.ai ist ein Produkt der {LEGAL.company}. Angebot ausschließlich für Unternehmer
            i. S. d. § 14 BGB, juristische Personen des öffentlichen Rechts und
            öffentlich-rechtliche Sondervermögen.
          </p>
        )}
        <p className="border-t border-border/70 pt-3">© {new Date().getFullYear()} autohaus.ai · ein Produkt der {LEGAL.company}</p>
      </div>
    </footer>
  );
}
