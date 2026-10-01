import HomeHeader from '@/components/home/HomeHeader';
import HomeHero from '@/components/home/HomeHero';
import { HomeBenefits, HomeClosingCta, HomeProcess, HomeQuality, HomeResults } from '@/components/home/HomeSections';
import SiteFooter from '@/components/legal/SiteFooter';
import { useAuth } from '@/hooks/useAuth';

export default function Landing() {
  const { user } = useAuth();
  const destination = user ? '/generator' : '/auth?plan=free';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HomeHeader />

      <main>
        <HomeHero />
        <HomeBenefits />
        <HomeProcess />
        <HomeResults />
        <HomeQuality />
        <HomeClosingCta destination={destination} />
      </main>

      <SiteFooter />
    </div>
  );
}