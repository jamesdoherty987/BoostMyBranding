'use client';

import useSWR from 'swr';
import { formatCurrency } from '@boost/core';
import { Badge, Button, Spinner } from '@boost/ui';
import { Download, CreditCard } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/auth';
import { mockClients } from '@boost/core';

const toneMap = {
  pending: 'warning',
  paid: 'success',
  overdue: 'danger',
  draft: 'default',
  cancelled: 'default',
} as const;

/**
 * Billing page. In dev fills from `mockClients`, in prod lists the client's
 * real invoices. Stripe hosted invoice URL + PDF download both supported.
 */
export default function InvoicesPage() {
  const { data, isLoading } = useSWR('portal:invoices', async () => {
    try {
      const me = await api.getMyClient();
      return { client: me, invoices: [] as any[] };
    } catch (err) {
      handlePortalAuthError(err);
      if (!ALLOW_MOCK_FALLBACK) throw err;
      return { client: mockClients[0], invoices: [] };
    }
  });

  if (isLoading || !data || !data.client) {
    return (
      <Shell title="Billing">
        <div className="flex justify-center p-12"><Spinner size={28} /></div>
      </Shell>
    );
  }

  const { client } = data;
  const demo = [
    { id: 'inv_003', month: 'May 2026', amount: 20000, status: 'pending' as const, due: '2026-05-15' },
    { id: 'inv_002', month: 'April 2026', amount: 20000, status: 'paid' as const, paid: '2026-04-02' },
    { id: 'inv_001', month: 'March 2026', amount: 20000, status: 'paid' as const, paid: '2026-03-02' },
  ];
  const invoices = data.invoices.length ? data.invoices : demo;

  return (
    <Shell title="Billing" subtitle={`${client.businessName} · ${client.subscriptionTier?.replace('_', ' ') ?? 'Active'}`}>
      <section className="rounded-2xl bg-gradient-cta p-5 text-white shadow-brand">
        <div className="text-xs font-medium uppercase tracking-widest text-white/80">
          Current plan
        </div>
        <div className="mt-1 text-2xl font-bold">
          {formatCurrency(client.monthlyPriceCents ?? 20000)}
          <span className="text-sm font-normal text-white/80"> / month</span>
        </div>
        {invoices[0]?.due ? (
          <div className="mt-2 text-sm text-white/85">
            Next bill {new Date(invoices[0].due).toLocaleDateString()}
          </div>
        ) : null}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">History</h2>
        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{inv.month}</span>
                <Badge tone={(toneMap as any)[inv.status] ?? 'default'} className="capitalize">
                  {inv.status}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">{formatCurrency(inv.amount)}</div>
            </div>
            {inv.status === 'pending' ? (
              <Button size="sm">
                <CreditCard className="h-3.5 w-3.5" />
                Pay
              </Button>
            ) : (
              <Button size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
            )}
          </div>
        ))}
      </section>
    </Shell>
  );
}
