'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button, SectionWrapper, BorderBeam } from '@boost/ui';
import { Check } from 'lucide-react';

type Tier = 'social_only' | 'website_only' | 'full_package';

interface TierDef {
  id: Tier;
  name: string;
  price: number;
  suffix: string;
  setup?: number;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

const tiers: TierDef[] = [
  {
    id: 'social_only',
    name: 'Social Only',
    price: 700,
    suffix: '/mo',
    description: '30 handcrafted posts a month across 4 platforms, run by our team.',
    features: [
      '30 posts / month',
      'Instagram, Facebook, LinkedIn, TikTok',
      'Written in your brand voice',
      'Dedicated account manager',
      'Monthly performance report',
    ],
    cta: 'Start social',
  },
  {
    id: 'full_package',
    name: 'Full Package',
    price: 800,
    setup: 800,
    suffix: '/mo',
    description: 'Social + a fast, modern website we maintain for you as your business changes.',
    features: [
      'Everything in Social Only',
      'Custom website + hosting',
      'Unlimited change requests',
      'Booking forms + map',
      'Priority support',
    ],
    cta: 'Go full package',
    highlight: true,
  },
  {
    id: 'website_only',
    name: 'Website Only',
    price: 150,
    setup: 800,
    suffix: '/mo',
    description: 'A modern website, built custom and kept current every month.',
    features: [
      'Custom website design',
      'Fast CDN hosting',
      'Ongoing content updates',
      'Booking integration',
      'Forms + analytics',
    ],
    cta: 'Just the website',
  },
];

export function Pricing() {
  return (
    <SectionWrapper id="pricing" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            One monthly price. <span className="text-gradient-brand">No hourly rates.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Flat fee, cancel any time after the first 3 months.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className={`relative flex flex-col rounded-3xl border p-8 ${
                t.highlight
                  ? 'border-transparent bg-slate-900 text-white shadow-2xl md:scale-[1.04]'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {t.highlight ? <BorderBeam duration={6} /> : null}
              {t.highlight ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-cta px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </div>
              ) : null}
              <h3 className={`text-xl font-semibold ${t.highlight ? 'text-white' : 'text-slate-900'}`}>
                {t.name}
              </h3>
              <p className={`mt-2 text-sm ${t.highlight ? 'text-white/70' : 'text-slate-600'}`}>
                {t.description}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold">€{t.price}</span>
                <span className={`text-sm ${t.highlight ? 'text-white/70' : 'text-slate-500'}`}>
                  {t.suffix}
                </span>
              </div>
              {t.setup ? (
                <div className={`mt-1 text-xs ${t.highlight ? 'text-white/70' : 'text-slate-500'}`}>
                  + €{t.setup} one-time setup
                </div>
              ) : null}
              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${t.highlight ? 'text-[#48D886]' : 'text-[#1D9CA1]'}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/signup?plan=${t.id}`} className="mt-8 block">
                <Button
                  variant={t.highlight ? 'primary' : 'outline'}
                  size="lg"
                  className="w-full"
                >
                  {t.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          Secure payment via Stripe. VAT calculated at checkout.
        </p>
      </div>
    </SectionWrapper>
  );
}
