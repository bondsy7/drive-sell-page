

# Plan: Landing Page Generator Upgrade

## Zusammenfassung

Der aktuelle Landing Page Generator hat drei wesentliche Schwaechen:
1. **Marke/Modell als Freitext** statt dem bestehenden `VehicleBrandModelPicker` Dropdown
2. **Kein Kontaktformular** in der generierten HTML (die PDF-Seiten haben es, Landing Pages nicht)
3. **Zu wenige Gestaltungsoptionen** -- der Nutzer hat kaum Einfluss auf Bilder, Ton, Zielgruppe, Preis etc.

## Aenderungen

### 1. ManualLandingGenerator.tsx -- Komplett ueberarbeiten

**Marke/Modell:** Freitext-Inputs durch `VehicleBrandModelPicker` ersetzen (wie bei VehicleSelectBeforeGenerate). Zusaetzlich Variante-Input (z.B. "Competition", "AMG").

**Neue Eingabefelder fuer mehr Individualitaet:**
- **Preis/Rate** (optional): Monatliche Rate oder Gesamtpreis, der auf der Seite erscheinen soll
- **Zielgruppe**: Dropdown (Privatkunden, Gewerbe, Junge Fahrer, Familien, Premium)
- **Tonalitaet**: Dropdown (Professionell, Emotional, Sportlich, Premium/Luxus, Jugendlich)
- **Farbe des Fahrzeugs** (optional): Beeinflusst Bild-Prompts fuer bessere Ergebnisse
- **Highlights/USPs**: Textarea fuer besondere Ausstattung, Aktionen, Vorteile
- **Bild-Stil**: Dropdown (Studio/Showroom, Outdoor/Natur, Urban/Stadt, Dynamisch/Fahrt) -- steuert die Image-Prompts
- **Eigene Bilder hochladen** (optional): Bis zu 3 Bilder vorab hochladen, die statt KI-Bildern verwendet werden

**Formular-Layout:** Mehrstufig mit klaren Abschnitten:
1. Fahrzeug (Marke/Modell/Variante/Farbe)
2. Angebot (Seitentyp, Preis, Zielgruppe)
3. Stil (Tonalitaet, Bild-Stil, Highlights)

### 2. Edge Function `generate-landing-page` -- Erweitern

- Neue Parameter entgegennehmen: `variant`, `price`, `targetAudience`, `tone`, `color`, `imageStyle`, `highlights`, `uploadedImages`
- System-Prompt anreichern mit Zielgruppe, Tonalitaet, Preis-Infos
- Bild-Prompts anpassen basierend auf `imageStyle` und `color` (z.B. "White BMW M3 Competition in a modern showroom" statt generisch)
- Hochgeladene Bilder priorisieren: wo User-Bilder vorhanden, werden keine KI-Bilder generiert

### 3. Kontaktformular in Landing Pages einbauen

- `buildLandingPageHTML()` und die Edge-Function `buildHTML()` erweitern:
  - `buildContactFormHTML()` aus `shared.ts` einbinden (bereits vorhanden, getestet, mit Leads-Integration + Bot-Verarbeitung)
  - `dealerUserId` und `projectId` durchreichen
  - `supabaseUrl` (VITE_SUPABASE_URL) als Parameter mitgeben
- Im Editor: Kontaktformular-Toggle (an/aus) und vehicleTitle-Feld editierbar
- Leads landen in der `leads`-Tabelle und werden vom Sales-Bot gleich behandelt wie PDF-Seiten-Anfragen

### 4. LandingPageEditor.tsx -- Kontaktformular-Sektion

- Neuer Accordion-Abschnitt "Kontaktformular" mit Toggle (aktivieren/deaktivieren)
- VehicleTitle editierbar (default: "Brand Model")
- Preview zeigt Kontaktformular-Button live an

### 5. landing-page-builder.ts -- Kontaktformular integrieren

- Neuer optionaler Parameter `contactForm?: { dealerUserId: string; projectId: string; supabaseUrl: string; vehicleTitle: string; pageType: string }`
- Wenn gesetzt: `buildContactFormHTML()` vor `</body>` einbauen
- Sticky CTA-Button + Modal wie bei den PDF-Angebotsseiten

## Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/ManualLandingGenerator.tsx` | VehicleBrandModelPicker, neue Felder, Bild-Upload |
| `supabase/functions/generate-landing-page/index.ts` | Erweiterte Parameter, bessere Prompts, Bild-Stil |
| `src/lib/landing-page-builder.ts` | ContactForm-Support |
| `src/components/LandingPageEditor.tsx` | Kontaktformular-Toggle + vehicleTitle |

## SEO-Verbesserungen (im Prompt)

- Open Graph Image-Tag mit Hero-Bild
- Canonical URL aus Dealer-Website
- Bessere JSON-LD Struktur (AutoDealer + Offer Schema)
- Zielgruppen-spezifische Keywords

