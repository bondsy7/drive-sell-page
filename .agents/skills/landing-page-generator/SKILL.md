---
name: landing-page-generator
description: Fahrzeug-Landing-Pages aus PDF/Daten generieren — Dual-Prompt-Strategie (JSON Content + Bilder), Edit-Mode-Persistenz, Händler-Profil-Fallbacks, Split-Screen-Layouts und Export-Pipeline. Triggert bei Landing-Page-Bearbeitung, manuellem LP-Generator, LP-Editor-Bugs oder Section-/Hero-/Footer-Anpassungen.
---

# Landing Page Generator

## Dual-Prompt-Strategie (`generate-landing-page`)

1. **Pass 1 — Content-JSON:** Strukturierte SEO-Meta, H1, Hero, Sections (typed: `steps`, `faq`, `cta`, `specs`, `comparison`, `benefits`, `gallery`, generic).
2. **Pass 2 — Bilder:** Pro Section mit `imagePrompt` ein passendes Bild via aktuellem Model-Tier.

Builder: `src/lib/landing-page-builder.ts` → `buildLandingPageHTML(...)`.

## Edit-Mode-Persistenz (KRITISCH)

Jede manuelle Änderung im Bearbeitungsmodus MUSS sofort in den State und in die exportierte HTML zurückfließen — sonst wird beim Wechsel in den Ansichtsmodus / Export der alte Wert reaktiviert.

Pattern in `LandingPageEditor.tsx`:
- `onChange` → updated `content`/`dealer`-State im Parent (`Index.tsx`)
- Preview-Iframe und Export nutzen denselben State, nicht das Original-JSON aus DB
- Vor Export: DB-Update mit aktuellem State (`landing_pages.content` + `dealer_snapshot`)

## Dealer-Snapshot

Beim Generieren wird `dealer_snapshot` als JSON in `landing_pages` gespeichert (Name, Adresse, Telefon, Logo, Primär-/Sekundärfarbe, Socials, Legal). Profil-Updates ändern bestehende LPs NICHT — das ist gewollt (historische Korrektheit).

Editor schreibt zurück in `dealer_snapshot`, nicht ins globale Profil.

## Layout: Split-Screen mit Gradient

`renderContentWithImage`: 50/50 Bild-Hintergrund + Gradient-Overlay nach links/rechts (alternierend nach Section-Index). Mobile: Vertikaler Gradient bottom-to-top mit weichem Übergang.

## Farbsystem

```ts
PRIMARY = dealer.primaryColor   // CTA-Buttons, Links
SECONDARY = dealer.secondaryColor // Dark/Accent Sections, Hero-Gradient
```

Fallbacks: `#3b82f6` / `#1e3a5f`. Validation: `/^#[0-9a-fA-F]{6}$/`.

## Hero-Bild-Scale

- Standard Hero: `cover` (volle Fläche)
- Vehicle in Split-Screen: 30% (kompakt) bzw. 40–50% (prominent) — NIE >50%, sonst bricht der Gradient-Übergang.

## Kontaktformular-Injection

`buildContactFormHTML({dealerUserId, projectId, vehicleId, supabaseUrl, vehicleTitle, currentCategory})` aus `templates/shared`. Submitted an `submit-lead` Edge Function → triggert `auto-process-lead` (service-role-gated).

## Pflichtangaben im Footer

Immer via `formatMandatoryDisclosure()` (siehe `automotive-pflichtangaben` Skill). Nie inline.

## Logo-Header

Header rendert Marken-Logo (aus `manufacturer-logos` Bucket via `getLogoForMake`) + Händler-Logo nebeneinander. Nur das aktuellste Marken-Logo verwenden.

## Helpful-Content LP-Variante (v6)

Manueller Generator (`ManualLandingGenerator.tsx`) mit Layout-Picker und SEO-Constraints. Eigene Prompt-Architektur — siehe `manual-landing-page-advanced-options` Memory.
