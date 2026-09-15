import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';

/**
 * TODO: Platzhalterseite. Die rechtsverbindliche Datenschutzerklärung muss
 * redaktionell ergänzt werden, bevor der Funnel bezahlten Traffic erhält.
 */
export default function DatenschutzPlatzhalter() {
  usePageMeta({
    title: 'Datenschutzerklärung – Autohaus.ai',
    description: 'Informationen zur Verarbeitung personenbezogener Daten bei Autohaus.ai.',
    canonicalPath: '/datenschutz',
    noIndex: true,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Datenschutzerklärung</h1>
      <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">Platzhalter – Inhalt ausstehend</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Diese Seite ist technisch vorbereitet, enthält aber noch keinen rechtsverbindlichen Text.
          Bitte die vollständige Datenschutzerklärung ergänzen, bevor Anzeigen auf den Funnel geschaltet werden.
        </p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Angaben aus dem Fahrzeugtest werden ausschließlich zur Bearbeitung Ihrer Anfrage verwendet.
      </p>
      <Link to="/" className="mt-8 inline-block rounded-md text-sm font-medium text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        Zurück zu Autohaus.ai
      </Link>
    </div>
  );
}
