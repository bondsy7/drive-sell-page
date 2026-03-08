import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  FileText, Sparkles, Image, Calculator, LayoutDashboard,
  Zap, ArrowRight, Shield, Clock, Globe, ChevronRight,
  Bot, Palette, BarChart3, Car, Users, LogOut, User
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';

const FEATURES = [
  {
    icon: FileText,
    title: 'PDF hochladen',
    desc: 'Lade ein Fahrzeugangebot als PDF hoch – unsere KI erkennt automatisch alle relevanten Daten wie Marke, Modell, Preis, Ausstattung und Verbrauchswerte.',
  },
  {
    icon: Bot,
    title: 'KI-Analyse',
    desc: 'Gemini 2.5 Flash analysiert dein PDF in Sekunden und extrahiert alle Fahrzeugdaten – Leasing, Finanzierung oder Kauf werden automatisch erkannt.',
  },
  {
    icon: Image,
    title: 'Bildgenerierung & Remastering',
    desc: 'Generiere fotorealistische Showroom-Bilder mit KI oder lade eigene Fotos hoch und lasse sie professionell aufbereiten.',
  },
  {
    icon: Palette,
    title: 'Template-System',
    desc: 'Wähle aus professionellen Templates wie Autohaus, Modern, Klassisch oder Minimalist – sofort anpassbar und responsive.',
  },
  {
    icon: Calculator,
    title: 'Finanzrechner',
    desc: 'Integrierte Leasing- und Finanzierungsrechner mit Bankauswahl und rechtlichen Hinweisen direkt in der Angebotsseite.',
  },
  {
    icon: Globe,
    title: 'HTML-Export',
    desc: 'Exportiere fertige Landingpages als standalone HTML-Datei – mit CO₂-Label, Kontaktformular und allen Bildern.',
  },
];

const STATS = [
  { value: '< 30s', label: 'PDF-Analyse' },
  { value: '7+', label: 'KI-Perspektiven' },
  { value: '4', label: 'Templates' },
  { value: '100%', label: 'WLTP-konform' },
];

const Landing = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border/50 bg-primary/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={logoDark} alt="Autohaus.AI" className="h-10" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-primary-foreground/70 hover:text-primary-foreground text-sm font-medium transition-colors">Features</a>
            <a href="#workflow" className="text-primary-foreground/70 hover:text-primary-foreground text-sm font-medium transition-colors">So funktioniert's</a>
            <Link to="/pricing" className="text-primary-foreground/70 hover:text-primary-foreground text-sm font-medium transition-colors">Preise</Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/generator">
                  <Button size="sm" className="gradient-accent text-accent-foreground gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Generator
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 gap-1.5">
                    <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                  </Button>
                </Link>
                <Link to="/profile">
                  <Button variant="ghost" size="icon" className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                    <User className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                    Anmelden
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="gradient-accent text-accent-foreground">
                    Kostenlos starten
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--accent)) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }} />
        <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-36">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/20 text-accent text-xs font-semibold mb-8 backdrop-blur-sm">
              <Zap className="w-3.5 h-3.5" />
              Powered by Automotive Intelligence
            </div>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 leading-[1.1] tracking-tight">
              Fahrzeugangebote in
              <span className="block bg-gradient-to-r from-accent to-blue-400 bg-clip-text text-transparent">
                Sekunden erstellen
              </span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/70 mb-10 max-w-2xl mx-auto leading-relaxed">
              Lade ein Fahrzeugangebot als PDF hoch – unsere KI erstellt daraus eine
              professionelle Verkaufsseite mit Bildern, Finanzierung und CO₂-Label.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={user ? '/generator' : '/auth'}>
                <Button size="lg" className="gradient-accent text-accent-foreground text-base px-8 h-12 gap-2 shadow-glow">
                  <Sparkles className="w-5 h-5" />
                  {user ? 'Zum Generator' : 'Jetzt kostenlos starten'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="border-primary-foreground/20 text-primary-foreground bg-transparent hover:bg-primary-foreground/10 text-base px-8 h-12">
                  Features entdecken
                </Button>
              </a>
            </div>
            <p className="text-primary-foreground/40 text-xs mt-6">
              10 kostenlose Credits · Kein Abo nötig · Sofort loslegen
            </p>
          </div>
        </div>
        {/* Gradient fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats Bar */}
      <section className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-2xl md:text-3xl font-bold text-accent">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
              <Clock className="w-3.5 h-3.5" />
              In 3 einfachen Schritten
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              So funktioniert's
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '01', title: 'PDF hochladen', desc: 'Ziehe dein Fahrzeugangebot per Drag & Drop in die App. Leasing, Kauf oder Finanzierung – alles wird erkannt.', icon: FileText },
              { num: '02', title: 'KI analysiert', desc: 'In unter 30 Sekunden extrahiert unsere KI alle Daten: Fahrzeug, Preis, Ausstattung, Verbrauch und mehr.', icon: Bot },
              { num: '03', title: 'Bearbeiten & exportieren', desc: 'Wähle ein Template, bearbeite die Daten und exportiere als fertige HTML-Landingpage mit Bildern und CO₂-Label.', icon: Globe },
            ].map((step) => (
              <div key={step.num} className="relative group">
                <div className="bg-card border border-border rounded-2xl p-8 h-full transition-all hover:shadow-elevated hover:border-accent/30">
                  <div className="text-accent/20 font-display text-5xl font-bold mb-4">{step.num}</div>
                  <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <h3 className="font-display font-bold text-foreground text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28 bg-muted/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Alles was du brauchst
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              Leistungsstarke Features
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Von der PDF-Analyse bis zum fertigen HTML-Export – alles in einer Anwendung.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-2xl p-6 transition-all hover:shadow-elevated hover:border-accent/30 group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:gradient-accent transition-all">
                  <feature.icon className="w-5 h-5 text-accent group-hover:text-accent-foreground transition-colors" />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
              <Users className="w-3.5 h-3.5" />
              Für wen?
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Perfekt für die Automobilbranche
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Autohäuser', desc: 'Erstelle in Minuten professionelle Angebotsseiten für jeden Neuwagen – mit CO₂-Label und Finanzierung.', icon: Car },
              { title: 'Freie Händler', desc: 'Spare dir teure Agenturen. Generiere Verkaufsseiten direkt aus bestehenden PDFs deiner Hersteller.', icon: BarChart3 },
              { title: 'Flottenmanager', desc: 'Verwalte Angebote effizient mit Dashboard, Lead-Management und Batch-Export.', icon: Shield },
            ].map((item) => (
              <div key={item.title} className="bg-card border border-border rounded-2xl p-8 text-center">
                <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="font-display font-bold text-foreground text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 gradient-hero" />
            <div className="absolute inset-0 opacity-[0.05]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--accent)) 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }} />
            <div className="relative p-12 md:p-16 text-center">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Bereit für den Start?
              </h2>
              <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">
                10 kostenlose Credits – kein Abo, keine Kreditkarte. Erstelle deine erste Angebotsseite in unter 2 Minuten.
              </p>
              <Link to={user ? '/generator' : '/auth'}>
                <Button size="lg" className="gradient-accent text-accent-foreground text-base px-8 h-12 gap-2 shadow-glow">
                  <Sparkles className="w-5 h-5" />
                  {user ? 'Zum Generator' : 'Kostenlos starten'}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <img src={logoLight} alt="Autohaus.AI" className="h-8 invert opacity-70" />
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Preise</Link>
              <Link to="/auth" className="hover:text-foreground transition-colors">Anmelden</Link>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Autohaus.AI · Alle Rechte vorbehalten</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
