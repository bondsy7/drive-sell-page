---
name: automotive-pflichtangaben
description: Pkw-EnVKV/WLTP Pflichtangaben für Fahrzeug-Banner, Inserate und Landingpages korrekt formatieren. Triggert bei Banner-Generierung, Anzeigentexten, CO₂-Klassen, Verbrauchsangaben, Leasing/Finanzierungs-Footern und allem rund um deutsches Kfz-Marketingrecht.
---

# Automotive Pflichtangaben (Pkw-EnVKV / WLTP)

Zentrale Logik: `src/lib/mandatory-disclosure.ts` → `formatMandatoryDisclosure(...)`.
Verwendet in `BannerGenerator.tsx`, Landing-Page-Templates und allen Anzeigen-Exports.

## Pflichtformate (exakt einzuhalten)

**PHEV (gewichtet kombiniert + entladen):**
```
Neuwagen • 535 kW (727 PS) • Hybrid (Benzin/Elektro) 17,2 kWh/100km + 4,9 l/100km (gew. komb.), 10,4 l/100km (entladen, komb.) • 111 g CO₂/km (gew. komb.) • CO₂-Klasse C (gew. komb.), G (entladen, komb.)
```

**Verbrenner (Benzin/Diesel):**
```
Neuwagen • 195 kW (265 PS) • Benzin 7,8 l/100km (komb.) • 178 g CO₂/km (komb.) • CO₂-Klasse G (komb.)
```

**Elektro (BEV):**
```
Neuwagen • 165 kW (224 PS) • Elektro 13,6 kWh/100km (komb.) • 0 g CO₂/km (komb.) • CO₂-Klasse A (komb.)
```

## Harte Regeln

- **CO₂-Klasse seit WLTP: nur A–G.** `+`-Zeichen werden bei Eingabe via Helper gestrippt — kein `A+`, `A++`, `A+++` (Pre-WLTP).
- **DAT-Filter:** Werte mit Schlüsselwörtern `dat-`, `dat group`, `dat-bewertung`, `dat-marktwert`, `dat-code`, `schwacke` werden via `isDatOnlyValue`/`stripDatValues` aus Pflichtangaben entfernt — gehören nicht aufs Banner.
- **Trennzeichen:** ` • ` (Space-Bullet-Space) zwischen Pflicht-Blöcken, ` | ` zwischen Pflicht- und Finanzteil.
- **Einheiten:** `l/100km`, `kWh/100km`, `g CO₂/km` (mit Tiefgestelltem ₂), `kW (PS)` immer als Paar.
- **Status:** `Neuwagen` / `Gebrauchtwagen` / `Jahreswagen` IMMER zuerst.

## Finanzierungs-/Leasing-Pflichtangaben (§ 17 PAngV)

Bei Leasing/Finanzierung zusätzlich verkettet mit ` | `:
Rate, Laufzeit, Fahrleistung, Anzahlung, Sonderzahlung, Schlussrate, Effektivzins, Sollzins, Gesamtbetrag, **Bank** (Pflicht — siehe `useDealerBanks`).

## Workflow bei Änderungen

1. **Nie** Pflichtangaben-Strings inline in Komponenten zusammenbauen — immer `formatMandatoryDisclosure()` rufen.
2. CO₂-Klassen-Selector (`CO2LabelSelector.tsx`) ist Single Source of Truth für A–G + PHEV-Doppelklasse.
3. Bei neuen Antriebsarten: Template in `mandatory-disclosure.ts` ergänzen, NICHT inline branchen.
4. Nach Änderungen: BannerGenerator-Preview + Landing-Page-Footer prüfen.
