import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function HomeHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo className="h-7 sm:h-8" />
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Hauptnavigation">
          <a href="#so-funktionierts" className="text-sm text-muted-foreground transition-colors hover:text-foreground">So funktioniert’s</a>
          <a href="#ergebnisse" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Ergebnisse</a>
          <Link to="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Preise</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link to="/dashboard"><LayoutDashboard className="h-4 w-4" /> Zum Portal</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Anmelden</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/fahrzeug-testen?source=startseite">
                  <span className="hidden sm:inline">Eigenes Fahrzeug testen</span>
                  <span className="sm:hidden">Testen</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
