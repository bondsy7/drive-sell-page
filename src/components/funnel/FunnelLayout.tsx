import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import auto3Logo from '@/assets/auto3-logo.png';

interface FunnelNavAnchor {
  href: string;
  label: string;
}

interface FunnelLayoutProps {
  children: ReactNode;
  /** Ziel des Haupt-CTA im Header und in der mobilen Aktionsleiste */
  ctaHref: string;
  ctaLabel: string;
  anchors?: FunnelNavAnchor[];
  /** Mobile sticky CTA ausblenden (z.B. auf Formular- und Danke-Seite) */
  showMobileCta?: boolean;
}

export default function FunnelLayout({
  children,
  ctaHref,
  ctaLabel,
  anchors = [],
  showMobileCta = true,
}: FunnelLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <img src={auto3Logo} alt="Autohaus.ai" className="h-7 w-auto" />
            <span className="sr-only">Autohaus.ai Startseite</span>
          </Link>

          <nav aria-label="Seitenbereiche" className="hidden items-center gap-6 md:flex">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {a.label}
              </a>
            ))}
          </nav>

          <Button asChild size="sm" className="shrink-0">
            <Link to={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </header>

      <main className={showMobileCta ? 'pb-20 sm:pb-0' : undefined}>{children}</main>

      <footer className="border-t border-border/70 bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Autohaus.ai · Angebot ausschließlich für gewerbliche Fahrzeughändler.</p>
          <Link to="/datenschutz" className="rounded-md underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Datenschutzerklärung
          </Link>
        </div>
      </footer>

      {showMobileCta && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button asChild className="w-full" size="lg">
            <Link to={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
