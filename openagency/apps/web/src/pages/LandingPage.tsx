import LandingNavbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import LogoBar from '../components/landing/LogoBar';
import StatsSection from '../components/landing/StatsSection';
import PlatformSection from '../components/landing/PlatformSection';
import EnginesSection from '../components/landing/EnginesSection';
import HowItWorks from '../components/landing/HowItWorks';
import StrategySection from '../components/landing/StrategySection';
import DeveloperSection from '../components/landing/DeveloperSection';
import InvestorSection from '../components/landing/InvestorSection';
import PricingSection from '../components/landing/PricingSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';
import ScrollToTop from '../components/landing/ScrollToTop';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <LandingNavbar />
      <HeroSection />
      <LogoBar />
      <StatsSection />
      <PlatformSection />
      <EnginesSection />
      <HowItWorks />
      <StrategySection />
      <DeveloperSection />
      <InvestorSection />
      <PricingSection />
      <CTASection />
      <Footer />
      <ScrollToTop />
    </div>
  );
}
