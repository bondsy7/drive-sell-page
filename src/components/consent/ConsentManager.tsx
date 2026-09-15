import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CONSENT_OPEN_EVENT,
  createConsent,
  readConsent,
  saveConsent,
  type ConsentState,
} from '@/lib/consent';

/**
 * Einwilligungsbanner + Einstellungen.
 * "Alle akzeptieren" und "Nur notwendige" sind gleichwertig gestaltet,
 * optionale Kategorien sind nicht vorausgewählt.
 */
export default function ConsentManager() {
  const [current, setCurrent] = useState<ConsentState | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    setCurrent(stored);
    if (!stored) setBannerOpen(true);

    const openHandler = () => {
      const latest = readConsent();
      setAnalytics(!!latest?.analytics);
      setMarketing(!!latest?.marketing);
      setSettingsOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, openHandler);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, openHandler);
  }, []);

  const persist = useCallback((a: boolean, m: boolean) => {
    const state = createConsent(a, m);
    saveConsent(state);
    if (m) persistPendingAttribution();
    setCurrent(state);
    setBannerOpen(false);
    setSettingsOpen(false);
  }, []);


  return (
    <>
      {bannerOpen && (
        <div
          role="dialog"
          aria-label="Einwilligung zu optionalen Diensten"
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/98 backdrop-blur"
        >
          <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
            <div className="space-y-2">
              <p className="font-display text-sm font-semibold text-foreground">
                Datenschutzeinstellungen
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Wir verwenden notwendige Funktionen, damit AUTO3 nutzbar ist. Optionale Dienste für
                Analyse und Marketing setzen wir ausschließlich mit deiner Einwilligung ein – vorher
                werden keine Daten an diese Anbieter übertragen. Du kannst deine Auswahl jederzeit
                über „Cookie-Einstellungen“ im Seitenfuß ändern oder widerrufen. Details in der{' '}
                <Link to="/datenschutz" className="underline underline-offset-2 hover:text-foreground">
                  Datenschutzerklärung
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => persist(true, true)}>
                Alle akzeptieren
              </Button>
              <Button className="flex-1" onClick={() => persist(false, false)}>
                Nur notwendige
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  setAnalytics(false);
                  setMarketing(false);
                  setSettingsOpen(true);
                }}
              >
                Einstellungen
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cookie-Einstellungen</DialogTitle>
            <DialogDescription>
              Wähle aus, welche optionalen Dienste eingesetzt werden dürfen. Ohne Einwilligung
              werden keine Analyse- oder Marketing-Dienste geladen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Notwendig</p>
                <p className="text-xs text-muted-foreground">
                  Anmeldung, Sitzung, Sicherheit und Grundfunktionen. Immer aktiv.
                </p>
              </div>
              <Switch checked disabled aria-label="Notwendig (immer aktiv)" />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Analyse</p>
                <p className="text-xs text-muted-foreground">
                  Reichweiten- und Nutzungsmessung, um das Angebot zu verbessern.
                </p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Analyse erlauben" />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Marketing</p>
                <p className="text-xs text-muted-foreground">
                  Messung und Ausspielung von Werbung, inklusive Conversion-Messung.
                </p>
              </div>
              <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="Marketing erlauben" />
            </div>

            {current && (
              <p className="text-[11px] text-muted-foreground">
                Aktuelle Auswahl gespeichert am{' '}
                {new Date(current.timestamp).toLocaleString('de-DE')} (Version {current.version}).
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => persist(false, false)}>
              Alle ablehnen
            </Button>
            <Button onClick={() => persist(analytics, marketing)}>Auswahl speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
