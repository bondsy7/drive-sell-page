import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Receipt, MessageSquare, Settings, CreditCard, ArrowLeft } from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Übersicht', end: true },
  { to: '/admin/users', icon: Users, label: 'Nutzer' },
  { to: '/admin/transactions', icon: Receipt, label: 'Transaktionen' },
  { to: '/admin/prompts', icon: MessageSquare, label: 'Prompts' },
  { to: '/admin/pricing', icon: CreditCard, label: 'Preise' },
  { to: '/admin/settings', icon: Settings, label: 'Einstellungen' },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 border-r border-border bg-card shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoDark} alt="Autohaus.AI" className="h-7" />
            <span className="font-display font-bold text-foreground text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" /> Zurück zur App
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
