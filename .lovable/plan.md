# Veraltete Pipeline-Ergebnisse beim Fahrzeugwechsel verhindern

## Umsetzung
- Beim Öffnen der Pipeline aus einem neu remasterten Fotosatz prüfen, ob der globale Pipeline-Zustand zu genau diesem aktuellen Fahrzeuglauf gehört.
- Eine abgeschlossene alte Pipeline vor dem Anzeigen der neuen Auswahl vollständig zurücksetzen, damit keine alten Bilder, Jobs oder Fahrzeugdaten erscheinen.
- Eine aktuell laufende Pipeline nicht unbemerkt überschreiben; nur abgeschlossene oder veraltete Zustände werden automatisch entfernt.
- Den Pipeline-Runner zusätzlich über eine stabile Kennung des aktuellen Fotosatzes absichern, damit ein alter Zustand auch bei Navigation oder erneutem Öffnen nicht übernommen wird.
- Einen fokussierten Regressionstest ergänzen: abgeschlossener Skoda-Lauf → neuer Volvo-Fotosatz → leere, startbereite Pipeline mit Volvo-Referenzen.

## Prüfung
- Relevanten Test ausführen.
- TypeScript-Prüfung und App-Build kontrollieren.
- Den Übergang im laufenden Generator prüfen: Remastern → „Bilderset generieren“ zeigt keine vorherigen Ergebnisse.
