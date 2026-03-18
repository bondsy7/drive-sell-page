

## Korrektur der CO₂-Preisszenarien und Beschriftungen (Pkw-EnVKV)

### Problem

Das offizielle BMWK-Dokument (Veröffentlichung vom 27.06.2024) gibt folgende CO₂-Preise vor:

| Angabe | Offiziell | Aktuell im Code |
|--------|-----------|-----------------|
| Mittel (Angabe 1) | **115 €/t** | 150 €/t |
| Niedrig (Angabe 2) | **55 €/t** | 100 €/t |
| Hoch (Angabe 3) | **190 €/t** | 250 €/t |

Zusätzlich fehlen die vorgeschriebenen Beschreibungstexte bei den Kostenangaben. Laut Pkw-EnVKV müssen die Angaben so formuliert sein:

> "Mögliche CO₂-Kosten über die nächsten 10 Jahre (15.000 km/Jahr): **2.346 €** (bei einem angenommenen mittleren durchschnittlichen CO₂-Preis von **115 €/t**)"

### Änderungen

**1. `src/lib/cost-utils.ts`** -- CO₂-Preise korrigieren
- `low: 100` → `low: 55`
- `medium: 150` → `medium: 115`
- `high: 250` → `high: 190`
- Kommentare aktualisieren auf die offiziellen BMWK-Werte

**2. `src/lib/templates/shared.ts`** -- `buildCostRows()` Labels anpassen
- Statt kurzer Labels die vollständigen Pflichtangaben verwenden:
  - `"Energiekosten bei 15.000 km/Jahr"` (mit dynamischer Fahrleistung)
  - `"CO₂-Kosten (mittel, 10J, 115 €/t)"`
  - `"CO₂-Kosten (niedrig, 10J, 55 €/t)"`
  - `"CO₂-Kosten (hoch, 10J, 190 €/t)"`
  - `"Kfz-Steuer/Jahr"`

**3. `src/lib/html-generator.ts`** -- Gleiche Label-Anpassung wie in shared.ts (Zeilen 53-58)

**4. Kraftstoffpreis-Label** -- Suffix "(Jahresdurchschnitt)" hinzufügen, damit klar ist, auf welcher Basis gerechnet wird.

### Nicht betroffen

- Die PDF-Extraktion (`analyze-pdf`) liest die Werte direkt aus dem Dokument und ist nicht betroffen.
- Die CO₂-Klassen-Zuordnung (A-G) und das Label-Image-System bleiben unverändert.
- Die `ConsumptionData`-Typen bleiben unverändert (die Felder speichern formatierte Strings).

