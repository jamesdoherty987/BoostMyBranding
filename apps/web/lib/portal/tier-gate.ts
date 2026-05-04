'use client';

/**
 * Small hook that protects a portal page by required tier(s). If the
 * signed-in client is on a tier that doesn't include this feature, we
 * redirect them to /dashboard rather than leave them stranded on a page
 * the nav doesn't even surface for them.
 *
 * Usage:
 *   // In a page that's only meaningful for social publishing:
 *   useTierGate(['social_only', 'full_package']);
 *
 * Behavior:
 *   - Still loading subscription data → does nothing (page shows its
 *     normal loading state).
 *   - Tier not in the allowed list → replaces route with /dashboard.
 *   - Tier is allowed → no-op.
 *
 * This is a soft gate for UX, not security. The real enforcement lives
 * on the API endpoints (e.g. posts/images require an active subscription).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { SubscriptionTier } from '@boost/core';
import { api } from '@/lib/portal/api';

export function useTierGate(allowedTiers: SubscriptionTier[]) {
  const router = useRouter();
  const { data: client, isLoading } = useSWR('portal:client', async () => {
    try {
      return await api.getMyClient();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (isLoading || !client) return;
    const tier = client.subscriptionTier;
    if (!tier) return;
    if (!allowedTiers.includes(tier as SubscriptionTier)) {
      router.replace('/portal/dashboard');
    }
    // allowedTiers is a stable prop in practice; it's a literal array
    // defined inline in the calling page. We don't need to re-run when
    // the array identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isLoading, router]);

  return { tier: client?.subscriptionTier, isLoading };
}
