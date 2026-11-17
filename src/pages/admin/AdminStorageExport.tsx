import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clipboard, Download, FileText, HardDriveDownload, KeyRound, Loader2, ShieldCheck, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import scriptTemplate from '@/assets/storage-export/Export-AutohausAI-Storage.ps1?raw';
import guideText from '@/assets/storage-export/ANLEITUNG.md?raw';

type ExportSession = {
  exportId: string;
  exportSecret: string;
  expiresAt: string;
};

function saveTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminStorageExport() {
  const [session, setSession] = useState<ExportSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<'id' | 'secret' | null>(null);

  const createSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-export', {
        body: { action: 'create_session' },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Exportsitzung konnte nicht gestartet werden.');
      if (!data?.exportId || !data?.exportSecret || !data?.expiresAt) throw new Error('Die Sitzungsantwort ist unvollständig.');
      setSession(data as ExportSession);
      toast.success('Neue, vierstündige Exportsitzung gestartet.');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Exportsitzung konnte nicht gestartet werden.');
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-export', {
        body: {
          action: 'revoke',
          exportId: session.exportId,
          exportSecret: session.exportSecret,
        },
      });
      if (error || data?.error || !data?.success) throw new Error(data?.error || error?.message || 'Widerruf fehlgeschlagen.');
      setSession(null);
      setCopied(null);
      toast.success('Exportsitzung widerrufen. Das Secret wurde aus der Ansicht entfernt.');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Exportsitzung konnte nicht widerrufen werden.');
    } finally {
      setLoading(false);
    }
  };

  const copyValue = async (kind: 'id' | 'secret') => {
    if (!session) return;
    await navigator.clipboard.writeText(kind === 'id' ? session.exportId : session.exportSecret);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const downloadScript = () => {
    const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-export`;
    const configured = scriptTemplate.split('__AUTOHAUS_STORAGE_EXPORT_URL__').join(endpoint);
    saveTextFile('Export-AutohausAI-Storage.ps1', configured, 'text/plain;charset=utf-8');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <HardDriveDownload className="h-7 w-7 text-accent" />
            <h1 className="font-display text-2xl font-bold text-foreground">Storage-Übergabe</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Read-only Export aller Buckets für Windows. Zuerst Dateiliste und Zwei-Dateien-Test, kein automatischer Volldownload.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/storage">Zur Storage-Übersicht</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Isoliert und ausschließlich für Administratoren</p>
            <p className="mt-1 text-muted-foreground">
              Keine Änderung an Buckets, Dateien oder bestehenden Berechtigungen. Private API-Schlüssel bleiben serverseitig.
              Signed URLs laufen nach zehn Minuten ab und werden nicht gespeichert.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">PowerShell 5.1 &amp; 7</Badge>
          <Badge variant="secondary">Öffentlich + privat</Badge>
          <Badge variant="secondary">Fortsetzbar</Badge>
          <Badge variant="secondary">API-/DB-Abgleich</Badge>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">1. Vierstündige Export-Sitzung</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Export-ID und Secret werden nur für diese Sitzung verwendet. Das Secret erscheint nur hier und wird nicht lokal gespeichert.
          </p>
        </div>
        {!session ? (
          <Button onClick={createSession} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Neue Export-Sitzung starten
          </Button>
        ) : (
          <div className="space-y-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Export-ID</span>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-background px-3 py-2 text-xs text-foreground">{session.exportId}</code>
                <Button size="sm" variant="outline" onClick={() => copyValue('id')} aria-label="Export-ID kopieren">
                  {copied === 'id' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Secret – nicht in Dateien oder Chat kopieren</span>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-background px-3 py-2 text-xs text-foreground">{session.exportSecret}</code>
                <Button size="sm" variant="outline" onClick={() => copyValue('secret')} aria-label="Exportsitzungs-Secret kopieren">
                  {copied === 'secret' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Gültig bis {new Date(session.expiresAt).toLocaleString('de-DE')}. Nach Ablauf oder Widerruf ist eine neue Adminbestätigung nötig.
            </p>
            <Button variant="outline" onClick={revokeSession} disabled={loading}>
              <StopCircle className="mr-2 h-4 w-4" /> Sitzung widerrufen
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">2. Windows-Werkzeuge herunterladen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Das Skript ist bereits mit dem Export-Endpunkt konfiguriert und enthält keine Zugangsschlüssel.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={downloadScript}>
            <Download className="mr-2 h-4 w-4" /> PowerShell-Skript
          </Button>
          <Button variant="outline" onClick={() => saveTextFile('AutohausAI-Storage-Anleitung.md', guideText, 'text/markdown;charset=utf-8')}>
            <FileText className="mr-2 h-4 w-4" /> Kurzanleitung
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">3. Kontrollierte Reihenfolge auf Windows</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Skript ohne Schalter starten: vollständige Dateiliste und Datenbankabgleich, kein Datei-Download.</li>
          <li><code>buckets.csv</code>, <code>files.csv</code> und Gesamtsummen kontrollieren.</li>
          <li>Mit <code>-TestOnly</code> genau eine öffentliche und eine private Datei sowie die Fortsetzung testen.</li>
          <li>Erst nach Ihrer Freigabe mit <code>-Download -Package 1,2</code> einzelne Pakete oder mit <code>-Download</code> alles laden.</li>
          <li>Mit <code>-Rescan</code> Änderungen abgleichen und mit <code>-VerifyOnly</code> die lokale Übergabe prüfen.</li>
        </ol>
      </section>
    </div>
  );
}
