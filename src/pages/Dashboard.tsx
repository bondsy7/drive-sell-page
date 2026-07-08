import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import VehiclesTab from '@/components/dashboard/VehiclesTab';
import DamageReportsTab from '@/components/dashboard/DamageReportsTab';
import CanvasProjectsTab from '@/components/dashboard/CanvasProjectsTab';
import SongsTab from '@/components/dashboard/SongsTab';
import ScheduledPostsTab from '@/components/dashboard/ScheduledPostsTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, FileSearch, Layers, Music, Clock } from 'lucide-react';

const Dashboard = () => {
  const [tab, setTab] = useState('vehicles');
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="vehicles" className="gap-2"><Car className="w-4 h-4" /> <span className="hidden sm:inline">Fahrzeuge</span></TabsTrigger>
            <TabsTrigger value="canvas" className="gap-2"><Layers className="w-4 h-4" /> <span className="hidden sm:inline">Canvas</span></TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><FileSearch className="w-4 h-4" /> <span className="hidden sm:inline">Schäden</span></TabsTrigger>
            <TabsTrigger value="songs" className="gap-2"><Music className="w-4 h-4" /> <span className="hidden sm:inline">Songs</span></TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2"><Clock className="w-4 h-4" /> <span className="hidden sm:inline">Geplant</span></TabsTrigger>
          </TabsList>
          <TabsContent value="vehicles"><VehiclesTab /></TabsContent>
          <TabsContent value="canvas"><CanvasProjectsTab /></TabsContent>
          <TabsContent value="reports"><DamageReportsTab /></TabsContent>
          <TabsContent value="songs"><SongsTab /></TabsContent>
          <TabsContent value="scheduled"><ScheduledPostsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
