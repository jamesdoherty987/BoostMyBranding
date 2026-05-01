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

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boostmybranding.com';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: 'BoostMyBranding',
      url: BASE,
      logo: `${BASE}/favicon.png`,
      sameAs: ['https://instagram.com/boostmybranding'],
      description:
        'A dedicated social media management team for modern local businesses. We plan, write, and publish every post so your brand keeps showing up.',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'hello@boostmybranding.com',
        contactType: 'customer service',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: BASE,
      name: 'BoostMyBranding',
      publisher: { '@id': `${BASE}/#organization` },
    },
    {
      '@type': 'Service',
      '@id': `${BASE}/#service`,
      name: 'Social Media Management',
      provider: { '@id': `${BASE}/#organization` },
      description:
        'Monthly social media content creation, scheduling, and publishing for local businesses. 30 posts per month across Instagram, Facebook, LinkedIn, TikTok, and more.',
      areaServed: { '@type': 'Country', name: 'Ireland' },
      serviceType: 'Social Media Management',
      offers: [
        {
          '@type': 'Offer',
          name: 'Social Only',
          price: '700',
          priceCurrency: 'EUR',
          description: '30 posts per month across 4 platforms with monthly reporting.',
        },
        {
          '@type': 'Offer',
          name: 'Full Package',
          price: '800',
          priceCurrency: 'EUR',
          description:
            'Social media management plus a custom website with hosting and unlimited change requests.',
        },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${BASE}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How long until my first posts go live?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Roughly a week. We spend the first few days learning your business, then build your brand brief and ship the first month of content for you to preview.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which platforms do you cover?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Instagram, Facebook, LinkedIn, TikTok, X (Twitter), Pinterest, and Bluesky. Stories and Reels included.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I cancel?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, monthly after the first 3 months.',
          },
        },
      ],
    },
  ],
};

/**
 * Landing page. Eight focused sections, clear conversion path:
 * Hero > Features > How it works > Monthly output > Comparison > Pricing > FAQ > Footer.
 */
export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
