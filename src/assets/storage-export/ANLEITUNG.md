# Autohaus.ai Storage-Übergabe – Windows-Kurzanleitung

## Sicherheit und Umfang

- Nur für berechtigte Administratoren. Die Export-Sitzung läuft nach vier Stunden ab und kann jederzeit widerrufen werden.
- Das Skript enthält keine API-Schlüssel. Das Sitzungs-Secret wird bei jedem Start sicher abgefragt und nicht gespeichert.
- Alle Storage-Zugriffe sind lesend. Keine Cloud-Datei wird verändert, verschoben oder gelöscht.
- Signed URLs gelten zehn Minuten, werden nur im Arbeitsspeicher verwendet und nicht in Manifeste oder Logs geschrieben.
- Ohne `-Download` oder `-TestOnly` wird ausschließlich die Dateiliste erstellt. Ein Volldownload startet niemals versehentlich.

## 1. Export vorbereiten

1. In Autohaus.ai als Administrator **Monitoring → Storage-Export** öffnen.
2. **Neue Export-Sitzung starten** wählen.
3. Export-ID und das nur einmal angezeigte Secret getrennt sicher aufbewahren. Das Secret nicht in eine Datei, E-Mail oder Chatnachricht kopieren.
4. Über die Adminseite das **konfigurierte PowerShell-Skript** und diese Anleitung herunterladen.
5. Ein kurzes, NTFS-formatiertes Ziel mit ausreichend freiem Speicher wählen, beispielsweise `D:\AH-Export`. Mindestens die erwarteten 12,1 GB plus Delta und Reserve einplanen. Der Ordner sollte nur für berechtigte lokale Administratoren lesbar sein; BitLocker wird empfohlen.

## 2. Vollständige Dateiliste ohne Download erzeugen

PowerShell im Ordner des heruntergeladenen Skripts öffnen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Export-AutohausAI-Storage.ps1 -Destination D:\AH-Export
```

Export-ID und Secret eingeben, wenn das Skript danach fragt. Dieser Befehl lädt **keine** Storage-Dateien herunter.

Ergebnis:

- `manifest\buckets.csv`: alle gefundenen Buckets, öffentlich/privat und API-/DB-Präsenz.
- `manifest\files.csv`: vollständige Dateiliste mit Bucket, ursprünglichem Pfad, Größe, ETag, Aktualisierungszeit, Abgleichstatus und Paketnummer.
- `manifest\files.jsonl`: dieselbe Liste zur automatisierten Weiterverarbeitung.
- `manifest\manifest-complete.json`: Bucket-, Datei-, Byte- und Paketsummen.
- `manifest\packages\package-*.json`: logische Downloadpakete, standardmäßig höchstens 500 MB oder 250 Dateien.
- `manifest\scan-state.json`: Fortsetzungspunkt für einen unterbrochenen Scan; keine Zugangsdaten.

Vor jedem Download die Abweichungen prüfen. `matched` bedeutet, dass Storage-API und interne Storage-Datenbank übereinstimmen. `api_only`, `database_only`, `size_mismatch`, `id_mismatch` und `etag_mismatch` werden ausdrücklich ausgewiesen und nicht still übersprungen.

## 3. Nur den vorgesehenen Testexport ausführen

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Export-AutohausAI-Storage.ps1 -Destination D:\AH-Export -TestOnly
```

Der Test:

1. lädt genau eine kleine, nichtleere öffentliche Datei,
2. lädt genau eine private Datei mit mindestens 128 KiB,
3. unterbricht die private Datei absichtlich nach 64 KiB,
4. setzt dieselbe Datei per HTTP-Range fort; falls die Quelle Range nicht unterstützt, wird nur diese Datei neu geladen,
5. prüft Dateigröße und lokale SHA-256-Werte sowie einen 32-stelligen Quell-ETag als MD5, sofern dieses Format vorliegt.

`manifest\test-report.json` muss für beide Dateien `completed: true` zeigen. Erst danach den Vollexport erwägen.

## 4. Später: einzelne Pakete oder vollständigen Download

Nur nach Prüfung von Dateiliste und Testbericht:

```powershell
# Nur Paket 1 und 2
powershell -NoProfile -ExecutionPolicy Bypass -File .\Export-AutohausAI-Storage.ps1 -Destination D:\AH-Export -Download -Package 1,2

# Alle Pakete – startet ausdrücklich den vollständigen Download
powershell -NoProfile -ExecutionPolicy Bypass -File .\Export-AutohausAI-Storage.ps1 -Destination D:\AH-Export -Download
```

Die Originaldateien liegen danach unter `<Ziel>\<Bucket>\<ursprünglicher Unterordner>\<Dateiname>`. Inhalte werden nicht konvertiert oder komprimiert.

## 5. Nach Abbruch fortsetzen

Denselben Befehl erneut ausführen. Bereits vollständig geprüfte Dateien werden übersprungen. `.part`-Dateien werden per HTTP-Range fortgesetzt; ohne Range-Unterstützung wird nur die betroffene Datei erneut geladen. Nach jeder Datei wird der Prüfstand in `manifest\download-state.jsonl` ergänzt. Diese Datei enthält keine Signed URLs oder Secrets.

Eine vorhandene, abweichende lokale Datei wird nicht automatisch überschrieben. Erst nach gesonderter Prüfung darf `-AllowLocalReplace` verwendet werden; die bisherige lokale Datei wird dann unter `local-conflicts` aufbewahrt.

## 6. Änderungen und Integrität prüfen

```powershell
# Neuen Read-only-Bestandsscan und Delta-Bericht erzeugen, kein Download
powershell -NoProfile -ExecutionPolicy Bypass -File .\Export-AutohausAI-Storage.ps1 -Destination D:\AH-Export -Rescan

# Neue/geänderte Dateien paketweise nachladen
powershell -NoProfile -ExecutionPolicy Bypass -File .\Export-AutohausAI-Storage.ps1 -Destination D:\AH-Export -Rescan -Download

# Alle lokal vorhandenen Dateien gegen Manifestgröße und Prüfsummen prüfen
powershell -NoProfile -ExecutionPolicy Bypass -File .\Export-AutohausAI-Storage.ps1 -Destination D:\AH-Export -VerifyOnly
```

`delta-report.csv` enthält neue, geänderte und zwischenzeitlich entfernte Quellobjekte. Lokal vorhandene Dateien werden bei einem Quell-Löschungshinweis nicht gelöscht. `verification-report.csv` enthält Größen, SHA-256, Quellprüfsummenstatus und Vollständigkeit.

Storage ist während des Betriebs kein atomarer Gesamt-Snapshot. Für einen streng punktgenauen Stand ist ein separat vereinbartes Schreibfenster erforderlich. Andernfalls den finalen Delta-Scan unmittelbar nach dem letzten Paket ausführen und den Zeitraum im Übergabeprotokoll festhalten.

## 7. Export-Sitzung beenden

In der Adminseite **Sitzung widerrufen** wählen. Danach sind keine weiteren Manifest- oder Signieraufrufe möglich. Bereits ausgestellte Signed URLs laufen spätestens nach zehn Minuten ab. Für eine spätere Fortsetzung muss ein Administrator eine neue Sitzung starten und deren ID/Secret eingeben.

## Neue technische Objekte und Entfernung nach der Übergabe

Neu und ausschließlich für diesen Export:

- Edge Function `storage-export`: Admin-Sitzung, rekursive Listenseiten, DB-Abgleich, zehnminütige Signed URLs und Widerruf.
- `public.storage_export_sessions`: nur Export-ID, Admin-ID, Secret-Hash, Ablauf, Widerruf und Nutzungszeit; keine Dateiinhalte oder Klartext-Secrets.
- `public.storage_export_db_buckets()`: read-only Bucketabgleich mit `storage.buckets`, nur für den Backend-Dienst ausführbar.
- `public.storage_export_db_inventory(text, integer, integer)`: read-only Objektabgleich mit `storage.objects`, nur für den Backend-Dienst ausführbar.
- Adminseite `/admin/storage-export` sowie die beiden lokalen Downloadvorlagen.

Nach abgeschlossener Übergabe zuerst alle Export-Sitzungen widerrufen. Ein autorisierter Datenbankadministrator kann danach ausschließlich die neuen Export-Metadaten und Lesefunktionen entfernen:

```sql
DROP FUNCTION public.storage_export_db_inventory(text, integer, integer);
DROP FUNCTION public.storage_export_db_buckets();
DROP TABLE public.storage_export_sessions;
```

Zusätzlich die neue Edge Function `storage-export`, die Adminseite `/admin/storage-export` sowie deren Navigations-/Routeneinträge entfernen. Diese Rückbauaktionen betreffen keine Storage-Buckets, Storage-Dateien oder bestehenden Berechtigungen. Sie werden nicht automatisch ausgeführt.

## Hinweise zu Windows-Dateinamen

Das Skript stoppt bei Windows-unzulässigen/reservierten Namen, statt still umzubenennen. Pfade ab 240 Zeichen verwendet es mit dem erweiterten `\\?\`-Präfix und deaktiviert prozessintern die .NET-Langpfadbeschränkung. Auf älteren Windows-Installationen muss zusätzlich die Systemrichtlinie **Lange Win32-Pfade aktivieren** beziehungsweise `LongPathsEnabled` aktiv sein; das Skript verändert diese Systemeinstellung nicht selbst. Ein kurzes Ziel wie `D:\AH-Export` wird trotzdem empfohlen. Falls tatsächlich unzulässige Originalnamen vorliegen, für diese Dateien ein WSL-/Linux-Ziel oder eine ausdrücklich vereinbarte reversible Namensabbildung mit Mapping verwenden.
