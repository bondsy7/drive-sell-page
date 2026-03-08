import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Copy, Check, ChevronDown, ChevronRight,
  Key, List, FileText, Code2, Globe, Zap, Shield
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-vehicles`;

const CodeBlock = ({ language, code, title }: { language: string; code: string; title?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-primary/95">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-primary/80">
          <span className="text-xs text-primary-foreground/50 font-mono">{title}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-primary-foreground/30 uppercase tracking-wider">{language}</span>
            <button onClick={handleCopy} className="text-primary-foreground/40 hover:text-primary-foreground transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-primary-foreground/90 font-mono text-[13px]">{code}</code>
      </pre>
    </div>
  );
};

const EndpointCard = ({
  method,
  path,
  description,
  responseExample,
  responseSchema,
  curlExample,
  jsExample,
}: {
  method: string;
  path: string;
  description: string;
  responseExample: string;
  responseSchema: string;
  curlExample: string;
  jsExample: string;
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'curl' | 'js' | 'response' | 'schema'>('curl');

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card transition-all hover:shadow-elevated">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="shrink-0 px-3 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs font-bold font-mono uppercase tracking-wider">
          {method}
        </span>
        <span className="font-mono text-sm text-foreground font-medium">{path}</span>
        <span className="hidden sm:block text-muted-foreground text-sm ml-2 truncate">{description}</span>
        <span className="ml-auto shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-border p-5 space-y-4">
          <p className="text-muted-foreground text-sm">{description}</p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit">
            {([
              { key: 'curl', label: 'cURL' },
              { key: 'js', label: 'JavaScript' },
              { key: 'response', label: 'Antwort' },
              { key: 'schema', label: 'Schema' },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'curl' && <CodeBlock language="bash" code={curlExample} title="cURL Beispiel" />}
          {tab === 'js' && <CodeBlock language="javascript" code={jsExample} title="JavaScript / fetch" />}
          {tab === 'response' && <CodeBlock language="json" code={responseExample} title="Beispiel-Antwort (JSON)" />}
          {tab === 'schema' && <CodeBlock language="typescript" code={responseSchema} title="TypeScript Schema" />}
        </div>
      )}
    </div>
  );
};

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api-vehicles',
    description: 'Liste aller Fahrzeuge des authentifizierten Nutzers',
    curlExample: `curl -X GET \\
  "${BASE_URL}" \\
  -H "x-api-key: ak_dein_api_key"`,
    jsExample: `const response = await fetch("${BASE_URL}", {
  headers: {
    "x-api-key": "ak_dein_api_key"
  }
});
const data = await response.json();
console.log(data.vehicles);`,
    responseExample: `{
  "vehicles": [
    {
      "id": "a1b2c3d4-...",
      "title": "BMW 320i M Sport",
      "template_id": "modern",
      "vehicle_data": {
        "vehicle": {
          "brand": "BMW",
          "model": "320i M Sport",
          "year": "2024",
          "price": "45.900 €",
          "mileage": "0 km",
          "fuel": "Benzin",
          "power": "184 PS",
          "transmission": "Automatik"
        },
        "consumption": { ... },
        "finance": { ... }
      },
      "main_image_url": "https://...",
      "created_at": "2026-03-08T12:00:00Z",
      "updated_at": "2026-03-08T14:30:00Z"
    }
  ]
}`,
    responseSchema: `interface VehiclesListResponse {
  vehicles: Array<{
    id: string;
    title: string;
    template_id: string;
    vehicle_data: VehicleData;
    main_image_url: string | null;
    created_at: string;   // ISO 8601
    updated_at: string;   // ISO 8601
  }>;
}

interface VehicleData {
  vehicle: {
    brand: string;
    model: string;
    year: string;
    price: string;
    mileage: string;
    fuel: string;
    power: string;
    transmission: string;
    color?: string;
    doors?: string;
    seats?: string;
  };
  consumption?: ConsumptionData;
  finance?: FinanceData;
  features?: string[];
  dealer?: DealerData;
}`,
  },
  {
    method: 'GET',
    path: '/api-vehicles/:id',
    description: 'Detailansicht eines einzelnen Fahrzeugs inkl. Bilder',
    curlExample: `curl -X GET \\
  "${BASE_URL}/a1b2c3d4-..." \\
  -H "x-api-key: ak_dein_api_key"`,
    jsExample: `const vehicleId = "a1b2c3d4-...";
const response = await fetch(
  \`${BASE_URL}/\${vehicleId}\`,
  { headers: { "x-api-key": "ak_dein_api_key" } }
);
const data = await response.json();
console.log(data.vehicle);`,
    responseExample: `{
  "vehicle": {
    "id": "a1b2c3d4-...",
    "title": "BMW 320i M Sport",
    "template_id": "modern",
    "vehicle_data": {
      "vehicle": { "brand": "BMW", "model": "320i M Sport", ... },
      "consumption": {
        "combined": "6.5",
        "co2": "148",
        "co2Class": "D",
        "energySource": "Benzin"
      },
      "finance": {
        "type": "Leasing",
        "monthlyRate": "399 €",
        "duration": "48 Monate",
        "downPayment": "5.000 €"
      }
    },
    "main_image_url": "https://...",
    "images": [
      {
        "id": "img-001",
        "url": "https://...",
        "perspective": "34_Vorne",
        "sort_order": 0
      },
      {
        "id": "img-002",
        "url": "https://...",
        "perspective": "Seite",
        "sort_order": 1
      }
    ],
    "created_at": "2026-03-08T12:00:00Z",
    "updated_at": "2026-03-08T14:30:00Z"
  }
}`,
    responseSchema: `interface VehicleDetailResponse {
  vehicle: {
    id: string;
    title: string;
    template_id: string;
    vehicle_data: VehicleData;
    main_image_url: string | null;
    images: Array<{
      id: string;
      url: string | null;
      perspective: string | null;
      sort_order: number | null;
    }>;
    created_at: string;
    updated_at: string;
  };
}`,
  },
  {
    method: 'GET',
    path: '/api-vehicles/:id/html',
    description: 'HTML-Fragment der Fahrzeug-Landingpage (ohne <html>/<body> Wrapper)',
    curlExample: `curl -X GET \\
  "${BASE_URL}/a1b2c3d4-.../html" \\
  -H "x-api-key: ak_dein_api_key"`,
    jsExample: `const vehicleId = "a1b2c3d4-...";
const response = await fetch(
  \`${BASE_URL}/\${vehicleId}/html\`,
  { headers: { "x-api-key": "ak_dein_api_key" } }
);
const html = await response.text();
// Direkt in ein DOM-Element einfügen:
document.getElementById("vehicle-container").innerHTML = html;`,
    responseExample: `<!-- HTML-Fragment (Content-Type: text/html) -->
<div class="vehicle-landing">
  <div class="vehicle-hero">
    <img src="https://..." alt="BMW 320i M Sport" />
    <h1>BMW 320i M Sport</h1>
    <p class="price">45.900 €</p>
  </div>
  <div class="vehicle-specs">
    <div class="spec-row">
      <span>Kraftstoff</span>
      <span>Benzin</span>
    </div>
    <!-- ... weitere Specs ... -->
  </div>
  <!-- CO₂-Label, Finanzierung, etc. -->
</div>`,
    responseSchema: `// Rückgabe: text/html (kein JSON)
// Der HTML-Body-Inhalt der generierten Landingpage
// ohne <html>, <head>, <body> Wrapper.
//
// Perfekt zum Einbetten in bestehende Seiten:
//   - WordPress via innerHTML
//   - iFrame srcdoc
//   - Server-Side Include

type HTMLFragmentResponse = string;`,
  },
];

const ApiDocs = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-primary/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <img src={logoDark} alt="Autohaus.AI" className="h-8" />
            </Link>
            <span className="text-primary-foreground/30 text-sm">/</span>
            <span className="text-primary-foreground/80 text-sm font-medium">API Dokumentation</span>
          </div>
          <Link to="/integrations">
            <Button variant="ghost" size="sm" className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Schnittstellen
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
            <Code2 className="w-3.5 h-3.5" />
            REST API v1
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
            API Dokumentation
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg">
            Greife per REST API auf deine Fahrzeugdaten zu. Perfekt für die Integration in CMS, Websites oder eigene Anwendungen.
          </p>
        </div>

        {/* Quick Start */}
        <div className="mb-12 space-y-6">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" /> Schnellstart
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Key, title: '1. API-Key holen', desc: 'Unter Schnittstellen findest du deinen persönlichen API-Key.' },
              { icon: Globe, title: '2. Request senden', desc: 'Sende GET-Requests mit dem Header x-api-key an die API.' },
              { icon: FileText, title: '3. Daten nutzen', desc: 'Erhalte JSON-Daten oder fertige HTML-Fragmente zum Einbetten.' },
            ].map((step) => (
              <div key={step.title} className="bg-card border border-border rounded-xl p-5">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                  <step.icon className="w-4.5 h-4.5 text-accent" />
                </div>
                <h3 className="font-display font-bold text-foreground text-sm mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Auth Section */}
        <div className="mb-12 space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" /> Authentifizierung
          </h2>
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <p className="text-muted-foreground text-sm">
              Alle API-Requests erfordern einen gültigen API-Key im Header. Der Key wird automatisch bei der Registrierung generiert und kann jederzeit unter <Link to="/integrations" className="text-accent hover:underline">Schnittstellen</Link> eingesehen oder erneuert werden.
            </p>
            <CodeBlock
              language="http"
              code={`GET /api-vehicles HTTP/1.1
Host: ${import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || 'your-project.supabase.co'}
x-api-key: ak_dein_api_key_hier`}
              title="Header-Format"
            />
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive font-medium">⚠️ Sicherheitshinweis</p>
              <p className="text-sm text-muted-foreground mt-1">
                Verwende deinen API-Key niemals in clientseitigem JavaScript. Nutze stattdessen einen Backend-Proxy oder Server-Side-Rendering.
              </p>
            </div>
          </div>
        </div>

        {/* Base URL */}
        <div className="mb-12 space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent" /> Base URL
          </h2>
          <CodeBlock language="text" code={BASE_URL} title="API Basis-URL" />
        </div>

        {/* Endpoints */}
        <div className="mb-12 space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <List className="w-5 h-5 text-accent" /> Endpunkte
          </h2>
          <div className="space-y-3">
            {ENDPOINTS.map((ep) => (
              <EndpointCard key={ep.path} {...ep} />
            ))}
          </div>
        </div>

        {/* Error Codes */}
        <div className="mb-12 space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground">Fehlercodes</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium">Code</th>
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium">Bedeutung</th>
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium hidden sm:table-cell">Lösung</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: '401', meaning: 'Unauthorized', fix: 'API-Key prüfen oder neu generieren' },
                  { code: '404', meaning: 'Not Found', fix: 'Fahrzeug-ID existiert nicht oder gehört einem anderen Nutzer' },
                  { code: '405', meaning: 'Method Not Allowed', fix: 'Nur GET-Requests werden unterstützt' },
                  { code: '500', meaning: 'Internal Server Error', fix: 'Interner Fehler – bitte erneut versuchen' },
                ].map((err) => (
                  <tr key={err.code} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-mono text-destructive font-medium">{err.code}</td>
                    <td className="px-5 py-3 text-foreground">{err.meaning}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{err.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="mb-12 space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground">Rate Limiting & Limits</h2>
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <p className="text-muted-foreground text-sm">
              Aktuell gibt es kein explizites Rate Limiting. Bitte sende maximal <strong className="text-foreground">60 Requests pro Minute</strong> und <strong className="text-foreground">1000 pro Stunde</strong> um eine faire Nutzung zu gewährleisten.
            </p>
            <p className="text-muted-foreground text-sm">
              Die Fahrzeugliste gibt maximal <strong className="text-foreground">1000 Einträge</strong> pro Anfrage zurück.
            </p>
          </div>
        </div>

        {/* Integration Examples */}
        <div className="mb-16 space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground">Integrations-Beispiele</h2>

          <div className="space-y-4">
            <CodeBlock
              language="php"
              title="WordPress / PHP"
              code={`<?php
$api_key = 'ak_dein_api_key';
$api_url = '${BASE_URL}';

$response = wp_remote_get($api_url, [
    'headers' => ['x-api-key' => $api_key]
]);

$vehicles = json_decode(
    wp_remote_retrieve_body($response), true
);

foreach ($vehicles['vehicles'] as $vehicle) {
    echo '<h2>' . esc_html($vehicle['title']) . '</h2>';
    echo '<p>' . esc_html(
        $vehicle['vehicle_data']['vehicle']['price']
    ) . '</p>';
}`}
            />

            <CodeBlock
              language="python"
              title="Python"
              code={`import requests

API_KEY = "ak_dein_api_key"
BASE_URL = "${BASE_URL}"

# Alle Fahrzeuge abrufen
response = requests.get(
    BASE_URL,
    headers={"x-api-key": API_KEY}
)
vehicles = response.json()["vehicles"]

for v in vehicles:
    print(f"{v['title']} - {v['vehicle_data']['vehicle']['price']}")

# Einzelnes Fahrzeug als HTML
html = requests.get(
    f"{BASE_URL}/{vehicles[0]['id']}/html",
    headers={"x-api-key": API_KEY}
).text`}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Autohaus.AI</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Startseite</Link>
            <Link to="/integrations" className="hover:text-foreground transition-colors">Schnittstellen</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Preise</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ApiDocs;
