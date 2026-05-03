'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import {
  mockClients,
  mockWebsiteRequests,
  slugify,
  type WebsiteConfig,
  type SiteTemplate,
} from '@boost/core';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Spinner,
  toast,
  confirmDialog,
} from '@boost/ui';
import { SiteRenderer } from '@boost/ui/site';
import {
  ExternalLink,
  Globe,
  Sparkles,
  Clock,
  Check,
  Loader2,
  Wand2,
  ArrowRight,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { SiteEditor } from '@/components/SiteEditor';
import { api } from '@/lib/api';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Optional template override panel. The AI now auto-detects the right
 * template from the business description, so the picker is collapsed by
 * default. Expand it when you want to force a specific layout.
 */
const TEMPLATES: Array<{
  id: SiteTemplate;
  name: string;
  description: string;
}> = [
  { id: 'service', name: 'Service business', description: 'Plumbers, electricians, cleaners.' },
  { id: 'food', name: 'Cafe & food', description: 'Cafes, restaurants, bars.' },
  { id: 'beauty', name: 'Beauty & wellness', description: 'Salons, spas, aesthetics.' },
  { id: 'fitness', name: 'Fitness & coaching', description: 'Gyms, PTs, yoga.' },
  { id: 'professional', name: 'Professional', description: 'Agencies, accountants.' },
  { id: 'retail', name: 'Retail & shop', description: 'Boutiques, shops, ecom.' },
  { id: 'medical', name: 'Medical & dental', description: 'Clinics, dentists.' },
  { id: 'creative', name: 'Creative & studio', description: 'Designers, photographers.' },
  { id: 'realestate', name: 'Property & real estate', description: 'Estate agents.' },
  { id: 'education', name: 'Education & training', description: 'Schools, tutors.' },
  { id: 'automotive', name: 'Automotive', description: 'Mechanics, garages, body shops.' },
  { id: 'hospitality', name: 'Hospitality', description: 'Hotels, B&Bs, guesthouses.' },
  { id: 'legal', name: 'Legal', description: 'Solicitors, law firms, barristers.' },
  { id: 'nonprofit', name: 'Non-profit', description: 'Charities, foundations, community.' },
  { id: 'tech', name: 'Tech & SaaS', description: 'Software, apps, startups.' },
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
  { key: 'gen_hero_image', label: 'Generating hero illustration', status: 'idle' },
  { key: 'assemble_config', label: 'Assembling site config', status: 'idle' },
  { key: 'save', label: 'Saving for review', status: 'idle' },
];

type GeneratedConfig = WebsiteConfig;

export default function WebsitesPage() {
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
    template: undefined as SiteTemplate | undefined,
    suggestions: '',
    primaryColor: '',
    accentColor: '',
    logoUrl: '',
  });
  const [templateOverrideOpen, setTemplateOverrideOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE);
  const [config, setConfig] = useState<GeneratedConfig | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Fetch approved images for the currently-selected client.
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

    let idx = 0;
    const tick = setInterval(() => {
      idx = Math.min(PIPELINE.length - 1, idx + 1);
      setSteps((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, status: 'doing' } : i < idx ? { ...s, status: 'done' } : s,
        ),
      );
    }, 800);

    try {
      // Build suggestions string that includes brand color overrides
      const suggestionParts: string[] = [];
      if (newSite.suggestions) suggestionParts.push(newSite.suggestions);
      if (newSite.primaryColor) suggestionParts.push(`Use ${newSite.primaryColor} as the primary brand color.`);
      if (newSite.accentColor) suggestionParts.push(`Use ${newSite.accentColor} as the accent color.`);
      if (newSite.logoUrl) suggestionParts.push(`The business logo is at: ${newSite.logoUrl}`);

      const result = await api.generateWebsite({
        clientId: newSite.clientId,
        description: newSite.description,
        services: newSite.services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        hasBooking: newSite.hasBooking,
        hasHours: newSite.hasHours,
        template: newSite.template, // may be undefined → Claude auto-detects
        suggestions: suggestionParts.join('\n') || undefined,
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

  /**
   * Inline edit handler. Patches the local config optimistically, then
   * persists via the update-field endpoint. If the API fails we roll back
   * to the previous value so the UI stays consistent with server state.
   */
  const handleFieldChange = useCallback(
    async (path: string, value: unknown) => {
      if (!config || !newSite.clientId) return;

      // Optimistic local patch so the preview updates instantly.
      const segments = path.split('.').filter((s) => s.length > 0);
      const prev = structuredClone(config) as any;
      const next = structuredClone(config) as any;
      let cursor = next;
      for (let i = 0; i < segments.length - 1; i++) {
        const k = segments[i]!;
        if (cursor[k] == null) {
          const nk = segments[i + 1]!;
          cursor[k] = /^\d+$/.test(nk) ? [] : {};
        }
        cursor = cursor[k];
      }
      cursor[segments[segments.length - 1]!] = value;
      setConfig(next);

      try {
        await api.updateWebsiteField({
          clientId: newSite.clientId,
          path,
          value,
        });
      } catch (e) {
        setConfig(prev);
        toast.error('Save failed', (e as Error).message);
      }
    },
    [config, newSite.clientId],
  );

  const selectedClient = clients.find((c) => c.id === newSite.clientId);

  return (
    <>
      <PageHeader
        title="Websites"
        subtitle="Spin up a new client site in minutes. Drop in a description, we generate the full config."
      />

      <div className="px-4 py-4 md:px-10 md:py-6 space-y-8">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">New site details</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Tell us about the business in plain English. The AI auto-detects the
                  right industry template, picks the best hero style, and generates
                  a custom illustration — all from what you write here.
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
                  rows={4}
                  value={newSite.description}
                  onChange={(e) =>
                    setNewSite((s) => ({ ...s, description: e.target.value }))
                  }
                  placeholder="Who they are, who they serve, their vibe. The more you write, the better the AI matches the look and tone."
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

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Suggestions (optional)
                </label>
                <Textarea
                  className="mt-1 no-zoom"
                  rows={2}
                  value={newSite.suggestions}
                  onChange={(e) =>
                    setNewSite((s) => ({ ...s, suggestions: e.target.value }))
                  }
                  placeholder="e.g. Use dark hero, beams variant, emphasise 24/7 availability..."
                />
              </div>

              {/* Brand colors + logo */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Primary color <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={newSite.primaryColor || '#1D9CA1'}
                      onChange={(e) => setNewSite((s) => ({ ...s, primaryColor: e.target.value }))}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={newSite.primaryColor}
                      onChange={(e) => setNewSite((s) => ({ ...s, primaryColor: e.target.value }))}
                      className="h-9 flex-1 font-mono text-xs"
                      placeholder="Auto-detect"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Accent color <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={newSite.accentColor || '#48D886'}
                      onChange={(e) => setNewSite((s) => ({ ...s, accentColor: e.target.value }))}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={newSite.accentColor}
                      onChange={(e) => setNewSite((s) => ({ ...s, accentColor: e.target.value }))}
                      className="h-9 flex-1 font-mono text-xs"
                      placeholder="Auto-detect"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Logo URL <span className="text-slate-400">(optional)</span>
                  </label>
                  <Input
                    className="mt-1 h-9 text-xs"
                    value={newSite.logoUrl}
                    onChange={(e) => setNewSite((s) => ({ ...s, logoUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Client images preview */}
              {clientImages.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Client images ({clientImages.length} available)
                  </label>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    The AI will review these and pick the best ones for the hero, gallery, and about sections.
                  </p>
                  <div className="mt-2 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                    {clientImages.slice(0, 12).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${src}-${i}`}
                        src={src}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      />
                    ))}
                    {clientImages.length > 12 && (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-600">
                        +{clientImages.length - 12}
                      </div>
                    )}
                  </div>
                </div>
              )}

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

              {/* Collapsed template override */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => setTemplateOverrideOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-xs font-medium text-slate-600">
                    Advanced: force a specific template
                    {newSite.template ? (
                      <span className="ml-2 rounded-full bg-[#1D9CA1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1D9CA1]">
                        {newSite.template}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      templateOverrideOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {templateOverrideOpen ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-2 text-[11px] text-slate-500">
                        Leave this off to let the AI pick. Only override when you
                        know the business doesn&apos;t match any obvious industry keyword.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-3">
                        <button
                          onClick={() =>
                            setNewSite((s) => ({ ...s, template: undefined }))
                          }
                          className={`rounded-lg border p-2 text-left text-[11px] transition-all ${
                            newSite.template === undefined
                              ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 text-[#1D9CA1]'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="font-semibold">Auto-detect</span>
                          <span className="block text-slate-400">
                            Recommended
                          </span>
                        </button>
                        {TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setNewSite((s) => ({ ...s, template: t.id }))}
                            className={`rounded-lg border p-2 text-left text-[11px] transition-all ${
                              newSite.template === t.id
                                ? 'border-[#1D9CA1] bg-[#1D9CA1]/5 text-[#1D9CA1]'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span className="font-semibold">{t.name}</span>
                            <span className="block truncate text-slate-400">
                              {t.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex flex-col items-stretch gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-500">
                  Generation takes ~30–60s (includes AI hero image).
                </span>
                <Button onClick={generate} loading={running} size="lg" disabled={running}>
                  {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                  {running ? 'Generating…' : 'Generate site'}
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
                <p className="mt-1 text-[11px] text-slate-500">
                  Clients with a generated site. Shows custom domain if attached,
                  otherwise the default /sites/ URL.
                </p>
                <div className="mt-4 space-y-3">
                  {clients
                    .filter((c) => c.subscriptionTier !== 'social_only' && c.websiteConfig)
                    .slice(0, 8)
                    .map((c) => {
                      const hasCustom =
                        c.customDomain && c.customDomainStatus === 'verified';
                      const host = hasCustom
                        ? (c.customDomain as string)
                        : `${APP_URL.replace(/^https?:\/\//, '')}/sites/${c.slug ?? slugify(c.businessName)}`;
                      const href = hasCustom
                        ? `https://${c.customDomain}`
                        : `${APP_URL}/sites/${c.slug ?? slugify(c.businessName)}`;
                      return (
                        <a
                          key={c.id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-cta text-white">
                            <Globe className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {c.businessName}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">{host}</div>
                          </div>
                          {hasCustom ? (
                            <Badge tone="success">
                              <span className="text-[10px] font-semibold uppercase">
                                Custom
                              </span>
                            </Badge>
                          ) : null}
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </a>
                      );
                    })}
                  {clients.filter((c) => c.websiteConfig).length === 0 && (
                    <p className="py-2 text-center text-[11px] text-slate-400">
                      No sites generated yet.
                    </p>
                  )}
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
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">Live preview</h2>
                  {editMode ? (
                    <Badge tone="info">
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        Edit mode
                      </span>
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (
                        !(await confirmDialog({
                          title: 'Delete this website config?',
                          description:
                            'The client will see a "coming soon" page until you regenerate.',
                          confirmLabel: 'Delete site',
                          danger: true,
                        }))
                      )
                        return;
                      try {
                        await api.deleteWebsiteConfig(newSite.clientId);
                        setConfig(null);
                        setEditMode(false);
                        toast.success('Website config cleared');
                      } catch (e) {
                        toast.error('Delete failed', (e as Error).message);
                      }
                    }}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generate}
                    disabled={running}
                  >
                    <Sparkles className="h-3 w-3" />
                    Regenerate
                  </Button>
                  <a
                    href={`${APP_URL}/sites/${selectedClient?.slug ?? slugify(selectedClient?.businessName ?? '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline">
                      Open full page
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
                <Card>
                  <CardContent className="p-0 overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-slate-500">
                        {config.meta.title}
                      </div>
                    </div>
                    <div className="max-h-[85vh] overflow-y-auto bg-white">
                      <SiteRenderer
                        config={config}
                        businessName={selectedClient?.businessName ?? 'Your Business'}
                        images={clientImages}
                        clientId={newSite.clientId}
                        embedded
                        editMode={editMode}
                        onFieldChange={handleFieldChange}
                      />
                    </div>
                  </CardContent>
                </Card>

                <SiteEditor
                  config={config}
                  onChange={setConfig}
                  clientId={newSite.clientId}
                  images={clientImages}
                  editMode={editMode}
                  onEditModeChange={setEditMode}
                />
              </div>

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
