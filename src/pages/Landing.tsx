import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Camera, Sparkles, Image, Globe, ArrowRight, ChevronRight,
  Bot, Palette, BarChart3, Car, Users, LogOut, User,
  LayoutDashboard, Video, FileText, Megaphone, Shield, ScanLine,
  Smartphone, Zap, RotateCcw
} from 'lucide-react';
import auto3Logo from '@/assets/auto3-logo.png';

/* ─── POA Feature Cards ─── */
const POA_STEPS = [
  {
    num: '01',
    icon: Camera,
    title: 'Ankunft am Hof',
    subtitle: 'Handyfoto & VIN-Scan',
    desc: 'Auto kommt an – Handy zücken, Foto machen. Unsere KI erkennt Marke, Modell und Ausstattung sofort per VIN/WMI-Lookup.',
  },
  {
    num: '02',
    icon: Sparkles,
    title: 'KI-Veredelung',
    subtitle: 'Fotorealistischer Showroom',
    desc: 'In Sekunden generiert AUTO3 aus deinem Handyfoto 18+ fotorealistische Perspektiven im Premium-Showroom – inklusive 360°-Spin.',
  },
  {
    num: '03',
    icon: Megaphone,
    title: 'Sofort vermarkten',
    subtitle: 'Banner, Videos & Landing Pages',
    desc: 'Banner für Social Media, Reels-Videos und SEO-optimierte Angebotsseiten – alles vollautomatisch in Minuten fertig.',
  },
];

const TOOLS = [
  {
    icon: Image,
    title: 'Visual AI Engine',
    desc: 'Fotorealistische Showroom-Bilder aus einfachen Handyfotos. 18+ Perspektiven, Innenraum & Außenansicht.',
  },
  {
    icon: RotateCcw,
    title: '360° Spin Generator',
    desc: 'Interaktive 360°-Fahrzeugansichten aus Bildern oder Videos. Bis zu 72 Frames für maximale Immersion.',
  },
  {
    icon: Palette,
    title: 'Banner Architect',
    desc: 'Verkaufsfertige Werbemittel für alle Social-Media-Formate. Instagram, Facebook, TikTok – ein Klick.',
  },
  {
    icon: Video,
    title: 'Cinematic Video Engine',
    desc: 'Dynamische Showroom-Videos für Reels & Stories. Maximale Aufmerksamkeit auf allen Kanälen.',
  },
  {
    icon: FileText,
    title: 'PDF Intelligence Converter',
    desc: 'Einkaufs-PDFs werden zu SEO-optimierten HTML-Landingpages mit CO₂-Label, Finanzrechner und Kontaktformular.',
  },
  {
    icon: Bot,
    title: 'KI-Verkaufsassistent',
    desc: 'Lead-Management & automatisierte Kundenkommunikation rund um die Uhr. CRM inklusive.',
  },
];

const AUDIENCES = [
  { icon: Car, title: 'Autohäuser', desc: 'Maximiere deine Marge durch minimale Standzeiten und professionelle CI-Pipelines.' },
  { icon: BarChart3, title: 'Freie Händler', desc: 'Nutze High-End-Technologie ohne teure Agenturkosten.' },
  { icon: Users, title: 'Privatpersonen', desc: 'Verkaufe dein Auto wie ein Profi mit Bildern, die Käufer begeistern.' },
];

const Landing = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navigation ── */}
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={auto3Logo} alt="AUTO3" className="h-8 sm:h-10" />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#poa" className="text-foreground/60 hover:text-foreground text-sm font-medium transition-colors">So funktioniert's</a>
            <a href="#tools" className="text-foreground/60 hover:text-foreground text-sm font-medium transition-colors">Werkzeuge</a>
            <Link to="/pricing" className="text-foreground/60 hover:text-foreground text-sm font-medium transition-colors">Preise</Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/generator">
                  <Button size="sm" className="gradient-accent text-accent-foreground gap-1.5 text-xs sm:text-sm">
                    <Sparkles className="w-3.5 h-3.5" /> Generator
                  </Button>
                </Link>
                <Link to="/dashboard" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-foreground/60 hover:text-foreground">
                    <LayoutDashboard className="w-3.5 h-3.5" /> <span className="hidden md:inline">Dashboard</span>
                  </Button>
                </Link>
                <Link to="/profile" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="icon" className="text-foreground/60 hover:text-foreground">
                    <User className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={signOut} className="text-foreground/60 hover:text-foreground">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm" className="text-foreground/60 hover:text-foreground">Anmelden</Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="gradient-accent text-accent-foreground text-xs sm:text-sm">
                    Kostenlos starten
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/8 border border-accent/15 text-accent text-xs font-bold mb-8 tracking-wide uppercase">
              <Zap className="w-3.5 h-3.5" />
              POA – Point of Arrival
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.08] tracking-tight">
              Verwandle die Ankunft
              <span className="block text-accent">in ein Erlebnis.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              AUTO3 ist der Moment, in dem ein einfaches Handyfoto zur fotorealistischen
              Showroom-Inszenierung wird. Minimale Standzeiten, maximale Marge – durch KI-gestützte Ästhetik.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={user ? '/generator' : '/auth'}>
                <Button size="lg" className="gradient-accent text-accent-foreground text-base px-8 h-13 gap-2 shadow-glow">
                  <Sparkles className="w-5 h-5" />
                  {user ? 'Zum Generator' : 'Jetzt kostenlos starten'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#poa">
                <Button variant="outline" size="lg" className="text-base px-8 h-13 border-border hover:bg-secondary">
                  So funktioniert's
                </Button>
              </a>
            </div>
            <p className="text-muted-foreground/60 text-xs mt-6">
              10 kostenlose Credits · Kein Abo nötig · Sofort loslegen
            </p>
          </div>
        </div>
        {/* Subtle decorative dots */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 0.5px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </section>

      {/* ── Stats Strip ── */}
      <section className="border-y border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '< 30s', label: 'Verarbeitungszeit' },
            { value: '18+', label: 'KI-Perspektiven' },
            { value: '360°', label: 'Interaktive Spins' },
            { value: '100%', label: 'WLTP-konform' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-2xl md:text-3xl font-bold text-accent">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── POA Workflow ── */}
      <section id="poa" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/8 text-accent text-xs font-bold mb-4 tracking-wide uppercase">
              <Smartphone className="w-3.5 h-3.5" />
              Der POA-Workflow
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              Vom Hof ins Internet in 3 Akten
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Point of Arrival – das Fahrzeug kommt an und alles passiert automatisch.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {POA_STEPS.map((step) => (
              <div key={step.num} className="relative group">
                <div className="bg-card border border-border rounded-2xl p-8 h-full transition-all hover:shadow-elevated hover:border-accent/25">
                  <div className="text-accent/15 font-display text-6xl font-bold mb-3 leading-none">{step.num}</div>
                  <div className="w-11 h-11 rounded-xl gradient-accent flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <h3 className="font-display font-bold text-foreground text-lg mb-1">{step.title}</h3>
                  <p className="text-accent text-sm font-medium mb-3">{step.subtitle}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tool Suite ── */}
      <section id="tools" className="py-20 md:py-28 bg-card">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/8 text-accent text-xs font-bold mb-4 tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Die Werkzeuge
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              Marketing & Sales Intelligence
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Alles, was du brauchst – von der Bildveredelung bis zum Verkaufsabschluss.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TOOLS.map((tool) => (
              <div
                key={tool.title}
                className="bg-background border border-border rounded-2xl p-6 transition-all hover:shadow-elevated hover:border-accent/25 group"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/8 flex items-center justify-center mb-4 group-hover:gradient-accent transition-all">
                  <tool.icon className="w-5 h-5 text-accent group-hover:text-accent-foreground transition-colors" />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">{tool.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Audiences ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/8 text-accent text-xs font-bold mb-4 tracking-wide uppercase">
              <Shield className="w-3.5 h-3.5" />
              Perfekt für die Automobilbranche
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Unsere Zielgruppen
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="bg-card border border-border rounded-2xl p-8 text-center transition-all hover:shadow-elevated">
                <div className="w-14 h-14 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-5">
                  <a.icon className="w-7 h-7 text-accent-foreground" />
                </div>
                <h3 className="font-display font-bold text-foreground text-lg mb-2">{a.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 gradient-hero" />
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--accent)) 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }} />
            <div className="relative p-12 md:p-16 text-center">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Bereit für den Start?
              </h2>
              <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">
                10 kostenlose Credits – kein Abo, keine Kreditkarte. Erlebe POA live in unter 2 Minuten.
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

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card py-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <img src={auto3Logo} alt="AUTO3" className="h-7 opacity-60" />
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Preise</Link>
              <Link to="/auth" className="hover:text-foreground transition-colors">Anmelden</Link>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} AUTO3 · Alle Rechte vorbehalten</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
