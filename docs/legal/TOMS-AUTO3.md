# Technische und organisatorische Maßnahmen nach Art. 32 DSGVO – AUTO3

Stand: 16.09.2026 · Breadcrumb Marketing GmbH. Anlage zum AVV.
Beschrieben sind ausschließlich Maßnahmen, die aus dem Projekt- und Provider-Stack
realistisch belegbar sind. Offene Punkte sind ausdrücklich gekennzeichnet.

## 1. Zutrittskontrolle
Betrieb ausschließlich auf verwalteter Cloud-Infrastruktur (Hosting-/Backend-Provider).
Es werden keine eigenen Rechenzentren betrieben; physische Sicherheit liegt beim
jeweiligen Anbieter und richtet sich nach dessen Nachweisen.

## 2. Zugangskontrolle
Nutzung nur über authentifizierte Konten, Registrierung mit E-Mail-Verifizierung,
Passwort- und Google-OAuth-Anmeldung über den Auth-Dienst des Backends. Administrative
Bereiche sind durch eine geschützte Route und eine serverseitig geprüfte Rolle abgesichert.

## 3. Zugriffskontrolle
Row Level Security auf den fachlichen Tabellen mit Trennung über `user_id`;
Service-Role-Schlüssel ausschließlich serverseitig in geschützten Funktionen; keine
privilegierten Schlüssel im Frontend. Rollen werden in einer separaten Rollentabelle
geführt und über eine Security-Definer-Funktion geprüft.

## 4. Weitergabekontrolle
Transportverschlüsselung per HTTPS/TLS für Anwendung, Schnittstellen und serverseitige
Funktionen. Aufrufe externer Dienste erfolgen ausschließlich verschlüsselt. Für private
Speicherbereiche (u. a. Originalaufnahmen, Dokumente, interne Uploads) werden zeitlich
begrenzte, signierte Links verwendet.

Transparenzhinweis: Für Veröffentlichung und Export (Social-Media-Beiträge, ausgelieferte
Landingpages, Bannerdateien, Herstellerlogos) sind Medien über öffentlich abrufbare,
nicht ohne Weiteres erratbare Adressen erreichbar. Das ist für die vom Kunden beauftragte
Veröffentlichung technisch erforderlich.

## 5. Eingabekontrolle und Protokollierung
Validierung von Eingaben in serverseitigen Funktionen; Protokollierung von
Generierungsversuchen, Aufträgen, Credit-Buchungen und Statusänderungen inklusive
Fehlercode, Anbieterantwort, Dauer und Wiederholungsstand. Es wird **nicht** behauptet,
dass jede Nutzeraktion revisionssicher protokolliert wird; ein manipulationssicheres
zentrales Sicherheitsmonitoring (SIEM) ist derzeit nicht im Einsatz.

## 6. Verfügbarkeit und Wiederherstellung
Betrieb auf verwalteter Anbieterinfrastruktur mit den Sicherungs- und
Wiederherstellungsmechanismen des jeweils gebuchten Anbieterplans. Konkrete RTO/RPO sind
nicht vereinbart und werden nicht zugesichert.

## 7. Mandantentrennung
Logische Trennung über die Nutzerkennung in Tabellen, Richtlinien und Speicherpfaden;
getrennte Produktiv- und Verwaltungssichten.

## 8. Datenminimierung und Löschung
Erhebung nur der für die Funktion erforderlichen Daten. Keine Speicherung von
IP-Adressen für Einwilligungen oder Vertragsannahmen. Keine Nutzung von Kundeninhalten
zu eigenen Trainings- oder Werbezwecken ohne gesonderte Vereinbarung. Löschung von
Konten, Projekten und Medien auf Anforderung; Bereinigungsroutine für verwaiste
Speicherobjekte.

Bekannte Einschränkung: Bei der Gemini File API laufen temporäre Dateien anbieterseitig
ab. Bei der OpenAI Files API bestehen hochgeladene Dateien fort, bis sie gelöscht werden;
ein automatischer Lösch-/Ablaufprozess ist **offen** und mit hoher Priorität dokumentiert,
weil Datei-IDs für die Wiederverwendung von Referenzen benötigt werden.

## 9. Sicherheitsupdates und Dependency Management
Versionsverwaltung des Quellcodes; Geheimnisse ausschließlich als serverseitige Secrets,
nicht im Code. Typ- und Build-Prüfungen sowie Tests im eingerichteten Umfang;
sicherheitsrelevante Abhängigkeiten werden regelmäßig aktualisiert.

## 10. Incident-Prozess
Verpflichtung zu interner Meldung, Bewertung und Eindämmung erkannter Vorfälle,
unverzüglicher Information betroffener Kunden mit den verfügbaren Angaben nach
Art. 33 Abs. 3 DSGVO und Dokumentation der ergriffenen Maßnahmen.

## 11. Berechtigungs- und Mitarbeitendenmanagement
Berechtigungsvergabe nach Need-to-know und dem Prinzip der geringsten Rechte;
Vertraulichkeitsverpflichtung der eingesetzten Personen.

## 12. Überprüfung
Die Maßnahmen werden anlassbezogen und risikoorientiert überprüft und an den Stand der
Technik angepasst, ohne das Schutzniveau zu unterschreiten.
