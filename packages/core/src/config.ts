/**
 * Centralized business config. Single source of truth for pricing, tier
 * definitions, company info, and feature copy used across all apps.
 *
 * Change pricing here → it updates everywhere: landing page, signup,
 * portal invoices, mock data, JSON-LD, and dashboard.
 */

import type { SubscriptionTier } from './types.js';

/* ------------------------------------------------------------------ */
/* Company                                                            */
/* ------------------------------------------------------------------ */

export const COMPANY = {
  name: 'BoostMyBranding',
  legalName: 'BoostMyBranding',
  email: 'contact@boostmybranding.com',
  domain: 'boostmybranding.com',
  country: 'Ireland',
  currency: 'EUR' as const,
  currencySymbol: '€',
  /** Minimum commitment before monthly cancellation is allowed. */
  minCommitmentMonths: 3,
} as const;

/* ------------------------------------------------------------------ */
/* Tiers                                                              */
/* ------------------------------------------------------------------ */

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  /** Monthly recurring price in cents. */
  priceCents: number;
  /** One-time setup fee in cents. 0 = no setup fee. */
  setupCents: number;
  description: string;
  features: string[];
  cta: string;
  /** Highlighted as "most popular" on the pricing page. */
  highlight?: boolean;
}

export const TIERS: TierConfig[] = [
  {
    id: 'social_only',
    name: 'Just Socials',
    priceCents: 25000,
    setupCents: 0,
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
    priceCents: 20000,
    setupCents: 80000,
    description: 'Social + a fast, modern website we maintain for you as your business changes.',
    features: [
      'Everything in Just Socials',
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
    priceCents: 2000,
    setupCents: 100000,
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

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Look up a tier by its id. */
export function getTier(id: SubscriptionTier): TierConfig {
  return TIERS.find((t) => t.id === id) ?? TIERS[0]!;
}

/** Format a tier's price for display, e.g. "€250/mo" or "€200/mo + €800 setup". */
export function formatTierPrice(tier: TierConfig): string {
  const price = `${COMPANY.currencySymbol}${tier.priceCents / 100}/mo`;
  if (tier.setupCents > 0) {
    return `${price} + ${COMPANY.currencySymbol}${(tier.setupCents / 100).toLocaleString()} setup`;
  }
  return price;
}

/** Get the monthly price in whole currency units (e.g. 250 for €250). */
export function tierMonthlyPrice(tier: TierConfig): number {
  return tier.priceCents / 100;
}

/** Get the setup fee in whole currency units (e.g. 800 for €800). */
export function tierSetupPrice(tier: TierConfig): number {
  return tier.setupCents / 100;
}
