'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { mockClients } from '@boost/core';
import { Badge, Button, Card, CardContent, Input, Textarea, Spinner, toast } from '@boost/ui';
import { Sparkles, Check, Loader2, Wand2, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/api';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'x'] as const;

interface Step {
  key: string;
  label: string;
  status: 'idle' | 'doing' | 'done' | 'failed';
  durationMs?: number;
}

const BASE_STEPS: Step[] = [
  { key: 'scrape_site', label: 'Reading the website', status: 'idle' },
  { key: 'fetch_images', label: 'Collecting photos', status: 'idle' },
  { key: 'analyze_images', label: 'Scoring uploaded photos', status: 'idle' },
  { key: 'enhance_images', label: 'Enhancing images with Flux', status: 'idle' },
  { key: 'generate_calendar', label: 'Drafting captions', status: 'idle' },
  { key: 'persist_posts', label: 'Packaging for review', status: 'idle' },
];

export default function GeneratePage() {
  const { data: clients = [], isLoading: clientsLoading } = useSWR(
    'generate:clients',
    async () => {
      try {
        return await api.listClients();
      } catch {
        return mockClients;
      }
    },
  );

  // Start blank, sync to first real client once the list arrives. Prevents
  // mock ids leaking into real API calls if someone smashes Generate while
  // the list is still loading.
  const [clientId, setClientId] = useState<string>('');
  useEffect(() => {
    if (!clients.length) return;
    if (!clientId || !clients.find((c) => c.id === clientId)) {
      setClientId(clients[0]!.id);
    }
  }, [clients, clientId]);

  const [count, setCount] = useState(30);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [platforms, setPlatforms] = useState<Set<string>>(
    new Set(['instagram', 'facebook', 'linkedin']),
  );
  const [notes, setNotes] = useState('Lean into seasonal angles and showcase the team.');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(BASE_STEPS);
  const [result, setResult] = useState<{ postsGenerated: number; costCents: number } | null>(null);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const run = async () => {
    const isValidUuid =
      !!clientId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
    if (!clientId || !isValidUuid) {
      toast.error(
        'Pick a client',
        clients.length === 0
          ? 'Loading your clients — try again in a moment.'
          : 'Choose who this is for from the dropdown.',
      );
      return;
    }
    setRunning(true);
    setResult(null);
    setSteps(BASE_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'doing' : 'idle' })));

    let currentIdx = 0;
    const advanceTimer = setInterval(() => {
      currentIdx = Math.min(BASE_STEPS.length - 1, currentIdx + 1);
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === currentIdx ? { ...s, status: 'doing' } : idx < currentIdx ? { ...s, status: 'done' } : s,
        ),
      );
    }, 700);

    try {
      const res = await api.generate({
        clientId,
        month,
        postsCount: count,
        platforms: Array.from(platforms),
        direction: notes,
      });
      clearInterval(advanceTimer);
      setSteps((prev) =>
        prev.map((s) => {
          const match = res.steps.find((r) => r.key === s.key);
          return match ? { ...s, status: match.ok ? 'done' : 'failed', durationMs: match.durationMs } : { ...s, status: 'done' };
        }),
      );
      setResult({ postsGenerated: res.postsGenerated, costCents: res.costCents });
      toast.success('Batch ready', `${res.postsGenerated} posts drafted`);
    } catch (e) {
      clearInterval(advanceTimer);
      toast.error('Generation failed', (e as Error).message);
      setSteps((prev) => prev.map((s) => (s.status === 'doing' ? { ...s, status: 'failed' } : s)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Generate content"
        subtitle="Kick off an AI run for one client: brand voice, captions, images, and schedule."
      />

      <div className="px-4 py-4 md:px-10 md:py-6">
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[1fr_420px]">
          <Card>
            <CardContent className="p-5 md:p-6">
              <label className="block text-sm font-medium text-slate-700">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={clientsLoading || clients.length === 0}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm no-zoom disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clientsLoading ? (
                  <option>Loading clients…</option>
                ) : clients.length === 0 ? (
                  <option>No clients yet — add one from the Clients tab</option>
                ) : (
                  <>
                    {!clientId ? (
                      <option value="" disabled>
                        Select a client…
                      </option>
                    ) : null}
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} · {c.industry ?? ''}
                      </option>
                    ))}
                  </>
                )}
              </select>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Posts</label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="mt-1.5 no-zoom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Month</label>
                  <Input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="mt-1.5 no-zoom"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-700">Platforms</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                        platforms.has(p)
                          ? 'border-transparent bg-gradient-cta text-white shadow-brand'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-700">Direction (optional)</label>
                <Textarea
                  className="mt-1.5 no-zoom"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  Est. cost:{' '}
                  <span className="font-semibold text-slate-700">
                    ~€{((count * 0.3) / 1).toFixed(2)}
                  </span>
                  {' · '}Est. time 4 min
                </div>
                <Button
                  onClick={run}
                  loading={running}
                  size="lg"
                  disabled={running || clientsLoading || !clientId}
                >
                  {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                  {running
                    ? 'Running…'
                    : clientsLoading
                      ? 'Loading clients…'
                      : 'Generate'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardContent className="p-5 md:p-6">
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
                      {s.durationMs ? (
                        <span className="ml-auto text-[10px] text-slate-400">
                          {(s.durationMs / 1000).toFixed(1)}s
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <AnimatePresence>
              {result ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card>
                    <CardContent className="p-5 md:p-6">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ImageIcon className="h-4 w-4 text-[#48D886]" />
                        {result.postsGenerated} posts ready
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Est. cost ~€{(result.costCents / 100).toFixed(2)}. Head to the review queue.
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
                          >
                            <Image
                              src={`https://picsum.photos/seed/gen-${clientId}-${i}/200/200`}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ))}
                      </div>
                      <a href="/review" className="mt-4 block">
                        <Button size="sm" className="w-full">
                          Open queue
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Badge tone="brand">AI safe</Badge>
              <p className="text-xs text-slate-600">
                Every post requires human approval before publishing.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
