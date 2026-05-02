/**
 * Portal-side subscription helpers.
 *
 * The portal is "look-around" by default — any signed-in user can browse
 * every screen. Premium actions (publishing, content generation, uploading
 * media for us to work with, etc.) are gated on `active` subscription status.
 * `past_due` keeps access as a grace period; `canceled` and `none` are locked.
 */

'use client';

import useSWR from 'swr';
import { api } from './api';

export interface SubscriptionView {
  tier: 'social_only' | 'website_only' | 'full_package';
  tierName: string;
  priceCents: number;
  status: 'none' | 'active' | 'past_due' | 'canceled';
  statusMeta: {
    label: string;
    tone: 'success' | 'warn' | 'danger' | 'default';
    description: string;
  };
  startedAt: string | null;
  active: boolean;
  hasCustomer: boolean;
}

/**
 * Read current subscription state. Cached SWR-wide so every component that
 * calls `useSubscription()` reuses one fetch.
 */
export function useSubscription() {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionView>(
    'portal:subscription',
    async () => {
      return await api.getSubscription();
    },
    { revalidateOnFocus: true },
  );
  return { subscription: data, error, isLoading, refresh: mutate };
}

/**
 * Kick off a Stripe Checkout session from inside the portal. Redirects to
 * Stripe, which on success bounces back to `/subscription?status=success`.
 */
export async function startCheckout(tier: SubscriptionView['tier']) {
  const { url } = await api.checkout(tier);
  if (url) window.location.href = url;
}

/** Open the Stripe-hosted billing portal for managing payment methods. */
export async function openBillingPortal() {
  const { url } = await api.openBillingPortal();
  if (url) window.location.href = url;
}
