export default function GeneratorMaintenanceNotice() {
  return (
    <section className="border-y border-border py-10 sm:py-16" aria-live="polite">
      <h1 className="font-display text-2xl font-bold text-foreground">Technische Überarbeitung</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Die Funktionen werden aktuell technisch überarbeitet und stehen Ihnen in Kürze wieder zur Verfügung.
      </p>
    </section>
  );
}