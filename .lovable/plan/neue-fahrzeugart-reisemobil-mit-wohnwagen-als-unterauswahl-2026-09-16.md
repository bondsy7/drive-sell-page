# Neue Fahrzeugart: Reisemobil (mit Wohnwagen als Unterauswahl)

Eine vollständig eigene Bildstrecke für Freizeitfahrzeuge — Wohnmobil, Kastenwagen und Wohnwagen. Pkw, Lkw und Motorrad bleiben unverändert: eigene Aufnahmeauswahl, eigene Texte für die Bildgenerierung, eigene Motivliste, kein gemeinsamer Code mit den bestehenden Arten.

## Auswahl beim Start

In der Fahrzeugart-Auswahl erscheint eine vierte Kachel „Reisemobil" (Beispiele: Wohnmobil, Kastenwagen, Alkoven, Wohnwagen). Danach folgt eine kurze Unterauswahl des Aufbautyps:

- Teilintegriert / Alkoven / Vollintegriert (mit Fahrerhaus)
- Kastenwagen (Campervan)
- Wohnwagen (Anhänger, kein Fahrerhaus, Deichsel statt Cockpit)

Die Unterauswahl steuert, welche Aufnahmen und welche generierten Motive angeboten werden. Beim Wohnwagen entfallen Cockpit und alles, was ein Fahrerhaus voraussetzt; stattdessen kommen Deichsel/Anhängerkupplung und Stützen dazu.

## Aufnahmen (Fotos, die hochgeladen werden)

Pflicht: 3/4 Front, Seite links, Seite rechts, Heck.
Optional: Cockpit (entfällt beim Wohnwagen), Wohnraum, Küche, Bad, Bett, Heckgarage, Fahrgestellnummer.

Die zehn hochgeladenen Illustrationen dienen als Vorschaubilder der Kacheln und werden als Projekt-Assets hinterlegt.

## Generierte Motive

- Außen: Master-Bild, Frontansicht, Seite links, Seite rechts, Heck, 3/4 hinten, leicht erhöhte Ansicht
- Innen: Sitzgruppe/Wohnbereich, Küchenzeile, Bad/Nasszelle, Schlafbereich, Cockpit-Sitzgruppe (nur motorisiert)
- Details: Aufbautür/Einstieg, Markise, Heckgarage/Stauraum, Aufstelldach bzw. Dachaufbauten, Räder, Außenanschlüsse; beim Wohnwagen zusätzlich Deichsel und Stützen
- Collagen: Außen-Grid, Innen-Grid, Social-Media-Collage

Alle Texte sind auf Freizeitfahrzeuge zugeschnitten: Innenaufnahmen zeigen den Aufbau leer und aufgeräumt (keine Personen, kein Geschirr, keine Wäsche), Möbelfronten, Polsterstoffe, Holzdekore, Fenster und Dachluken müssen exakt der Vorlage entsprechen. Ausdrücklich verboten sind Pkw-Motive (Kühlergrill-Detail, Rücksitzbank, Kofferraumklappe) und das Erfinden von Ausstattung.

## Technische Umsetzung

- `src/config/vehicle-class-types.ts`: `motorhome` wird aktive Klasse; neuer Typ `MotorhomeBodyTypeKey` (`semi_integrated` | `alcove` | `fully_integrated` | `campervan` | `caravan`) plus optionales Feld in `VehicleClassContext` und in `VehicleData` (`motorhomeBodyType`).
- Neu `src/config/profiles/motorhome-profile.ts`: Slots wie oben, `remasterPromptProfile: 'motorhome'`, `hasWorkflowWizard: true` für die Aufbau-Unterauswahl, `showSlotSections: true` (Pflicht vs. optional).
- Neu `src/config/motorhome-workflow.ts`: Aufbautyp-Auswahl und daraus abgeleitete Slot-/Jobfilterung (Cockpit und Fahrerhaus-Motive nur motorisiert, Deichsel-Motive nur Wohnwagen) — analog zum bestehenden Lkw-Workflow, ohne diesen anzufassen.
- Neu `src/prompts/remaster/motorhome.ts`: `MOTORHOME_SUBJECT_LOCK`, `MOTORHOME_IDENTITY_LOCK`, `MOTORHOME_INTERIOR_LOCK`, `MOTORHOME_NEGATIVE_CONSTRAINTS`, `MOTORHOME_PERSPECTIVE_PROMPTS`, `buildMotorhomePromptBlocks()`.
- Neu `src/lib/pipeline-jobs-motorhome.ts`: `MOTORHOME_PIPELINE_JOBS` mit den Kategorien hero/exterior/interior/detail/grid; Innenjobs mit `category: 'interior'`, damit Kennzeichen-/Referenzrouting korrekt greift.
- `src/lib/pipeline-jobs.ts`: `getPipelineJobsForVehicleClass` um `motorhome` erweitern, `ALL_PIPELINE_JOBS` und `getTotalImageCount` ergänzen.
- `src/lib/remaster-prompt.ts`: dritter Klassen-Zweig `isMotorhome` für Prompt-Blöcke und Perspektivtexte; bestehende Pkw-/Lkw-/Motorrad-Zweige unverändert.
- `src/config/vehicle-classes.ts`: Profil registrieren, `ACTIVE_VEHICLE_CLASSES` erweitern.
- `src/components/capture/VehicleClassPicker.tsx` / `VehicleClassStrip.tsx`: Kachel plus Bild; `src/components/OneShotStudio.tsx` von `PIPELINE_JOBS` auf `getPipelineJobsForVehicleClass(vehicleClass)` umstellen (wie beim Motorrad bereits erfolgt).
- `src/contexts/PipelineContext.tsx`: Referenzzuordnung für die Wohnraum-Slots (Bad, Bett, Küche, Wohnraum, Heckgarage) ergänzen, analog zum Zweirad-Cockpit-Zweig.
- `supabase/functions/remaster-vehicle-image/index.ts`: `ACTIVE_CLASSES` um `motorhome` erweitern und die Klasse an die Prompt-Auswahl durchreichen; Funktion neu deployen.
- Assets: die zehn Illustrationen als `.asset.json`-Pointer unter `src/assets/motorhome-perspectives/` ablegen, zusätzlich ein Kachelbild unter `src/assets/vehicle-classes/motorhome.png`.
- Keine Datenbankänderung nötig — die Fahrzeugart wird als Text gespeichert und ist nicht eingeschränkt.
- Abschluss: Typprüfung, Testlauf und Build; Sichtprüfung der neuen Auswahl im Vorschaufenster.

## Offen / nicht enthalten

- Die neuen Texte sind wie bei Motorrad und Lkw zunächst nicht im Admin-Bereich „Prompts" editierbar.
- Creditpreise entsprechen den bestehenden Stufen; keine eigene Preislogik für Reisemobile.
