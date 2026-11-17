# Plan: Vollständige, read-only Storage-Sicherung für Autohaus.ai

## Ziel und Umfang

Ein Administrator soll alle Dateien aus sämtlichen Lovable-Cloud-Storage-Buckets – einschließlich privater Buckets – mit Originalinhalt, Bucket, Ordnerpfad und Dateiname auf einen Windows-Rechner herunterladen können. Die Sicherung soll paketiert, fortsetzbar und anhand einer vollständigen Dateiliste prüfbar sein.

Dieser Plan verändert jetzt **keine** produktiven Funktionen, Tabellen, Policies oder Dateien. Die genannten rund 13.803 Dateien und 12,1 GB werden beim echten Scan neu gezählt, nicht als garantierte Bestandswerte übernommen.

Nicht Bestandteil dieses Exports sind Datenbank, Auth-Konten, Edge-Function-Code oder Secrets. Die regulären Datenbanksicherungen und der Datenbankexport enthalten keine Storage-Dateien.

## Aktueller Befund

Die vorhandene Admin-Storage-Übersicht ist kein geeigneter Exportmechanismus:

- Sie verwendet sechs fest eingetragene Bucket-Namen statt aller tatsächlich vorhandenen neun Buckets.
- Sie listet je Ordner höchstens 1.000 Einträge ohne Offset-Fortsetzung und zeigt später nur 200 Dateien.
- Sie erzeugt weder vollständige Manifeste noch Downloadpakete oder Prüfsummen.
- Private Buckets und abgelaufene Downloads sind nicht als automatisierter Übergabeprozess ausgelegt.

## Empfohlene Architektur

```text
Admin in Autohaus.ai
        |
        | Export-Sitzung starten, bestehende Adminrolle wird geprüft
        v
Neue isolierte Read-only-Exportfunktion
  - Buckets und Objekte auflisten
  - kurz gültige Signed URLs ausstellen
  - keine Dateiinhalte verarbeiten oder speichern
        |
        | nur Manifestdaten und zeitlich begrenzte URLs über HTTPS
        v
PowerShell auf Windows
  - paketweise direkte Downloads aus dem Storage
  - .part-Dateien, Wiederholungen und Fortsetzung
  - Größen- und SHA-256-Prüfung, Abschlussbericht
```

Die Edge Function lädt oder zippt die 12,1 GB **nicht**. Sie listet nur Metadaten und signiert einzelne Downloadanfragen. Dadurch laufen keine großen Dateien durch den Functions-Speicher, und der laufende Anwendungsbetrieb wird nicht durch einen langen Serverexport belastet.

## 1. Adminzugang und temporäre Export-Sitzung

- Einstieg ausschließlich im geschützten Adminbereich bei der Storage-Übersicht.
- Beim Start prüft die Funktion den angemeldeten Benutzer per `getClaims()` und die vorhandene serverseitige Adminrolle über `has_role()`; UI-Sichtbarkeit allein gilt nicht als Schutz.
- Die Funktion erzeugt eine begrenzte Export-Sitzung mit zufälligem Secret, Ablaufzeit und Widerrufmöglichkeit. Vorschlag: höchstens vier Stunden, bei Bedarf durch erneute Adminbestätigung verlängerbar.
- In einer neuen, isolierten Metadatentabelle werden nur Export-ID, Admin-ID, Secret-Hash, Ablauf und Widerrufstatus gespeichert – niemals das Klartext-Secret oder Storage-Inhalte. Direkter Clientzugriff bleibt per RLS gesperrt.
- Das Secret wird einmal angezeigt und im PowerShell-Skript sicher abgefragt. Es wird nicht im Skript, in der Manifestdatei, auf der Kommandozeile oder in Logs gespeichert.
- Jeder Manifest-/Signieraufruf prüft Sitzung, Ablauf, Widerruf und erneut die Adminrolle. NichtAdministratoren erhalten keinen Zugriff.
- Service-Role- oder andere private API-Schlüssel verlassen die serverseitige Funktion nie. Das Windows-Skript enthält keine solchen Schlüssel.
- Die einzigen Schreibvorgänge betreffen diese Export-Sitzungsmetadaten. Auf Storage-Objekten gibt es ausschließlich Leseoperationen; keine Uploads, Moves, Updates oder Deletes und keine Änderung vorhandener Bucket-Policies.

## 2. Vollständiger Bucket- und Dateiscan

Die neue Funktion erhält klar validierte Aktionen für Sitzung starten, Scan fortsetzen, URLs signieren und Sitzung beenden.

Der Scan:

1. Ermittelt die Buckets dynamisch über die Admin-Storage-API und gleicht sie mit den erwarteten neun Buckets ab. Neue oder fehlende Buckets werden ausdrücklich gemeldet.
2. Durchläuft jeden Bucket rekursiv ohne feste Ordner tiefe oder feste Benutzer-/Fahrzeugpräfixe.
3. Verwendet stabile Sortierung und Seiten mit höchstens 1.000 Einträgen plus Offset, bis jeder Ordner vollständig gelesen ist.
4. Unterscheidet Dateien von Ordnern anhand der Storage-Metadaten und berücksichtigt auch leere Dateien sowie Dateien im Bucket-Stamm.
5. Speichert im Fortsetzungscursor Bucket, Ordner und Offset. Dadurch kann auch ein unterbrochener Scan fortgesetzt werden.
6. Liefert pro Datei mindestens Bucket, vollständigen Objektpfad, Objekt-ID, Größe, MIME-Typ, `updated_at` und – falls vorhanden – ETag. Ein ETag wird nicht pauschal als MD5 oder SHA-256 behandelt.

Die Ergebnisse werden nach `bucket + objektpfad` sortiert und dedupliziert. Die Funktion protokolliert keine Signed URLs, Sitzungs-Secrets oder privaten Schlüssel.

## 3. Manifest und Downloadpakete

Im Exportziel entsteht beispielsweise:

```text
D:\AutohausAI-Storage\2026-11-17_1015\
  <bucket>\<originaler-unterordner>\<originaler-dateiname>
  manifest\
    buckets.csv
    files.csv
    files.jsonl
    scan-state.json
    packages\package-0001.json ...
    download-state.jsonl
    verification-report.csv
    summary.json
```

- `files.csv` dient der einfachen Kontrolle in Excel; JSON Lines erlaubt speicherschonende automatische Verarbeitung.
- Das Manifest enthält **keine** Signed URLs und keine Zugangsdaten.
- Pakete werden deterministisch aus dem vollständigen Manifest gebildet, beispielsweise maximal 500 MB oder 250 Dateien pro Paket. Eine einzelne größere Datei bildet ein eigenes Paket.
- Pakete sind logische Downloadeinheiten; die Originaldateien werden unverändert und ohne Komprimierung oder Formatumwandlung gespeichert.
- Jedes Paket kann einzeln heruntergeladen, wiederholt und verifiziert werden. Der Gesamtablauf lässt sich nach jedem Paket sicher unterbrechen.

## 4. Zeitlich begrenzte Downloadlinks

- Kurz vor einem Paket fordert das Skript nur für dessen nächste kleine Dateigruppe Signed URLs an, beispielsweise 25 Dateien mit zehn Minuten Gültigkeit.
- Öffentliche und private Buckets verwenden einheitlich kurz gültige Signed URLs; öffentliche Dauerlinks landen nicht im Manifest.
- Die Dateien werden direkt vom Storage zum Windows-Rechner übertragen. URLs bleiben nur im Arbeitsspeicher und werden nicht in Console, Log oder Fehlerbericht ausgegeben.
- Bei Ablauf fordert das Skript für noch nicht begonnene oder unvollständige Dateien neue URLs an. Ist auch die Export-Sitzung abgelaufen, pausiert es mit einer klaren Anweisung zur erneuten Adminbestätigung.
- `401/403`, `404`, `409`, `429` und `5xx` werden getrennt behandelt. Fehlende Objekte oder Berechtigungsfehler werden niemals als erfolgreich übersprungen.

## 5. Fortsetzbares Windows-PowerShell-Skript

Geplant ist ein einzelnes Skript ohne Drittanbieterinstallation, kompatibel mit Windows PowerShell 5.1 und PowerShell 7.

Funktionen:

- Parameter für Exportziel, alle oder ausgewählte Pakete, Fortsetzen und reine Verifikation.
- Downloads zunächst in `<dateiname>.part`; erst nach vollständiger Übertragung und Größenprüfung erfolgt das lokale Umbenennen in den Originalnamen.
- Bereits vollständige Dateien werden anhand erwarteter Größe und gespeichertem lokalem SHA-256 übersprungen.
- HTTP-Range setzt eine `.part`-Datei fort, sofern der Server dies korrekt bestätigt. Andernfalls wird nur die betroffene Datei neu geladen, nicht das gesamte Paket.
- Netzwerkfehler sowie `429/5xx` erhalten begrenzte Wiederholungen mit exponentiellem Backoff und Zufallsverzögerung.
- Standardmäßig wenige beziehungsweise zunächst sequentielle Downloads; optional höchstens zwei parallele Übertragungen, um Speicher und Netzwerk nicht unnötig zu belasten.
- Nach jeder Datei wird der lokale Status atomar fortgeschrieben. Ein Neustart erkennt dadurch exakt die verbleibenden Dateien.
- Keine automatische Überschreibung fremder oder abweichender lokaler Dateien. Solche Konflikte werden gemeldet und benötigen eine ausdrückliche lokale Entscheidung.
- Nach Abschluss berechnet das Skript SHA-256 für jede lokale Datei und erzeugt einen Bericht pro Datei und Bucket.

Vor dem Download prüft das Skript Windows-Pfadlängen und unzulässige beziehungsweise reservierte Dateinamen. Windows kann bestimmte Storage-Namen nicht originalgetreu abbilden. Solche Ausnahmen werden vorab vollständig gemeldet; es gibt keine stille Umbenennung. Für tatsächlich vorkommende inkompatible Namen ist ein WSL-/Linux-Ziel oder eine ausdrücklich freizugebende reversible Namensabbildung samt Mapping erforderlich.

## 6. Vollständigkeits- und Aktualitätskontrolle

Der Abschlussbericht vergleicht je Bucket:

- erwartete und heruntergeladene Dateianzahl,
- erwartete und tatsächliche Bytes,
- fehlende, zusätzliche, geänderte und fehlgeschlagene Objekte,
- lokale Zielpfade und SHA-256-Werte,
- Paketstatus sowie Scan-Beginn und Scan-Ende.

Storage bietet hierbei keinen atomaren Gesamt-Snapshot über alle Buckets. Ohne Schreibstopp können sich Dateien während eines langen Exports verändern. Deshalb ist ein zweiter, rein lesender Abgleichscan vorgesehen:

- neue oder geänderte Objekte werden als Delta-Paket nachgeladen,
- zwischenzeitlich entfernte Objekte werden dokumentiert,
- geänderte Größen/Zeitstempel führen zu erneutem Download und Prüfung,
- der Schlussbericht bezeichnet ausdrücklich den abgedeckten Zeitraum und etwaige verbleibende Abweichungen.

Für eine strikt punktgenaue Übergabe wäre zusätzlich ein kurzes, separat vereinbartes Schreibfenster nötig. Für den Normalablauf ist das nicht erforderlich; der Export selbst sperrt nichts und unterbricht den Betrieb nicht.

## 7. Schutz des laufenden Betriebs

- Keine Änderungen an bestehenden Generator-, Dashboard-, Auth-, Pricing- oder Publishing-Funktionen.
- Keine Änderungen an vorhandenen Storage-Buckets, Objekten oder Policies.
- Kein serverseitiges Zippen, keine 12-GB-Antwort und keine langlaufende Function für die eigentlichen Dateiinhalte.
- Sequentielle Scan-Seiten, kleine Signier-Batches und standardmäßig geringe Downloadparallelität.
- Durchführung bevorzugt in einer ruhigen Nutzungsphase; der Export erzeugt dennoch den notwendigen Storage- ausgehenden Traffic von etwa 12,1 GB plus möglichem Delta.
- Der Admin kann eine Sitzung jederzeit widerrufen. Bereits ausgestellte URLs laufen nach wenigen Minuten von selbst ab.
- Der Windows-Zielordner sollte per NTFS-Berechtigungen geschützt und idealerweise auf einem BitLocker-geschützten Laufwerk liegen, da private Fahrzeug-, Kunden- und Dokumentdaten enthalten sein können.

## 8. Prüfung vor produktivem Vollexport

1. Funktionstests mit simuliertem Storage für rekursive Ordner, über 1.000 Einträge, leere Dateien, Unicode-Namen und mehrere Buckets.
2. Sicherheitstests: ohne Anmeldung, als normaler Benutzer, als Admin, mit abgelaufener und mit widerrufener Export-Sitzung.
3. Kleiner read-only Pilot mit je einer Datei aus einem öffentlichen und einem privaten Bucket; Originalbytes und lokale SHA-256 vergleichen.
4. Abbruch mitten in einer Datei und mitten in einem Paket; danach Fortsetzung ohne erneuten Download bereits geprüfter Dateien.
5. Test abgelaufener Signed URLs, `429/5xx`-Wiederholungen, fehlender Objekte und geänderter Dateigröße.
6. Vollständiger Manifestscan vor dem ersten großen Download; Bucket-, Datei- und Bytezahlen mit den erwarteten Größenordnungen vergleichen.
7. Paketweiser Vollexport, finaler Delta-Scan und anschließende reine Verifikation ohne erneuten Download.

## Abnahmekriterien

- Alle beim finalen Scan vorhandenen Buckets und Objekte sind entweder erfolgreich gesichert oder ausdrücklich als Fehler/Delta aufgeführt.
- Private und öffentliche Dateien sind im Originalformat vorhanden; keine Datei wurde serverseitig verändert.
- Bucket- und Unterordnerstruktur sowie Windows-kompatible Originaldateinamen sind erhalten.
- Jede Datei besitzt Manifestgröße, Status, Zielpfad und lokale SHA-256; Summen stimmen je Bucket überein.
- Unterbrechungen und abgelaufene Links erfordern keinen Neustart des Gesamtexports.
- Kein privater API-Schlüssel oder dauerhaft gültiger Downloadlink befindet sich im Skript, Manifest oder Log.
- Ein Nichtadministrator kann weder Manifeste noch Signed URLs abrufen.

## Spätere Umsetzungseinheiten

1. Isolierte Export-Sitzungsmetadaten und Admin-Only-Backendfunktion.
2. Seitenweiser Scanner, Manifest- und Paketbildung.
3. Admin-Startdialog und sichere Übergabe des Sitzungs-Secrets.
4. PowerShell-Download, Fortsetzung, Paketfilter und Verifikation.
5. Pilot, Last schonender Vollexport und dokumentierter Delta-Abgleich.
