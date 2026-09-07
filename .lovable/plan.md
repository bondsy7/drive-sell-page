# Referenz-Upload: Fehler "Failed to send a request to the Edge Function"

## Was die Meldung bedeutet

Die Meldung stammt nicht aus unserer Prüf-Logik, sondern vom Netzwerk-Aufruf selbst:
Die Anfrage an die KI-Analyse konnte **gar nicht beantwortet werden** — die Verbindung
kam nicht zustande bzw. wurde vorher abgebrochen. Deshalb steht bei allen sechs Bildern
derselbe Text und keine inhaltliche Begründung (anders als bei früheren Fehlern wie
"Semantik-Firewall" oder "nicht-2xx", die echte Antworten waren).

Geprüft wurde bereits (heute, direkt gegen die Funktion):
- Die Analyse-Funktion ist erreichbar, die Berechtigungs-Vorabprüfung (CORS) antwortet korrekt.
- Ohne Anmeldung antwortet sie sauber mit "nicht angemeldet".
- Es liegen aktuell **keine Protokolleinträge** der Analyse-Funktion vor, d. h. die Aufrufe
  aus dem Browser sind dort offenbar nie angekommen oder wurden vorher abgebrochen.

Die drei realistischen Ursachen:
1. **Abbruch durch Zeitüberschreitung** — jedes Bild wird einzeln analysiert, ohne Zeitlimit
   und ohne Wiederholung. Dauert eine Analyse zu lange, bricht der Browser ab.
2. **Abgelaufene Anmeldung** — das Zugangs-Token wird einmal geholt; läuft es während eines
   längeren Stapels ab, scheitern die Folgeanfragen.
3. **Verbindungsabbruch bei mehreren Bildern nacheinander** (Netz/Proxy), ohne dass ein
   Wiederholungsversuch stattfindet.

## Was ich ändern will

1. **Zeitlimit + Wiederholung**: Jede Bildanalyse bekommt ein klares Zeitlimit und bis zu
   zwei automatische Wiederholungen mit Wartezeit. Nur wenn alle scheitern, gilt das Bild
   als abgewiesen.
2. **Anmeldung pro Anfrage frisch holen**: Das Token wird unmittelbar vor jedem Aufruf neu
   gelesen statt einmal für den ganzen Stapel.
3. **Verständliche Fehlertexte**: Statt "Failed to send a request to the Edge Function"
   erscheint z. B. "Analyse hat zu lange gedauert — erneut versuchen" oder
   "Sitzung abgelaufen — bitte neu anmelden".
4. **"Erneut versuchen"-Knopf pro abgewiesenem Bild**, damit man nicht alles neu hochladen muss.
5. **Server-Seite absichern**: In der Analyse-Funktion ein Zeitlimit für den KI-Aufruf und
   eine Protokollzeile pro Anfrage, damit künftige Fehler nachvollziehbar sind.

## Technische Details

- `src/features/reference-v2/phase1-5/analysis-coordinator.ts`: Retry-/Timeout-Wrapper um den
  Analyse-Aufruf, Fehlerklassifizierung (Netz/Timeout/Auth/Validierung) statt Rohtext.
- `src/features/reference-v2/phase1-5/provider-adapter.ts`: `authHeaders()` je Aufruf,
  `AbortController` für Upload und `functions.invoke`, Mapping auf sprechende Fehlercodes.
- `src/features/reference-v2/phase1-5/AutomaticReferenceIntake.tsx`: Retry-Aktion je Karte,
  neue Fehlertexte.
- `supabase/functions/reference-v2-analyze-image/index.ts`: `AbortSignal.timeout` für den
  Gemini-Aufruf, strukturiertes Logging (`[reference-v2-analyze] correlationId=… ms=…`),
  Neu-Deploy.
- Keine Änderungen an Firewall-/Validierungsregeln, Perspektivlogik oder Legacy-Remastering.

## Danach

Ich teste mit denselben Bildtypen erneut und melde, ob die Analyse durchläuft oder nun eine
inhaltlich verständliche Ablehnung liefert.
