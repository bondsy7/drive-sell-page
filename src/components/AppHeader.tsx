import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, LogIn, MessageSquare, Home } from 'lucide-react';
import logoLight from '@/assets/logo-light.png';
import CreditBadge from '@/components/CreditBadge';
import UserMenuSheet from '@/components/UserMenuSheet';
import SalesChatWidget, { useSalesChatUnread } from '@/components/sales/SalesChatWidget';

interface AppHeaderProps {
  leftActions?: React.ReactNode;
  variant?: 'card' | 'primary';
}

export default function AppHeader({ leftActions, variant = 'card' }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { unreadCount } = useSalesChatUnread();

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
    <>
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

                {/* Credits */}
                <CreditBadge />

                {/* Dashboard Home */}
                <Link to="/dashboard">
                  <Button variant="ghost" size="icon" className={ghostClass} title="Dashboard">
                    <Home className={iconClass} />
                  </Button>
                </Link>

                {/* Chat icon */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative ${ghostClass}`}
                  title="KI Verkaufsassistent"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageSquare className={iconClass} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>

                {/* Tabbed user menu */}
                <UserMenuSheet
                  isAdmin={isAdmin}
                  ghostClass={ghostClass}
                  iconClass={iconClass}
                  onSignOut={signOut}
                />
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

      {/* Chat Drawer */}
      {user && <SalesChatWidget open={chatOpen} onOpenChange={setChatOpen} />}
    </>
  );
}
