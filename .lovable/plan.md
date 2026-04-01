

## Plan: Landing Page Generator – Kontextuelle Bilder & Helpful Content Overhaul

### Ziel
Der Landing Page Generator soll zu einem echten Conversion-Tool werden: Jede Section bekommt ein thematisch passendes Bild (Motor → Motorbild, Innenraum → Interieur, etc.), der Content wird als "Helpful Content" aufgebaut, und die Bedienung wird maximal vereinfacht.

---

### 1. Frontend vereinfachen (`src/components/ManualLandingGenerator.tsx`)

**Auto-Load Dealer-Profil**: Beim Mount automatisch das Profil laden und als Badge anzeigen ("Händlerdaten geladen ✓"). Kein manueller Dealer-Input mehr nötig.

**Formular auf 2 Schritte reduzieren**:
- **Schritt 1 – Fahrzeug & Angebot**: Brand/Model Picker, Variante, Farbe, Seitentyp, Preis/Rate – alles in einem Block.
- **Schritt 2 – Stil & Extras**: Tonalität, Bild-Stil, Highlights/USPs, eigene Bilder (max 5 statt 3).

**Mehr Bilder erlauben**: Upload-Limit von 3 auf 5 erhöhen, damit Nutzer z.B. Innenraum, Motor, Detail-Shots mitgeben können.

**Progress-Anzeige verbessern**: Fortschritt mit Schritten anzeigen ("Texte generieren... Bilder generieren 3/7...").

---

### 2. Edge Function überarbeiten (`supabase/functions/generate-landing-page/index.ts`)

**Kontextuelle Bild-Prompts**: Der System-Prompt wird so umgebaut, dass die KI für JEDE Section einen thematisch exakten `imagePrompt` generiert, der zum Inhalt passt:

```text
Für JEDE Section MUSS ein imagePrompt generiert werden.
Der imagePrompt MUSS exakt zum Sektionsinhalt passen:
- Sektion über Motor/Leistung → Motorraum, Auspuff, Bremsen
- Sektion über Innenraum/Komfort → Cockpit, Sitze, Infotainment  
- Sektion über Design/Exterieur → Seitenansicht, Heck, Details
- Sektion über Technologie → Display, Ladeport, Assistenzsysteme
- Sektion über Sicherheit → Airbags, Sensoren, Crash-Test Szenario
- FAQ/Steps/CTA Sektionen → kein Bild (imagePrompt: null)
```

**Mehr Bilder generieren**: `imageCount` pro Typ erhöhen (5-7 statt 3-5). Parallel-Batch von 2 auf 3 erhöhen.

**Helpful Content Prompt**: Den Content-Prompt erweitern:
- Jede Section muss echten Informationswert bieten
- Konkrete technische Daten, Vergleiche, Praxisbeispiele
- Kaufberatungs-Charakter: "Was bedeutet das für Sie im Alltag?"
- Strukturierte Inhalte: Bullet-Points, Vergleichstabellen, Checklisten
- SEO: Natürliche Long-Tail-Keywords, FAQ mit echten Fragen

**Section-Types erweitern**: Neue Typen hinzufügen:
- `specs` – Technische Daten mit Bild
- `comparison` – Vergleichstabelle
- `benefits` – Vorteilsliste mit Icons
- `gallery` – Bildergalerie-Section

---

### 3. HTML Builder erweitern (Edge Function + `src/lib/landing-page-builder.ts`)

**Neue Section-Layouts**: 
- `specs`: Zwei-Spalten-Layout mit großem Bild links, Daten rechts
- `comparison`: Responsive Tabelle
- `benefits`: Icon-Grid mit Bildern
- `gallery`: 2-3 Spalten Bildergalerie

**Bessere Bild-Integration**: Jedes Bild bekommt eine semantische Caption basierend auf dem Sektions-Headline.

---

### Dateien die geändert werden

| Datei | Änderung |
|---|---|
| `src/components/ManualLandingGenerator.tsx` | Vereinfachtes 2-Step-Formular, Auto-Profil-Load, 5 Bilder, besserer Progress |
| `supabase/functions/generate-landing-page/index.ts` | Kontextuelle Image-Prompts, Helpful Content Prompt, mehr Bilder, neue Section-Types, Batch-Size 3 |
| `src/lib/landing-page-builder.ts` | Neue Section-Layouts (specs, comparison, benefits, gallery) |

### Credits
Kosten bleiben bei 3 Credits (mehr Bilder werden intern generiert, kein Aufpreis).

