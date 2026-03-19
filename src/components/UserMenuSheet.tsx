import { Link } from 'react-router-dom';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  MoreVertical, User, Plug, CreditCard, ShieldCheck, LogOut,
  Calculator, Receipt, Home, Plus, Sparkles,
} from 'lucide-react';
import { useState } from 'react';

interface UserMenuSheetProps {
  isAdmin: boolean;
  ghostClass: string;
  iconClass: string;
  onSignOut: () => void;
}

export default function UserMenuSheet({ isAdmin, ghostClass, iconClass, onSignOut }: UserMenuSheetProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const linkClass =
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={ghostClass} title="Menü">
          <MoreVertical className={iconClass} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 sm:w-80 p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base font-display">Menü</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="navigation" className="flex-1 flex flex-col">
          <TabsList className="mx-4 bg-muted/50">
            <TabsTrigger value="navigation" className="text-xs flex-1">Navigation</TabsTrigger>
            <TabsTrigger value="tools" className="text-xs flex-1">Rechner</TabsTrigger>
            <TabsTrigger value="account" className="text-xs flex-1">Konto</TabsTrigger>
          </TabsList>

          {/* Navigation */}
          <TabsContent value="navigation" className="flex-1 px-4 py-3 space-y-1 mt-0">
            <Link to="/dashboard" className={linkClass} onClick={close}>
              <Home className="w-4 h-4 text-muted-foreground" /> Dashboard
            </Link>
            <Link to="/generator" className={linkClass} onClick={close}>
              <Plus className="w-4 h-4 text-muted-foreground" /> Neues Projekt
            </Link>
            <Link to="/sales-assistant" className={linkClass} onClick={close}>
              <Sparkles className="w-4 h-4 text-muted-foreground" /> KI Verkaufsassistent
            </Link>
            {isAdmin && (
              <Link to="/admin" className={linkClass} onClick={close}>
                <ShieldCheck className="w-4 h-4 text-accent" /> Admin-Bereich
              </Link>
            )}
          </TabsContent>

          {/* Rechner / Tools */}
          <TabsContent value="tools" className="flex-1 px-4 py-3 space-y-1 mt-0">
            <Link to="/leasing-rechner" className={linkClass} onClick={close}>
              <Calculator className="w-4 h-4 text-muted-foreground" /> Leasing-Rechner
            </Link>
            <Link to="/finanzierungsrechner" className={linkClass} onClick={close}>
              <Calculator className="w-4 h-4 text-muted-foreground" /> Finanzierungsrechner
            </Link>
            <Link to="/kfz-steuer-rechner" className={linkClass} onClick={close}>
              <Receipt className="w-4 h-4 text-muted-foreground" /> Kfz-Steuer-Rechner
            </Link>
          </TabsContent>

          {/* Konto */}
          <TabsContent value="account" className="flex-1 px-4 py-3 space-y-1 mt-0">
            <Link to="/profile" className={linkClass} onClick={close}>
              <User className="w-4 h-4 text-muted-foreground" /> Profil
            </Link>
            <Link to="/integrations" className={linkClass} onClick={close}>
              <Plug className="w-4 h-4 text-muted-foreground" /> Schnittstellen
            </Link>
            <Link to="/pricing" className={linkClass} onClick={close}>
              <CreditCard className="w-4 h-4 text-muted-foreground" /> Credits & Pläne
            </Link>
            <div className="pt-3 border-t border-border mt-3">
              <button className={`${linkClass} w-full text-destructive hover:bg-destructive/10`} onClick={() => { onSignOut(); close(); }}>
                <LogOut className="w-4 h-4" /> Abmelden
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
