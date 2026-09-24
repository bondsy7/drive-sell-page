import { ReactNode, useEffect, MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import { captureLastTouch } from '@/lib/funnel-attribution';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/brand/BrandLogo';
import SiteFooter from '@/components/legal/SiteFooter';

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
  const location = useLocation();
  useEffect(() => {
    captureLastTouch();
    trackFunnelEvent('page_view', { page_path: location.pathname });
  }, [location.pathname]);

  // Alle CTA-Klicks im Funnel zentral erfassen (Links zum Test / Prozesscheck)
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest('a,button') as HTMLElement | null;
    if (!el) return;
    const href = el.getAttribute('href') ?? '';
    const ctaId = el.dataset.cta || (href.includes('/fahrzeug-testen') ? 'fahrzeug_testen' : href === '#prozess-check' ? 'prozess_check' : '');
    if (!ctaId) return;
    trackFunnelEvent('cta_click', { cta_id: ctaId, cta_label: (el.textContent ?? '').trim().slice(0, 60) }, {
      eventId: `cta_click:${crypto.randomUUID()}`,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground" onClickCapture={onClickCapture}>
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <BrandLogo className="h-7" />
            <span className="sr-only">autohaus.ai Startseite</span>
          </Link>

          <nav aria-label="Seitenbereiche" className="hidden items-center gap-7 md:flex">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="rounded-md text-xs font-semibold text-foreground/75 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {a.label}
              </a>
            ))}
          </nav>

          <Button asChild size="sm" className="shrink-0 shadow-glow">
            <Link to={ctaHref}>{ctaLabel} <span aria-hidden="true">→</span></Link>
          </Button>
        </div>
      </header>

      <main className={showMobileCta ? 'pb-20 sm:pb-0' : undefined}>{children}</main>

      <SiteFooter />

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
