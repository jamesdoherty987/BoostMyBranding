import { Navbar } from '@/components/Navbar';
import { LaunchHero } from '@/components/LaunchHero';
import { Marquee } from '@/components/Marquee';
import { Statement } from '@/components/Statement';
import { Features } from '@/components/Features';
import { Demo } from '@/components/Demo';
import { Integrations } from '@/components/Integrations';
import { Comparison } from '@/components/Comparison';
import { Stats } from '@/components/Stats';
import { ExampleSites } from '@/components/ExampleSites';
import { Testimonials } from '@/components/Testimonials';
import { Pricing } from '@/components/Pricing';
import { FAQ } from '@/components/FAQ';
import { Contact } from '@/components/Contact';
import { Footer } from '@/components/Footer';
import { Toaster } from '@boost/ui';

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <LaunchHero />
      <Marquee />
      <Statement />
      <Features />
      <Demo />
      <Integrations />
      <Comparison />
      <Stats />
      <ExampleSites />
      <Testimonials />
      <Pricing />
      <FAQ />
      <Contact />
      <Footer />
      <Toaster />
    </main>
  );
}
