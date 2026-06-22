import AppHeader from '@/components/AppHeader';
import CreditSlider from '@/components/CreditSlider';

const CreditRechner = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-8 sm:py-16">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
            Credit-Rechner
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Plane dein Credit-Budget und sieh, wie viele Bilder, Banner, Videos und Landingpages du erstellen kannst.
          </p>
        </div>
        <CreditSlider defaultCredits={50} />
      </main>
    </div>
  );
};

export default CreditRechner;
