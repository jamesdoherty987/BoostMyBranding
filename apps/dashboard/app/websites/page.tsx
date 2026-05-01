'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { mockClients, mockWebsiteRequests, slugify, type WebsiteConfig } from '@boost/core';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Spinner,
  toast,
} from '@boost/ui';
import { SiteRenderer } from '@boost/ui/site';
import {
  ExternalLink,
  Plus,
  Globe,
  Sparkles,
  Clock,
  Check,
  Loader2,
  Wand2,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/api';

const TEMPLATES: Array<{
  id: 'service' | 'food' | 'beauty' | 'fitness' | 'professional';
  name: string;
  description: string;
  seed: string;
}> = [
  {
    id: 'service',
    name: 'Service business',
    description: 'Hero + services grid + booking. Great for plumbers, electricians, cleaners.',
    seed: 'tpl-service',
  },
  {
    id: 'food',
    name: 'Cafe & food',
    description: 'Menu-led layout with gallery and map. Perfect for cafes and restaurants.',
    seed: 'tpl-food',
  },
  {
    id: 'beauty',
    name: 'Beauty & wellness',
    description: 'Elegant hero + before/after + booking widget.',
    seed: 'tpl-beauty',
  },
  {
    id: 'fitness',
    name: 'Fitness & coaching',
    description: 'Bold stats, class schedule, video hero.',
    seed: 'tpl-fitness',
  },
  {
    id: 'professional',
    name: 'Professional services',
    description: 'Trust-first layout for agencies, accountants, consultants.',
    seed: 'tpl-pro',
  },
];

interface PipelineStep {
  key: string;
  label: string;
  status: 'idle' | 'doing' | 'done' | 'failed';
}

const PIPELINE: PipelineStep[] = [
  { key: 'scrape_site', label: 'Reading your existing site', status: 'idle' },
  { key: 'fetch_images', label: 'Collecting your photos', status: 'idle' },
  { key: 'write_copy', label: 'Writing hero + services copy', status: 'idle' },
  { key: 'assemble_config', label: 'Assembling site config', status: 'idle' },
  { key: 'save', label: 'Saving for review', status: 'idle' },
];

type GeneratedConfig = WebsiteConfig;

export default function WebsitesPage() {
  // Prefer real clients list when the API is reachable, otherwise fall back
  // to the deterministic mock set so the page is never empty in dev.
  const { data: clients = mockClients } = useSWR('websites:clients', async () => {
    try {
      return await api.listClients();
    } catch {
      return mockClients;
    }
  });

  const [newSite, setNewSite] = useState({
    clientId: clients[0]?.id ?? mockClients[0]!.id,
    businessName: '',
    url: '',
    description:
      'A small local business focused on quality work, clear communication, and repeat customers.',
    services: 'Installations, Repairs, Maintenance',
    hasBooking: true,
    hasHours: true,
    template: TEMPLATES[0]!.id,
  });
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE);
  const [config, setConfig] = useState<GeneratedConfig | null>(null);

  // Fetch approved images for the currently-selected client so the live
  // preview uses real photos the same way the public site will. Fails silently
  // in mock mode (api.listImages throws without a client).
  const { data: clientImages = [] } = useSWR(
    newSite.clientId ? `websites:images:${newSite.clientId}` : null,
    async () => {
      try {
        const rows = await api.listImages(newSite.clientId);
        return rows
          .map((r) => r.fileUrl)
          .filter((u): u is string => typeof u === 'string' && u.length > 0);
      } catch {
        return [];
      }
    },
  );

  const generate = async () => {
    if (!newSite.clientId) {
      toast.error('Pick a client', 'Choose who this site is for.');
      return;
    }
    setRunning(true);
    setConfig(null);
    setSteps(PIPELINE.map((s, i) => ({ ...s, status: i === 0 ? 'doing' : 'idle' })));

    // Visual pipeline cadence — the real call is a single roundtrip so we
    // drive a simulated step-through that completes at the same moment.
    let idx = 0;
    const tick = setInterval(() => {
      idx = Math.min(PIPELINE.length - 1, idx + 1);
      setSteps((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, status: 'doing' } : i < idx ? { ...s, status: 'done' } : s,
        ),
      );
    }, 650);

    try {
      const result = await api.generateWebsite({
        clientId: newSite.clientId,
        description: newSite.description,
        services: newSite.services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        hasBooking: newSite.hasBooking,
        hasHours: newSite.hasHours,
        template: newSite.template,
      });
      clearInterval(tick);
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setConfig(result.config);
      toast.success(
        'Site generated',
        result.fromMock ? 'Preview ready (demo mode).' : 'Config saved to the client record.',
      );
    } catch (e) {
      clearInterval(tick);
      setSteps((prev) =>
        prev.map((s) => (s.status === 'doing' ? { ...s, status: 'failed' } : s)),
      );
      toast.error('Generation failed', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Websites"
        subtitle="Spin up a new client site in minutes. Drop in a description, we generate the full config."
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
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">New site details</h2>
                <p className="mt-1 text-xs text-slate-500">
                  We scrape the reference URL if you have one, pull the client&apos;s approved
                  photos, and draft the whole config — hero, services, reviews, FAQ.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Client</label>
                <select
                  value={newSite.clientId}
                  onChange={(e) => setNewSite((s) => ({ ...s, clientId: e.target.value }))}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm no-zoom"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} · {c.industry ?? ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Business name</label>
                  <Input
                    className="mt-1"
                    value={newSite.businessName}
                    onChange={(e) =>
                      setNewSite((s) => ({ ...s, businessName: e.target.value }))
                    }
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

              <div>
                <label className="text-xs font-medium text-slate-600">Description</label>
                <Textarea
                  className="mt-1 no-zoom"
                  rows={3}
                  value={newSite.description}
                  onChange={(e) =>
                    setNewSite((s) => ({ ...s, description: e.target.value }))
                  }
                  placeholder="Tell us what the business does, who they serve, and the tone you want."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Services (comma-separated)
                </label>
                <Input
                  className="mt-1"
                  value={newSite.services}
                  onChange={(e) => setNewSite((s) => ({ ...s, services: e.target.value }))}
                  placeholder="Installations, Repairs, Maintenance"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newSite.hasBooking}
                    onChange={(e) =>
                      setNewSite((s) => ({ ...s, hasBooking: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#48D886] focus:ring-[#48D886]"
                  />
                  Include booking form
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newSite.hasHours}
                    onChange={(e) =>
                      setNewSite((s) => ({ ...s, hasHours: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#48D886] focus:ring-[#48D886]"
                  />
                  Show opening hours
                </label>
              </div>

              <div className="flex flex-col items-stretch gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-500">
                  Generation usually takes under 30s.
                </span>
                <Button onClick={generate} loading={running} size="lg" disabled={running}>
                  {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                  {running ? 'Generating…' : 'Generate site config'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Wand2 className="h-4 w-4 text-[#1D9CA1]" />
                  Pipeline
                </div>
                <ol className="mt-4 space-y-3">
                  {steps.map((s, i) => (
                    <li key={s.key} className="flex items-center gap-3 text-sm">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                          s.status === 'done'
                            ? 'bg-gradient-cta text-white'
                            : s.status === 'doing'
                              ? 'bg-[#FFEC3D] text-slate-900'
                              : s.status === 'failed'
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.status === 'done' ? (
                          <Check className="h-3 w-3" />
                        ) : s.status === 'doing' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : s.status === 'failed' ? (
                          '!'
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={s.status === 'idle' ? 'text-slate-500' : 'text-slate-900'}>
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

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

            <Card>
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
                          <span className="text-xs font-semibold text-slate-900">
                            {c?.businessName}
                          </span>
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

        <AnimatePresence>
          {config ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Live preview</h2>
                <a
                  href={`/sites/${slugify(
                    clients.find((c) => c.id === newSite.clientId)?.businessName ?? '',
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline">
                    Open full page
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </a>
              </div>

              <Card>
                <CardContent className="p-0 overflow-hidden">
                  {/* Browser chrome wrapping the real renderer output */}
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-slate-500">
                      {config.meta.title}
                    </div>
                  </div>

                  {/* Scrollable preview region. Blocks automatically switch to
                      `immediate` rendering inside embedded mode so reveal
                      animations and parallax don't get stuck on the nested
                      scroll container's intersection observer. */}
                  <div className="max-h-[85vh] overflow-y-auto bg-white">
                    <SiteRenderer
                      config={config}
                      businessName={
                        clients.find((c) => c.id === newSite.clientId)?.businessName ??
                        'Your Business'
                      }
                      images={clientImages}
                      clientId={newSite.clientId}
                      embedded
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Raw config toggle */}
              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                  View raw config JSON
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-[11px] text-slate-100">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </details>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
