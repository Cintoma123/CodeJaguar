import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { PrinciplesStrip } from "@/components/PrinciplesStrip";
import { FeatureGrid } from "@/components/FeatureGrid";
import { TerminalDemo } from "@/components/TerminalDemo";
import { ProviderSection } from "@/components/ProviderSection";
import { SocialProof } from "@/components/SocialProof";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <PrinciplesStrip />
        <FeatureGrid />
        <TerminalDemo />
        <ProviderSection />
        <SocialProof />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
