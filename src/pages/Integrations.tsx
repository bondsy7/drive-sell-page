import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Copy, RefreshCw, Key, Code, Globe, Plug,
  Upload, Server, CheckCircle, XCircle, Loader2, Download
} from "lucide-react";
import CreditBadge from "@/components/CreditBadge";
import logoLight from "@/assets/logo-light.png";
import { downloadWordPressPlugin } from "@/lib/wordpress-plugin";

interface FtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  directory: string;
  is_sftp: boolean;
}

const defaultFtp: FtpConfig = { host: "", port: 21, username: "", password: "", directory: "/", is_sftp: false };

export default function Integrations() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  // FTP state
  const [ftp, setFtp] = useState<FtpConfig>(defaultFtp);
  const [ftpLoading, setFtpLoading] = useState(true);
  const [ftpSaving, setFtpSaving] = useState(false);
  const [ftpTesting, setFtpTesting] = useState(false);
  const [ftpTestResult, setFtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiBase = `${supabaseUrl}/functions/v1/api-vehicles`;

  useEffect(() => {
    if (!user) return;
    loadApiKey();
    loadFtpConfig();
  }, [user]);

  const loadApiKey = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("api_key")
      .eq("id", user!.id)
      .single();
    setApiKey((data as any)?.api_key || "");
    setLoading(false);
  };

  const loadFtpConfig = async () => {
    const { data } = await supabase
      .from("ftp_configs" as any)
      .select("*")
      .eq("user_id", user!.id)
      .single();
    if (data) {
      const d = data as any;
      setFtp({
        host: d.host || "",
        port: d.port || 21,
        username: d.username || "",
        password: d.password || "",
        directory: d.directory || "/",
        is_sftp: d.is_sftp || false,
      });
    }
    setFtpLoading(false);
  };

  const regenerateKey = async () => {
    setRegenerating(true);
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const newKey = `ak_${hex}`;

    const { error } = await supabase
      .from("profiles")
      .update({ api_key: newKey, updated_at: new Date().toISOString() } as any)
      .eq("id", user!.id);

    if (error) {
      toast.error("Fehler beim Generieren des API-Keys");
    } else {
      setApiKey(newKey);
      toast.success("Neuer API-Key generiert");
    }
    setRegenerating(false);
  };

  const saveFtpConfig = async () => {
    setFtpSaving(true);
    const payload = { ...ftp, user_id: user!.id, updated_at: new Date().toISOString() };

    const { data: existing } = await supabase
      .from("ftp_configs" as any)
      .select("id")
      .eq("user_id", user!.id)
      .single();

    let error;
    if (existing) {
      ({ error } = await supabase.from("ftp_configs" as any).update(payload as any).eq("user_id", user!.id));
    } else {
      ({ error } = await supabase.from("ftp_configs" as any).insert(payload as any));
    }

    if (error) {
      toast.error("Fehler beim Speichern der FTP-Konfiguration");
    } else {
      toast.success("FTP-Konfiguration gespeichert");
    }
    setFtpSaving(false);
  };

  const testFtpConnection = async () => {
    setFtpTesting(true);
    setFtpTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ftp-upload", {
        body: { action: "test" },
      });
      if (error) throw error;
      setFtpTestResult(data as any);
    } catch {
      setFtpTestResult({ success: false, message: "Verbindungstest fehlgeschlagen" });
    }
    setFtpTesting(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert`);
  };

  const embedCode = `<div id="autohaus-ai-vehicles"></div>
<script src="${window.location.origin}/embed.js"
  data-api-key="${apiKey}"
  data-supabase-url="${supabaseUrl}">
</script>`;

  const embedSingleCode = `<div id="autohaus-ai-vehicle" data-vehicle-id="FAHRZEUG_ID"></div>
<script src="${window.location.origin}/embed.js"
  data-api-key="${apiKey}"
  data-supabase-url="${supabaseUrl}">
</script>`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={logoLight} alt="Autohaus.AI" className="h-8" />
          </Link>
          <div className="flex items-center gap-3">
            <CreditBadge />
            <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
            <Link to="/profile"><Button variant="ghost" size="sm">Profil</Button></Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">Schnittstellen & Integration</h1>
            <p className="text-muted-foreground text-sm">Binden Sie Ihre Fahrzeugangebote auf Ihrer Website ein</p>
          </div>
        </div>

        {/* ============ API Key ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> API-Zugang (REST)</CardTitle>
            <CardDescription>Ihr persönlicher API-Key für den Zugriff auf die REST API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input readOnly value={loading ? "Laden..." : apiKey} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey, "API-Key")} disabled={!apiKey}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={regenerateKey} disabled={regenerating}>
                <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-3 text-sm">
              <p className="font-semibold">Endpunkte:</p>
              <div className="space-y-2 font-mono text-xs">
                {[
                  { path: "", desc: "Liste aller Fahrzeuge" },
                  { path: "/:id", desc: "Einzelnes Fahrzeug als JSON" },
                  { path: "/:id/html", desc: "HTML-Fragment zum Einbetten" },
                ].map(ep => (
                  <div key={ep.path} className="flex items-start gap-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold shrink-0">GET</span>
                    <div>
                      <p className="break-all">{apiBase}{ep.path && <span className="text-primary">{ep.path}</span>}</p>
                      <p className="text-muted-foreground font-sans">{ep.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-border">
                <p className="font-semibold mb-1">Authentifizierung:</p>
                <p className="text-muted-foreground">Header: <code className="bg-background px-1 rounded">x-api-key: {apiKey ? apiKey.slice(0, 12) + "..." : "ak_..."}</code></p>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="font-semibold mb-1">Beispiel (cURL):</p>
                <div className="bg-background rounded p-2 overflow-x-auto">
                  <code className="text-xs whitespace-pre">{`curl -H "x-api-key: ${apiKey || "YOUR_API_KEY"}" \\\n  ${apiBase}`}</code>
                </div>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => copyToClipboard(`curl -H "x-api-key: ${apiKey}" ${apiBase}`, "cURL-Befehl")}>
                  <Copy className="w-3 h-3 mr-1" /> Kopieren
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============ FTP Upload ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5" /> FTP-Upload</CardTitle>
            <CardDescription>Laden Sie generierte HTML-Seiten direkt auf Ihren Webserver hoch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ftpLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Laden...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Host</Label>
                    <Input placeholder="ftp.mein-autohaus.de" value={ftp.host} onChange={e => setFtp({ ...ftp, host: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Port</Label>
                    <Input type="number" value={ftp.port} onChange={e => setFtp({ ...ftp, port: parseInt(e.target.value) || 21 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Benutzername</Label>
                    <Input value={ftp.username} onChange={e => setFtp({ ...ftp, username: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Passwort</Label>
                    <Input type="password" value={ftp.password} onChange={e => setFtp({ ...ftp, password: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Zielverzeichnis</Label>
                    <Input placeholder="/httpdocs/fahrzeuge/" value={ftp.directory} onChange={e => setFtp({ ...ftp, directory: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={ftp.is_sftp} onCheckedChange={v => setFtp({ ...ftp, is_sftp: v })} />
                    <Label>SFTP verwenden</Label>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={testFtpConnection} disabled={ftpTesting || !ftp.host}>
                    {ftpTesting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                    Verbindung testen
                  </Button>
                  <Button size="sm" onClick={saveFtpConfig} disabled={ftpSaving || !ftp.host}>
                    {ftpSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    Speichern
                  </Button>
                </div>

                {ftpTestResult && (
                  <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${ftpTestResult.success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                    {ftpTestResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {ftpTestResult.message}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  <strong>Hinweis:</strong> Über FTP hochgeladene Seiten sind eigenständige HTML-Dateien ohne Menü-Integration in Ihre Website. Für eine nahtlose Integration nutzen Sie den Embed-Code oder das WordPress-Plugin.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ============ Embed Code ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5" /> Embed-Code</CardTitle>
            <CardDescription>Binden Sie Ihre Fahrzeugangebote direkt auf Ihrer Website ein — SEO-freundlich im DOM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Fahrzeugliste (alle Angebote)</Label>
              <div className="bg-muted rounded-lg p-3">
                <code className="text-xs whitespace-pre-wrap break-all">{embedCode}</code>
              </div>
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => copyToClipboard(embedCode, "Embed-Code")}>
                <Copy className="w-3 h-3 mr-1" /> Code kopieren
              </Button>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Einzelfahrzeug</Label>
              <div className="bg-muted rounded-lg p-3">
                <code className="text-xs whitespace-pre-wrap break-all">{embedSingleCode}</code>
              </div>
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => copyToClipboard(embedSingleCode, "Embed-Code (Einzelfahrzeug)")}>
                <Copy className="w-3 h-3 mr-1" /> Code kopieren
              </Button>
            </div>
            <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Optionale Attribute:</p>
              <p><code>data-theme="dark"</code> — Dunkles Farbschema</p>
              <p><code>data-columns="2"</code> — Spaltenanzahl (Standard: 3)</p>
            </div>
          </CardContent>
        </Card>

        {/* ============ WordPress Plugin ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plug className="w-5 h-5" /> WordPress Plugin</CardTitle>
            <CardDescription>Integrieren Sie Fahrzeugangebote direkt in Ihre WordPress-Seite — SEO-optimiert mit Schema.org</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold">So funktioniert's:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>WordPress-Plugin herunterladen (Ihr API-Key ist bereits hinterlegt)</li>
                <li>Im WordPress-Admin unter <strong>Plugins → Installieren → Plugin hochladen</strong></li>
                <li>Plugin aktivieren — unter <strong>Einstellungen → Autohaus.AI</strong> können Sie den Sync konfigurieren</li>
                <li>Fahrzeuge erscheinen automatisch als eigene Seiten unter <code>/fahrzeuge/</code></li>
              </ol>
            </div>
            <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
              <p className="font-semibold">Features:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Custom Post Type <code>fahrzeug_angebot</code> mit Ihrem Theme-Layout</li>
                <li>Automatischer Sync (stündlich / täglich) + manueller Sync</li>
                <li>Schema.org <code>Car</code> Markup für Google-Suchergebnisse</li>
                <li>Featured Images werden automatisch heruntergeladen</li>
              </ul>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadWordPressPlugin(apiKey, supabaseUrl)} disabled={!apiKey}>
              <Download className="w-3 h-3 mr-1" /> Plugin herunterladen (.php)
            </Button>
          </CardContent>
        </Card>

        {/* ============ API Response Example ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5" /> API-Antwort Beispiel</CardTitle>
            <CardDescription>So sieht die JSON-Antwort der REST API aus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs">{JSON.stringify({
                vehicle: {
                  id: "uuid",
                  title: "BMW 320d M Sport",
                  vehicle_data: {
                    vehicle: { brand: "BMW", model: "320d", year: "2024", price: "45.900 €" },
                    consumption: { combined: "5.2 l/100km", co2: "136 g/km" },
                    finance: { type: "leasing", rate: "399 €/Monat" }
                  },
                  main_image_url: "https://...",
                  images: [{ url: "https://...", perspective: "34_Vorne" }]
                }
              }, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
