import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, RefreshCw, Key, Code, Globe, Plug } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import logoLight from "@/assets/logo-light.png";

export default function Integrations() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiBase = `${supabaseUrl}/functions/v1/api-vehicles`;

  useEffect(() => {
    if (!user) return;
    loadApiKey();
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

  const regenerateKey = async () => {
    setRegenerating(true);
    // Generate a new key client-side
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert`);
  };

  const embedCode = `<div id="autohaus-ai-vehicles"></div>
<script src="${window.location.origin}/embed.js" data-api-key="${apiKey}"></script>`;

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

        {/* API Key Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> API-Zugang</CardTitle>
            <CardDescription>Ihr persönlicher API-Key für den Zugriff auf die REST API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={loading ? "Laden..." : apiKey}
                className="font-mono text-sm"
              />
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
                <div className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold shrink-0">GET</span>
                  <div>
                    <p className="break-all">{apiBase}</p>
                    <p className="text-muted-foreground font-sans">Liste aller Fahrzeuge</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold shrink-0">GET</span>
                  <div>
                    <p className="break-all">{apiBase}/<span className="text-primary">:id</span></p>
                    <p className="text-muted-foreground font-sans">Einzelnes Fahrzeug als JSON</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold shrink-0">GET</span>
                  <div>
                    <p className="break-all">{apiBase}/<span className="text-primary">:id</span>/html</p>
                    <p className="text-muted-foreground font-sans">HTML-Fragment zum Einbetten</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="font-semibold mb-1">Authentifizierung:</p>
                <p className="text-muted-foreground">Header: <code className="bg-background px-1 rounded">x-api-key: {apiKey ? apiKey.slice(0, 12) + "..." : "ak_..."}</code></p>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
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

        {/* Embed Code Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5" /> Embed-Code</CardTitle>
            <CardDescription>Binden Sie Ihre Fahrzeugangebote direkt auf Ihrer Website ein — SEO-freundlich im DOM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted rounded-lg p-4">
              <code className="text-xs whitespace-pre-wrap break-all">{embedCode}</code>
            </div>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(embedCode, "Embed-Code")}>
              <Copy className="w-3 h-3 mr-1" /> Code kopieren
            </Button>
            <p className="text-xs text-muted-foreground">
              Fügen Sie diesen Code auf Ihrer Website ein. Das Script lädt Ihre Fahrzeugangebote und rendert sie direkt in die Seite.
            </p>
          </CardContent>
        </Card>

        {/* WordPress Plugin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plug className="w-5 h-5" /> WordPress Plugin</CardTitle>
            <CardDescription>Integrieren Sie Fahrzeugangebote direkt in Ihre WordPress-Seite — SEO-optimiert und im Theme-Layout</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold">So funktioniert's:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>WordPress-Plugin herunterladen</li>
                <li>Im WordPress-Admin unter <strong>Plugins → Installieren → Plugin hochladen</strong></li>
                <li>Plugin aktivieren und unter <strong>Einstellungen → Autohaus.AI</strong> den API-Key eintragen</li>
                <li>Fahrzeuge erscheinen automatisch als eigene Seiten</li>
              </ol>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Globe className="w-3 h-3 mr-1" /> Plugin herunterladen (demnächst verfügbar)
            </Button>
          </CardContent>
        </Card>

        {/* API Response Example */}
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
