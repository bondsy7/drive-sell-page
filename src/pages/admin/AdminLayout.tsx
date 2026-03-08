import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Receipt, MessageSquare, Settings, CreditCard, ArrowLeft, FileText, Mail, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoLight from '@/assets/logo-light.png';

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Übersicht', end: true },
  { to: '/admin/users', icon: Users, label: 'Nutzer' },
  { to: '/admin/transactions', icon: Receipt, label: 'Transaktionen' },
  { to: '/admin/leads', icon: Mail, label: 'Leads' },
  { to: '/admin/pdf-gallery', icon: FileText, label: 'PDF-Galerie' },
  { to: '/admin/prompts', icon: MessageSquare, label: 'Prompts' },
  { to: '/admin/pricing', icon: CreditCard, label: 'Preise' },
  { to: '/admin/settings', icon: Settings, label: 'Einstellungen' },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <>
      <div className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logoLight} alt="Autohaus.AI" className="h-7" />
          <span className="font-display font-bold text-foreground text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">Admin</span>
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={onNavClick}>
          <ArrowLeft className="w-3 h-3" /> Zurück zur App
        </Link>
      </div>
    </>
  );
}

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-border bg-card shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logoLight} alt="Autohaus.AI" className="h-6" />
          <span className="font-display font-bold text-foreground text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">Admin</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-foreground/50" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-card border-r border-border flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <SidebarContent onNavClick={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        <Outlet />
      </main>
    </div>
  );
}
