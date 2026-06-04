'use client';

/**
 * Personal content automation — your own viral-content channels.
 *
 * Reachable from the dashboard sidebar ("Personal") or ⌘K → "Personal channels" (g then p).
 */

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Plus,
  Sparkles,
  Zap,
  Play,
  Pause,
  Trash2,
  Save,
  AlertTriangle,
  Clock,
  Music2,
  Mic,
  CircleStop,
  CalendarPlus,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Textarea, Spinner, toast } from '@boost/ui';
import {
  ApiError,
  type PersonalAccount,
  type PersonalPost,
  type PersonalThemeSummary,
  type PersonalPlatform,
} from '@boost/api-client';
import Link from 'next/link';
import { api } from '@/lib/dashboard/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { MediaLibrary } from '@/components/dashboard/personal/MediaLibrary';
import { CharacterStudio } from '@/components/dashboard/personal/CharacterStudio';
import { GeneratorConfigPanel } from '@/components/dashboard/personal/GeneratorConfig';
import { ThemesManager } from '@/components/dashboard/personal/ThemesManager';
import { LongformPanel } from '@/components/dashboard/personal/LongformPanel';

const PLATFORMS: PersonalPlatform[] = [
  'instagram', 'tiktok', 'facebook', 'youtube', 'x', 'linkedin', 'pinterest', 'bluesky', 'google_business',
];

/* ═══════════════════════════════════════════════════════════════════ */
/* Page                                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export default function PersonalDashboardPage() {
  const { data: themes } = useSWR('personal:themes', () => api.personalThemes());
  const {
    data: accounts,
    error: accountsError,
    isLoading: accountsLoading,
    mutate: refetchAccounts,
  } = useSWR('personal:accounts', () => api.listPersonalAccounts(), {
    shouldRetryOnError: true,
    errorRetryCount: 3,
  });
  const { data: features } = useSWR('personal:features', () => api.personalFeatures());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!selectedId && accounts && accounts.length > 0) {
      setSelectedId(accounts[0]!.id);
    }
  }, [accounts, selectedId]);

  const selected = accounts?.find((a) => a.id === selectedId) ?? null;

  const accountsUnauthorized = accountsError instanceof ApiError && accountsError.status === 401;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <PageHeader
        title="Personal channels"
        subtitle="Automated pipeline for your own social accounts: themes, schedule, and generation. Use the sidebar or ⌘K → Personal (g, p)."
      />

      <FeatureBanner features={features} />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* ── Column 1: account list ─────────────────────── */}
          <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-120px)] lg:overflow-y-auto">
            <Button
              onClick={() => setCreating(true)}
              className="w-full justify-start gap-2"
              variant="primary"
            >
              <Plus className="h-4 w-4" />
              New channel
            </Button>
            {accountsError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <div className="font-semibold">
                  {accountsUnauthorized ? 'Sign in required' : 'Couldn&apos;t load channels'}
                </div>
                <p className="mt-2 break-words text-xs leading-relaxed text-rose-800/90">
                  {(accountsError as Error).message ?? 'Request failed'}
                </p>
                {accountsUnauthorized ? (
                  <div className="mt-3 space-y-2 text-xs leading-relaxed text-rose-800/90">
                    <p>
                      The API only accepts the <code className="rounded bg-rose-100 px-1 font-mono text-[11px]">bmb_session</code>{' '}
                      cookie set when you sign in on{' '}
                      <Link href="/team" className="font-semibold underline underline-offset-2">
                        Team sign-in
                      </Link>
                      . If DevTools shows a different cookie named <code className="font-mono">session</code>, that is
                      ignored here (often another local app). Sign in again from this site so{' '}
                      <code className="font-mono">bmb_session</code> is set on <code className="font-mono">localhost</code>.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-rose-800/80">
                    If you just pulled code updates, run{' '}
                    <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-[11px]">pnpm db:migrate</code> from the
                    repo root so Postgres has the latest columns, then restart the API.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void refetchAccounts()}>
                    Try again
                  </Button>
                  {accountsUnauthorized ? (
                    <Button variant="primary" size="sm" onClick={() => { window.location.href = '/team'; }}>
                      Team sign-in
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              {accountsLoading && !accounts ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-[72px] animate-pulse rounded-xl border border-slate-200 bg-slate-100/80"
                    />
                  ))}
                </div>
              ) : null}
              {!accountsLoading && !accountsError && accounts?.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No channels yet. Create one to start posting.
                </div>
              ) : null}
              {accounts?.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedId(acc.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedId === acc.id
                      ? 'border-slate-900 bg-white shadow-sm'
                      : 'border-slate-200 bg-white/50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{acc.themeEmoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {acc.accountName}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {acc.platform} · {acc.themeName}
                      </div>
                    </div>
                    <StatusDot status={acc.status} />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {acc.totalPosts} posts · {acc.postsPerDay}/day
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Column 2: detail ───────────────────────────── */}
          <main className="min-w-0">
            {creating ? (
              <CreateAccountForm
                themes={themes ?? []}
                onCancel={() => setCreating(false)}
                onCreated={(acc) => {
                  setCreating(false);
                  setSelectedId(acc.id);
                  refetchAccounts();
                }}
              />
            ) : selected ? (
              <AccountDetail
                key={selected.id}
                account={selected}
                themes={themes ?? []}
                features={features}
                onChanged={refetchAccounts}
              />
            ) : accountsError ? (
              <Card>
                <CardContent className="p-8 text-center text-slate-600">
                  <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
                  <p className="text-sm font-medium text-slate-900">
                    {accountsUnauthorized ? 'You are not signed in to the API' : 'Fix the error in the sidebar'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {accountsUnauthorized
                      ? 'Use Team sign-in so the browser gets a bmb_session cookie for this API.'
                      : 'The list request failed — your channels may still exist in the database.'}
                  </p>
                  {accountsUnauthorized ? (
                    <Button variant="primary" size="sm" className="mt-4" onClick={() => { window.location.href = '/team'; }}>
                      Open team sign-in
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                themes={themes ?? []}
                onStart={() => setCreating(true)}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Feature banner                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

function FeatureBanner({
  features,
}: {
  features: Awaited<ReturnType<typeof api.personalFeatures>> | undefined;
}) {
  if (!features) return null;
  const missing: string[] = [];
  if (!features.db) missing.push('database');
  if (!features.claude) missing.push('Claude (scripts)');
  if (!features.contentStudio) missing.push('ContentStudio (auto-posting)');
  if (!features.scrapers.pexels && !features.scrapers.unsplash && !features.scrapers.pixabay) {
    missing.push('stock media APIs');
  }
  if (!features.voice.elevenlabs && !features.voice.openai) {
    missing.push('TTS provider');
  }
  const showCsWorkspaceHint =
    features.contentStudio && !features.contentStudioDefaultWorkspace;
  if (missing.length === 0 && !showCsWorkspaceHint) return null;
  return (
    <div className="mx-auto mb-4 max-w-[1400px] space-y-2 px-4 sm:px-6 lg:px-10">
      {missing.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 sm:px-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 break-words">
            <span className="font-semibold">Running with mocks:</span> {missing.join(', ')} not configured. Videos will
            still generate but with placeholder assets. Add API keys in{' '}
            <code className="rounded bg-amber-100 px-1 [overflow-wrap:anywhere]">.env</code> to go live.
          </div>
        </div>
      ) : null}
      {showCsWorkspaceHint ? (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950 sm:px-4">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <div className="min-w-0 flex-1 break-words">
            <span className="font-semibold">ContentStudio workspace:</span> there is no default{' '}
            <code className="rounded bg-sky-100 px-1 [overflow-wrap:anywhere]">CONTENTSTUDIO_WORKSPACE_ID</code> in server
            .env. Set it, or enter a workspace id on each channel&apos;s Publishing card, so account lists and &quot;Generate
            &amp; schedule post&quot; can resolve a workspace.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Create account form                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

function CreateAccountForm({
  themes,
  onCancel,
  onCreated,
}: {
  themes: PersonalThemeSummary[];
  onCancel: () => void;
  onCreated: (a: PersonalAccount) => void;
}) {
  const [themeId, setThemeId] = useState<string>(themes[0]?.id ?? '');
  const [accountName, setAccountName] = useState('');
  const [platform, setPlatform] = useState<PersonalPlatform>('instagram');
  const [handle, setHandle] = useState('');
  const [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false);
  const [themeQuery, setThemeQuery] = useState('');

  useEffect(() => {
    if (!themeId && themes[0]) setThemeId(themes[0].id);
  }, [themes, themeId]);

  const selectedTheme = themes.find((t) => t.id === themeId);
  const filteredThemes = themes.filter((t) => {
    if (!themeQuery.trim()) return true;
    const q = themeQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.tagline.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.topicSeedExamples.some((s) => s.toLowerCase().includes(q))
    );
  });

  async function submit() {
    if (!accountName.trim() || !themeId) return;
    setBusy(true);
    try {
      const acc = await api.createPersonalAccount({
        accountName: accountName.trim(),
        platform,
        themeId,
        handle: handle.trim() || undefined,
        customDirection: direction.trim() || undefined,
        watermarkHandle: handle.trim() ? `@${handle.replace(/^@/, '').trim()}` : undefined,
      });
      toast.success('Channel created', 'Ready to generate.');
      onCreated(acc);
    } catch (e) {
      toast.error('Could not create', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">Create a channel</h2>
            <p className="mt-1 break-words text-sm text-slate-500">
              Each channel locks to one viral niche and posts on its own schedule.
            </p>
          </div>
          <Button variant="ghost" onClick={onCancel} className="shrink-0 self-start sm:self-auto">
            Cancel
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <label className="block min-w-0 text-sm font-semibold text-slate-900">
                Pick a theme <span className="text-xs font-normal text-slate-400">· {themes.length} available</span>
              </label>
              <Input
                value={themeQuery}
                onChange={(e) => setThemeQuery(e.target.value)}
                placeholder="Search themes…"
                className="w-full sm:max-w-xs sm:shrink-0"
              />
            </div>
            <div className="grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredThemes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                    themeId === t.id
                      ? 'border-slate-900 bg-slate-50 shadow-sm ring-1 ring-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="mb-1 flex w-full min-w-0 items-center justify-between gap-1">
                    <span className="shrink-0 text-2xl">{t.emoji}</span>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                      {t.template === 'animated-explainer' ? (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700">
                          1–8 min · animated
                        </span>
                      ) : null}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: t.accentColor + '22', color: t.accentColor }}
                      >
                        {t.cpmTier} CPM
                      </span>
                    </div>
                  </div>
                  <div className="w-full min-w-0 break-words text-sm font-semibold text-slate-900">{t.name}</div>
                  <div className="mt-0.5 break-words text-[12px] text-slate-500">{t.tagline}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Array.from(new Set(t.preferredPlatforms)).slice(0, 3).map((p, i) => (
                      <span
                        key={`${t.id}-plat-${i}-${p}`}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              {filteredThemes.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  No themes match "{themeQuery}".
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-900">Channel name</label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. FinanceBite IG"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-900">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PersonalPlatform)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-900">Handle (optional)</label>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@yourhandle"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-900">Theme niche</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                {selectedTheme ? (
                  <span>
                    {selectedTheme.emoji} {selectedTheme.name}
                  </span>
                ) : (
                  <span className="text-slate-400">Pick a theme above</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-900">
              Custom direction (optional)
            </label>
            <Textarea
              rows={3}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="Examples: 'focus on index funds, skip crypto hype' or 'only cover European history'"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !accountName.trim() || !themeId}>
              {busy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              Create channel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Account detail                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

function AccountDetail({
  account,
  themes,
  features,
  onChanged,
}: {
  account: PersonalAccount;
  themes: PersonalThemeSummary[];
  features: Awaited<ReturnType<typeof api.personalFeatures>> | undefined;
  onChanged: () => void;
}) {
  const theme = themes.find((t) => t.id === account.themeId);
  const {
    data: posts,
    isLoading: postsLoading,
    mutate: refetchPosts,
  } = useSWR(
    ['personal:posts', account.id],
    () => api.listPersonalPosts(account.id, { limit: 300 }),
    {
      // Poll only while a generation is in flight — failed/ready posts
      // should not keep hammering the API or look like "still loading".
      refreshInterval: (list) => {
        if (!list?.length) return 0;
        const rendering = list.some((p) => p.status === 'rendering');
        if (rendering) return 2_500;
        const busy = list.some((p) =>
          ['queued', 'scripting', 'sourcing_media', 'rendering'].includes(p.status),
        );
        return busy ? 5_000 : 0;
      },
    },
  );
  const { data: characters } = useSWR('personal:characters', () => api.listCharacters());

  /** When posts SWR updates (poll, cancel, generate, etc.), refresh accounts so the sidebar `totalPosts` / metadata match the server. */
  const postsLifecycleSig = useMemo(
    () =>
      (posts ?? [])
        .map((p) => `${p.id}:${p.status}:${p.videoUrl ? '1' : '0'}`)
        .sort()
        .join('|'),
    [posts],
  );
  useEffect(() => {
    if (!postsLifecycleSig) return;
    void onChanged();
  }, [postsLifecycleSig, onChanged]);

  const [tab, setTab] = useState<'overview' | 'media' | 'characters' | 'themes' | 'config' | 'longform'>('overview');
  const [generating, setGenerating] = useState(false);
  const [topicOverride, setTopicOverride] = useState('');

  const hasResolvableCsWorkspace = useMemo(
    () =>
      Boolean(
        (account.contentStudioWorkspaceId ?? '').trim() ||
          (features?.contentStudioDefaultWorkspace ?? false),
      ),
    [account.contentStudioWorkspaceId, features?.contentStudioDefaultWorkspace],
  );
  const canGenerateAndSchedulePost = Boolean(features?.contentStudio && hasResolvableCsWorkspace);

  async function runNow() {
    setGenerating(true);
    try {
      const res = await api.generatePersonalPost(account.id, {
        topic: topicOverride.trim() || undefined,
      });
      toast.success(
        res.pending ? 'Generation started' : 'Generation kicked off',
        res.pending
          ? 'This channel runs one encode at a time; long videos can still take many minutes.'
          : 'Check the Posts tab shortly.',
      );
      setTopicOverride('');
      void refetchPosts();
      setTimeout(() => void refetchPosts(), 2000);
      setTimeout(() => void refetchPosts(), 8000);
    } catch (e) {
      toast.error('Could not generate', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function generateAndSchedulePost() {
    setGenerating(true);
    try {
      const res = await api.generatePersonalPost(account.id, {
        topic: topicOverride.trim() || undefined,
        scheduleToContentStudio: true,
      });
      toast.success(
        res.pending ? 'Generate & post started' : 'Video queued',
        res.pending
          ? 'When the render finishes, the video is scheduled in ContentStudio in the next ~1h slot (using this channel’s workspace and connected account).'
          : 'Check Recent posts for status.',
      );
      setTopicOverride('');
      void refetchPosts();
      setTimeout(() => void refetchPosts(), 2000);
      setTimeout(() => void refetchPosts(), 8000);
    } catch (e) {
      toast.error('Could not start', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header + tabs ──────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-3xl">{account.themeEmoji}</span>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-slate-900">{account.accountName}</h2>
                <p className="break-words text-sm text-slate-500">
                  {account.platform} · {account.themeName}
                  {account.handle ? ` · ${account.handle}` : ''}
                </p>
              </div>
            </div>
            <Badge className="shrink-0 self-start sm:self-auto" tone={account.status === 'active' ? 'success' : 'default'}>
              {account.status}
            </Badge>
          </div>

          {/* ── Generate panel ──────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-900">Generate now</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Input
                value={topicOverride}
                onChange={(e) => setTopicOverride(e.target.value)}
                placeholder={`Optional topic (${theme?.topicSeedExamples[0] ?? 'auto-pick'})`}
                className="min-w-0 flex-1 sm:min-w-[200px]"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={runNow}
                  disabled={generating || account.status === 'archived'}
                  title={account.status === 'archived' ? 'Archived channels cannot generate new posts.' : undefined}
                >
                  {generating ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? 'Starting…' : 'Generate post'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={generateAndSchedulePost}
                  disabled={
                    generating ||
                    account.status === 'archived' ||
                    !canGenerateAndSchedulePost
                  }
                  title={
                    account.status === 'archived'
                      ? 'Archived channels cannot generate new posts.'
                      : !features?.contentStudio
                        ? 'Set CONTENTSTUDIO_API_KEY in .env and restart the API.'
                        : !hasResolvableCsWorkspace
                          ? 'Set CONTENTSTUDIO_WORKSPACE_ID in server .env or a workspace id under Overview → Publishing for this channel.'
                          : 'Render then schedule to ContentStudio (~1h from now) using this channel’s workspace and connected account below.'
                  }
                >
                  <CalendarPlus className="h-4 w-4" />
                  Generate &amp; schedule post
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              <span className="font-medium text-slate-500">Generate post</span> — video only. To publish after render, use
              Overview → Publishing, or turn on Auto-approve + Auto-schedule on the schedule card.{' '}
              <span className="font-medium text-slate-500">Generate &amp; schedule post</span> — requires ContentStudio API
              key and a resolvable workspace (server default or per-channel Publishing). With ContentStudio off, the API
              uses mock scheduling only.
            </p>
          </div>

          {/* ── Tabs ────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
            <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
              Overview
            </TabButton>
            <TabButton active={tab === 'media'} onClick={() => setTab('media')}>
              Media
            </TabButton>
            <TabButton active={tab === 'characters'} onClick={() => setTab('characters')}>
              Characters
            </TabButton>
            <TabButton active={tab === 'themes'} onClick={() => setTab('themes')}>
              Themes
            </TabButton>
            <TabButton active={tab === 'config'} onClick={() => setTab('config')}>
              Style &amp; config
            </TabButton>
            <TabButton active={tab === 'longform'} onClick={() => setTab('longform')}>
              Long-form
            </TabButton>
          </div>
        </CardContent>
      </Card>

      {/* ── Tab content ────────────────────────────────────── */}
      {tab === 'overview' ? (
        <>
          <ScheduleCard account={account} onChanged={onChanged} />
          <PublishingCard account={account} features={features} onChanged={onChanged} />
          <TopicsCard account={account} onChanged={onChanged} theme={theme} />
          <PostsGrid
            accountId={account.id}
            posts={posts}
            isLoading={postsLoading}
            onPostsChanged={() => {
              void refetchPosts();
            }}
          />
        </>
      ) : null}

      {tab === 'media' ? (
        <MediaLibrary account={account} characters={characters ?? []} />
      ) : null}

      {tab === 'characters' ? <CharacterStudio /> : null}

      {tab === 'themes' ? <ThemesManager /> : null}

      {tab === 'config' ? (
        <GeneratorConfigPanel
          account={account}
          characters={characters ?? []}
          onChanged={onChanged}
        />
      ) : null}

      {tab === 'longform' ? (
        <LongformPanel
          account={account}
          theme={theme}
          onChanged={onChanged}
          onPostsChanged={() => void refetchPosts()}
          onSwitchTab={(t) => setTab(t)}
        />
      ) : null}
    </div>
  );
}

function PublishingCard({
  account,
  features,
  onChanged,
}: {
  account: PersonalAccount;
  features: Awaited<ReturnType<typeof api.personalFeatures>> | undefined;
  onChanged: () => void;
}) {
  const [workspaceId, setWorkspaceId] = useState(account.contentStudioWorkspaceId ?? '');
  const [accountIdPick, setAccountIdPick] = useState(account.contentStudioAccountId ?? '');
  const [connected, setConnected] = useState<Array<{ platform: string; handle: string; id: string }>>([]);
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [listBanner, setListBanner] = useState<'empty' | 'mismatch' | null>(null);

  useEffect(() => {
    setWorkspaceId(account.contentStudioWorkspaceId ?? '');
    setAccountIdPick(account.contentStudioAccountId ?? '');
    setConnected([]);
    setListBanner(null);
  }, [account.id, account.contentStudioWorkspaceId, account.contentStudioAccountId]);

  const platformMatches = connected.filter((a) => a.platform === account.platform);
  const savedPickMissingFromList =
    Boolean(accountIdPick.trim()) && !platformMatches.some((a) => a.id === accountIdPick);

  async function loadConnected() {
    setLoadBusy(true);
    try {
      const res = await api.listPersonalContentStudioAccounts(workspaceId.trim() || undefined);
      const accounts = res.accounts ?? [];
      setConnected(accounts);
      if (!res.configured) {
        setListBanner(null);
        toast.error('ContentStudio API key missing', 'Set CONTENTSTUDIO_API_KEY in .env and restart the API.');
      } else if (accounts.length === 0) {
        setListBanner('empty');
        toast.info(
          'No connected accounts in this workspace',
          'Check the workspace id, server CONTENTSTUDIO_WORKSPACE_ID, and that social accounts are linked in ContentStudio.',
        );
      } else {
        const matches = accounts.filter((a) => a.platform === account.platform);
        setListBanner(matches.length === 0 ? 'mismatch' : null);
        toast.success('Loaded connected accounts', `${accounts.length} from ContentStudio.`);
      }
    } catch (e) {
      setListBanner(null);
      toast.error('Could not load accounts', (e as Error).message);
    } finally {
      setLoadBusy(false);
    }
  }

  async function savePublishing() {
    setSaveBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        contentStudioWorkspaceId: workspaceId.trim() ? workspaceId.trim() : null,
        contentStudioAccountId: accountIdPick.trim() || null,
      });
      toast.success('Publishing settings saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }

  const csOk = Boolean(features?.contentStudio);
  const envDefaultWorkspace = Boolean(features?.contentStudioDefaultWorkspace);

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-600">Publishing (ContentStudio)</h3>
        <p className="mb-4 text-xs text-slate-500">
          API key and default workspace live in server <code className="rounded bg-slate-100 px-1">.env</code>. Per channel
          you can override the workspace and pick which connected social account receives posts (same platform as this
          channel: <span className="font-medium">{account.platform}</span>).
        </p>

        {!csOk ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ContentStudio integration is off — configure CONTENTSTUDIO_API_KEY to enable scheduling.
          </div>
        ) : null}

        {csOk && !envDefaultWorkspace && !(account.contentStudioWorkspaceId ?? '').trim() && !workspaceId.trim() ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            No server-wide default workspace is set. Enter a workspace id here (or set{' '}
            <code className="rounded bg-sky-100 px-1">CONTENTSTUDIO_WORKSPACE_ID</code> in .env) before Refresh list will
            return accounts.
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Workspace id (optional override)">
            <Input
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="Defaults from CONTENTSTUDIO_WORKSPACE_ID"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Connected account for this platform">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={accountIdPick}
                onChange={(e) => setAccountIdPick(e.target.value)}
                className="w-full min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Auto — first {account.platform} account in workspace</option>
                {savedPickMissingFromList ? (
                  <option value={accountIdPick}>
                    Saved account (not in current list — refresh or pick another)
                  </option>
                ) : null}
                {platformMatches.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.handle || a.id} ({a.platform})
                  </option>
                ))}
              </select>
              <Button type="button" variant="ghost" size="sm" onClick={loadConnected} disabled={loadBusy || !csOk}>
                {loadBusy ? <Spinner className="h-4 w-4" /> : 'Refresh list'}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Click Refresh list after setting workspace id (or leave blank to use env default). Only accounts matching
              this channel&apos;s platform are listed.
            </p>
          </Field>
        </div>

        {csOk && listBanner === 'empty' ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            The last refresh returned no accounts for this workspace. Confirm the workspace id, that{' '}
            <code className="rounded bg-slate-200 px-1">CONTENTSTUDIO_WORKSPACE_ID</code> is set if you rely on the
            default, and that ContentStudio has at least one connected social account.
          </div>
        ) : null}
        {csOk && listBanner === 'mismatch' ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This workspace has connected accounts, but none match this channel&apos;s platform ({account.platform}).
            Connect the right network in ContentStudio or pick a workspace that includes it.
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={savePublishing} disabled={saveBusy || !csOk} size="sm">
            {saveBusy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save publishing settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-b-2 border-slate-900 text-slate-900'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Schedule card                                                        */
/* ═══════════════════════════════════════════════════════════════════ */

function ScheduleCard({
  account,
  onChanged,
}: {
  account: PersonalAccount;
  onChanged: () => void;
}) {
  const [postsPerDay, setPostsPerDay] = useState(account.postsPerDay);
  const [hour, setHour] = useState(account.postingHourUtc);
  const [minute, setMinute] = useState(account.postingMinuteUtc);
  const [spacing, setSpacing] = useState(account.postSpacingMinutes);
  const [autoApprove, setAutoApprove] = useState(account.autoApprove);
  const [autoSchedule, setAutoSchedule] = useState(account.autoSchedule);
  const [autoGenerateOnSchedule, setAutoGenerateOnSchedule] = useState(
    account.autoGenerateOnSchedule ?? false,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPostsPerDay(account.postsPerDay);
    setHour(account.postingHourUtc);
    setMinute(account.postingMinuteUtc);
    setSpacing(account.postSpacingMinutes);
    setAutoApprove(account.autoApprove);
    setAutoSchedule(account.autoSchedule);
    setAutoGenerateOnSchedule(account.autoGenerateOnSchedule ?? false);
  }, [account]);

  async function toggleScheduleAutopilot() {
    setBusy(true);
    try {
      const next = !(account.autoGenerateOnSchedule ?? false);
      await api.updatePersonalAccount(account.id, {
        autoGenerateOnSchedule: next,
      });
      onChanged();
    } catch (e) {
      toast.error('Could not update schedule', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reactivateChannelStatus() {
    setBusy(true);
    try {
      await api.updatePersonalAccount(account.id, { status: 'active' });
      toast.success('Channel resumed — scheduled runs can run when autopilot is on.');
      onChanged();
    } catch (e) {
      toast.error('Could not update channel', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        postsPerDay,
        postingHourUtc: hour,
        postingMinuteUtc: minute,
        postSpacingMinutes: spacing,
        autoApprove,
        autoSchedule,
        autoGenerateOnSchedule,
      });
      toast.success('Schedule saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAcc() {
    if (!confirm('Delete this channel and all of its posts? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.deletePersonalAccount(account.id);
      toast.success('Channel deleted');
      onChanged();
    } catch (e) {
      toast.error('Could not delete', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        {account.status === 'paused' && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span>
              This channel was fully paused (legacy). Scheduled runs stay off until you resume the channel.
              Manual Generate still works.
            </span>
            <Button variant="outline" size="sm" className="shrink-0 border-amber-300" onClick={reactivateChannelStatus} disabled={busy}>
              Resume channel
            </Button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="min-w-0 text-sm font-bold uppercase tracking-wide text-slate-600">Schedule</h3>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleScheduleAutopilot}
              disabled={busy || account.status === 'archived' || account.status === 'paused'}
              title={
                account.status === 'paused'
                  ? 'Resume the channel first — full pause blocks scheduled runs until then.'
                  : undefined
              }
            >
              {account.autoGenerateOnSchedule ? (
                <>
                  <Pause className="h-4 w-4" /> Pause schedule
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Resume schedule
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={deleteAcc} disabled={busy}>
              <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Posts / day">
            <select
              value={postsPerDay}
              onChange={(e) => setPostsPerDay(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hour UTC">
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minute">
            <select
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  :{String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Spacing (min)">
            <Input
              type="number"
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              min={30}
              max={720}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
          <Toggle
            label="Automatically generate videos on this schedule"
            checked={autoGenerateOnSchedule}
            onChange={setAutoGenerateOnSchedule}
            disabled={account.status === 'paused' || account.status === 'archived'}
          />
          <Toggle label="Auto-approve" checked={autoApprove} onChange={setAutoApprove} />
          <Toggle label="Auto-schedule to ContentStudio" checked={autoSchedule} onChange={setAutoSchedule} />
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 break-words text-xs text-slate-500">
            <Clock className="mr-1 inline h-3 w-3 shrink-0" />
            {account.status === 'archived'
              ? 'Channel archived — restore it to use generation.'
              : account.status === 'paused'
                ? 'Channel status is paused — resume the channel above for scheduled runs, or use Generate post manually.'
                : autoGenerateOnSchedule
                  ? account.nextRunAt
                    ? `Next run: ${new Date(account.nextRunAt).toLocaleString()}`
                    : 'Next run: — (save schedule to set)'
                  : 'Scheduled generation off — use Generate post above or Resume schedule.'}
          </div>
          <Button onClick={save} disabled={busy} size="sm" className="w-full shrink-0 sm:w-auto">
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-sm ${disabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-700'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 disabled:opacity-50"
      />
      {label}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Topics card                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

function TopicsCard({
  account,
  onChanged,
  theme,
}: {
  account: PersonalAccount;
  onChanged: () => void;
  theme?: PersonalThemeSummary;
}) {
  const [seeds, setSeeds] = useState<string>(account.topicSeeds.join('\n'));
  const [blacklist, setBlacklist] = useState<string>(account.topicBlacklist.join('\n'));
  const [direction, setDirection] = useState<string>(account.customDirection ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        topicSeeds: seeds.split('\n').map((s) => s.trim()).filter(Boolean),
        topicBlacklist: blacklist.split('\n').map((s) => s.trim()).filter(Boolean),
        customDirection: direction.trim() || undefined,
      });
      toast.success('Topics saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-600">
          Topics & direction
        </h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Topic seeds — one per line
            </label>
            <Textarea
              rows={6}
              value={seeds}
              onChange={(e) => setSeeds(e.target.value)}
              placeholder={
                theme?.topicSeedExamples.join('\n') ?? 'e.g.\nCompound interest in plain English\nThe rule of 72'
              }
            />
            <p className="mt-1 text-[11px] text-slate-400">
              The engine rotates through these and asks Claude for a fresh angle each time.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Blacklist — one per line
            </label>
            <Textarea
              rows={6}
              value={blacklist}
              onChange={(e) => setBlacklist(e.target.value)}
              placeholder="e.g.\ncrypto hype\nday trading\nget-rich-quick"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Anything on this list never appears in a generated script.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Custom direction
          </label>
          <Textarea
            rows={3}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="e.g. 'avoid politics entirely, keep tone curious not hype-driven'"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={busy} size="sm">
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save topics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Posts grid                                                           */
/* ═══════════════════════════════════════════════════════════════════ */

function postPosterAspectClass(ar: PersonalPost['aspectRatio']): string {
  switch (ar) {
    case '16:9':
      return 'aspect-video';
    case '1:1':
      return 'aspect-square';
    case '4:5':
      return 'aspect-[4/5]';
    case '9:16':
    default:
      return 'aspect-[9/16]';
  }
}

function PostsGrid({
  accountId,
  posts,
  isLoading,
  onPostsChanged,
}: {
  accountId: string;
  posts: PersonalPost[] | undefined;
  isLoading: boolean;
  onPostsChanged: () => void;
}) {
  const failedInView = (posts ?? []).filter((p) => p.status === 'failed');
  const [clearingFailed, setClearingFailed] = useState(false);

  async function clearAllFailed() {
    if (failedInView.length === 0) return;
    if (
      !confirm(
        'Delete every failed video for this channel? This cannot be undone. (Includes failed posts not shown in the recent list.)',
      )
    ) {
      return;
    }
    setClearingFailed(true);
    try {
      const { deleted } = await api.deleteFailedPersonalPosts(accountId);
      toast.success(
        deleted === 0 ? 'Nothing to remove' : 'Failed videos removed',
        deleted === 0 ? 'No failed posts were in the database.' : `Removed ${deleted} failed post(s).`,
      );
      onPostsChanged();
    } catch (e) {
      toast.error('Could not remove failed posts', (e as Error).message);
    } finally {
      setClearingFailed(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Spinner className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading posts…</p>
          <p className="mt-1 text-xs text-slate-500">Past videos stay here; this list can take a moment on first open.</p>
        </CardContent>
      </Card>
    );
  }

  const list = posts ?? [];

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Sparkles className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No posts yet</p>
          <p className="mt-1 text-xs text-slate-500">Click Generate post above to create your first video.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
            Recent posts ({list.length})
          </h3>
          {failedInView.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={clearingFailed}
              onClick={() => void clearAllFailed()}
            >
              {clearingFailed ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove all failed
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <PostCard key={p.id} accountId={accountId} post={p} onPostsChanged={onPostsChanged} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const IN_PROGRESS_POST_STATUSES = new Set(['queued', 'scripting', 'sourcing_media', 'rendering']);

/** One combined progress readout for the whole pipeline (not encode-only). */
function postGenerationProgressUi(post: PersonalPost): { percent: number; label: string } | null {
  if (post.videoUrl) return null;
  if (
    post.status === 'failed' ||
    post.status === 'ready' ||
    post.status === 'scheduled' ||
    post.status === 'published'
  ) {
    return null;
  }
  if (!IN_PROGRESS_POST_STATUSES.has(post.status)) return null;

  const encodePct =
    typeof post.renderProgress === 'number'
      ? Math.min(100, Math.max(0, post.renderProgress))
      : null;

  switch (post.status) {
    case 'queued':
      return { percent: 5, label: 'In queue…' };
    case 'scripting':
      return { percent: 22, label: 'Writing script & storyboard…' };
    case 'sourcing_media':
      return { percent: 55, label: 'Creating visuals & audio…' };
    case 'rendering': {
      const base = 72;
      const span = 27;
      const blend = encodePct != null ? base + (encodePct / 100) * span : base + span * 0.35;
      return {
        percent: Math.min(99, blend),
        label: 'Assembling your video…',
      };
    }
    default:
      return { percent: 10, label: 'Working…' };
  }
}

function PostCard({
  post,
  accountId,
  onPostsChanged,
}: {
  post: PersonalPost;
  accountId: string;
  onPostsChanged: () => void;
}) {
  const statusMeta = statusFor(post.status);
  const genUi = postGenerationProgressUi(post);
  const [stopping, setStopping] = useState(false);

  async function stopGeneration() {
    if (!IN_PROGRESS_POST_STATUSES.has(post.status)) return;
    if (!confirm('Stop this generation? The video will be marked as failed.')) return;
    setStopping(true);
    try {
      await api.cancelPersonalPost(accountId, post.id);
      toast.success('Generation stopped');
      onPostsChanged();
    } catch (e) {
      toast.error('Could not stop', (e as Error).message);
    } finally {
      setStopping(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div
        className={`relative overflow-hidden bg-slate-100 ${postPosterAspectClass(post.aspectRatio)}`}
        style={{ minHeight: 180 }}
      >
        {post.videoUrl ? (
          <video
            src={post.videoUrl}
            controls
            className="h-full w-full object-cover"
            poster={post.mediaAssets[0]?.url}
          />
        ) : post.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-rose-50 p-3 text-center">
            <AlertTriangle className="h-8 w-8 shrink-0 text-rose-500" />
            <p className="text-xs font-semibold text-rose-900">Generation failed</p>
            {post.errorMessage ? (
              <p className="max-h-28 min-w-0 overflow-y-auto break-words text-[10px] leading-snug text-rose-800">
                {post.errorMessage}
              </p>
            ) : null}
          </div>
        ) : post.mediaAssets[0]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaAssets[0].url}
            alt={post.title}
            className="h-full w-full object-cover opacity-70"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-6 w-6 text-slate-400" />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        </div>
        {post.durationSeconds ? (
          <div className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            {post.durationSeconds}s
          </div>
        ) : null}
      </div>
      {genUi ? (
        <div className="relative z-10 min-w-0 border-t border-slate-200/90 bg-slate-950 px-3 py-2.5 text-white">
          <div className="mb-0.5 flex min-w-0 items-baseline justify-between gap-2 text-[10px] font-medium">
            <span className="min-w-0 truncate">Creating video</span>
            <span className="shrink-0 tabular-nums">{Math.round(genUi.percent)}%</span>
          </div>
          <p className="mb-1.5 min-w-0 break-words text-[10px] leading-snug text-emerald-100/95">{genUi.label}</p>
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, genUi.percent))}%`,
                }}
              />
            </div>
            <button
              type="button"
              disabled={stopping}
              onClick={() => void stopGeneration()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {stopping ? <Spinner className="h-3 w-3" /> : <CircleStop className="h-3 w-3" />}
              Stop
            </button>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 p-3">
        <div className="break-words text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
          {post.title || post.topic}
        </div>
        <div className="mt-1 break-words text-[12px] leading-snug text-slate-500 line-clamp-2">{post.hook}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {post.voiceoverUrl ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700">
              <Mic className="h-3 w-3" /> VO
            </span>
          ) : null}
          {post.musicUrl ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
              <Music2 className="h-3 w-3" /> Music
            </span>
          ) : null}
          {post.mediaAssets.some((m) => m.source === 'news') ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
              News
            </span>
          ) : null}
          {post.mediaAssets.some((m) => m.source === 'wikipedia') ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
              Wiki
            </span>
          ) : null}
        </div>
        {post.errorMessage ? (
          <div className="mt-2 break-words rounded-md bg-rose-50 p-2 text-[11px] text-rose-700">
            {post.errorMessage}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function statusFor(status: string): {
  label: string;
  tone: 'success' | 'default' | 'warning' | 'danger';
} {
  switch (status) {
    case 'scheduled':
    case 'published':
      return { label: status, tone: 'success' };
    case 'ready':
      return { label: 'ready', tone: 'success' };
    case 'failed':
      return { label: 'failed', tone: 'danger' };
    case 'queued':
    case 'scripting':
    case 'sourcing_media':
      return { label: status.replace('_', ' '), tone: 'warning' };
    case 'rendering':
      return {
        label: 'finishing',
        tone: 'warning',
      };
    default:
      return { label: status, tone: 'default' };
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Status dot                                                           */
/* ═══════════════════════════════════════════════════════════════════ */

function StatusDot({ status }: { status: PersonalAccount['status'] }) {
  const color =
    status === 'active' ? 'bg-emerald-500' : status === 'paused' ? 'bg-amber-500' : 'bg-slate-400';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Empty state                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

function EmptyState({ themes, onStart }: { themes: PersonalThemeSummary[]; onStart: () => void }) {
  const [query, setQuery] = useState('');
  const filtered = themes.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.tagline.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.topicSeedExamples.some((s) => s.toLowerCase().includes(q))
    );
  });
  return (
    <Card>
      <CardContent className="p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-400">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Create your first channel</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            Pick a viral niche, set a posting schedule, and the pipeline writes scripts, scrapes real imagery, mixes voice + music, and schedules to ContentStudio — every day, automatically.
          </p>
          <Button className="mt-6" onClick={onStart}>
            <Plus className="h-4 w-4" />
            New channel
          </Button>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900">
                All {themes.length} themes
              </div>
              <div className="break-words text-xs text-slate-500">
                Sorted by virality score. Click <b>New channel</b> above to pick one.
              </div>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search themes…"
              className="w-full sm:max-w-xs sm:shrink-0"
            />
          </div>
          <div className="grid max-h-[640px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={onStart}
                className="flex flex-col items-start rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:shadow-sm"
              >
                <div className="mb-1 flex w-full min-w-0 items-center justify-between gap-1">
                  <span className="shrink-0 text-xl">{t.emoji}</span>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: t.accentColor + '22', color: t.accentColor }}
                  >
                    {t.cpmTier} CPM
                  </span>
                </div>
                <div className="w-full min-w-0 break-words text-xs font-semibold text-slate-900">{t.name}</div>
                <div className="mt-0.5 line-clamp-2 min-w-0 break-words text-[10px] text-slate-500">{t.tagline}</div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                No themes match "{query}".
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
