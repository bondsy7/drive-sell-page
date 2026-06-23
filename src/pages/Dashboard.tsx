import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import VehiclesTab from '@/components/dashboard/VehiclesTab';
import DamageReportsTab from '@/components/dashboard/DamageReportsTab';
import CanvasProjectsTab from '@/components/dashboard/CanvasProjectsTab';
import SongsTab from '@/components/dashboard/SongsTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, FileSearch, Layers, Music } from 'lucide-react';

const Dashboard = () => {
  const [tab, setTab] = useState('vehicles');
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="vehicles" className="gap-2"><Car className="w-4 h-4" /> Fahrzeuge</TabsTrigger>
            <TabsTrigger value="canvas" className="gap-2"><Layers className="w-4 h-4" /> Canvas-Projekte</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><FileSearch className="w-4 h-4" /> Schadensberichte</TabsTrigger>
            <TabsTrigger value="songs" className="gap-2"><Music className="w-4 h-4" /> Songs</TabsTrigger>
          </TabsList>
          <TabsContent value="vehicles"><VehiclesTab /></TabsContent>
          <TabsContent value="canvas"><CanvasProjectsTab /></TabsContent>
          <TabsContent value="reports"><DamageReportsTab /></TabsContent>
          <TabsContent value="songs"><SongsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
