'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { mockClients, formatCurrency } from '@boost/core';
import { Badge, Button, Input, Spinner } from '@boost/ui';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/api';

const TIER_LABELS = {
  social_only: 'Social only',
  website_only: 'Website only',
  full_package: 'Full package',
} as const;

const TIER_TONES = {
  social_only: 'info',
  website_only: 'brand',
  full_package: 'success',
} as const;

export default function ClientsPage() {
  const [q, setQ] = useState('');
  const { data = mockClients, isLoading } = useSWR('clients:list', async () => {
    try {
      return await api.listClients();
    } catch {
      return mockClients;
    }
  });

  const filtered = data.filter((c) => c.businessName.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${data.length} brands on BoostMyBranding`}
        action={
          <Button size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New client</span>
          </Button>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="mb-5 relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients…"
            className="pl-10 no-zoom"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner size={28} /></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/clients/${c.id}`}
                  className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="relative h-24 bg-gradient-cta md:h-28">
                    <div className="absolute left-5 -bottom-6 h-14 w-14 overflow-hidden rounded-2xl border-4 border-white bg-white md:h-16 md:w-16">
                      {(c as any).logoUrl ? (
                        <Image src={(c as any).logoUrl} alt="" fill unoptimized />
                      ) : null}
                    </div>
                  </div>
                  <div className="p-5 pt-8">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">{c.businessName}</h3>
                        <p className="truncate text-xs text-slate-500">{(c as any).industry}</p>
                      </div>
                      <Badge tone={TIER_TONES[c.subscriptionTier]}>
                        {TIER_LABELS[c.subscriptionTier]}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                      <Stat label="Posts" value={(c as any).stats?.postsThisMonth ?? 0} />
                      <Stat label="Waiting" value={(c as any).stats?.pendingApproval ?? 0} />
                      <Stat label="MRR" value={formatCurrency((c as any).monthlyPriceCents ?? 0)} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-sm font-bold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  );
}
