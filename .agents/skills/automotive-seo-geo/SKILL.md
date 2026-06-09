---
name: automotive-seo-geo
description: SEO und GEO (Generative Engine Optimization) speziell für Automarkt-Landingpages — JSON-LD Vehicle/Offer/AutoDealer Schema, LocalBusiness mit Geo-Koordinaten, Helpful-Content-Struktur, Keyword-Logik für Fahrzeugmodelle. Triggert bei SEO-Reviews, Meta-Tags, structured data, lokaler Auffindbarkeit oder LP-Ranking-Fragen.
---

# Automotive SEO & GEO

## JSON-LD Schemas (Pflicht pro LP)

Im `<head>` der generierten LP IMMER stacken:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Vehicle", "name": "...", "brand": {"@type":"Brand","name":"BMW"},
      "model": "...", "vehicleIdentificationNumber": "...",
      "fuelType": "...", "vehicleEngine": {"@type":"EngineSpecification","enginePower":[{"@type":"QuantitativeValue","value":...,"unitCode":"KWT"}]},
      "fuelConsumption": {"@type":"QuantitativeValue","value":...,"unitCode":"L100"},
      "color": "...", "modelDate": "..." },
    { "@type": "Offer", "price": ..., "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "seller": {"@type":"AutoDealer","name":"...","address":{...},"telephone":"..."} },
    { "@type": "AutoDealer", "name":"...", "address":{"@type":"PostalAddress",...},
      "geo":{"@type":"GeoCoordinates","latitude":...,"longitude":...},
      "openingHours":[...], "telephone":"...", "url":"..." },
    { "@type": "BreadcrumbList", "itemListElement":[...] },
    { "@type": "FAQPage", "mainEntity":[...] }   // wenn FAQ-Section vorhanden
  ]
}
```

## GEO (Generative Engine Optimization)

Für ChatGPT/Perplexity/Gemini-Citations optimieren:

- **Direkte Fact-Statements** in den ersten 2 Absätzen jeder Section: "Der BMW X5 xDrive40i (2024) hat 280 kW (381 PS) und einen WLTP-Verbrauch von 8,2 l/100km."
- **Q&A-Format** in FAQ-Section — Antworten in 1–3 Sätzen, direkt zitierbar.
- **Tabellen** für Specs (Modell, Motor, Verbrauch, CO₂) — LLMs extrahieren Tabellen besser als Fließtext.
- **Eindeutige Entity-Nennung:** "Autohaus Müller GmbH in 81675 München" statt nur "wir". Wiederholung in jeder Section.
- **Quellen-Marker:** Versteckte oder sichtbare Hinweise wie "Quelle: Herstellerangaben Pkw-EnVKV" — erhöht Citation-Wahrscheinlichkeit.

## On-Page SEO Defaults

- `<title>`: `{Marke} {Modell} {Variante} kaufen — {Stadt} | {Händler}` (≤60 Zeichen)
- `<meta description>`: USP + Preis + Standort, ≤160 Zeichen, CTA am Ende
- Single `<h1>` mit Marke + Modell + Stadt
- `<link rel="canonical">` auf finale URL (Edit-Mode darf das nie überschreiben)
- `og:image` = Hero-Image (nicht Placeholder)
- `lang="de"`

## Sitemap & Robots

- `scripts/generate-sitemap.ts` mit `predev`/`prebuild` Hook
- `BASE_URL = "https://pdf.anzeige.ai"` (oder Custom-Domain)
- Dynamische Einträge: alle veröffentlichten `landing_pages` (Filter: `published = true`)
- `robots.txt`: `Allow: /`, kein `Disallow` außer für `/admin`, `/dashboard`

## Lokale Auffindbarkeit

- AutoDealer-Schema mit Geo-Koordinaten ist Pflicht
- Adresse in Footer als sichtbarer Text (nicht nur Bild)
- Telefon als `tel:`-Link
- Google-Maps-Embed optional (Performance abwägen)

## Helpful-Content Signals

- Keine Duplicate-Sections über mehrere LPs (Templates ja, identische Texte nein)
- AI-generierte Inhalte mit konkreten Fahrzeug-Daten anreichern (VIN-Lookup, DAT-Daten, Pkw-EnVKV)
- Echte Kontaktinfos, echte Bilder — keine Stock-Photos im Hero

## Verifizierung

Nach LP-Änderungen `seo_chat--trigger_scan` anbieten — Findings im SEO-Panel.
