## Ziel

Wenn beim Remastern die „Spezifische Bereinigung" aktiv ist, soll das Modell nicht mehr versuchen, jeden einzelnen Sticker / Farbakzent präzise zu lokalisieren, sondern die **Grundfarbe der Fahrzeuglackierung** (im Beispiel: grau) über die gesamte Karosserie ziehen. Damit werden Sticker, Neon-Akzente, Streifen, Foliierungen etc. automatisch „übermalt", auch wenn sie vom Vision-Pre-Scan nicht einzeln erkannt wurden.

## Änderung

Datei: `src/lib/remaster-prompt.ts` – Block `<BODY_CLEANUP>` (ca. Zeile 446–469).

Neuen Unterblock `BASE_PAINT_UNIFICATION` in `<BODY_CLEANUP>` ergänzen. Er wird nur eingefügt, wenn mindestens eine Cleanup-Kategorie aktiv ist (also automatisch nur für die zwei freigeschalteten Nutzer relevant) und wenn `config.changeColor` **nicht** aktiv ist (bei bewusst gewähltem Farbwechsel darf `colorHex` gewinnen).

Inhalt (auf Englisch, im vorhandenen Prompt-Stil):

```
<BASE_PAINT_UNIFICATION>
BODY PAINT MUST BE ONE SINGLE, UNIFORM OEM COLOR:
1. Identify the dominant OEM base paint color of the vehicle body from the largest, cleanest painted areas (roof, hood, upper doors, rear quarter panels — areas without decals).
2. Extend that EXACT paint color, shade, metallic flake pattern and finish (glossy/matte/pearl) across the ENTIRE painted body: cab, doors, side panels, wind deflectors, spoilers, side skirts, bumpers, wheel arches, fenders, tailgate, box body / trailer walls where they are painted metal.
3. Any surface area that currently shows a different color than this base — stickers, decals, wraps, side stripes, neon/yellow/red accents, camo patterns, gradient graphics, painted logos, printed tarpaulin sections, contrast panels added by the operator — MUST be OVERPAINTED with the identified base color so it becomes visually indistinguishable from the surrounding factory paint.
4. This rule is a SAFETY NET: even if an individual sticker or colored zone was not listed in DETECTED_BRANDING, if it clearly breaks the uniform OEM base color it MUST be painted over with the base color.
5. Preserve genuine OEM two-tone paint schemes ONLY when they are clearly factory (e.g. black roof on a factory two-tone, black plastic lower cladding, black window surrounds). If in doubt whether a color break is factory or operator-added, treat it as operator-added and unify with the base color.
6. WHITELIST (do NOT repaint): OEM manufacturer emblem, OEM model-name lettering, glass, lights, tires, wheels, chrome trim, black plastic cladding, mirrors housings that are factory-black, grille.
7. After unification, the entire painted body must look like a single continuous, freshly-polished OEM paint job — no color patches, no ghost outlines of removed graphics, no halos, no seams.
</BASE_PAINT_UNIFICATION>
```

Reihenfolge im Prompt: direkt **vor** dem bestehenden „RECONSTRUCTION RULES"-Absatz einfügen, damit das Modell zuerst die Grundfarbe zieht und danach die Rekonstruktions-Regeln (nahtlose Panels, keine Ghosting-Kanten) darauf anwendet.

## Wechselwirkungen

- `changeColor + colorHex`: wenn der Nutzer bewusst eine neue Lackfarbe wählt, gewinnt weiterhin `<COLOR_CHANGE_MANDATE>` (bereits „ABSOLUTE, NON-NEGOTIABLE"). Der neue Block wird in diesem Fall unterdrückt, damit sich beide Regeln nicht widersprechen.
- `DETECTED_BRANDING`: bleibt unverändert — der Vision-Pre-Scan liefert weiterhin die präzise Liste, der neue Block ist die Rückfall-/Deckungs-Ebene.
- Kein UI-Element, kein neuer Credit-Verbrauch, keine Änderung an Edge Functions oder DB.

## Technische Umsetzung

Innerhalb des bestehenden `if (config.cleanupItems && config.cleanupItems.length > 0)`-Zweigs in `buildMasterPrompt`:

1. Neue Konstante `basePaintUnification` bauen (nur wenn `!config.changeColor`).
2. Im Template-String für `<BODY_CLEANUP>` diesen Block zwischen „WHITELIST — keep untouched" und „RECONSTRUCTION RULES" einfügen.

Danach kurze Sichtprüfung des generierten Prompts über einen Testlauf im Remaster-Flow für ein LKW-Bild.
