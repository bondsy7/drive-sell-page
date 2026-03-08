

## Integration & Distribution: Fahrzeug-Landingpages auf Kundenwebsites bringen

### Problemstellung

Die generierten HTML-Angebotsseiten sind aktuell nur als Download verfügbar. Autohäuser brauchen Wege, diese Inhalte auf ihre bestehenden Websites zu bekommen -- idealerweise SEO-freundlich und in das vorhandene Design integriert.

### Vorgeschlagene Integrationswege

#### 1. REST API (Kernstück)
Eine neue Edge Function `api/vehicles` die pro Projekt strukturierte JSON-Daten ausliefert (Fahrzeugdaten, Bilder-URLs, Verbrauch, Finanzierung). Damit kann jedes System die Daten abrufen und selbst rendern.

- **Authentifizierung**: API-Key pro Nutzer (neues Feld `api_key` in `profiles`, auto-generiert)
- **Endpunkte**:
  - `GET /vehicles` -- Liste aller Projekte des Nutzers
  - `GET /vehicles/:id` -- Einzelnes Projekt als JSON
  - `GET /vehicles/:id/html` -- Fertiges HTML-Fragment (ohne `<html>`/`<body>`, nur der Content-Block)
- **Vorteil**: Universell einsetzbar, jedes CMS/Framework kann die Daten konsumieren

#### 2. FTP-Upload
Eine Edge Function die das generierte HTML per FTP auf den Kundenserver hochlädt.

- **Konfiguration im Profil**: FTP-Host, Port, Benutzer, Passwort, Zielverzeichnis
- **Ablauf**: Button "Auf Server hochladen" im Export-Dialog, sendet HTML an Edge Function die per FTP hochlädt
- **Nachteil** (dem Nutzer kommunizieren): Standalone-Seite ohne Menü-Integration

#### 3. Embed-Script / iFrame (Einfachste SEO-Variante)
Ein JavaScript-Snippet das der Kunde auf seiner Website einbindet. Das Script lädt die Fahrzeugdaten per REST API und rendert sie direkt in die Seite.

- `<script src="https://autohaus.ai/embed.js" data-dealer="USER_ID"></script>`
- Rendert eine Fahrzeugliste oder Einzelansicht
- Erbt teilweise das CSS der Host-Seite
- Besser als iFrame für SEO, da der Content im DOM liegt

#### 4. WordPress Plugin (Wichtigster Kanal)
Ein WordPress-Plugin das die REST API nutzt und native WordPress-Inhalte erzeugt.

- Erstellt Custom Post Type `fahrzeug_angebot`
- Synchronisiert automatisch per Cron oder manuell
- Nutzt das aktive Theme-Layout (Menü, Footer, Sidebar)
- SEO-freundlich: echte WordPress-Seiten mit Schema.org Markup
- **Umsetzung**: Plugin-Code als Download im Profil bereitstellen (PHP-Datei)

### UI-Konzept: Neue "Schnittstellen"-Seite

Neue geschützte Route `/integrations` (erreichbar über Profil oder Dashboard-Navigation):

```text
┌──────────────────────────────────────────────┐
│  Schnittstellen & Integration                │
├──────────────────────────────────────────────┤
│                                              │
│  🔑 API-Zugang                               │
│  ┌──────────────────────────────────────┐    │
│  │ API-Key: ak_xxxx...  [Kopieren][Neu] │    │
│  │ Endpunkt: .../api/vehicles           │    │
│  │ [Dokumentation anzeigen]             │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  📡 FTP-Upload                               │
│  ┌──────────────────────────────────────┐    │
│  │ Host: ___  Port: ___  User: ___     │    │
│  │ Passwort: ___  Verzeichnis: ___     │    │
│  │ [Verbindung testen] [Speichern]      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  🔗 Embed-Code                               │
│  ┌──────────────────────────────────────┐    │
│  │ <script src="..."></script>          │    │
│  │ [Kopieren]                            │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  🔌 WordPress Plugin                         │
│  ┌──────────────────────────────────────┐    │
│  │ Plugin herunterladen (.zip)           │    │
│  │ Anleitung: 1. Plugin hochladen...    │    │
│  └──────────────────────────────────────┘    │
│                                              │
└──────────────────────────────────────────────┘
```

### Technische Umsetzung

**Phase 1 -- REST API + UI (jetzt)**
1. DB-Migration: `api_key` Feld in `profiles` + RLS
2. Edge Function `api-vehicles/index.ts` mit API-Key Auth
3. Neue Seite `src/pages/Integrations.tsx` mit API-Key-Management und Dokumentation
4. Navigation in Dashboard/Profil erweitern (Link zu `/integrations`)
5. Export-Dialog um "Auf Server hochladen" erweitern

**Phase 2 -- FTP + Embed (danach)**
6. FTP-Konfiguration in DB (neue Tabelle `ftp_configs`)
7. Edge Function `ftp-upload/index.ts`
8. Embed-Script als statische JS-Datei in `public/embed.js`

**Phase 3 -- WordPress Plugin (separat)**
9. WordPress-Plugin-PHP generieren und als Download bereitstellen
10. Anleitungs-Sektion auf der Integrations-Seite

### Empfehlung

Ich würde mit **Phase 1** starten: REST API + Integrations-Seite. Das ist die Grundlage für alles andere (FTP, Embed und WordPress Plugin nutzen alle die gleiche API). Soll ich damit beginnen?

