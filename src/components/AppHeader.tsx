import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Calculator, Receipt, User, Plug, ShieldCheck, LogOut, ChevronDown, CreditCard, LogIn,
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
              {/* New Project */}
              <Link to="/generator">
                <Button size="sm" className="gap-1.5 text-xs sm:text-sm">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Neues Projekt</span>
                  <span className="sm:hidden">Neu</span>
                </Button>
              </Link>

              {/* Rechner Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-1.5 hidden sm:inline-flex ${ghostClass}`}>
                    <Calculator className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Rechner</span>
                    <ChevronDown className="w-3 h-3" />
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

              {/* Profile */}
              <Link to="/profile" className="hidden sm:inline-flex">
                <Button variant="ghost" size="icon" className={ghostClass} title="Profil">
                  <User className={iconClass} />
                </Button>
              </Link>

              {/* Integrations */}
              <Link to="/integrations" className="hidden sm:inline-flex">
                <Button variant="ghost" size="icon" className={ghostClass} title="Schnittstellen">
                  <Plug className={iconClass} />
                </Button>
              </Link>

              {/* Pricing */}
              <Link to="/pricing">
                <Button variant="ghost" size="icon" className={ghostClass} title="Credits & Pläne">
                  <CreditCard className={iconClass} />
                </Button>
              </Link>

              {/* Admin */}
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="icon" title="Admin-Bereich" className={`hover:bg-accent group ${ghostClass}`}>
                    <ShieldCheck className="w-4 h-4 text-accent group-hover:text-accent-foreground transition-colors" />
                  </Button>
                </Link>
              )}

              {/* Credits */}
              <CreditBadge />

              {/* Logout */}
              <Button variant="ghost" size="icon" onClick={signOut} className={ghostClass} title="Abmelden">
                <LogOut className={iconClass} />
              </Button>
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

      {/* Mobile quick links – only for logged-in users */}
      {user && (
        <div className="flex gap-2 px-3 pb-2 overflow-x-auto sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs whitespace-nowrap">
                <Calculator className="w-3 h-3" /> Rechner <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild><Link to="/leasing-rechner" className="flex items-center gap-2"><Calculator className="w-4 h-4" /> Leasing</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/finanzierungsrechner" className="flex items-center gap-2"><Calculator className="w-4 h-4" /> Finanzierung</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/kfz-steuer-rechner" className="flex items-center gap-2"><Receipt className="w-4 h-4" /> Kfz-Steuer</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/profile"><Button variant="outline" size="sm" className="gap-1 text-xs whitespace-nowrap"><User className="w-3 h-3" /> Profil</Button></Link>
          <Link to="/integrations"><Button variant="outline" size="sm" className="gap-1 text-xs whitespace-nowrap"><Plug className="w-3 h-3" /> API</Button></Link>
        </div>
      )}
    </header>
  );
}
