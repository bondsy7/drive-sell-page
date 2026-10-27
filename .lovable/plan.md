# Offline-Modus für autohaus.ai

## Was realistisch offline geht
Alle KI-Funktionen (Remastering, Banner, Video, Landingpages, PDF-Auswertung) und Credits brauchen zwingend Internet. Offline sinnvoll sind:
- App öffnet sich auch ohne Netz (statt weißer Seite / Browserfehler) und lässt sich als App aufs Handy legen.
- Zuletzt angesehene Fahrzeuge, Galerien und Bilder bleiben ansehbar.
- Klarer Hinweis „Offline – Generierung erst wieder mit Verbindung möglich", Generier-Buttons gesperrt.
- Phase 2 (optional): Fotoaufnahme auf dem Hof ohne Netz – Fotos werden lokal gemerkt und automatisch hochgeladen, sobald Netz da ist. Kein automatischer Start kostenpflichtiger Generierungen.

## Schritte
1. App-Installation: Name, Icon (BrandLogo-Bildmarke), Farben – „Zum Startbildschirm hinzufügen".
2. Offline-Grundgerüst: App-Oberfläche wird zwischengespeichert; Seitenaufrufe immer zuerst aus dem Netz, nur offline aus dem Speicher (keine veralteten Versionen nach Updates).
3. Bild-Cache: bereits geladene Fahrzeugbilder werden begrenzt (z. B. 300 Bilder / 30 Tage) zwischengespeichert.
4. Offline-Hinweisleiste + Sperre aller kostenpflichtigen/serverseitigen Aktionen solange offline.
5. Phase 2 separat: Upload-Warteschlange für Erfassungsfotos.

Offline funktioniert nur in der veröffentlichten App (app.autohaus.ai), nicht in der Editor-Vorschau.

## Technische Details
- `vite-plugin-pwa` mit `generateSW`, `registerType: "autoUpdate"`, `devOptions.enabled: false`, `injectRegister: null`, SW-Datei `/sw.js`.
- Eine Registrierungs-Wrapper-Datei; verweigert Registrierung in Dev, iframe, Lovable-Preview-Hosts (id-preview--/preview--, lovableproject.com, beta.lovable.dev, delegierte Preview-URL) und bei `?sw=off`; dort bestehende `/sw.js`-Registrierungen abmelden.
- Navigation `NetworkFirst`, `/~oauth` und Auth-/API-/Edge-Function-Aufrufe nie cachen; `CacheFirst` nur für gehashte eigene Assets; signierte Storage-URLs per `StaleWhileRevalidate` mit Ablauf.
- Manifest + Head-Tags (manifest, theme-color `#174f6b`, apple-touch-icon) in `index.html`.
- Offline-Status-Hook (`navigator.onLine` + Events) für Banner und Button-Sperren.
- Phase 2: IndexedDB-Warteschlange für Originale, Upload über bestehende Speicherlogik mit Slot-Dateinamen.
