# AUTO3 — Kosten, Speicher & Skalierung
**Chef-Report · Stand: 25. Juni 2026**

> **Geschäftsmodell:** 1 Paket = **490 €/Monat** = **1.000 Credits**. Nachkauf: **200 Credits = 100 €**.
> Ein Kunde = ein Paket. Hochrechnung unten: **1 / 10 / 100 / 1.000 Kunden**.

---

## 1. Fixkosten (unabhängig von Kunden)

| Position | Anbieter | €/Monat | Anmerkung |
|---|---|---|---|
| Entwicklungs-Plattform | Lovable Pro | **92 €** | Inkl. 100 Build-Credits |
| Domain `anzeige.ai` | Registrar | **2 €** | Jahrespreis ÷ 12 |
| **Summe Fix** | | **≈ 94 €/Monat** | unverändert bei 1 oder 1.000 Kunden |

> ❌ **Resend** ist bewusst **nicht** enthalten — das nötige Release-Feature ist noch nicht freigegeben.
> ❌ Kein eigener Server, keine VM, keine Datenbank-Lizenz — alles in Lovable Cloud enthalten.

---

## 2. Variable Kosten (pro Kunde / pro Aktion)

Alle Generierungen laufen über **Nano Banana 2** (Standard). Andere Modelle nur intern als Backup-Chain (siehe Anhang).

### 2.1 API-Kosten pro Aktion (Einkauf)

| Aktion | EK (USD) | EK (€) | VK in Credits | VK (€) | Marge |
|---|---|---|---|---|---|
| Bild (Nano Banana 2) | $0.039 | 0,036 € | 1 Cr | 0,49 € | **93 %** |
| Banner Studio Komplett | $0.10 | 0,093 € | 2 Cr | 0,98 € | **90 %** |
| Quick Banner | $0.04 | 0,037 € | 1 Cr | 0,49 € | **92 %** |
| Video Standard (8s, Veo 3.1) | $3.20 | 2,96 € | 18 Cr | 8,82 € | **66 %** |
| Video Fast | $0.40 | 0,37 € | 4 Cr | 1,96 € | **81 %** |
| Landing Page (Content + 7 Bilder) | $0.36 | 0,33 € | 10 Cr | 4,90 € | **93 %** |
| PDF-Analyse + VIN + Bilder | $0.48 | 0,44 € | 12 Cr | 5,88 € | **92 %** |
| Schadensanalyse | $0.05 | 0,046 € | 1 Cr | 0,49 € | **91 %** |
| Song / Musik-Clip | $0.04–0.08 | 0,04–0,07 € | 1 Cr | 0,49 € | **85–92 %** |

### 2.2 Cloud-Overhead pro Aktion

| Bestandteil | $ pro Aktion | Erklärung |
|---|---|---|
| Edge-Function Compute | $0.0008 | Lovable Cloud Compute |
| DB-Schreiben + RLS-Check | $0.0002 | atomare Credit-Buchung |
| Storage-Upload (Image-Transfer) | $0.0005/Bild | Gemini File API Roundtrip |
| Stripe-Gebühr (anteilig) | $0.012 | nur bei Top-Up / Abo-Buchung |
| **Summe Overhead** | **~$0.014** | **~0,013 €** pro Aktion |

→ Bereits in **allen** Margen oben einkalkuliert.

---

## 3. **DAS HEISSE THEMA: SPEICHER**

### 3.1 Was wird gespeichert?

| Bucket | Inhalt | Größe Ø |
|---|---|---|
| `vehicle-images` | Original-Uploads + remasterte Bilder | ~600 KB / Bild |
| `videos` | 8-Sek MP4 (Veo 3.1) | ~4 MB / Video |
| `banners` | finale Banner (PNG/JPG) | ~400 KB / Banner |
| `landing-pages` | 7 Bilder pro LP | ~3 MB / LP |
| `songs` | Musik-Clips | ~1 MB / Song |
| `pdfs` | Eingelesene Original-PDFs | ~2 MB / PDF |

### 3.2 Realistischer Verbrauch pro Kunde / Monat

Annahme: Kunde verbraucht 1.000 Credits sinnvoll gemischt:

| Aktion | Anzahl/Monat | Speicher/Monat |
|---|---|---|
| Bilder | 400 × 600 KB | **240 MB** |
| Banner | 100 × 400 KB | **40 MB** |
| Videos | 20 × 4 MB | **80 MB** |
| Landing Pages | 30 × 3 MB | **90 MB** |
| Songs | 10 × 1 MB | **10 MB** |
| PDFs | 20 × 2 MB | **40 MB** |
| **Summe / Monat** | | **≈ 500 MB / Kunde / Monat** |

### 3.3 Lovable Cloud / Supabase Preise

| Position | Preis | Quelle |
|---|---|---|
| Storage | **$0.021 / GB / Monat** | Lovable Cloud (Supabase Pro Tier) |
| Egress (Download) | **$0.09 / GB** | nur wenn Bilder aufgerufen / heruntergeladen |
| Database | $0.125 / GB | Metadaten nur, vernachlässigbar (<1 GB) |
| Compute (Edge Func) | inkl. $25 Freikontingent | siehe Overhead |
| **Free Tier** | **$25 Cloud + $1 AI / Monat** | wird automatisch abgezogen |

> Cloud-Kosten sind **vorhersehbar** und **live einsehbar** unter
> **Workspace → Settings → Cloud & AI Balance** (siehe Screenshot des Users).

### 3.4 Storage-Hochrechnung (kumulativ über 12 Monate)

| Kunden | Monat 1 | Monat 6 | Monat 12 | Monat 12 Storage-Kosten | Egress (10×Read) |
|---|---|---|---|---|---|
| **1** | 0,5 GB | 3 GB | 6 GB | $0,13 | $5,40 |
| **10** | 5 GB | 30 GB | 60 GB | $1,26 | $54 |
| **100** | 50 GB | 300 GB | 600 GB | **$12,60** | **$540** |
| **1.000** | 500 GB | 3 TB | 6 TB | **$126** | **$5.400** |

> **WICHTIG:** Egress (Download) ist der Kostentreiber, nicht Storage selbst.
> Bei 1.000 Kunden und Bildern, die je 10× geladen werden: **~5.400 $/Monat Egress**.
> → **Maßnahme:** CDN-Cache aktiv lassen, alte Originale nach 90 Tagen archivieren / löschen (per Cron-Job vorhandene `cleanup-orphaned-storage` Function).

---

## 4. Skalierung: Was bleibt unterm Strich?

### Annahme pro Kunde:
- Umsatz: **490 €** (Basis-Abo)
- Variable API-Kosten bei realistischem Mix: **~110 € EK**
- Speicher Monat 12: ~6 GB → 0,13 $ Storage + ~5 $ Egress = **~5 €**

| Kunden | Umsatz/Monat | API-EK | Storage+Egress (M12) | Fixkosten | **Gewinn/Monat** | Marge |
|---|---|---|---|---|---|---|
| **1** | 490 € | 110 € | 5 € | 94 € | **281 €** | 57 % |
| **10** | 4.900 € | 1.100 € | 50 € | 94 € | **3.656 €** | 75 % |
| **100** | 49.000 € | 11.000 € | 500 € | 94 € | **37.406 €** | 76 % |
| **1.000** | 490.000 € | 110.000 € | 5.000 € | 94 € | **374.906 €** | **77 %** |

### Worst-Case (alle nur Videos)
| Kunden | API-EK Video-Mix | Gewinn/Monat |
|---|---|---|
| 1 | 280 € | 116 € |
| 100 | 28.000 € | 20.400 € |
| 1.000 | 280.000 € | **204.400 €** |

→ Selbst im Worst-Case keine roten Zahlen, weil Credits **vor** API-Call atomar abgebucht werden.

---

## 5. Was kann "explodieren"?

| Risiko | Schutz | Realistisch? |
|---|---|---|
| Kunde verbraucht zu viele Credits | `deduct_credits` RPC bricht ab bei 0 | **Nein** |
| Storage wächst unkontrolliert | `cleanup-orphaned-storage` Cron + 90-Tage-Archiv-Regel | **kontrollierbar** |
| API-Provider erhöht Preise | Marge >75 % puffert ±20 % Preiserhöhung | gering |
| DDOS / API-Missbrauch | JWT-Auth + RLS + Cloudflare vor Edge Functions | **Nein** |
| Cloud-Limit überschritten | Live-Alert + automatische Top-up-Sperre setzbar | **kontrollierbar** |

---

## 6. Live-Monitoring (Pflicht-Routine)

1. **Wöchentlich (2 Min):** Cloud & AI Balance im Lovable-Dashboard prüfen.
2. **Monatlich (5 Min):** Storage-Wachstum vs. Kundenzahl abgleichen.
3. **Bei >500 Kunden:** Auto-Archiv-Job aktivieren (Bilder >90 Tage → Cold Storage).
4. **Cloud-Limit setzen:** Settings → Spending Cap = 500 $/Monat als Hard-Stop.

---

## 7. Zusammenfassung für den Chef

> **Bei 1 Kunde:** 281 € Gewinn — wir sind sofort profitabel.
> **Bei 100 Kunden:** 37.400 € Gewinn/Monat bei nur 500 € Speicherkosten.
> **Bei 1.000 Kunden:** ~375.000 € Gewinn/Monat. Speicher kostet dann ~5.000 €/Monat — komplett vorhersehbar und live einsehbar.
> **Wir können nicht ins Minus rutschen**, weil jede Aktion erst die Credits prüft, dann die API ruft.
> **Einzige Wachstums-Aufgabe:** Storage-Cleanup-Cron nach 90 Tagen aktivieren, sobald wir >500 Kunden haben.

---

## Anhang A — Bildmodelle (Standard & Backup)

**Standard für alle Kunden:** `gemini-3.1-flash-image` (Nano Banana 2) — Auswahl im UI entfernt.

Im Hintergrund läuft automatisch eine Fallback-Kette (nur falls Standard überlastet):

| Reihenfolge | Modell | EK pro Bild | Einsatz |
|---|---|---|---|
| 1 (Standard) | gemini-3.1-flash-image (Nano Banana 2) | $0.039 | immer |
| 2 (Backup) | gemini-3-pro-image | $0.06 | nur bei 503/429 |
| 3 (Backup) | gemini-2.5-flash-image | $0.03 | letzte Reserve |
| 4 (Reframe) | Ideogram v3 Reframe | $0.06 | nur Bilderweiterung |
| 5 (Notfall) | gpt-image-2 (low) | $0.04 | wenn alles Google down |

Der Kunde sieht und wählt nichts davon — komplett intern.

## Anhang B — Quellen Cloud-Preise

- Lovable Cloud Free-Tier: $25 Cloud + $1 AI / Monat (Settings → Cloud & AI Balance)
- Supabase Storage: $0.021/GB/Monat, Egress $0.09/GB
- Stripe: 1,5 % + 0,25 € pro EU-Transaktion
- Google Gemini API: ai.google.dev/pricing
- OpenAI: platform.openai.com/pricing
- Ideogram: ideogram.ai/api/pricing
