# Standtage vermeiden – Screenlayout & Seitenkonzept (nur Konzept, kein Code)

## Abgrenzung

Dieses Dokument ist ausschließlich das Seitenkonzept für eine neue Paid-Landingpage zum Problem „Standtage vermeiden". Es werden keine Dateien geändert, keine Routes angelegt, keine Bilder produziert und der bestehende Funnel wird nicht verknüpft. Die Umsetzung erfolgt erst nach Freigabe.

Vorgesehen für die spätere Umsetzung (jetzt nicht enthalten):

- URL: `/standtage-vermeiden` (Alternative: `/fahrzeuge-sofort-online`)
- Rahmen: bestehendes `FunnelLayout` (Header mit Ankern, mobile Aktionsleiste, `SiteFooter`)
- CTA-Ziel: `/fahrzeug-testen?source=standtage`, Attribution `lp_standtage`
- Meta: Titel „Standtage vermeiden – Fahrzeugbilder direkt vom Hof | autohaus.ai"

## Designrahmen (unverändert aus dem Projekt)

- Heller Hintergrund `--background`, weiße Karten `--card`, Charcoal-Text `--foreground`, Akzentgrün `--primary`/`--accent` (#00A98F), gedeckte Fläche `--secondary`
- Schriften: `font-display` für Headlines, Systemsans für Fließtext
- Inhalte in 1120 px (`max-w-6xl`), Sektionen `py-14`, Karten `rounded-lg border border-border bg-card shadow-card`
- Rote Signalfarbe nur für „wegfallende" Schritte, Sterne nur in Bewertungen
- Keine bunte Gradient-Optik, keine Icon-Wände, keine Feature-Grids, die wie eine SaaS-Produktseite wirken

## Seitenziel

Ein Ziel pro Besuch: **ein Fahrzeug für den Test einreichen.** Deshalb keine Preisblöcke, keine zweiten Conversion-Ziele, keine Navigation ins Produkt.

Kernbotschaft über alle Screens: **„Vom LKW ins Netz."** – Ein Fahrzeug, das ankommt, muss nicht erst durch Aufbereitung, Fotograf und Fotobox, um verkäuflich gezeigt werden zu können.

Tempo wird als **Ablauf** erzählt („vom Wareneingang zum fertigen Motiv"), nicht als Zahl oder Versprechen.

---

## Screenaufbau von oben nach unten

### S0 · Header

Logo links, zwei Anker (`Ablauf`, `Fragen`), primärer CTA rechts („Fahrzeug kostenlos testen"). Auf dem Handy: keine Anker, CTA als fixierte Leiste am unteren Rand.

### S1 · Hero – Kontrast in einem Blick

Zweispaltig (links Text ca. 45 %, rechts Bild ca. 55 %), helle Kartenfläche, schmale Trennlinie nach unten.

```text
┌───────────────────────────────┬──────────────────────────────────────┐
│ Augenmerk (klein, Akzent)     │  ┌────────────────┐┌────────────────┐ │
│                               │  │ ANKUNFT        ││ ONLINE         │ │
│ JEDER STANDTAG                │  │  Fahrzeug auf  ││  dasselbe      │ │
│ KOSTET GELD.                  │  │  dem Anhänger, ││  Fahrzeug im   │ │
│                               │  │  Hof, bewölkt  ││  Showroom-Look │ │
│ ── mit Akzentzeile ──         │  └────────────────┘└────────────────┘ │
│ Vom LKW ins Netz – ohne       │      [ 9 Schritte ] → [ 3 Schritte ] │
│ Umweg über Aufbereitung,      │                                       │
│ Fotograf und Fotobox.         │  Kein Fotostudio · Keine Nacharbeit   │
│                               │                                       │
│ [Testen] [Ablauf ansehen]     │                                       │
└───────────────────────────────┴──────────────────────────────────────┘
```

- **Augenmerk:** „Für Autohäuser, Fahrzeughändler und Händlergruppen"
- **H1:** „Jeder Standtag kostet Geld."
- **Akzentzeile (kleiner, grün, direkt unter H1):** „Vom LKW ins Netz."
- **Subline:** „Wenn der Autotransporter vorfährt, beginnt der Verkauf. Ihre Mitarbeiter machen wenige Smartphone-Aufnahmen direkt am Fahrzeug – autohaus.ai erzeugt daraus professionelle, einheitliche Bilder im Showroom- und CI-Look. Kein Reinigen, kein Fotograf, keine Fotobox."
- **CTAs:** primär „Ein Fahrzeug kostenlos testen", sekundär „So läuft es ab" (Anker `#ablauf`)
- **Mikro-Vertrauenszeile:** „Kein Fotostudio nötig · Keine manuelle Nachbearbeitung · Für Händler und Gruppen"

**Bildidee (empfohlen):** dasselbe Fahrzeug in zwei Zuständen nebeneinander, harter Schnitt in der Mitte. Links realitätsnah: Auto auf dem Anhänger eines Sattelzugs auf einem Autohof, Morgendämmerung, bewölkter Himmel, Kennzeichen sichtbar, leicht staubig. Rechts: exakt dieselbe Ansicht als helles Showroom-/CI-Motiv. Kleine Label „Ankunft" und „Online". Darunter eine schmale Leiste, die den Wegfall der Prozesskette andeutet.

Wichtig: das dramatische LKW-Motiv bleibt auf die linke Bildhälfte beschränkt und wirkt dokumentarisch, nicht schmutzig. Die rechte Hälfte und die gesamte Seite bleiben hell und hochwertig.

**Alternative (wenn Interaktion gewünscht):** die bestehende Smartphone-Reveal-Maske aus dem Fahrzeugbilder-Hero, nur mit dem Anhänger-Bild als unbearbeiteter Fläche. Vorteil: bekanntes Element, hohe Verweildauer. Nachteil: erklärt den Standtage-Kontext schwächer als das Zwei-Hälften-Bild. Empfehlung bleibt das Zwei-Hälften-Bild.

### S2 · Problemsektion – „Zwischen Ankunft und Anzeige liegen Stunden"

Kurze Einleitung, dann die klassische Kette als horizontaler Pfad mit neun Stationen; auf dem Handy horizontal wischbar.

```text
abladen → reinigen/aufbereiten → rangieren & platzieren → Aufnahmeplatz/Fotobox finden
→ ausrichten → beleuchten → fotografieren → kontrollieren → freigeben → online stellen
```

Darunter vier Abhängigkeits-Kacheln (je ein Satz, keine Zahlen):

- **„Hängt am Wetter."** – Regen, Sonne und Dunkelheit entscheiden über den Zeitpunkt.
- **„Hängt an Personen."** – Wer fotografieren kann oder darf, ist oft gerade beschäftigt.
- **„Hängt an Plätzen."** – Die Fotobox ist besetzt oder der Hof ist voll.
- **„Hängt an Freigaben."** – Bilder müssen kontrolliert werden, bevor etwas passiert.

Abschlusszeile: „In dieser Zeit steht das Fahrzeug. Es ist bezahlt, finanziert und noch nicht sichtbar."

### S3 · Prozessvergleich – das Herzstück der Seite

Zwei gleich hohe Karten nebeneinander, dazwischen ein runder Pfeil (nur Desktop). Links gedämpfte Fläche mit roten X-Symbolen, rechts weiße Fläche mit grünen Häkchen und Akzandrahmen.

```text
┌── Der klassische Weg ──────────┐   ┌── Mit autohaus.ai ─────────────┐
│ ✕ abladen                      │   │ ✓ Ankommen und fotografieren   │
│ ✕ reinigen / aufbereiten       │ → │ ✓ autohaus.ai verarbeitet       │
│ ✕ Fahrzeug rangieren           │   │ ✓ Vermarkten                   │
│ ✕ Fotobox / Platz finden       │   │                                │
│ ✕ ausrichten und beleuchten    │   │ Ein Smartphone genügt.         │
│ ✕ professionell fotografieren  │   │ Am Standort, direkt am Fahrzeug│
│ ✕ kontrollieren und freigeben  │   │                                │
│ ✕ online stellen               │   │                                │
└────────────────────────────────┘   └────────────────────────────────┘
```

Darunter eine Leiste „Fällt weg" mit durchgestrichenen Chips: Aufbereitung · Fotograf · Fotobox · Ausrichten · Beleuchten · Warteschlange · Nachbearbeitung.

Abschlusszeile: „Aus einem Hoftermin wird ein Handgriff."

### S4 · Nutzen – vier Argumente, jeweils ein Satz

Vier Karten, ein Icon, eine Headline, maximal zwei Zeilen Text. Kein Feature-Sprech.

1. **„Verkaufsfähig, während es noch auf dem Hof steht."** – Die Bilder entstehen dort, wo das Fahrzeug ohnehin steht.
2. **„Unabhängig von Wetter, Fotograf und freien Plätzen."** – Niemand muss warten, bis ein Aufnahmeplatz frei wird.
3. **„Ein einheitlicher Auftritt über den gesamten Bestand."** – Alle Fahrzeuge im selben Look, über Mitarbeiter und Standorte hinweg.
4. **„Weniger Aufwand im Tagesgeschäft."** – Wer ablädt, kann direkt fotografieren; der Rest läuft automatisch.

Optional eine fünfte, breite Karte: **„Skaliert mit dem Wareneingang."** – Mehrere Fahrzeuge nacheinander folgen demselben Ablauf, ohne dass der Prozess jedes Mal neu gestartet wird.

### S5 · Beweise und Vertrauen – ohne erfundene Zahlen

Drei Elemente untereinander:

1. **Vorher/Nachher-Galerie** mit den vorhandenen Beispielmotiven (Bestandsfoto gegen Showroom-Ergebnis), überschriftet „So sieht das Ergebnis aus". Ehrlicher Hinweis darunter: „Das Ergebnis hängt von der Qualität Ihrer Aufnahme ab. Im Test zeigen wir es an einem Ihrer eigenen Fahrzeuge."
2. **„So läuft der Test ab"** – drei nummerierte Schritte: konkretes Beispiel-Ergebnis · kurze Prozesseinschätzung · Empfehlung für den Einsatz. identisch mit dem bestehenden Funnel, damit die Erwartung übereinstimmt.
3. **Vertrauenszeile** als kompakte Leiste mit Häkchen:
   - Angebot ausschließlich für Unternehmer i. S. d. § 14 BGB
   - Das hochgeladene Bild wird nur für die Testanfrage verwendet und nicht veröffentlicht
   - Rückmeldung in der Regel innerhalb eines Werktags
   - KI-generierte Medien werden gekennzeichnet
   - Ein Produkt der Breadcrumb Marketing GmbH, Hanau

Zusätzlich, falls gewünscht, ein Zitat aus den bestehenden Kundenstimmen (Thomas R., Mehrmarken-Autohaus) – nur wenn die Stimme belegbar ist.

Bewusst nicht verwendet: Sterne-Noten, „über 500 Autohäuser", Prozentangaben, Preise, Hersteller-Logos, „Made in Germany"-Siegel, Datenschutz-Siegel.

### S6 · Kurz-FAQ (vier Fragen, Akkordeon)

- „Brauche ich eine bestimmte Kamera?" – Nein, ein aktuelles Smartphone genügt.
- „Wer fotografiert bei uns?" – Jede Person, die das Fahrzeug ohnehin anfasst. Keine Schulung nötig.
- „Funktioniert das auch für Transporter, Motorrad oder LKW?" – Ja, die Aufnahmeabläufe sind je Fahrzeugart aufgebaut.
- „Was passiert mit meinem Bild?" – Es wird nur für die Bearbeitung der Testanfrage verwendet und nicht öffentlich zugänglich gespeichert.

### S7 · Abschluss-CTA

Vollbreite Akzentfläche (bestehender Hero-Verlauf), links Text, rechts Button, mobile untereinander.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Machen Sie Ihr nächstes Fahrzeug zum Test.                          │
│  Ein Smartphone-Foto vom Hof genügt. Sie sehen das Ergebnis          │
│  und entscheiden dann.                                               │
│                    [ Ein Fahrzeug kostenlos testen ]                 │
│  Dauert nur eine Minute · Rückmeldung innerhalb eines Werktags       │
└──────────────────────────────────────────────────────────────────────┘
```

### S8 · Footer

Bestehender Rechts-Footer, unverändert.

**Gesamtlänge:** acht Bildschirme, davon fünf mit Text. Kein Video, keine Preislogik, keine Produkttour – bewusst kurz für Paid-Traffic.

---

## Mobile Darstellung

- Hero stapelt: Augenmerk → H1 (zwei Zeilen) → Akzentzeile → Subline → Buttons (primär volle Breite) → Bildpaar untereinander bzw. seitlich wischbar → Mikro-Vertrauenszeile als Zwei-Zeilen-Block.
- Fixierte CTA-Leiste am unteren Rand ab dem zweiten Screen, verdeckt den Inhalt nicht.
- Prozesskette: horizontal wischbare Chips mit Snap, „Fällt weg"-Chips umbrechend.
- Prozessvergleich: klassischer Weg zuerst, darunter autohaus.ai mit Akzandrahmen; Pfeil entfällt.
- Nutzenkarten einspaltig, Galerie wischbar, FAQ als Karten mit Chevron.
- Typografie eine Stufe kleiner: H1 30–34 px, Subline 15 px, Karten 14 px, Buttons 48 px hoch.
- Keine horizontalen Überläufe, Bildseitenverhältnisse unverzerrt.

---

## Textvorschläge für Headlines und CTAs

| Bereich | Empfehlung | Alternative |
|---|---|---|
| H1 | „Jeder Standtag kostet Geld." | „Das Fahrzeug ist da. Warum ist es erst nächste Woche online?" |
| Akzentzeile | „Vom LKW ins Netz." | „Vom Wareneingang zur Anzeige." |
| Subline | „Wenn der Autotransporter vorfährt, beginnt der Verkauf. Ihre Mitarbeiter machen wenige Smartphone-Aufnahmen direkt am Fahrzeug – autohaus.ai erzeugt daraus professionelle, einheitliche Bilder im Showroom- und CI-Look. Kein Reinigen, kein Fotograf, keine Fotobox." | „Ein Auto kommt an, ein Foto entsteht, ein fertiges Motiv geht raus – ohne Umweg über Aufbereitung, Fotograf und Fotobox." |
| Primär-CTA | „Ein Fahrzeug kostenlos testen" | „Jetzt ein Fahrzeug testen" |
| Sekundär-CTA | „So läuft es ab" | „Ablauf ansehen" |
| Problem-Headline | „Zwischen Ankunft und Anzeige liegen Stunden." | „Der teuerste Schritt ist der, den keiner sieht." |
| Vergleich-Headline | „Vom LKW ins Netz – in drei Schritten." | „Ein Handgriff statt eines Hoftermins." |
| Nutzen-Headline | „Was sich für Ihren Bestand ändert." | „Warum Ihr Bestand schneller sichtbar wird." |
| Beweis-Headline | „So sieht das Ergebnis aus." | „Aus einem Handyfoto wird ein Verkaufsmotiv." |
| Abschluss-CTA | „Machen Sie Ihr nächstes Fahrzeug zum Test." | „Testen Sie es mit dem nächsten Wareneingang." |
| Mikro-CTA-Subline | „Dauert nur eine Minute · Rückmeldung innerhalb eines Werktags" | „Ein Foto genügt · keine Vertragsbindung im Test" |

## Bildproduktionsliste (für die Umsetzungsphase)

1. Hero links: Autotransporter mit mehreren Fahrzeugen auf einem Autohof, Morgendämmerung, dokumentarisch, ca. 700 px breit, WebP.
2. Hero rechts: dasselbe Fahrzeug als helles Showroom-Motiv, gleiche Ansicht, ca. 700 px, WebP.
3. Prozess: Mitarbeiter mit Smartphone am Fahrzeug auf dem Anhänger/Hof, ca. 720 px, WebP.
4. Galerie: vorhandene Vorher/Nachher-Motive, keine neuen needed.
5. Optional Abschluss: Fahrzeug im Schaufenster/Anzeigenumfeld, ca. 720 px, WebP.

Falls Bild 1 oder 2 KI-generiert entsteht, greift die Kennzeichnungspflicht für KI-Medien über die zentrale Funktion des Projekts.

## Offene Entscheidungen vor der Umsetzung

1. finaler URL-Pfad (`/standtage-vermeiden` empfohlen).
2. Ob die Akzentzeile „noch am selben Tag online" sagen darf – nach aktuellem Stand **nein**, weil es wie ein Zeitversprechen wirkt; Vorschlag weicht deshalb auf „ohne Umweg über …" aus.
3. Ob das Kunden-Zitat in S5 genutzt wird (nur mit belegbarer Stimme).
4. Ob die Seite zusätzlich eine Demo-Buchung anbietet – Empfehlung: nein, ein Ziel pro Paid-Seite.
