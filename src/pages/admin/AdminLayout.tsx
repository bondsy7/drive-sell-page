import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Receipt, MessageSquare, Settings, CreditCard, ArrowLeft, FileText, Mail, Menu, X, Car, Hash, ShieldCheck, BookOpen, Activity, Send, TrendingUp, HardDrive, Filter, CalendarDays, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import logoLight from '@/assets/logo-light.png';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  end?: boolean;
}

interface NavGroupDef {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    label: 'Übersicht',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Nutzer & Abos',
    items: [
      { to: '/admin/users', icon: Users, label: 'Nutzer' },
      { to: '/admin/transactions', icon: Receipt, label: 'Transaktionen' },
      { to: '/admin/revenue', icon: TrendingUp, label: 'Umsatz & Abos' },
      { to: '/admin/pricing', icon: CreditCard, label: 'Preise' },
    ],
  },
  {
    label: 'Inhalte & Daten',
    items: [
      { to: '/admin/leads', icon: Mail, label: 'Leads' },
      { to: '/admin/pdf-gallery', icon: FileText, label: 'PDF-Galerie' },
      { to: '/admin/logos', icon: Car, label: 'Hersteller-Logos' },
      { to: '/admin/wmi-codes', icon: Hash, label: 'WMI-Codes & Aliase' },
      { to: '/admin/sales-assistant', icon: MessageSquare, label: 'Sales-Assistent' },
      { to: '/admin/prompts', icon: BookOpen, label: 'Prompts' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/admin/jobs', icon: Activity, label: 'Job-Monitor' },
      { to: '/admin/email-monitor', icon: Send, label: 'E-Mail-Monitor' },
      { to: '/admin/storage', icon: HardDrive, label: 'Storage' },
      { to: '/admin/conversion', icon: Filter, label: 'Conversion-Funnel' },
      { to: '/admin/test-drives', icon: CalendarDays, label: 'Probefahrten' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/settings', icon: Settings, label: 'Einstellungen' },
      { to: '/admin/secrets', icon: ShieldCheck, label: 'API-Keys' },
      { to: '/architecture', icon: BookOpen, label: 'Architektur' },
    ],
  },
];

function NavGroup({ group, onNavClick }: { group: typeof NAV_GROUPS[number]; onNavClick?: () => void }) {
  // Single-item groups (Dashboard) render without collapsible wrapper
  if (group.items.length === 1 && group.label === 'Übersicht') {
    const item = group.items[0];
    return (
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavClick}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )
        }
      >
        <item.icon className="w-4 h-4" />
        {item.label}
      </NavLink>
    );
  }

  return (
    <Collapsible defaultOpen className="space-y-0.5">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors group">
        {group.label}
        <ChevronDown className="w-3 h-3 transition-transform group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {group.items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-1',
                isActive ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <>
      <div className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logoLight} alt="Autohaus.AI" className="h-7" />
          <span className="font-display font-bold text-foreground text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">Admin</span>
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.label} group={group} onNavClick={onNavClick} />
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
      <aside className="hidden md:flex w-56 border-r border-border bg-card shrink-0 flex-col">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logoLight} alt="Autohaus.AI" className="h-6" />
          <span className="font-display font-bold text-foreground text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">Admin</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

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