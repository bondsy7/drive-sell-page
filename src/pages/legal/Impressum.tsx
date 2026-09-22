import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL } from '@/lib/legal-config';

export default function Impressum() {
  return (
    <LegalLayout
      title="Impressum"
      metaTitle="Impressum – autohaus.ai | Breadcrumb Marketing GmbH"
      metaDescription="Anbieterkennzeichnung nach § 5 DDG für autohaus.ai, ein Produkt der Breadcrumb Marketing GmbH in Hanau."
      canonicalPath="/impressum"
      intro={<p>Angaben gemäß § 5 DDG.</p>}
    >
      <LegalSection title="Anbieter">
        <p>
          {LEGAL.company}
          <br />
          {LEGAL.street}
          <br />
          {LEGAL.city}
          <br />
          {LEGAL.country}
        </p>
        <p>autohaus.ai ist ein Produkt der {LEGAL.company}.</p>
      </LegalSection>

      <LegalSection title="Vertretungsberechtigt">
        <p>Geschäftsführer: {LEGAL.managingDirector}</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>
          Telefon: {LEGAL.phone}
          <br />
          E-Mail:{' '}
          <a className="underline underline-offset-2 hover:text-foreground" href={`mailto:${LEGAL.email}`}>
            {LEGAL.email}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Registereintrag">
        <p>
          Registergericht: {LEGAL.registerCourt}
          <br />
          Handelsregister: {LEGAL.registerNumber}
        </p>
      </LegalSection>

      <LegalSection title="Umsatzsteuer-Identifikationsnummer">
        <p>USt-IdNr. gemäß § 27a UStG: {LEGAL.vatId}</p>
      </LegalSection>

      <LegalSection title="Verantwortlich nach § 18 Abs. 2 MStV">
        <p>
          Vorsorglich für journalistisch-redaktionell gestaltete Inhalte:
          <br />
          {LEGAL.managingDirector}
          <br />
          {LEGAL.street}
          <br />
          {LEGAL.city}
          <br />
          {LEGAL.country}
        </p>
      </LegalSection>

      <LegalSection title="Zielgruppe">
        <p>
          autohaus.ai richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB, juristische
          Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen. Ein
          Vertragsschluss mit Verbrauchern ist ausgeschlossen. Mindestalter: 18 Jahre.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
