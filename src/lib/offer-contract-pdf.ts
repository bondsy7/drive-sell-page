import { jsPDF } from 'jspdf';
import { LEGAL, LEGAL_VERSIONS } from '@/lib/legal-config';
import {
  ALL_INCL_PACKAGES,
  FOTO_PACKAGES,
  SETUP_FEE_CENTS,
  MIN_TERM_MONTHS,
} from '@/lib/stripe-plans';

const BASE_URL = 'https://autohaus.ai';

const euro = (cents: number) =>
  `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export interface OfferContractInput {
  /** Anzeigename des Pakets, z. B. "All-Incl-Marketing Advanced" */
  packageLabel: string;
  /** Interner Slug für den Dateinamen */
  slug: string;
  monthlyCents: number;
  credits: number;
  scope: string[];
  setupFeeCents?: number;
}

export function allInclContractInput(slug: string): OfferContractInput | null {
  const pkg = ALL_INCL_PACKAGES.find((p) => p.slug === slug);
  if (!pkg) return null;
  return {
    packageLabel: `All-Incl-Marketing ${pkg.name}`,
    slug: pkg.slug,
    monthlyCents: pkg.priceCents,
    credits: pkg.credits,
    setupFeeCents: SETUP_FEE_CENTS,
    scope: [
      `Bis zu ca. ${pkg.vehiclesPerMonth} Fahrzeuge pro Monat (16 Perspektiven je Fahrzeug)`,
      `${pkg.credits.toLocaleString('de-DE')} Credits pro Abrechnungsmonat`,
      ...pkg.included,
      'Zugang zur AUTO3-Plattform für die Nutzerinnen und Nutzer des Auftraggebers',
    ],
  };
}

export function fotoContractInput(slug: string): OfferContractInput | null {
  const pkg = FOTO_PACKAGES.find((p) => p.slug === slug);
  if (!pkg) return null;
  return {
    packageLabel: `Fotoservice ${pkg.vehicles} ${pkg.vehicles === 1 ? 'Fahrzeug' : 'Fahrzeuge'} / Monat`,
    slug: pkg.slug,
    monthlyCents: pkg.monthlyCents,
    credits: pkg.credits,
    setupFeeCents: SETUP_FEE_CENTS,
    scope: [
      `${pkg.vehicles} ${pkg.vehicles === 1 ? 'Fahrzeug' : 'Fahrzeuge'} pro Monat mit je 16 Perspektiven`,
      `${pkg.credits.toLocaleString('de-DE')} Credits pro Abrechnungsmonat`,
      `Preis je Fahrzeug: ${euro(pkg.pricePerVehicleCents)} netto`,
      'Zusatzapplikationen (Posts, Banner, Video, Landingpage) nach Aufwand gemäß Preisliste',
    ],
  };
}

export function buildOfferContractDoc(input: OfferContractInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 18;
  const W = 210 - M * 2;
  let y = M;

  const pageBreak = (needed = 10) => {
    if (y + needed > 275) {
      doc.addPage();
      y = M;
    }
  };

  const heading = (text: string) => {
    pageBreak(14);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(text, M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
  };

  const para = (text: string, indent = 0) => {
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, W - indent) as string[];
    lines.forEach((line) => {
      pageBreak(6);
      doc.text(line, M + indent, y);
      y += 4.4;
    });
  };

  const bullet = (text: string) => para(`•  ${text}`, 2);

  const field = (label: string, width = W) => {
    pageBreak(12);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(label, M, y);
    doc.setTextColor(0);
    y += 5.5;
    doc.setDrawColor(150);
    doc.line(M, y, M + width, y);
    y += 6;
    doc.setFontSize(9.5);
  };

  const fieldRow = (labelLeft: string, labelRight: string) => {
    pageBreak(12);
    const half = (W - 8) / 2;
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(labelLeft, M, y);
    doc.text(labelRight, M + half + 8, y);
    doc.setTextColor(0);
    y += 5.5;
    doc.setDrawColor(150);
    doc.line(M, y, M + half, y);
    doc.line(M + half + 8, y, M + W, y);
    y += 6;
    doc.setFontSize(9.5);
  };

  // Kopf
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Auftrag und Vertrag über die Nutzung von AUTO3', M, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  para(
    `Software-as-a-Service für Autohäuser und gewerbliche Fahrzeughändler · Angebot vom ${new Date().toLocaleDateString('de-DE')} · Stand der Vertragsdokumente: ${LEGAL.versionDate}`,
  );
  doc.setTextColor(0);

  heading('1. Vertragsparteien');
  para(
    `Anbieter: ${LEGAL.company}, ${LEGAL.street}, ${LEGAL.city}, ${LEGAL.country}. Geschäftsführer: ${LEGAL.managingDirector}. ${LEGAL.registerCourt}, ${LEGAL.registerNumber}. USt-IdNr.: ${LEGAL.vatId}. Telefon ${LEGAL.phone}, E-Mail ${LEGAL.email}.`,
  );
  y += 2;
  para('Auftraggeber (bitte vollständig ausfüllen):');
  y += 2;
  field('Firma / vollständige Firmierung');
  field('Straße und Hausnummer');
  fieldRow('PLZ und Ort', 'Land');
  fieldRow('Handelsregister / Registernummer', 'USt-IdNr.');
  fieldRow('Ansprechpartner (Vor- und Nachname)', 'Funktion');
  fieldRow('E-Mail für Vertrag und Rechnungen', 'Telefon');

  heading('2. Vertragsgegenstand und Leistungsumfang');
  para(
    `Der Anbieter stellt dem Auftraggeber die SaaS-Plattform ${LEGAL.product} über das Internet zur Nutzung bereit. Gebucht wird das folgende Paket:`,
  );
  y += 2;
  doc.setFont('helvetica', 'bold');
  para(input.packageLabel);
  doc.setFont('helvetica', 'normal');
  y += 1;
  input.scope.forEach(bullet);
  y += 1;
  para(
    'Nicht verbrauchte Credits verfallen zum Ende des jeweiligen Abrechnungsmonats, soweit nicht ausdrücklich etwas anderes vereinbart ist. Zusätzliche Credits können jederzeit kostenpflichtig nachgebucht werden. Die Leistungen werden mit KI-Unterstützung erbracht; erzeugte Medien werden gemäß Art. 50 KI-VO gekennzeichnet.',
  );

  heading('3. Vergütung');
  bullet(`Monatliche Grundvergütung: ${euro(input.monthlyCents)} netto`);
  if (input.setupFeeCents) {
    bullet(
      `Einmalige Implementierungs- und Einrichtungspauschale: ${euro(input.setupFeeCents)} netto (fällt nur bei der Erstbeauftragung an)`,
    );
  }
  bullet('Alle Preise verstehen sich netto zzgl. der jeweils gesetzlichen Umsatzsteuer.');
  bullet('Abrechnung monatlich im Voraus; Zahlung per Kreditkarte oder SEPA-Lastschrift über den Zahlungsdienstleister Stripe.');
  bullet('Zusatzleistungen (Posts, Banner, Videos, Landingpages, weitere Credits) werden nach der jeweils gültigen Preisliste abgerechnet.');

  heading('4. Laufzeit und Kündigung');
  para(
    `Der Vertrag beginnt mit der Freischaltung des Zugangs und hat eine Mindestlaufzeit von ${MIN_TERM_MONTHS} Monaten. Er verlängert sich jeweils um weitere ${MIN_TERM_MONTHS} Monate, sofern er nicht mit einer Frist von einem Monat zum Ende der jeweiligen Laufzeit in Textform gekündigt wird. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.`,
  );

  heading('5. Geschäftskundenvertrag, kein Widerrufsrecht');
  para(
    `${LEGAL.product} richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB. Der Auftraggeber bestätigt mit seiner Unterschrift, dass er den Vertrag in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit schließt, mindestens 18 Jahre alt und zur Vertretung des angegebenen Unternehmens berechtigt ist. Ein Verbraucherwiderrufsrecht besteht daher nicht.`,
  );

  heading('6. Einbezogene Vertragsdokumente');
  para(
    `Bestandteil dieses Vertrags sind die nachfolgenden Dokumente in ihrer bei Vertragsschluss geltenden Fassung (Stand ${LEGAL.versionDate}). Der Auftraggeber bestätigt, sie zur Kenntnis genommen zu haben:`,
  );
  y += 1;
  bullet(`Allgemeine Geschäftsbedingungen (Version ${LEGAL_VERSIONS.agb}): ${BASE_URL}/agb`);
  bullet(`Datenschutzerklärung (Version ${LEGAL_VERSIONS.privacy}): ${BASE_URL}/datenschutz`);
  bullet(`Auftragsverarbeitungsvertrag nach Art. 28 DSGVO: ${BASE_URL}/avv`);
  bullet(`Technische und organisatorische Maßnahmen: ${BASE_URL}/toms`);
  bullet(`Unterauftragsverarbeiter: ${BASE_URL}/unterauftragsverarbeiter`);
  bullet(`Hinweise zur KI-Kennzeichnung: ${BASE_URL}/ki-transparenz`);

  heading('7. Mitwirkung, Inhalte und Rechte');
  para(
    'Der Auftraggeber stellt sicher, dass er an allen hochgeladenen Inhalten (insbesondere Fahrzeugfotos, Dokumente, Logos und Markenzeichen) über die erforderlichen Rechte verfügt und dass die Veröffentlichung keine Rechte Dritter verletzt. An den mit der Plattform erzeugten Ergebnissen erhält der Auftraggeber das Recht zur Nutzung für eigene Vermarktungszwecke. Gesetzliche Pflichtangaben, insbesondere nach der Pkw-EnVKV und der PAngV, verantwortet der Auftraggeber.',
  );

  heading('8. Schlussbestimmungen');
  para(
    'Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist Hanau, soweit der Auftraggeber Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist. Änderungen und Ergänzungen bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam.',
  );

  heading('9. Unterschriften');
  para(
    'Mit der Unterschrift beauftragt der Auftraggeber das oben genannte Paket verbindlich und akzeptiert die unter Ziffer 6 aufgeführten Vertragsdokumente.',
  );
  y += 6;
  fieldRow('Ort, Datum', 'Ort, Datum');
  y += 8;
  fieldRow(
    'Auftraggeber (rechtsverbindliche Unterschrift, Stempel)',
    `${LEGAL.company} (Unterschrift)`,
  );

  pageBreak(16);
  y += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  const footer = doc.splitTextToSize(
    `${LEGAL.company} · ${LEGAL.street} · ${LEGAL.city} · Geschäftsführer ${LEGAL.managingDirector} · ${LEGAL.registerCourt} ${LEGAL.registerNumber} · USt-IdNr. ${LEGAL.vatId} · ${LEGAL.phone} · ${LEGAL.email}`,
    W,
  ) as string[];
  footer.forEach((line) => {
    doc.text(line, M, y);
    y += 3.4;
  });

  return doc;
}

export function generateOfferContractPdf(input: OfferContractInput) {
  buildOfferContractDoc(input).save(`AUTO3-Vertrag-${input.slug}.pdf`);
}
