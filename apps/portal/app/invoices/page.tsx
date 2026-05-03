'use client';

/**
 * Billing page. Lists invoices for the signed-in client. In dev (no DB)
 * we render deterministic mock rows so the screen isn't empty; in prod
 * with no invoices yet we show a friendly "first invoice on its way"
 * empty state instead of fabricated data.
 */

import useSWR from 'swr';
import Link from 'next/link';
import { formatCurrency, getTier, mockClients } from '@boost/core';
import { Badge, Button, EmptyState, Spinner } from '@boost/ui';
import { Download, CreditCard, Receipt, ArrowRight } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';

interface Invoice {
  id: string;
  month: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'draft' | 'cancelled';
  due?: string;
  paid?: string;
  hostedUrl?: string;
  pdfUrl?: string;
}

const toneMap = {
  pending: 'warning',
  paid: 'success',
  overdue: 'danger',
  draft: 'default',
  cancelled: 'default',
} as const;

export default function InvoicesPage() {
  const { subscription } = useSubscription();
  const { data, isLoading } = useSWR('portal:invoices', async () => {
    try {
      const me = await api.getMyClient();
      // Real invoice listing will plug in here once the API supports it;
      // we return `null` so the page can distinguish "loaded but empty"
      // from "still loading".
      return { client: me, invoices: null as Invoice[] | null };
    } catch (err) {
      handlePortalAuthError(err);
      if (!ALLOW_MOCK_FALLBACK) throw err;
      return { client: mockClients[0], invoices: null as Invoice[] | null };
    }
  });

  if (isLoading || !data || !data.client) {
    return (
      <Shell title="Billing">
        <div className="flex justify-center p-12">
          <Spinner size={28} />
        </div>
      </Shell>
    );
  }

  const { client } = data;
  const defaultPrice = getTier('full_package').priceCents;
  const monthlyPrice = client.monthlyPriceCents ?? defaultPrice;

  // In dev with no API, seed a small demo timeline so the screen shows
  // what the real thing will look like once invoices start landing.
  const demo: Invoice[] = ALLOW_MOCK_FALLBACK
    ? [
        {
          id: 'inv_003',
          month: 'May 2026',
          amount: monthlyPrice,
          status: 'pending',
          due: '2026-05-15',
        },
        {
          id: 'inv_002',
          month: 'April 2026',
          amount: monthlyPrice,
          status: 'paid',
          paid: '2026-04-02',
        },
        {
          id: 'inv_001',
          month: 'March 2026',
          amount: monthlyPrice,
          status: 'paid',
          paid: '2026-03-02',
        },
      ]
    : [];

  const invoices: Invoice[] = data.invoices ?? demo;
  const firstPending = invoices.find((i) => i.status === 'pending');
  const subscriptionActive = subscription?.active ?? false;

  return (
    <Shell
      title="Billing"
      subtitle={client.businessName}
    >
      <section className="rounded-2xl bg-gradient-cta p-5 text-white shadow-brand">
        <div className="text-xs font-medium uppercase tracking-widest text-white/80">
          Current plan
        </div>
        <div className="mt-1 text-2xl font-bold">
          {formatCurrency(monthlyPrice)}
          <span className="text-sm font-normal text-white/80"> / month</span>
        </div>
        {firstPending?.due ? (
          <div className="mt-2 text-sm text-white/85">
            Next bill {new Date(firstPending.due).toLocaleDateString()}
          </div>
        ) : subscription?.startedAt ? (
          <div className="mt-2 text-sm text-white/85">
            Member since{' '}
            {new Date(subscription.startedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
            })}
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">History</h2>

        {invoices.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title={
                subscriptionActive
                  ? 'Your first invoice is on its way'
                  : 'No invoices yet'
              }
              description={
                subscriptionActive
                  ? "We'll email a receipt after your first billing cycle. It'll appear here too."
                  : 'Subscribe to a plan to start your billing cycle.'
              }
              action={
                !subscriptionActive ? (
                  <Link href="/subscription">
                    <Button>
                      See plans
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{inv.month}</span>
                    <Badge tone={toneMap[inv.status] ?? 'default'} className="capitalize">
                      {inv.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatCurrency(inv.amount)}
                    {inv.paid ? ` · paid ${new Date(inv.paid).toLocaleDateString()}` : ''}
                  </div>
                </div>
                {inv.status === 'pending' ? (
                  inv.hostedUrl ? (
                    <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm">
                        <CreditCard className="h-3.5 w-3.5" />
                        Pay
                      </Button>
                    </a>
                  ) : (
                    <Button size="sm" disabled>
                      <CreditCard className="h-3.5 w-3.5" />
                      Pay
                    </Button>
                  )
                ) : inv.pdfUrl ? (
                  <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                  </a>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
