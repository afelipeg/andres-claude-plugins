import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import LogoBar from "@/components/LogoBar";
import StatsSection from "@/components/StatsSection";
import EnginesSection from "@/components/EnginesSection";
import HowItWorks from "@/components/HowItWorks";
import StrategySection from "@/components/StrategySection";
import DeveloperSection from "@/components/DeveloperSection";
import InvestorSection from "@/components/InvestorSection";
import PricingSection from "@/components/PricingSection";
import PlatformSection from "@/components/PlatformSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Navbar />
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
