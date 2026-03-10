import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Calculator, Receipt, User, Plug, ShieldCheck, LogOut, ChevronDown, CreditCard, LogIn, LayoutDashboard, MoreVertical,
} from 'lucide-react';
import logoLight from '@/assets/logo-light.png';
import CreditBadge from '@/components/CreditBadge';

interface AppHeaderProps {
  leftActions?: React.ReactNode;
  variant?: 'card' | 'primary';
}

export default function AppHeader({ leftActions, variant = 'card' }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc('has_role' as any, { _user_id: user.id, _role: 'admin' }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const logoLink = user ? '/dashboard' : '/';

  const isCard = variant === 'card';
  const headerBg = isCard
    ? 'border-b border-border bg-card/80 backdrop-blur-sm'
    : 'border-b border-border bg-primary';
  const ghostClass = isCard
    ? ''
    : 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10';
  const iconClass = 'w-4 h-4';

  return (
    <header className={`${headerBg} sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        {/* Left: Logo */}
        <Link to={logoLink} className="flex items-center shrink-0">
          <img src={logoLight} alt="Autohaus.AI" className="h-7 sm:h-8" />
        </Link>

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {leftActions}

          {user ? (
            <>
              {/* Dashboard */}
              <Link to="/dashboard">
                <Button variant="ghost" size="icon" className={ghostClass} title="Dashboard">
                  <LayoutDashboard className={iconClass} />
                </Button>
              </Link>

              {/* New Project */}
              <Link to="/generator">
                <Button size="sm" className="gap-1.5 text-xs sm:text-sm">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Neues Projekt</span>
                  <span className="sm:hidden">Neu</span>
                </Button>
              </Link>

              {/* Rechner Dropdown – icon only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={`hidden sm:inline-flex ${ghostClass}`} title="Rechner">
                    <Calculator className={iconClass} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/leasing-rechner" className="flex items-center gap-2">
                      <Calculator className="w-4 h-4" /> Leasing-Rechner
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/finanzierungsrechner" className="flex items-center gap-2">
                      <Calculator className="w-4 h-4" /> Finanzierungsrechner
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/kfz-steuer-rechner" className="flex items-center gap-2">
                      <Receipt className="w-4 h-4" /> Kfz-Steuer-Rechner
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Credits */}
              <CreditBadge />

              {/* More menu dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={ghostClass} title="Menü">
                    <MoreVertical className={iconClass} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="w-4 h-4" /> Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/integrations" className="flex items-center gap-2">
                      <Plug className="w-4 h-4" /> Schnittstellen
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/pricing" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Credits & Pläne
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-accent" /> Admin-Bereich
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4" /> Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {/* Pricing (public) */}
              <Link to="/pricing">
                <Button variant="ghost" size="sm" className={`gap-1.5 ${ghostClass}`}>
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Preise</span>
                </Button>
              </Link>

              {/* Login */}
              <Link to="/auth">
                <Button size="sm" className="gap-1.5">
                  <LogIn className="w-3.5 h-3.5" />
                  Anmelden
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
