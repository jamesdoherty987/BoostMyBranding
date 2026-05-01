import { Navbar } from '@/components/Navbar';
import { LaunchHero } from '@/components/LaunchHero';
import { Features } from '@/components/Features';
import { Demo } from '@/components/Demo';
import { MonthlyOutput } from '@/components/MonthlyOutput';
import { Comparison } from '@/components/Comparison';
import { Pricing } from '@/components/Pricing';
import { FAQ } from '@/components/FAQ';
import { Footer } from '@/components/Footer';
import { Toaster } from '@boost/ui';

/**
 * Landing page. Eight focused sections, clear conversion path:
 * Hero → Features → How it works → Monthly output → Comparison → Pricing → FAQ → Footer.
 */
export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <LaunchHero />
      <Features />
      <Demo />
      <MonthlyOutput />
      <Comparison />
      <Pricing />
      <FAQ />
      <Footer />
      <Toaster />
    </main>
  );
}
