import React from 'react';
import AppHeader from '@/components/AppHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageSquare, Route, BookOpen, History, ListChecks, Sparkles, Bot, Settings2, CalendarDays, FileText, Car, Calendar, Inbox, Users } from 'lucide-react';
import SalesGeneratorTab from '@/components/sales/SalesGeneratorTab';
import SalesJourneyTab from '@/components/sales/SalesJourneyTab';
import SalesKnowledgeTab from '@/components/sales/SalesKnowledgeTab';
import SalesHistoryTab from '@/components/sales/SalesHistoryTab';
import SalesTasksTab from '@/components/sales/SalesTasksTab';
import SalesChatPage from '@/components/sales/SalesChatPage';
import SalesAutopilotSettings from '@/components/sales/SalesAutopilotSettings';
import SalesBookingsTab from '@/components/sales/SalesBookingsTab';
import SalesQuotesTab from '@/components/sales/SalesQuotesTab';
import SalesTradeInTab from '@/components/sales/SalesTradeInTab';
import SalesCalendarSettings from '@/components/sales/SalesCalendarSettings';
import SalesMailboxTab from '@/components/sales/SalesMailboxTab';
import SalesCrmTab from '@/components/sales/SalesCrmTab';


export default function SalesAssistant() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                KI Verkaufsassistent
              </h1>
              <p className="text-muted-foreground text-sm">
                Nutze Kundendaten, Customer Journey und Firmenwissen, um schneller passende Vertriebsantworten zu erzeugen.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="crm" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="crm" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Users className="w-4 h-4" /> Kunden CRM
            </TabsTrigger>
            <TabsTrigger value="assistant" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MessageSquare className="w-4 h-4" /> Assistent
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Bot className="w-4 h-4" /> Chat
            </TabsTrigger>
            <TabsTrigger value="journey" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Route className="w-4 h-4" /> Customer Journey
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BookOpen className="w-4 h-4" /> Wissen
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <History className="w-4 h-4" /> Verläufe
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <ListChecks className="w-4 h-4" /> Aufgaben
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <CalendarDays className="w-4 h-4" /> Probefahrten
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <FileText className="w-4 h-4" /> Angebote
            </TabsTrigger>
            <TabsTrigger value="tradein" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Car className="w-4 h-4" /> Inzahlungnahme
            </TabsTrigger>
            <TabsTrigger value="mailbox" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Inbox className="w-4 h-4" /> Postfach
            </TabsTrigger>
            <TabsTrigger value="autopilot" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Settings2 className="w-4 h-4" /> Autopilot
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Calendar className="w-4 h-4" /> Kalender
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crm"><SalesCrmTab /></TabsContent>
          <TabsContent value="assistant"><SalesGeneratorTab /></TabsContent>
          <TabsContent value="chat"><SalesChatPage /></TabsContent>
          <TabsContent value="journey"><SalesJourneyTab /></TabsContent>
          <TabsContent value="knowledge"><SalesKnowledgeTab /></TabsContent>
          <TabsContent value="history"><SalesHistoryTab /></TabsContent>
          <TabsContent value="tasks"><SalesTasksTab /></TabsContent>
          <TabsContent value="bookings"><SalesBookingsTab /></TabsContent>
          <TabsContent value="quotes"><SalesQuotesTab /></TabsContent>
          <TabsContent value="tradein"><SalesTradeInTab /></TabsContent>
          <TabsContent value="mailbox"><SalesMailboxTab /></TabsContent>
          <TabsContent value="autopilot"><SalesAutopilotSettings /></TabsContent>
          <TabsContent value="calendar"><SalesCalendarSettings /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
