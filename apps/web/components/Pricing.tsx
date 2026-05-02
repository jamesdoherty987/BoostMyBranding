'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button, SectionWrapper, BorderBeam } from '@boost/ui';
import { Check } from 'lucide-react';
import { TIERS, COMPANY, tierMonthlyPrice, tierSetupPrice } from '@boost/core';

export function Pricing() {
  return (
    <SectionWrapper id="pricing" className="py-14 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            One monthly price. <span className="text-gradient-brand">No hourly rates.</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:mt-4 md:text-lg">
            Flat fee, cancel any time after the first {COMPANY.minCommitmentMonths} months.
          </p>
        </div>

        {/* All three cards equal width */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:mt-14 md:grid-cols-3 md:gap-6">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className={`relative flex flex-col rounded-2xl border p-5 md:rounded-3xl md:p-8 ${
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

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className={`text-lg font-semibold md:text-xl ${t.highlight ? 'text-white' : 'text-slate-900'}`}>
                    {t.name}
                  </h3>
                  <p className={`mt-1 text-xs md:text-sm ${t.highlight ? 'text-white/70' : 'text-slate-600'}`}>
                    {t.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-bold md:text-5xl">
                      {COMPANY.currencySymbol}{tierMonthlyPrice(t)}
                    </span>
                    <span className={`text-xs md:text-sm ${t.highlight ? 'text-white/70' : 'text-slate-500'}`}>
                      /mo
                    </span>
                  </div>
                  {t.setupCents > 0 ? (
                    <div className={`mt-0.5 text-[11px] md:text-xs ${t.highlight ? 'text-white/70' : 'text-slate-500'}`}>
                      + {COMPANY.currencySymbol}{tierSetupPrice(t).toLocaleString()} setup
                    </div>
                  ) : null}
                </div>
              </div>

              <ul className="mt-4 flex-1 space-y-2 md:mt-6 md:space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs md:text-sm">
                    <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 md:h-4 md:w-4 ${t.highlight ? 'text-[#48D886]' : 'text-[#1D9CA1]'}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/signup?plan=${t.id}`} className="mt-5 block md:mt-8">
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
