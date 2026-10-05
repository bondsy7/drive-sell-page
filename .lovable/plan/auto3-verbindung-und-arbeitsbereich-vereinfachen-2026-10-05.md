# Auto3-Verbindung und Arbeitsbereich vereinfachen

## Ziel
Auto3 wird in zwei klare Schritte getrennt: Im Profil wird nur die Händler-/Mandanten-URL verbunden und sichtbar geprüft. Nach erfolgreicher Verbindung erscheint im Generator ein eigener Auto3-Arbeitsbereich für Bestand, Import, Aufbereitung und globale Regeln.

## Umsetzung
1. **Einfache Verbindung im Profil**
   - Die bisherigen Auto3-Bestands-, Website- und Aufbereitungsbereiche aus dem Profil entfernen.
   - Eine kompakte Auto3-Verbindung mit einem Feld für die Händler-URL ergänzen.
   - „Verbindung prüfen“ ruft Auto3 serverseitig auf; nur eine tatsächlich erreichbare URL wird gespeichert.
   - Erfolgszustand klar als „Verbunden“ mit Händler-URL und geprüftem Fahrzeugbestand darstellen; Fehler verständlich direkt am Feld zeigen.
   - Die bisherige Auto3-Login-E-Mail und Posting-Vorgaben nicht mehr als primäre Verbindungsmaske zeigen; bestehende gespeicherte Werte und Push-Logik bleiben technisch unangetastet.

2. **Auto3-Kachel im Generator**
   - Nach erfolgreicher Verbindung eine eigene Kachel „Auto3 Fahrzeugbestand“ im Generator anzeigen.
   - Nicht verbundene Konten sehen keine operative Auto3-Kachel; die Einrichtung bleibt im Profil erreichbar.
   - Die Kachel öffnet einen eigenen Generator-Bereich statt Bestand und Jobs im Profil zu vermischen.

3. **Neues Auto3-Center**
   - Oben eine kompakte Statuszeile mit Verbindung, Fahrzeuganzahl, Automatikstatus und Profilfreigabe.
   - Darunter den vorhandenen Fahrzeugbestand mit Suche, Filtern, Import, Jobstatus und bestehenden Aktionen unverändert weiterverwenden.
   - Aufbereitungslogik, VIN-Schutz, private Originale, Credit-Grenzen und manuelles Website-Publishing bleiben unverändert.

4. **Globale Regeln einklappen**
   - Automatikmodus und Freigabestatus leicht auffindbar oben darstellen.
   - Globale Bildregeln in klar benannte, standardmäßig geschlossene Bereiche gliedern:
     - Bildstil: Showroom, Kennzeichen, Qualität
     - Perspektiven und Bildumfang
     - Zusatzausgaben: Banner, Social, Video, Website-Ziel
   - Kosten pro Fahrzeug und Freigabe bleiben dauerhaft sichtbar, damit keine Credits unbemerkt freigegeben werden.

5. **Sicherer Rollout**
   - Händler-URL kontobezogen speichern und in der bestehenden serverseitigen Auto3-Funktion verwenden; keine URL und keine VIN ungeprüft an den Browser durchreichen.
   - Bestehende Auto-Schmitt-Konfiguration kompatibel übernehmen, damit aktuelle Imports und Jobs weiterlaufen.
   - Erst Verbindung und Generator-Kachel ausrollen, danach die kompakteren Regelbereiche; keine Änderung an Generatoren, Job-Orchestrierung, Credits oder Website-Veröffentlichung.
   - Desktop und Smartphone sowie Verbindung, Fehlerzustand, Kachel-Sichtbarkeit, Bestand und Import prüfen.

## Technische Details
- Die Händler-URL wird auf HTTPS, zulässiges Format und eine erfolgreiche Auto3-Antwort geprüft.
- Der technische Auto3-Host bleibt zentral konfiguriert; Nutzer tragen nur die Händler-/Mandanten-URL ein.
- Der bestehende `auto3-inventory`-Adapter bleibt read-only gegenüber Auto3 und erhält nur eine Verbindungsprüfung sowie die kontobezogene Mandantenauswahl.
- Keine Auto3-Schreibzugriffe, keine automatische Website-Veröffentlichung und keine Änderung der bestehenden Credit-Guards.
