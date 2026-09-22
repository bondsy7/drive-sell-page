import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, LogOut } from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function PublicHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo className="h-7 sm:h-8" />
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Hauptnavigation">
          <Link to="/produkte" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Produkte</Link>
          <Link to="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Preise</Link>
          <Link to="/referenzen" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Referenzen</Link>
          <a href="/#unternehmen" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Unternehmen</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/dashboard"><LayoutDashboard className="h-4 w-4" /> Übersicht</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/generator">Zum Portal <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Abmelden">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Anmelden</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth?plan=free">Jetzt starten <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}