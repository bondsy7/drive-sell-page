# Logo und Überschriftenschrift aktualisieren

## Umsetzung
- Das bisherige zentrale Rasterlogo durch die gelieferte originale SVG ersetzen, sodass Kopfzeilen, Fußbereich, Anmeldung und weitere bestehende Logo-Platzierungen automatisch die neue Version nutzen.
- Aus derselben SVG ein quadratisches Favicon ableiten und die Browser-Verknüpfung darauf umstellen.
- Die gelieferte Dessau-Bold-Schrift datensparsam lokal einbinden und zunächst ausschließlich auf bestehende `font-display`-Überschriften anwenden; Fließtexte und Bedienelemente bleiben unverändert lesbar.
- Direkte Logo-Nutzung im Angebots-PDF auf die SVG umstellen, sofern dessen Bildverarbeitung SVG unterstützt; andernfalls eine passend abgeleitete Rasterversion verwenden.

## Prüfung
- Startseite und eine Funnel-Seite auf Desktop und Smartphone visuell prüfen: Logo-Proportionen, Überschriftenumbrüche, Sonderzeichen und Überläufe.
- Anmeldung und Produktkopf stichprobenartig prüfen.
- Vorschaufehler und Buildstatus kontrollieren; nicht veröffentlichen.
