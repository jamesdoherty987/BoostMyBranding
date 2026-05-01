'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { mockClients, mockWebsiteRequests } from '@boost/core';
import { Badge, Button, Card, CardContent, Input } from '@boost/ui';
import { ExternalLink, Plus, Globe, Sparkles, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const TEMPLATES = [
  {
    id: 'tpl-service',
    name: 'Service business',
    description: 'Hero + services grid + booking. Great for plumbers, electricians, cleaners.',
    seed: 'tpl-service',
  },
  {
    id: 'tpl-food',
    name: 'Cafe & food',
    description: 'Menu-led layout with gallery and map. Perfect for cafes and restaurants.',
    seed: 'tpl-food',
  },
  {
    id: 'tpl-beauty',
    name: 'Beauty & wellness',
    description: 'Elegant hero + before/after + booking widget.',
    seed: 'tpl-beauty',
  },
  {
    id: 'tpl-fitness',
    name: 'Fitness & coaching',
    description: 'Bold stats, class schedule, video hero.',
    seed: 'tpl-fitness',
  },
];

export default function WebsitesPage() {
  const [newSite, setNewSite] = useState({ businessName: '', url: '', template: TEMPLATES[0]!.id });

  return (
    <>
      <PageHeader
        title="Websites"
        subtitle="Spin up a new client site in minutes. Templates handle 90% of the work."
        action={
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New website
          </Button>
        }
      />

      <div className="px-4 py-4 md:px-10 md:py-6 space-y-8">
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Start from a template</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TEMPLATES.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setNewSite((s) => ({ ...s, template: t.id }))}
                className={`text-left overflow-hidden rounded-2xl border transition-all ${
                  newSite.template === t.id
                    ? 'border-[#48D886] ring-2 ring-[#48D886]/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <Image
                    src={`https://picsum.photos/seed/${t.seed}/600/450`}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {newSite.template === t.id ? (
                    <div className="absolute inset-0 bg-gradient-to-t from-[#48D886]/30 to-transparent" />
                  ) : null}
                </div>
                <div className="bg-white p-4">
                  <div className="font-semibold text-slate-900">{t.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{t.description}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-slate-900">New site details</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Business name</label>
                  <Input
                    className="mt-1"
                    value={newSite.businessName}
                    onChange={(e) => setNewSite((s) => ({ ...s, businessName: e.target.value }))}
                    placeholder="Murphy's Plumbing"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Existing site (optional)
                  </label>
                  <Input
                    className="mt-1"
                    value={newSite.url}
                    onChange={(e) => setNewSite((s) => ({ ...s, url: e.target.value }))}
                    placeholder="https://murphysplumbing.ie"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">Template</label>
                <div className="mt-1 text-sm text-slate-800">
                  {TEMPLATES.find((t) => t.id === newSite.template)?.name}
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Button size="sm">
                  <Sparkles className="h-4 w-4" />
                  Generate site config
                </Button>
                <span className="text-xs text-slate-500">
                  We&apos;ll scrape {newSite.url || 'a reference site'} and write your config.json.
                </span>
              </div>
            </CardContent>
          </Card>

          <aside>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold text-slate-900">Live client sites</h2>
                <div className="mt-4 space-y-3">
                  {mockClients
                    .filter((c) => c.subscriptionTier !== 'social_only')
                    .map((c) => (
                      <a
                        key={c.id}
                        href="#"
                        className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-cta text-white">
                          <Globe className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {c.businessName.toLowerCase().replace(/[^a-z]+/g, '')}.com
                          </div>
                          <div className="text-[11px] text-slate-500">Last deploy 2d ago</div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </a>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#1D9CA1]" />
                  <h2 className="text-sm font-semibold text-slate-900">Change requests</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {mockWebsiteRequests.map((r) => {
                    const c = mockClients.find((x) => x.id === r.clientId);
                    return (
                      <div key={r.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900">{c?.businessName}</span>
                          <Badge
                            tone={
                              r.status === 'completed'
                                ? 'success'
                                : r.status === 'in_progress'
                                  ? 'info'
                                  : 'warning'
                            }
                          >
                            {r.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{r.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </>
  );
}
