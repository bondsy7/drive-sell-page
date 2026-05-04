import AppHeader from '@/components/AppHeader';
import VehiclesTab from '@/components/dashboard/VehiclesTab';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <VehiclesTab />
      </main>
    </div>
  );
};

export default Dashboard;
