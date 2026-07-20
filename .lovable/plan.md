# Zuverlässige Erkennung von Sticker/Schriftzügen/Schildern beim Remaster

## Ursache
Das Bild-Modell muss aktuell in einem einzigen Pass Fremd-Branding gleichzeitig **finden** und **entfernen**. Ohne konkrete Positionsangaben rät es — deshalb bleiben Elemente wie `TRUCKTAT Every Mile in Style` oder gelbe Warnschilder stehen bzw. es wird versehentlich OEM-Grafik entfernt. Lösung: die Erkennung von der Entfernung entkoppeln.

## Umfang
Änderung nur im Remaster-Pfad. Kein neues UI, kein Verifikations-Pass, keine Kostenexplosion — genau **ein** zusätzlicher, günstiger Vision-Call (`google/gemini-3.1-flash-lite`) pro Bild, nur wenn mindestens eine Bereinigungs-Kategorie angehakt ist.

## Ablauf
```text
User startet Remaster
      │
      ▼
cleanupItems.length > 0 ?
  ├── nein → wie bisher, direkt Bild-Edit
  └── ja  → Detect-Call (siehe unten)
              ▼
        Detect-JSON:
        [{ kind, location, text?, color?, size }, …]
              ▼
        In Master-Prompt als
        <DETECTED_BRANDING>-Block einfügen
              ▼
        Bild-Edit wie bisher (Nano Banana),
        BODY_CLEANUP-Regeln greifen jetzt
        auf eine benannte Liste statt Blindsuche
```

## Änderungen im Detail

### 1. Neue Edge Function `detect-vehicle-branding`
- Input: `imageFileUri` (Gemini File API, gemäß Projekt-Regel „File API First") + Liste der aktivierten Cleanup-Kategorien.
- Modell: `google/gemini-3.1-flash-lite` (direct API, wie andere Functions per `GEMINI_API_KEY` aus `admin_secrets`, kein Lovable Gateway).
- Auth: `sb.auth.getClaims(token)` (Projekt-Regel).
- Prompt in stichfestem Englisch, verlangt strikt JSON-Array:
  ```
  For each non-OEM element on the vehicle body, return an object with:
    kind      = "lettering" | "logo" | "sign" | "sticker" | "banner" | "external-accessory"
    location  = concrete vehicle region (e.g. "wind deflector above windshield",
                "driver door lower half", "left B-pillar", "trailer curtain side")
    text      = literal text if readable, else null
    color     = dominant color, e.g. "yellow", "blue on white"
    size      = "small" | "medium" | "large"
  Include ONLY elements that are NOT part of the base OEM vehicle
  (i.e. NOT the manufacturer emblem, NOT model badge, NOT type plate,
   NOT mandatory legal markings integrated by the OEM).
  Return `[]` if nothing found. No prose, JSON only.
  ```
- Robust: JSON-Repair-Fallback (Regex extrahiert erstes `[...]`), bei Parse-Fail leeres Array — Remaster läuft trotzdem, nur ohne Inventar.
- Response: `{ items: DetectedBrandingItem[] }`.

### 2. `src/lib/remaster-prompt.ts`
- `RemasterConfig` bekommt optionales Feld `detectedBranding?: DetectedBrandingItem[]`.
- Neuer Prompt-Abschnitt `<DETECTED_BRANDING>` direkt **vor** `<BODY_CLEANUP>`, wird nur eingefügt wenn Liste vorhanden. Format:
  ```
  <DETECTED_BRANDING>
  A vision pre-scan of the input image identified the following non-OEM
  elements on this vehicle. Treat this as an authoritative removal
  checklist — every item MUST be gone in the output:
  - [LETTERING] "TRUCKTAT Every Mile in Style" — wind deflector above windshield, white text, large
  - [SIGN]      yellow warning plate — front grille left side, medium
  - [STICKER]   blue decal strip — right B-pillar, medium
  …
  Only remove items matching the user-selected cleanup categories: {lettering, signs, stickers}.
  Any item whose `kind` is not in this whitelist must remain untouched.
  </DETECTED_BRANDING>
  ```
- Die `<BODY_CLEANUP>`-Rekonstruktions-Regeln bleiben — sie greifen nun auf konkret benannte Regionen statt eine Blindsuche.

### 3. Prompt-Härtung in `<BODY_CLEANUP>` (Zusatz zu bestehendem Block)
- „Definition of operator branding": jeder lesbare Text (Wort, URL, Telefon, E-Mail) und jede Grafik, die **nicht** auf offiziellen OEM-Pressebildern eines Base-`<make> <model>` erscheint, gilt automatisch als Fremd-Branding.
- Systematische Scan-Anweisung: top→bottom, front→rear, beide Seiten, Dach, Spiegel, Windleitblech, Kotflügelverbreiterungen, Radlaufblenden, Plane/Kofferaufbau, Anhänger, Mudflaps.
- Whitelist präzisieren: nur Hersteller-Emblem, Modell-Schriftzug, Typenschild, gesetzlich vorgeschriebene OEM-Markierungen bleiben.

### 4. Verdrahtung im Remaster-Aufruf
- In der bestehenden Remaster-Client-Logik (`src/hooks/useRemaster*.ts` bzw. dort wo `RemasterConfig` gebaut wird): wenn `cleanupItems.length > 0`, vor dem eigentlichen Edit-Call `detect-vehicle-branding` invoken, Ergebnis in `config.detectedBranding` schreiben.
- Fehlschlag des Detect-Calls loggt eine Warnung, blockiert aber den Remaster nicht — Fallback = alter Zustand.

### 5. Logging & Monitoring
- Edge-Function loggt strukturiert: `[detect-vehicle-branding] items=N kinds=[lettering,sign] user=…`.
- Remaster-Function loggt, ob ein `<DETECTED_BRANDING>`-Block im Prompt war (`detected=1|0`) — dadurch A/B-Vergleich im Job-Monitor möglich.

## Nicht-Ziele (aus Umfang bewusst raus)
- Kein Verifikations-Pass nach dem Remaster.
- Kein Auto-Upgrade auf Nano Banana Pro.
- Kein UI zum manuellen Markieren von Bereichen.
- Diese Optionen bleiben als spätere Ausbaustufe möglich, sind aber jetzt nicht Teil der Änderung.

## Erwartetes Ergebnis
Wenn du z. B. „Schriftzüge" und „Schilder" anhakst, sieht der Bild-Prompt eine namentliche Liste („`TRUCKTAT Every Mile in Style` — Windleitblech", „gelbes Warnschild — Kühlergrill links") statt einer abstrakten Kategorie. Damit steigt die Trefferquote deutlich, ohne dass Nutzer manuell markieren müssen oder der Credit-Verbrauch spürbar wächst (Flash-Lite Call ist gegenüber dem Nano-Banana-Edit vernachlässigbar).
