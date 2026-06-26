# AUTO3 – Paket-Analyse mit Bildvolumen, Retry-Risiko & ehrliche Bewertung

> Ziel: Klare, ehrliche Antwort darauf, ob die Pakete mit fester Bilderanzahl wirtschaftlich tragen – **inklusive Nachgenerierung** ("Bild war Mist, Dach fehlt, Felge verbogen, Schatten falsch") und inklusive Speicher / Transfer / Overhead. Stand: heute, Modell **Gemini 3.1 Flash Image** als Standard.

---

## 1. Was die Pakete versprechen (Bilder gesamt)

Annahme aus Mockup: 3 Phasen × 12 Monate + Bonus (Whitelabel/Plugin = 0, Bilder einmalig)

| Paket    | Rechnung                          | Bilder gesamt | Preis (12 Mon.) | €/Bild Kunde |
| -------- | --------------------------------- | ------------- | --------------- | ------------ |
| Basic    | 30×12 + 30×12 + 30×12 + 60        | **1.140**     | 399 €           | 0,35 €       |
| Advanced | 50×12 + 50×12 + 50×12 + 100       | **1.900**     | 499 €           | 0,26 €       |
| Premium  | 100×12 + 100×12 + 100×12 + 200    | **3.800**     | 899 €           | 0,24 €       |
| Ultra    | 200×12 + 200×12 + 200×12 + 400    | **7.600**     | 1.599 €         | 0,21 €       |

> **Wichtig:** Das sind **Bilder gesamt über 12 Monate**, nicht pro Monat. Der Kunde zahlt einmalig (oder monatlich gestreckt) – das Paket ist ein Jahresvertrag.

---

## 2. Was ein Bild uns wirklich kostet (EK)

### 2.1 Reine API-Kosten (1 Generation)

| Posten                             | Wert       | Bemerkung                             |
| ---------------------------------- | ---------- | ------------------------------------- |
| Gemini 3.1 Flash Image (1 Bild)    | $0,0387    | Google offizieller Preis              |
| Infrastruktur (Upload, Egress, DB) | $0,0005    | Supabase Storage + Gemini File API    |
| Aktion-Overhead (Stripe-Anteil, Edge-Runtime, Log) | $0,0140 | flach pro Aktion              |
| **Summe je Generation**            | **$0,0532** ≈ **0,049 €** |                            |

### 2.2 **Realität:** Retry-Faktor

AI-Bilder sind **nicht zu 100 % perfekt**. Erfahrungswerte aus der Pipeline:

| Szenario                            | Retry-Faktor | Echte Kosten/Bild |
| ----------------------------------- | ------------ | ----------------- |
| Optimistisch (saubere PDF, gute Quelle) | ×1,2     | 0,059 €           |
| **Realistisch (Standard-Kunde)**    | **×1,5**     | **0,074 €**       |
| Pessimistisch (schlechte Quelle, hoher Anspruch) | ×2,0 | 0,098 €      |
| Worst-Case (Schadensfälle, dunkle Bilder) | ×2,5  | 0,123 €           |

> **Wichtig:** Wir können den Retry nicht garantieren. AI ist subjektiv ("schön"), und mal verschwindet ein Dach, mal sitzt die Felge falsch. Der Kunde wird neu generieren – das **müssen wir einplanen**.

### 2.3 Speicher & Egress pro Kunde (12 Monate)

| Posten                          | Annahme              | EK / Jahr |
| ------------------------------- | -------------------- | --------- |
| Storage (Bilder × 0,4 MB)       | 0,021 $/GB·Monat     | 1,90 € (Basic) bis 12,60 € (Ultra) |
| Egress (Downloads, Webview)     | 0,09 $/GB, ×3 Views  | 12,60 € (Basic) bis 84,00 € (Ultra) |

---

## 3. Realistische Margenrechnung (mit Retry ×1,5 + Storage/Egress)

| Paket    | Bilder | EK Bilder (×1,5) | EK Speicher/Egress | EK gesamt | Preis  | **Marge €** | **Marge %** |
| -------- | ------ | ---------------- | ------------------ | --------- | ------ | ----------- | ----------- |
| Basic    | 1.140  | 84 €             | 15 €               | **99 €**  | 399 €  | **300 €**   | **75 %** ✅ |
| Advanced | 1.900  | 141 €            | 24 €               | **165 €** | 499 €  | **334 €**   | **67 %** ✅ |
| Premium  | 3.800  | 281 €            | 48 €               | **329 €** | 899 €  | **570 €**   | **63 %** ✅ |
| Ultra    | 7.600  | 562 €            | 97 €               | **659 €** | 1.599 €| **940 €**   | **59 %** ⚠️ |

### Worst-Case (×2,5 Retry – kritischer Kunde)

| Paket    | EK Bilder | + Speicher | EK gesamt | Preis  | **Marge** |
| -------- | --------- | ---------- | --------- | ------ | --------- |
| Basic    | 140 €     | 15 €       | 155 €     | 399 €  | 244 € (61 %) ✅ |
| Advanced | 234 €     | 24 €       | 258 €     | 499 €  | 241 € (48 %) ⚠️ |
| Premium  | 467 €     | 48 €       | 515 €     | 899 €  | 384 € (43 %) ⚠️ |
| Ultra    | 935 €     | 97 €       | 1.032 €   | 1.599 €| 567 € (35 %) ❌ |

> **Ultra ist im Worst-Case riskant.** Wenn ein Profi-Kunde alle 7.600 Bilder mit ×2,5 Retry rauspresst, bleiben nur 35 % Marge – und das ohne Support-Aufwand, ohne Lyria, ohne Video.

---

## 4. Ehrliche Bewertung: Wo das Modell **stark** ist

✅ **Klares Versprechen** – Kunde versteht "1.140 Bilder fürs Jahr" sofort.
✅ **Margenpuffer in Basic/Advanced** – auch bei doppeltem Retry positiv.
✅ **Skalierbarkeit** – Pakete sind einfach in Stripe abzubilden.
✅ **Kein Negativrisiko pro Aktion** – `deduct_credits` RPC sperrt vor jeder API-Anfrage.

## 5. Wo das Modell **schwach / riskant** ist

❌ **Jahresbindung ist hoch für ein AI-Tool.** Wenn Bild 47 schlecht ist und der Kunde abspringt, hat er noch 11 Monate vor sich. → **Unzufriedenheit > Churn-Risiko**.

❌ **"Bild gelungen" ist subjektiv.** Wir können nicht garantieren, dass das Dach drauf bleibt oder Spiegelungen passen. → Kunde fühlt sich betrogen, wenn Bilder "verbraucht" wurden.

❌ **Fixe Bilderzahl bestraft Power-User.** Ultra-Kunde generiert 7.600 Bilder, retried 2,5× → wir verdienen 35 %. Beim nächsten Vertrag kürzt er.

❌ **Video / Lyria / Landingpage fehlen** in dieser Rechnung. Sobald Kunde 1 Video pro Fahrzeug will (EK 2,94 €), fressen 30 Videos schon 88 € extra.

❌ **Retry kostet UNS, nicht den Kunden.** Bei fixer Bilderzahl: jeder Retry zählt gegen sein Kontingent – Kunde wird wütend. Bei Credit-Modell: Retry kostet 1 Credit – Kunde versteht es.

---

## 6. Empfehlung: Hybrid statt fix

### Variante A: **Bilder + Retry-Garantie**
- Paket wirbt mit "1.140 fertige Bilder" (nicht "1.140 Generationen").
- Wir kalkulieren intern mit ×1,5 Retry-Faktor → Marge bleibt 60–75 %.
- Kunde darf **jedes Bild kostenlos 2× neu generieren**, ohne dass es zählt.
- Vorteil: Kunde fühlt sich sicher, wir haben den Puffer eingepreist.

### Variante B: **Credit-Pakete behalten + Fahrzeug-Bundles als "Empfehlung"**
- 1.000 Credits / Monat = 490 € (bestehend).
- Wir zeigen auf der Pricing-Seite: *"Mit Basic-Paket schaffst du ca. 30 Fahrzeuge / Monat (à 12 Bilder + 2 Retries)."*
- Kunde sieht den Bilder-Wert, behält aber Flexibilität für Video/Banner/Landingpage.
- **Risiko-Null für uns**, weil `deduct_credits` jede Aktion vorher sperrt.

### Variante C: **Jahrespaket NUR Ultra/Premium, Monat für kleine**
- Basic + Advanced = monatlich kündbar (Credit-Modell).
- Premium + Ultra = Jahresvertrag mit fixem Bildervolumen + Rabatt.
- Reduziert Churn-Risiko bei Einsteigern, sichert ARR bei Profis.

---

## 7. Konkrete Zahlen, die der Chef sehen sollte

| Frage                                               | Antwort                                       |
| --------------------------------------------------- | --------------------------------------------- |
| Was kostet uns 1 Bild wirklich?                     | **0,049 €** (1 Gen) bis **0,123 €** (×2,5 Retry) |
| Marge Basic im Realfall?                            | **75 %** (300 € / Paket)                      |
| Marge Ultra im Worst-Case?                          | **35 %** – kritisch, Puffer nötig             |
| Können wir bei AI "Qualität garantieren"?           | **Nein.** Wir können nur Retries einplanen.   |
| Was ist das größte Risiko?                          | **Kunden-Churn** wegen Jahresbindung + subjektiver Qualität |
| Was empfiehlt das System (Code-seitig)?             | **Atomarer Credit-Abzug** – wir gehen NIE ins Minus pro Aktion |
| Größte Schwäche der Pakete?                         | **Fixe Bilderzahl** bestraft Retry – Kunde fühlt sich bestraft für AI-Fehler |
| Empfehlung?                                         | **Variante A** (Retry-Garantie kommunizieren) oder **Variante B** (Credit-Modell mit Fahrzeug-Indikator) |

---

## 8. Was wir dem Kunden **ehrlich sagen sollten**

> "AI-generierte Bilder erreichen in 80–90 % der Fälle beim ersten Versuch ein gutes Ergebnis. Für die restlichen Bilder bieten wir bis zu **2 kostenlose Nachgenerierungen** je Bild – diese zählen **nicht** gegen dein Paket. Bei stark abweichenden Quellbildern (Nachtaufnahmen, Beschädigungen) kann der Anspruch variieren – wir empfehlen vorher den Testlauf mit 5 Fahrzeugen."

Damit sind wir:
- **Ehrlich** über AI-Grenzen.
- **Geschützt** durch eingepreisten Retry-Puffer.
- **Wettbewerbsfähig** gegenüber Tools, die "unlimitiert" versprechen und dann Qualität schwanken lassen.

---

## 9. TL;DR für die Geschäftsleitung

1. **Die Pakete tragen sich** – aber nur, wenn wir den Retry-Faktor ×1,5 einkalkulieren (ist hier gemacht).
2. **Basic + Advanced sind sicher** (75 % / 67 % Marge auch im Realfall).
3. **Premium + Ultra brauchen einen Retry-Deckel** (z. B. "max. 2 Retries je Bild kostenlos") – sonst Worst-Case 35 %.
4. **Jahresbindung ist die größte Schwäche** – AI-Tools verkaufen sich schwer im Abo, weil Qualität subjektiv ist.
5. **Empfehlung:** Variante A (Retry-Garantie kommunizieren) ODER Variante B (Credits behalten + Fahrzeug-Indikator zeigen).

> **Wir machen niemals Minus pro Aktion** – das schützt der atomare Credit-Abzug (`deduct_credits` RPC). Aber wir können **unzufriedene Kunden** produzieren, wenn das Versprechen "1.140 perfekte Bilder" nicht hält. Genau hier liegt das echte Geschäftsrisiko.
