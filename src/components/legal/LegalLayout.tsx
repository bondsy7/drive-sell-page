import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SiteFooter from '@/components/legal/SiteFooter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { LEGAL } from '@/lib/legal-config';

interface LegalLayoutProps {
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;
  intro?: ReactNode;
  children: ReactNode;
  /** Abweichendes Standdatum, sonst Release-Datum. */
  versionDate?: string;
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_li]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function LegalLayout({
  title,
  metaTitle,
  metaDescription,
  canonicalPath,
  intro,
  children,
  versionDate,
}: LegalLayoutProps) {
  usePageMeta({ title: metaTitle, description: metaDescription, canonicalPath });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-3xl space-y-9">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>

          <header className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
            <p className="text-xs text-muted-foreground">
              Stand: {versionDate ?? LEGAL.versionDate} · AUTO3 ist ein Produkt der {LEGAL.company}
            </p>
          </header>

          {intro && <div className="text-sm leading-relaxed text-muted-foreground">{intro}</div>}

          <div className="space-y-8">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
