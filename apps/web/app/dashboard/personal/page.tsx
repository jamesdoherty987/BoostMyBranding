'use client';

/**
 * Personal content automation — your own viral-content channels.
 *
 * Reachable from the dashboard sidebar ("Personal") or ⌘K → "Personal channels" (g then p).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  RefreshCw,
  Share2,
  Download,
  ImageDown,
  Info,
  Mail,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Textarea, Spinner, toast, Dialog, confirmDialog } from '@boost/ui';
import {
  ApiError,
  type PersonalAccount,
  type PersonalPost,
  type PersonalGenerationInfo,
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
  const accountsNetworkError =
    accountsError instanceof ApiError ? accountsError.isNetworkError : false;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <PageHeader
        title="Personal channels"
        subtitle={
          <>
            <span className="block text-pretty">
              Automated pipeline for your own social accounts: themes, schedule, and generation.
            </span>
            <span className="mt-1.5 hidden text-pretty text-slate-500 sm:block">
              Use the sidebar menu or ⌘K → Personal (g, p).
            </span>
          </>
        }
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
                  {accountsUnauthorized ? 'Sign in required' : "Couldn't load channels"}
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
                ) : accountsNetworkError ? (
                  <div className="mt-3 space-y-2 text-xs leading-relaxed text-rose-800/90">
                    <p>
                      The browser could not reach the API (often the dev server is stopped, the URL is
                      wrong, or CORS blocked the request). Confirm{' '}
                      <code className="rounded bg-rose-100 px-1 font-mono text-[11px]">NEXT_PUBLIC_API_URL</code>{' '}
                      in your web env matches a running API (default{' '}
                      <code className="font-mono">http://127.0.0.1:4000</code> in dev). In production, leave{' '}
                      <code className="rounded bg-rose-100 px-1 font-mono text-[11px]">NEXT_PUBLIC_API_URL</code> unset
                      so requests use same-origin <code className="font-mono">/api</code> (Vercel → Railway). Then restart the API after
                      pulling changes. Use either{' '}
                      <code className="font-mono">localhost</code> or <code className="font-mono">127.0.0.1</code>{' '}
                      consistently for both dashboard and API env URLs.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-rose-800/80">
                    If the API returned a database error after pulling code, run{' '}
                    <code className="rounded bg-rose-100 px-1 py-0.5 font-mono text-[11px]">pnpm db:migrate</code>{' '}
                    from the repo root, then restart the API.
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
            .env. Set it, or enter a workspace id on each channel's <strong>Posting</strong> tab, so account lists and "Generate
            & schedule post" can resolve a workspace.
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
        const sourcing = list.some((p) => p.status === 'sourcing_media');
        if (sourcing) return 3_000;
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

  const [tab, setTab] = useState<
    'overview' | 'posting' | 'media' | 'characters' | 'themes' | 'config' | 'longform'
  >('overview');
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

  const videoExampleTitleCount = useMemo(() => {
    if ((account.formatKind ?? 'video') !== 'video') return 99;
    return (account.styleBible?.exampleVideoTitles ?? []).filter(
      (t) => String(t).trim().length > 0,
    ).length;
  }, [account.formatKind, account.styleBible]);

  async function runNow() {
    setGenerating(true);
    try {
      const fresh = await api.getPersonalAccount(account.id);
      const exampleCount = (fresh.styleBible?.exampleVideoTitles ?? []).filter(
        (t) => String(t).trim().length > 0,
      ).length;
      if ((fresh.formatKind ?? 'video') === 'video' && exampleCount < 1) {
        toast.error(
          'Example video titles required',
          'Add at least one under Style & config (and save) before generating video posts.',
        );
        return;
      }
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
      const fresh = await api.getPersonalAccount(account.id);
      const exampleCount = (fresh.styleBible?.exampleVideoTitles ?? []).filter(
        (t) => String(t).trim().length > 0,
      ).length;
      if ((fresh.formatKind ?? 'video') === 'video' && exampleCount < 1) {
        toast.error(
          'Example video titles required',
          'Add at least one under Style & config (and save) before generating video posts.',
        );
        return;
      }
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
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <Button
                  className="w-full min-w-0 sm:w-auto"
                  onClick={() => void runNow()}
                  disabled={generating || account.status === 'archived'}
                  title={
                    account.status === 'archived'
                      ? 'Archived channels cannot generate new posts.'
                      : videoExampleTitleCount < 1
                        ? 'Add example video titles under Style & config (and save). The button still works once they are saved on the server.'
                        : undefined
                  }
                >
                  {generating ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? 'Starting…' : 'Generate post'}
                </Button>
                <Button
                  className="w-full min-w-0 sm:w-auto"
                  variant="secondary"
                  onClick={() => void generateAndSchedulePost()}
                  disabled={
                    generating ||
                    account.status === 'archived' ||
                    !canGenerateAndSchedulePost
                  }
                  title={
                    account.status === 'archived'
                      ? 'Archived channels cannot generate new posts.'
                      : videoExampleTitleCount < 1
                        ? 'Add example video titles under Style & config (and save). The button still works once they are saved on the server.'
                        : !features?.contentStudio
                          ? 'Set CONTENTSTUDIO_API_KEY in .env and restart the API.'
                          : !hasResolvableCsWorkspace
                            ? 'Set CONTENTSTUDIO_WORKSPACE_ID in server .env or a workspace id under the Posting tab for this channel.'
                            : 'Render then schedule to ContentStudio (~1h from now) using this channel’s workspace and connected account (Posting tab).'
                  }
                >
                  <CalendarPlus className="h-4 w-4" />
                  Generate & schedule post
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              <span className="font-medium text-slate-500">Generate post</span> — creates the video. It will{' '}
              <strong>not</strong> queue in Content Studio unless{' '}
              <span className="font-medium text-slate-500">Posting → Send to Content Studio</span> is on (or you use
              Generate &amp; schedule below).{' '}
              <span className="font-medium text-slate-500">Generate &amp; schedule post</span> — always queues in
              Content Studio after render (~1h slot) when the API key and workspace are set.
            </p>
          </div>

          {/* ── Tabs (horizontal scroll on narrow screens — many tabs) ── */}
          <div className="relative -mx-2 mt-6 min-w-0 border-b border-slate-200 px-2 sm:mx-0 sm:px-0">
            <div className="-mb-px flex gap-0 overflow-x-auto overflow-y-hidden pb-px [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
              Overview
            </TabButton>
            <TabButton active={tab === 'posting'} onClick={() => setTab('posting')}>
              <span className="inline-flex items-center gap-1">
                <Share2 className="h-3.5 w-3.5 opacity-80" />
                Posting
              </span>
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
              Style & config
            </TabButton>
            <TabButton active={tab === 'longform'} onClick={() => setTab('longform')}>
              Long-form
            </TabButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tab content ────────────────────────────────────── */}
      {tab === 'overview' ? (
        <>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">Where videos get published</h3>
                  <p className="mt-1 text-xs leading-snug text-slate-600">
                    YouTube, Instagram, TikTok, and other networks are connected inside{' '}
                    <span className="font-semibold">Content Studio</span> (each platform uses its own OAuth there). Use
                    the <span className="font-semibold">Posting</span> tab to map this channel to a workspace and pick
                    which connected account receives finished videos.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {features?.contentStudioAppUrl ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => window.open(features.contentStudioAppUrl!, '_blank', 'noopener,noreferrer')}
                    >
                      Open Content Studio
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => setTab('posting')}>
                    Posting settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <ScheduleCard account={account} onChanged={onChanged} onOpenPostingTab={() => setTab('posting')} />
          <TopicsCard account={account} onChanged={onChanged} theme={theme} />
          <PostsGrid
            accountId={account.id}
            posts={posts}
            isLoading={postsLoading}
            videoDeliveryEmail={account.videoDeliveryEmail ?? null}
            emailDeliveryEnabled={Boolean(features?.resend)}
            onPostsChanged={async (): Promise<void> => {
              await refetchPosts();
            }}
          />
        </>
      ) : null}

      {tab === 'posting' ? (
        <PublishingCard account={account} features={features} onChanged={onChanged} />
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
          onPostsChanged={async (): Promise<void> => {
            await refetchPosts();
          }}
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
  const [postToContentStudio, setPostToContentStudio] = useState(account.autoSchedule);
  const [connected, setConnected] = useState<
    Array<{ platform: string; handle: string; id: string; label: string }>
  >([]);
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [testEmailBusy, setTestEmailBusy] = useState(false);
  const [listBanner, setListBanner] = useState<'empty' | 'mismatch' | null>(null);
  const [contentStudioListError, setContentStudioListError] = useState<string | null>(null);
  const [workspacesList, setWorkspacesList] = useState<Array<{ id: string; name: string }> | null>(null);
  const [workspacesBusy, setWorkspacesBusy] = useState(false);
  const [emailVideoOnReady, setEmailVideoOnReady] = useState(account.emailVideoOnReady ?? false);
  const [videoDeliveryEmail, setVideoDeliveryEmail] = useState(account.videoDeliveryEmail ?? '');

  const csOk = Boolean(features?.contentStudio);
  const envDefaultWorkspace = Boolean(features?.contentStudioDefaultWorkspace);
  const resendOk = Boolean(features?.resend);

  useEffect(() => {
    setWorkspaceId(account.contentStudioWorkspaceId ?? '');
    setAccountIdPick(account.contentStudioAccountId ?? '');
  }, [account.id, account.contentStudioWorkspaceId, account.contentStudioAccountId]);

  /** Invalidate cached Content Studio list only when workspace or channel row changes — not when only the pinned account id is saved (that was clearing the dropdown and falsely showing "not in list"). */
  useEffect(() => {
    setConnected([]);
    setListBanner(null);
    setContentStudioListError(null);
  }, [account.id, account.contentStudioWorkspaceId]);

  useEffect(() => {
    setPostToContentStudio(account.autoSchedule);
  }, [account.autoSchedule]);

  useEffect(() => {
    setEmailVideoOnReady(account.emailVideoOnReady ?? false);
    setVideoDeliveryEmail(account.videoDeliveryEmail ?? '');
  }, [account.id, account.emailVideoOnReady, account.videoDeliveryEmail]);

  /** Load Content Studio accounts when Posting opens so dropdown options have real ids (not only after manual refresh). */
  useEffect(() => {
    if (!csOk) return;
    if (!workspaceId.trim() && !envDefaultWorkspace) return;
    let cancelled = false;
    void (async () => {
      try {
        setContentStudioListError(null);
        const res = await api.listPersonalContentStudioAccounts(workspaceId.trim() || undefined);
        if (cancelled) return;
        const err = res.listError?.trim() || null;
        setContentStudioListError(err);
        const accounts = res.accounts ?? [];
        setConnected(accounts);
        if (!res.configured) {
          setListBanner(null);
        } else if (err) {
          setListBanner(null);
        } else if (accounts.length === 0) {
          setListBanner('empty');
        } else {
          const matches = accounts.filter((a) => a.platform === account.platform);
          setListBanner(matches.length === 0 ? 'mismatch' : null);
        }
      } catch {
        if (!cancelled) {
          setConnected([]);
          setContentStudioListError(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account.id, account.platform, csOk, envDefaultWorkspace, workspaceId]);

  const platformMatches = connected.filter((a) => a.platform === account.platform);
  const normId = (s: string) => String(s).trim();
  const savedPickMissingFromList =
    Boolean(accountIdPick.trim()) &&
    !platformMatches.some((a) => normId(a.id) === normId(accountIdPick));

  async function loadConnected() {
    setLoadBusy(true);
    try {
      setContentStudioListError(null);
      const res = await api.listPersonalContentStudioAccounts(workspaceId.trim() || undefined);
      const err = res.listError?.trim() || null;
      setContentStudioListError(err);
      const accounts = res.accounts ?? [];
      setConnected(accounts);
      if (!res.configured) {
        setListBanner(null);
        toast.error('ContentStudio API key missing', 'Set CONTENTSTUDIO_API_KEY in .env and restart the API.');
      } else if (err) {
        setListBanner(null);
        toast.error('ContentStudio did not return accounts', err);
      } else if (accounts.length === 0) {
        setListBanner('empty');
        toast.info(
          'No connected accounts in this workspace',
          'Use “List workspaces” to verify the workspace id, or connect YouTube in the Content Studio app for that workspace.',
        );
      } else {
        const matches = accounts.filter((a) => a.platform === account.platform);
        setListBanner(matches.length === 0 ? 'mismatch' : null);
        toast.success('Loaded connected accounts', `${accounts.length} from ContentStudio.`);
      }
    } catch (e) {
      setListBanner(null);
      setContentStudioListError(null);
      toast.error('Could not load accounts', (e as Error).message);
    } finally {
      setLoadBusy(false);
    }
  }

  async function loadWorkspacesFromApi() {
    setWorkspacesBusy(true);
    try {
      const res = await api.listPersonalContentStudioWorkspaces();
      const err = res.listError?.trim() || null;
      if (!res.configured) {
        setWorkspacesList(null);
        toast.error('ContentStudio API key missing', 'Set CONTENTSTUDIO_API_KEY in .env and restart the API.');
        return;
      }
      if (err) {
        setWorkspacesList(null);
        toast.error('Could not list workspaces', err);
        return;
      }
      const list = res.workspaces ?? [];
      setWorkspacesList(list);
      if (list.length === 0) {
        toast.info('No workspaces', 'This API key has no workspaces, or the response shape changed.');
      } else {
        toast.success('Workspaces loaded', `${list.length} workspace(s). Pick the id that matches where you connected YouTube.`);
      }
    } catch (e) {
      setWorkspacesList(null);
      toast.error('Could not list workspaces', (e as Error).message);
    } finally {
      setWorkspacesBusy(false);
    }
  }

  async function savePublishing() {
    setSaveBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        contentStudioWorkspaceId: workspaceId.trim() ? workspaceId.trim() : null,
        contentStudioAccountId: accountIdPick.trim() || null,
        autoSchedule: postToContentStudio,
        emailVideoOnReady,
        videoDeliveryEmail: videoDeliveryEmail.trim() ? videoDeliveryEmail.trim() : null,
      });
      toast.success('Posting settings saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }

  async function sendTestDeliveryEmail() {
    setTestEmailBusy(true);
    try {
      // Persist current form values first so the test uses what you see on screen.
      await api.updatePersonalAccount(account.id, {
        contentStudioWorkspaceId: workspaceId.trim() ? workspaceId.trim() : null,
        contentStudioAccountId: accountIdPick.trim() || null,
        autoSchedule: postToContentStudio,
        emailVideoOnReady,
        videoDeliveryEmail: videoDeliveryEmail.trim() ? videoDeliveryEmail.trim() : null,
      });
      const res = await api.testPersonalVideoDeliveryEmail(account.id);
      toast.success(
        'Test email sent',
        res.usedRealVideo
          ? `Check ${res.to} (and spam). Used your latest video link.`
          : `Check ${res.to} (and spam). No ready video yet — used a placeholder link.`,
      );
      onChanged();
    } catch (e) {
      toast.error('Test email failed', (e as Error).message);
    } finally {
      setTestEmailBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-600">Posting &amp; delivery</h3>
        <p className="mb-3 min-w-0 text-pretty break-words text-xs leading-relaxed text-slate-500">
          <strong className="text-slate-700">You cannot add YouTube or other social logins inside this dashboard</strong>{' '}
          — OAuth happens in the Content Studio product. Checklist: (1) In Content Studio, connect each network (YouTube,
          Instagram, …). (2) Put <code className="rounded bg-slate-100 px-1">CONTENTSTUDIO_API_KEY</code> and{' '}
          <code className="rounded bg-slate-100 px-1">CONTENTSTUDIO_WORKSPACE_ID</code> in the API <code className="rounded bg-slate-100 px-1">.env</code>{' '}
          and restart the API. (3) Below, confirm workspace id (or leave blank to use the env default). (4){' '}
          <em>Refresh list</em> and pick the connected account that matches this channel&apos;s platform ({account.platform}
          ). (5) Turn on <strong>Send to Content Studio</strong> only when you want finished videos queued there automatically.
          (6) Save. For uploads, production needs public video URLs (R2 or <code className="rounded bg-slate-100 px-1">API_PUBLIC_URL</code>
          ) so Content Studio can fetch the file.
        </p>
        {features?.contentStudioAppUrl ? (
          <p className="mb-4 text-xs text-slate-600">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mr-2 align-middle"
              onClick={() => window.open(features.contentStudioAppUrl!, '_blank', 'noopener,noreferrer')}
            >
              Open Content Studio
            </Button>
            Connect Instagram, YouTube, TikTok, etc. there; they will appear in the dropdown after Refresh list.
          </p>
        ) : (
          <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Set <code className="rounded bg-slate-200 px-1">CONTENTSTUDIO_APP_URL</code> in the API{' '}
            <code className="rounded bg-slate-200 px-1">.env</code> to show an &quot;Open Content Studio&quot; button here
            (your team&apos;s Content Studio web URL).
          </p>
        )}
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

        {csOk ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <Toggle
              label="Send finished videos to Content Studio after generation"
              checked={postToContentStudio}
              onChange={setPostToContentStudio}
              disabled={!csOk}
            />
            <p className="mt-2 text-[11px] leading-snug text-slate-600">
              When <strong>off</strong>, videos stay in this app (ready / pending approval). Scheduled autopilot also
              won&apos;t push to Content Studio until you turn this on. The <strong>Generate &amp; schedule post</strong>{' '}
              button on Overview still queues in Content Studio in one step (explicit).
            </p>
          </div>
        ) : null}

        <h3 className="mt-8 mb-1 text-sm font-bold uppercase tracking-wide text-slate-600">Email when ready (Resend)</h3>
        <p className="mb-3 min-w-0 text-pretty break-words text-xs leading-relaxed text-slate-500">
          When enabled, each finished render triggers an email from your API&apos;s{' '}
          <code className="rounded bg-slate-100 px-1">FROM_EMAIL</code> with a <strong>public download link</strong> to the MP4
          (no file attachment — better for large videos and Resend limits). Requires{' '}
          <code className="rounded bg-slate-100 px-1">RESEND_API_KEY</code> in server <code className="rounded bg-slate-100 px-1">.env</code>
          , and the <strong>domain</strong> used in <code className="rounded bg-slate-100 px-1">FROM_EMAIL</code> must be verified in your Resend
          project (otherwise Resend returns &quot;domain is not verified&quot; and no mail is sent).
        </p>
        {!resendOk ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Email delivery is unavailable — add <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> to the API .env
            (and verify <code className="rounded bg-amber-100 px-1">FROM_EMAIL</code> is verified in Resend), then restart the API.
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <Toggle
              label="Email me a link when a new video finishes rendering"
              checked={emailVideoOnReady}
              onChange={setEmailVideoOnReady}
              disabled={!resendOk}
            />
            <div className="mt-3">
              <Field label="Send to">
                <Input
                  type="email"
                  value={videoDeliveryEmail}
                  onChange={(e) => setVideoDeliveryEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="text-sm"
                  disabled={!resendOk}
                  autoComplete="email"
                />
              </Field>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-slate-600">
              Use <strong>Save posting settings</strong> below. Finished videos also have an <strong>Email</strong>{' '}
              button that sends a short link email (copy title / save video / save thumbnail to Photos). If the
              address is empty or invalid, the server skips sending.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void sendTestDeliveryEmail()}
                disabled={testEmailBusy || saveBusy || !resendOk || !emailVideoOnReady || !videoDeliveryEmail.trim()}
              >
                {testEmailBusy ? <Spinner className="h-4 w-4" /> : null}
                Send test email
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Workspace id (optional override)">
            <Input
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="Defaults from CONTENTSTUDIO_WORKSPACE_ID"
              className="font-mono text-xs"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void loadWorkspacesFromApi()}
                disabled={workspacesBusy || !csOk}
              >
                {workspacesBusy ? <Spinner className="h-4 w-4" /> : 'List workspaces'}
              </Button>
              <span className="text-[11px] text-slate-500">
                Uses your API key — copy the workspace where you connected YouTube, then Refresh list.
              </span>
            </div>
            {workspacesList && workspacesList.length > 0 ? (
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 text-[11px]">
                {workspacesList.map((w) => (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b border-slate-100 py-1 last:border-b-0"
                  >
                    <span className="min-w-0 font-medium text-slate-800">{w.name}</span>
                    <code className="shrink-0 text-[10px] text-slate-600 [overflow-wrap:anywhere]">{w.id}</code>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWorkspaceId(w.id)}>
                      Use id
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>
          <Field label="Connected account for this platform">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={accountIdPick}
                onChange={(e) => setAccountIdPick(e.target.value)}
                className="w-full min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  Auto — first {account.platform} account in this workspace (no pinned id)
                </option>
                {savedPickMissingFromList ? (
                  <option value={accountIdPick}>
                    Saved selection (id not in current list — refresh or pick again)
                  </option>
                ) : null}
                {platformMatches.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <Button type="button" variant="ghost" size="sm" onClick={loadConnected} disabled={loadBusy || !csOk}>
                {loadBusy ? <Spinner className="h-4 w-4" /> : 'Refresh list'}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Click Refresh list after setting workspace id (or leave blank to use env default). Only accounts matching
              this channel's platform are listed.
            </p>
          </Field>
        </div>

        {csOk && contentStudioListError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-950">
            <strong className="font-semibold">Content Studio API:</strong> {contentStudioListError}
          </div>
        ) : null}

        {csOk && !contentStudioListError && listBanner === 'empty' ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            The last refresh returned no accounts for this workspace. Use <strong>List workspaces</strong> to confirm
            the id, set <code className="rounded bg-slate-200 px-1">CONTENTSTUDIO_WORKSPACE_ID</code> in the API{' '}
            <code className="rounded bg-slate-200 px-1">.env</code> if you rely on the default, and connect YouTube (and
            other networks) inside the Content Studio app for <em>that</em> workspace — then Refresh list again.
          </div>
        ) : null}
        {csOk && listBanner === 'mismatch' ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This workspace has connected accounts, but none match this channel's platform ({account.platform}).
            Connect the right network in ContentStudio or pick a workspace that includes it.
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={savePublishing} disabled={saveBusy} size="sm">
            {saveBusy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save posting settings
          </Button>
          {!csOk ? (
            <span className="self-center text-[11px] text-slate-500">
              Content Studio is off — you can still save email delivery settings.
            </span>
          ) : null}
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
      className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium transition sm:px-4 ${
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
  onOpenPostingTab,
}: {
  account: PersonalAccount;
  onChanged: () => void;
  onOpenPostingTab: () => void;
}) {
  const [postsPerDay, setPostsPerDay] = useState(account.postsPerDay);
  const [hour, setHour] = useState(account.postingHourUtc);
  const [minute, setMinute] = useState(account.postingMinuteUtc);
  const [spacing, setSpacing] = useState(account.postSpacingMinutes);
  const [autoApprove, setAutoApprove] = useState(account.autoApprove);
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
    if (
      !(await confirmDialog({
        title: 'Delete this channel?',
        description: 'This removes the channel and all of its posts permanently. This cannot be undone.',
        confirmLabel: 'Delete channel',
        danger: true,
      }))
    ) {
      return;
    }
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
        </div>

        <p className="mt-3 text-xs leading-snug text-slate-500">
          <strong className="text-slate-700">Content Studio:</strong> whether finished videos are sent there is controlled on the{' '}
          <button
            type="button"
            className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
            onClick={onOpenPostingTab}
          >
            Posting
          </button>{' '}
          tab (<em>Send finished videos to Content Studio after generation</em>). Saving this schedule card does not change that setting.
        </p>

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

function formatMusicSource(s: PersonalGenerationInfo['musicSource']): string {
  if (s === 'custom_bed') return 'Custom uploaded bed';
  if (s === 'library') return 'Library track';
  return '—';
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-1.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}

function PostGenerationInfoDialog({
  open,
  onClose,
  info,
  postTemplateId,
}: {
  open: boolean;
  onClose: () => void;
  info: PersonalGenerationInfo | null;
  postTemplateId: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Video details"
      description="Snapshot of models and settings used for this render."
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {!info ? (
        <p className="text-sm leading-snug text-slate-600">
          No snapshot for this post yet. New renders store models, TTS, music, and cost here.
        </p>
      ) : (
        <dl className="m-0">
          <InfoRow
            label="Pipeline"
            value={info.pipeline === 'director' ? 'Director (multi-shot)' : 'Classic pipeline'}
          />
          <InfoRow label="Post template" value={postTemplateId || '—'} />
          <InfoRow label="Theme template" value={info.themeTemplate ?? '—'} />
          <InfoRow label="Image model" value={info.imageModelId ?? '—'} />
          <InfoRow label="Video model" value={info.videoModelId ?? '—'} />
          <InfoRow label="Script model" value={info.scriptModel ?? '—'} />
          <InfoRow label="TTS provider" value={info.ttsProvider ?? '—'} />
          <InfoRow label="TTS voice id" value={<span className="font-mono text-xs">{info.ttsVoiceId ?? '—'}</span>} />
          <InfoRow label="TTS speed" value={info.ttsSpeed != null ? String(info.ttsSpeed) : '—'} />
          <InfoRow label="Music source" value={formatMusicSource(info.musicSource)} />
          <InfoRow
            label="Music bed level (1–10)"
            value={info.musicBackgroundLevel != null ? String(info.musicBackgroundLevel) : 'Default'}
          />
          <InfoRow label="Music credit" value={info.musicAttribution ?? '—'} />
          <InfoRow label="Stitch encode" value={info.stitchEncodePreset ?? '—'} />
          <InfoRow label="Quality tier" value={info.qualityTier ?? '—'} />
          <InfoRow
            label="Long-form"
            value={
              info.longformEnabled == null ? '—' : info.longformEnabled ? 'Yes' : 'No'
            }
          />
          <InfoRow
            label="Est. generation cost"
            value={info.costCents != null ? `${(info.costCents / 100).toFixed(2)} USD` : '—'}
          />
          <InfoRow label="Recorded at" value={new Date(info.completedAt).toLocaleString()} />
        </dl>
      )}
    </Dialog>
  );
}

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
  videoDeliveryEmail,
  emailDeliveryEnabled,
  onPostsChanged,
}: {
  accountId: string;
  posts: PersonalPost[] | undefined;
  isLoading: boolean;
  videoDeliveryEmail: string | null;
  emailDeliveryEnabled: boolean;
  onPostsChanged: () => void | Promise<void>;
}) {
  const failedInView = (posts ?? []).filter((p) => p.status === 'failed');
  const [clearingFailed, setClearingFailed] = useState(false);
  const canEmailPosts =
    emailDeliveryEnabled && Boolean((videoDeliveryEmail ?? '').trim());

  async function clearAllFailed() {
    if (
      !(await confirmDialog({
        title: 'Delete all failed videos?',
        description:
          failedInView.length > 0
            ? `This permanently deletes every failed post for this channel (${failedInView.length} failed in this list; any other failed rows in the database are included too). This cannot be undone.`
            : 'This permanently deletes every failed post for this channel, including failures that are not in this recent list. This cannot be undone.',
        confirmLabel: 'Delete all failed',
        danger: true,
      }))
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
      await Promise.resolve(onPostsChanged());
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
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Recent posts ({list.length})
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={clearingFailed}
              onClick={() => void clearAllFailed()}
              title="Deletes every post in failed status for this channel (not only the ones visible here)"
            >
              {clearingFailed ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete all failed
              {failedInView.length > 0 ? (
                <span className="ml-0.5 rounded-full bg-rose-100 px-1.5 py-0 text-[10px] font-bold tabular-nums text-rose-800">
                  {failedInView.length}
                </span>
              ) : null}
            </Button>
          </div>
          <p className="text-xs leading-snug text-slate-500">
            Each finished post has{' '}
            <span className="font-semibold text-slate-600">Add video to Camera Roll</span> and{' '}
            <span className="font-semibold text-slate-600">Add thumbnail to Camera Roll</span> (when a thumbnail
            exists). Use <span className="font-semibold text-slate-600">Email</span> to send a download /
            Save to Photos link to the address in Posting. On iPhone, the share sheet opens after a second tap
            once the file is ready.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <PostCard
              key={p.id}
              accountId={accountId}
              post={p}
              canEmailDelivery={canEmailPosts}
              deliveryEmailHint={(videoDeliveryEmail ?? '').trim() || null}
              onPostsChanged={onPostsChanged}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const IN_PROGRESS_POST_STATUSES = new Set(['queued', 'scripting', 'sourcing_media', 'rendering']);

const VIDEO_FILE_READY_STATUSES = new Set(['ready', 'scheduled', 'published']);

function postVideoFilename(post: PersonalPost): string {
  const raw = ((post.title ?? '').trim() || (post.topic ?? '').trim() || 'video')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  return raw.toLowerCase().endsWith('.mp4') ? raw : `${raw || 'video'}.mp4`;
}

function canSaveOrDownloadPostVideo(post: PersonalPost): boolean {
  return Boolean(post.videoUrl?.trim()) && VIDEO_FILE_READY_STATUSES.has(post.status);
}

/** Saves MP4 via same-origin API proxy (storage URLs often block CORS). */
async function downloadPostVideoFile(post: PersonalPost): Promise<void> {
  const url = api.personalPostVideoDownloadUrl(post.accountId, post.id);
  const filename = postVideoFilename(post);
  const res = await fetch(url, { mode: 'cors', credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type PreparedMediaShare = { file: File; title: string; shareUrl: string };

type SharePhotosGesture = { variant: 'video' | 'thumbnail'; prepared: PreparedMediaShare };

/** Same-origin authenticated download URL (used for URL-only share fallback). */
async function preparePostVideoForShare(post: PersonalPost): Promise<PreparedMediaShare> {
  const shareUrl = api.personalPostVideoDownloadUrl(post.accountId, post.id);
  const filename = postVideoFilename(post);
  const title = ((post.title ?? '').trim() || (post.topic ?? '').trim() || 'Video').slice(0, 120);
  const res = await fetch(shareUrl, { mode: 'cors', credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load video (HTTP ${res.status})`);
  const blob = await res.blob();
  const type = blob.type && /^video\//i.test(blob.type) ? blob.type : 'video/mp4';
  const file = new File([blob], filename, { type });
  return { file, title, shareUrl };
}

/**
 * Safari / all browsers on iOS only treat `navigator.share()` as user-initiated if it runs
 * in the same turn as the tap. `await fetch()` before `share()` loses the gesture →
 * NotAllowedError (“The request is not allowed…”). We always use a second tap there.
 *
 * Covers iPhone, iPod touch, iPad (including “desktop” Safari UA), and Chromium on iOS.
 */
function isIosLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } })
    .userAgentData;
  if (uaData?.platform === 'iOS') return true;
  // iPadOS “Request Desktop Website” often reports Macintosh + touch.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Mobile-first: Web Share with a File so iOS/Android can “Save Video” / add to Photos.
 * On iOS (and if one-tap share is denied), returns `secondTap` so the UI can call `share()`
 * from a **second** button press after the video is loaded.
 */
async function sharePostVideoForCameraRoll(
  post: PersonalPost,
): Promise<{ outcome: 'done' } | { outcome: 'secondTap'; prepared: PreparedMediaShare }> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.share) {
    throw new Error(
      'Sharing is not available in this browser. On your phone expand "Need the file?" for MP4/JPEG, or use Download on a wider screen.',
    );
  }

  const prepared = await preparePostVideoForShare(post);

  if (isIosLike()) {
    return { outcome: 'secondTap', prepared };
  }

  if (nav.canShare?.({ files: [prepared.file] })) {
    try {
      await nav.share({ files: [prepared.file], title: prepared.title });
      return { outcome: 'done' };
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'AbortError') return { outcome: 'done' };
      if (name === 'NotAllowedError' || name === 'InvalidStateError') {
        return { outcome: 'secondTap', prepared };
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  if (nav.canShare?.({ url: prepared.shareUrl })) {
    try {
      await nav.share({
        title: prepared.title,
        text: 'Open the link, then use your browser menu to save the video.',
        url: prepared.shareUrl,
      });
      return { outcome: 'done' };
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'AbortError') return { outcome: 'done' };
      if (name === 'NotAllowedError') return { outcome: 'secondTap', prepared };
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  return { outcome: 'secondTap', prepared };
}

function postThumbnailFilename(post: PersonalPost): string {
  const raw = ((post.title ?? '').trim() || (post.topic ?? '').trim() || 'thumbnail')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  const base = raw || 'thumbnail';
  const lower = base.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return base;
  return `${base}.jpg`;
}

function canSaveOrDownloadPostThumbnail(post: PersonalPost): boolean {
  return Boolean(post.thumbnailUrl?.trim()) && VIDEO_FILE_READY_STATUSES.has(post.status);
}

/** Poster JPEG via same-origin API proxy (matches video download — R2 may block CORS). */
async function downloadPostThumbnailFile(post: PersonalPost): Promise<void> {
  const url = api.personalPostThumbnailDownloadUrl(post.accountId, post.id);
  const filename = postThumbnailFilename(post);
  const res = await fetch(url, { mode: 'cors', credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function preparePostThumbnailForShare(post: PersonalPost): Promise<PreparedMediaShare> {
  const shareUrl = api.personalPostThumbnailDownloadUrl(post.accountId, post.id);
  const filename = postThumbnailFilename(post);
  const title = `${((post.title ?? '').trim() || (post.topic ?? '').trim() || 'Thumbnail').slice(0, 100)} (thumbnail)`;
  const res = await fetch(shareUrl, { mode: 'cors', credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load thumbnail (HTTP ${res.status})`);
  const blob = await res.blob();
  const type = blob.type && /^image\//i.test(blob.type) ? blob.type : 'image/jpeg';
  const file = new File([blob], filename, { type });
  return { file, title, shareUrl };
}

/** Same iOS second-tap pattern as {@link sharePostVideoForCameraRoll}. */
async function sharePostThumbnailForCameraRoll(
  post: PersonalPost,
): Promise<{ outcome: 'done' } | { outcome: 'secondTap'; prepared: PreparedMediaShare }> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.share) {
    throw new Error(
      'Sharing is not available in this browser. On your phone expand "Need the file?" for MP4/JPEG, or use Download on a wider screen.',
    );
  }

  const prepared = await preparePostThumbnailForShare(post);

  if (isIosLike()) {
    return { outcome: 'secondTap', prepared };
  }

  if (nav.canShare?.({ files: [prepared.file] })) {
    try {
      await nav.share({ files: [prepared.file], title: prepared.title });
      return { outcome: 'done' };
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'AbortError') return { outcome: 'done' };
      if (name === 'NotAllowedError' || name === 'InvalidStateError') {
        return { outcome: 'secondTap', prepared };
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  if (nav.canShare?.({ url: prepared.shareUrl })) {
    try {
      await nav.share({
        title: prepared.title,
        text: 'Open the link, then save the image from your browser (e.g. for a YouTube custom thumbnail).',
        url: prepared.shareUrl,
      });
      return { outcome: 'done' };
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'AbortError') return { outcome: 'done' };
      if (name === 'NotAllowedError') return { outcome: 'secondTap', prepared };
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  return { outcome: 'secondTap', prepared };
}

/** `navigator.share({ files })` must run in a direct tap after `fetch` (iOS WebKit). */
async function sharePreparedToCameraRoll(
  variant: 'video' | 'thumbnail',
  prepared: PreparedMediaShare,
  onDismiss: () => void,
): Promise<void> {
  const nav = navigator;
  if (!nav.share) {
    toast.error(
      variant === 'thumbnail' ? 'Thumbnail' : 'Video',
      'Sharing is not available. Expand "Need the file?" on your phone, or use Download on a wider screen.',
    );
    return;
  }
  const { file, title, shareUrl } = prepared;
  const toastLabel = variant === 'thumbnail' ? 'Thumbnail' : 'Video';

  const tryShareUrl = async (fileShareErr?: unknown): Promise<void> => {
    const detail =
      fileShareErr instanceof Error
        ? fileShareErr.message
        : fileShareErr != null
          ? String(fileShareErr)
          : '';
    if (!nav.canShare?.({ url: shareUrl })) {
      toast.error(
        toastLabel,
        `${variant === 'thumbnail' ? 'Could not share the image.' : 'Could not share the video.'}${detail ? ` ${detail}` : ''} Open in Safari (not an in-app browser). On a phone, expand "Need the file?" below for MP4 / JPEG, or use a wider window.`,
      );
      return;
    }
    try {
      await nav.share({
        title,
        text:
          variant === 'thumbnail'
            ? 'Open in Safari while signed in, then save the image to Photos.'
            : 'Open in Safari while signed in, then save the video to Photos.',
        url: shareUrl,
      });
      queueMicrotask(() => onDismiss());
    } catch (e2: unknown) {
      const n2 = (e2 as { name?: string })?.name;
      if (n2 === 'AbortError') {
        queueMicrotask(() => onDismiss());
        return;
      }
      toast.error(toastLabel, e2 instanceof Error ? e2.message : String(e2));
    }
  };

  try {
    await nav.share({ files: [file], title });
    /** Defer so callers can clear UI state (e.g. `setShareBusy`) before this unmounts the prompt. */
    queueMicrotask(() => onDismiss());
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name;
    if (name === 'AbortError') {
      queueMicrotask(() => onDismiss());
      return;
    }
    await tryShareUrl(e);
  }
}

function ShareToPhotosInlinePrompt({
  variant,
  prepared,
  onDismiss,
}: {
  variant: 'video' | 'thumbnail';
  prepared: PreparedMediaShare;
  onDismiss: () => void;
}) {
  const [shareBusy, setShareBusy] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const hint =
    variant === 'thumbnail'
      ? 'Ready. Tap Share, then Save Image or Add to Camera Roll.'
      : 'Ready. Tap Share, then Save Video or Add to Camera Roll.';

  useLayoutEffect(() => {
    bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, []);

  return (
    <div
      ref={bannerRef}
      role="status"
      aria-live="polite"
      aria-label={variant === 'thumbnail' ? 'Thumbnail ready to add to Camera Roll' : 'Video ready to add to Camera Roll'}
      className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/95 px-2.5 py-2.5 max-sm:py-3"
    >
      <p className="text-xs font-medium leading-snug text-emerald-950 max-sm:text-[13px]">{hint}</p>
      <div className="mt-2.5 flex flex-wrap items-stretch gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="touch-manipulation min-h-11 min-w-[7.5rem] gap-2 px-4 text-sm max-sm:min-h-[48px] max-sm:text-[15px]"
          disabled={shareBusy}
          onClick={() => {
            if (shareBusy) return;
            setShareBusy(true);
            void sharePreparedToCameraRoll(variant, prepared, onDismiss).finally(() => setShareBusy(false));
          }}
        >
          {shareBusy ? <Spinner className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          Share
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="touch-manipulation min-h-11 px-3 text-sm text-slate-600 max-sm:min-h-[48px]"
          onClick={onDismiss}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function useIsNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);
  return narrow;
}

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
      return { percent: 5, label: 'In queue — starts when the current video finishes' };
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
  canEmailDelivery,
  deliveryEmailHint,
  onPostsChanged,
}: {
  post: PersonalPost;
  accountId: string;
  canEmailDelivery: boolean;
  deliveryEmailHint: string | null;
  onPostsChanged: () => void | Promise<void>;
}) {
  const statusMeta = statusFor(post.status);
  const genUi = postGenerationProgressUi(post);
  const [stopping, setStopping] = useState(false);
  const videoTitle = (post.title ?? '').trim();
  const topicSeed = (post.topic ?? '').trim();
  const isWaitingInAccountQueue = topicSeed.startsWith('⏳ In queue');
  const busyPlanningTitle =
    IN_PROGRESS_POST_STATUSES.has(post.status) && !videoTitle && Boolean(topicSeed) && !isWaitingInAccountQueue;
  const headline =
    videoTitle ||
    (busyPlanningTitle ? 'Planning channel headline…' : '') ||
    (isWaitingInAccountQueue ? 'Waiting in queue' : '') ||
    '—';
  const [playing, setPlaying] = useState(false);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [shareSaveBusy, setShareSaveBusy] = useState(false);
  const [thumbDownloadBusy, setThumbDownloadBusy] = useState(false);
  const [thumbShareSaveBusy, setThumbShareSaveBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  /** iOS WebKit: `share()` must run on a second tap after `fetch` (see share helpers above). */
  const [shareGesture, setShareGesture] = useState<SharePhotosGesture | null>(null);
  const narrow = useIsNarrowScreen();
  /** Avoid SSR/client mismatch: capability is read only after mount (brief flash of extra buttons is OK). */
  const [uiReady, setUiReady] = useState(false);
  useEffect(() => {
    setUiReady(true);
  }, []);
  const clientShare =
    uiReady && typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  /** On phones with Web Share, hide top-level file downloads to keep one obvious path to Photos. */
  const simplifyMobileSave = narrow && clientShare;
  const shareSheetOpen = shareGesture != null;
  const saveRowBusy =
    downloadBusy || shareSaveBusy || thumbDownloadBusy || thumbShareSaveBusy || emailBusy;
  const saveRowDisabled = saveRowBusy || shareSheetOpen;
  useEffect(() => {
    setPlaying(false);
    setShareGesture(null);
  }, [post.id]);

  const posterUrl = post.videoUrl?.trim()
    ? post.thumbnailUrl?.trim() || undefined
    : (post.thumbnailUrl?.trim() || post.mediaAssets[0]?.url) ?? undefined;

  async function stopGeneration() {
    if (!IN_PROGRESS_POST_STATUSES.has(post.status)) return;
    if (
      !(await confirmDialog({
        title: 'Stop this generation?',
        description: 'The run will be cancelled and this post will be marked as failed.',
        confirmLabel: 'Stop generation',
        danger: true,
      }))
    ) {
      return;
    }
    setStopping(true);
    try {
      await api.cancelPersonalPost(accountId, post.id);
      toast.success('Generation stopped');
      await Promise.resolve(onPostsChanged());
    } catch (e) {
      toast.error('Could not stop', (e as Error).message);
    } finally {
      setStopping(false);
    }
  }

  const canRegenerateThumb =
    Boolean(post.videoUrl?.trim()) &&
    ['ready', 'scheduled', 'published'].includes(post.status);

  async function regenerateThumbnail() {
    if (!canRegenerateThumb) return;
    setThumbBusy(true);
    try {
      await api.regeneratePersonalPostThumbnail(accountId, post.id);
      toast.success('Thumbnail updated');
      await Promise.resolve(onPostsChanged());
    } catch (e) {
      toast.error('Could not regenerate thumbnail', (e as Error).message);
    } finally {
      setThumbBusy(false);
    }
  }

  async function deleteThisPost() {
    if (
      !(await confirmDialog({
        title: 'Delete this video?',
        description:
          'This permanently removes the post from this channel. If it was published elsewhere, that does not unpublish the social post. This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.deletePersonalPost(accountId, post.id);
      toast.success('Video removed');
      await Promise.resolve(onPostsChanged());
    } catch (e) {
      toast.error('Could not delete', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div
        className={`relative w-full overflow-hidden bg-slate-100 ${postPosterAspectClass(post.aspectRatio)} max-h-[min(78vh,720px)]`}
        style={{ minHeight: 180 }}
      >
        {post.videoUrl ? (
          playing ? (
            <div className="relative flex h-full min-h-0 w-full items-center justify-center bg-black">
              <video
                src={post.videoUrl}
                controls
                playsInline
                className="h-full w-full object-cover"
                poster={posterUrl}
              />
              <button
                type="button"
                onClick={() => setPlaying(false)}
                className="absolute left-2 top-10 z-10 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-black/75"
              >
                Back to poster
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group relative flex h-full min-h-[180px] w-full cursor-pointer border-0 bg-black p-0 text-left"
              aria-label="Play video"
            >
              {posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={posterUrl}
                  src={posterUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <Play className="h-12 w-12 text-white/70" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg ring-4 ring-black/20 transition-transform group-hover:scale-105">
                  <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
                </span>
              </div>
            </button>
          )
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
          <div className="relative h-full min-h-[180px] w-full bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl ?? post.mediaAssets[0].url}
              alt={videoTitle || topicSeed || 'Post'}
              className="h-full w-full object-cover opacity-95"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-6 w-6 text-slate-400" />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        </div>
        {(() => {
          const sec =
            post.durationSeconds ??
            (!post.videoUrl && post.plannedDurationSeconds ? post.plannedDurationSeconds : null);
          if (sec == null) return null;
          const approx = post.durationSeconds == null && post.plannedDurationSeconds != null;
          return (
            <div className="absolute right-2 top-2 z-[15] rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              {approx ? '~' : ''}
              {sec}s
            </div>
          );
        })()}
        {!playing ? (
          <button
            type="button"
            aria-label="Delete this video"
            title="Delete this video"
            disabled={deleting}
            onClick={(e) => {
              e.stopPropagation();
              void deleteThisPost();
            }}
            className="absolute bottom-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-md backdrop-blur-sm transition hover:bg-rose-600/90 disabled:opacity-50"
          >
            {deleting ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
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
        <div
          className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug text-slate-900"
          title={videoTitle || undefined}
        >
          {headline}
        </div>
        {post.createdAt ? (
          <p
            className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"
            title={new Date(post.createdAt).toISOString()}
          >
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="touch-manipulation max-sm:min-h-11 max-sm:px-3 h-7 gap-1 px-2 text-[11px] text-slate-600 max-sm:text-xs"
            disabled={saveRowDisabled}
            onClick={() => setInfoOpen(true)}
          >
            <Info className="h-3.5 w-3.5" />
            Details
          </Button>
          {canSaveOrDownloadPostVideo(post) ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`touch-manipulation max-sm:min-h-11 max-sm:px-3 h-7 gap-1 px-2 text-[11px] ${simplifyMobileSave ? 'hidden' : ''}`}
                disabled={saveRowDisabled}
                title="Saves an MP4 to your device (streams through the API so the browser can save it)."
                onClick={(e) => {
                  e.stopPropagation();
                  void (async () => {
                    setDownloadBusy(true);
                    try {
                      await downloadPostVideoFile(post);
                      toast.success('Download started', 'Check your downloads folder for the MP4.');
                    } catch (err) {
                      toast.info('Download', (err as Error).message);
                    } finally {
                      setDownloadBusy(false);
                    }
                  })();
                }}
              >
                {downloadBusy ? <Spinner className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="touch-manipulation max-sm:min-h-11 max-sm:px-3 max-sm:text-[10px] max-sm:leading-snug h-7 gap-1 px-2 text-[11px] whitespace-normal text-left"
                disabled={saveRowDisabled}
                title={
                  simplifyMobileSave
                    ? 'Add this video to your Camera Roll via the share sheet. On iPhone: when you see Ready, tap Share, then Save Video.'
                    : 'Add this video to your Camera Roll (Photos) via the share sheet. On iPhone you tap twice: first prepares the file, then Share opens the sheet.'
                }
                onClick={(e) => {
                  e.stopPropagation();
                  void (async () => {
                    setShareSaveBusy(true);
                    try {
                      const result = await sharePostVideoForCameraRoll(post);
                      if (result.outcome === 'secondTap') {
                        setShareGesture({ variant: 'video', prepared: result.prepared });
                        return;
                      }
                    } catch (err) {
                      toast.error('Video', (err as Error).message);
                    } finally {
                      setShareSaveBusy(false);
                    }
                  })();
                }}
              >
                {shareSaveBusy ? <Spinner className="h-3 w-3 shrink-0" /> : <Share2 className="h-3 w-3 shrink-0" />}
                <span>Add video to Camera Roll</span>
              </Button>
              {canEmailDelivery ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="touch-manipulation max-sm:min-h-11 max-sm:px-3 h-7 gap-1 px-2 text-[11px]"
                  disabled={saveRowDisabled}
                  title={
                    deliveryEmailHint
                      ? `Email a download / Save to Photos link to ${deliveryEmailHint}`
                      : 'Email a download / Save to Photos link'
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      setEmailBusy(true);
                      try {
                        const res = await api.emailPersonalPostDelivery(accountId, post.id);
                        toast.success(
                          'Email sent',
                          `Check ${res.to} (and spam) — tap Save video / Save thumbnail to add to Photos.`,
                        );
                      } catch (err) {
                        toast.error('Email failed', (err as Error).message);
                      } finally {
                        setEmailBusy(false);
                      }
                    })();
                  }}
                >
                  {emailBusy ? <Spinner className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  Email
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="touch-manipulation max-sm:min-h-11 max-sm:px-3 h-7 gap-1 px-2 text-[11px]"
                  disabled={saveRowDisabled}
                  title="Set a delivery email under Personal → Posting, then you can email this video"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info(
                      'Email not configured',
                      'Open Posting, set Video delivery email (and ensure Resend is set up on the API), then Save.',
                    );
                  }}
                >
                  <Mail className="h-3 w-3" />
                  Email
                </Button>
              )}
            </>
          ) : null}
          {canSaveOrDownloadPostThumbnail(post) ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`touch-manipulation max-sm:min-h-11 max-sm:px-3 h-7 gap-1 px-2 text-[11px] ${simplifyMobileSave ? 'hidden' : ''}`}
                disabled={saveRowDisabled}
                title="Saves the poster / YouTube-style thumbnail as a JPEG (same-origin API proxy)."
                onClick={(e) => {
                  e.stopPropagation();
                  void (async () => {
                    setThumbDownloadBusy(true);
                    try {
                      await downloadPostThumbnailFile(post);
                      toast.success('Download started', 'Check your downloads for the JPEG (use as YouTube custom thumbnail).');
                    } catch (err) {
                      toast.info('Download JPEG', (err as Error).message);
                    } finally {
                      setThumbDownloadBusy(false);
                    }
                  })();
                }}
              >
                {thumbDownloadBusy ? <Spinner className="h-3 w-3" /> : <ImageDown className="h-3 w-3" />}
                JPEG
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="touch-manipulation max-sm:min-h-11 max-sm:px-3 max-sm:text-[10px] max-sm:leading-snug h-7 gap-1 px-2 text-[11px] whitespace-normal text-left"
                disabled={saveRowDisabled}
                title={
                  simplifyMobileSave
                    ? 'Add this thumbnail image to your Camera Roll via the share sheet.'
                    : 'Add this thumbnail JPEG to your Camera Roll (Photos) via the share sheet (same two-step flow as video on iPhone).'
                }
                onClick={(e) => {
                  e.stopPropagation();
                  void (async () => {
                    setThumbShareSaveBusy(true);
                    try {
                      const result = await sharePostThumbnailForCameraRoll(post);
                      if (result.outcome === 'secondTap') {
                        setShareGesture({ variant: 'thumbnail', prepared: result.prepared });
                        return;
                      }
                    } catch (err) {
                      toast.error('Thumbnail', (err as Error).message);
                    } finally {
                      setThumbShareSaveBusy(false);
                    }
                  })();
                }}
              >
                {thumbShareSaveBusy ? <Spinner className="h-3 w-3 shrink-0" /> : <Share2 className="h-3 w-3 shrink-0" />}
                <span>Add thumbnail to Camera Roll</span>
              </Button>
            </>
          ) : null}
          {canRegenerateThumb ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-manipulation max-sm:min-h-11 max-sm:px-3 h-7 gap-1 px-2 text-[11px]"
              disabled={thumbBusy || saveRowDisabled}
              onClick={() => void regenerateThumbnail()}
            >
              {thumbBusy ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
              Regenerate thumbnail
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-1">
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
        </div>
        {shareGesture ? (
          <ShareToPhotosInlinePrompt
            variant={shareGesture.variant}
            prepared={shareGesture.prepared}
            onDismiss={() => setShareGesture(null)}
          />
        ) : null}
        {simplifyMobileSave && (canSaveOrDownloadPostVideo(post) || canSaveOrDownloadPostThumbnail(post)) ? (
          <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50/90 sm:hidden">
            <summary className="cursor-pointer select-none px-2 py-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100/80">
              Need the MP4 or JPEG file?
            </summary>
            <div className="flex flex-wrap gap-2 border-t border-slate-200/90 px-2 pb-2.5 pt-2">
              {canSaveOrDownloadPostVideo(post) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-10 gap-1.5 px-3 text-[12px]"
                  disabled={saveRowBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      setDownloadBusy(true);
                      try {
                        await downloadPostVideoFile(post);
                        toast.success('Download started', 'Check your downloads for the MP4.');
                      } catch (err) {
                        toast.info('Download', (err as Error).message);
                      } finally {
                        setDownloadBusy(false);
                      }
                    })();
                  }}
                >
                  {downloadBusy ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  Video (MP4)
                </Button>
              ) : null}
              {canSaveOrDownloadPostThumbnail(post) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-10 gap-1.5 px-3 text-[12px]"
                  disabled={saveRowBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      setThumbDownloadBusy(true);
                      try {
                        await downloadPostThumbnailFile(post);
                        toast.success('Download started', 'Check your downloads for the JPEG.');
                      } catch (err) {
                        toast.info('Download JPEG', (err as Error).message);
                      } finally {
                        setThumbDownloadBusy(false);
                      }
                    })();
                  }}
                >
                  {thumbDownloadBusy ? <Spinner className="h-3.5 w-3.5" /> : <ImageDown className="h-3.5 w-3.5" />}
                  Thumbnail (JPEG)
                </Button>
              ) : null}
            </div>
          </details>
        ) : null}
        {(post.renderActivityLog?.length ?? 0) > 0 ? (
          <details className="mt-2 rounded-md border border-slate-200 bg-slate-50/90 text-left">
            <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">
              Generation log ({post.renderActivityLog!.length} line
              {post.renderActivityLog!.length === 1 ? '' : 's'})
            </summary>
            <p className="border-b border-slate-200/90 px-2 py-1.5 text-[10px] leading-snug text-slate-500">
              Rolling tail — you see the newest lines returned by the server; older entries fall off once the buffer is
              full.
            </p>
            <div className="max-h-52 overflow-y-auto border-t border-slate-200/90 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-slate-800">
              {(post.renderActivityLog ?? []).map((row, i) => (
                <div
                  key={`${row.at}-${i}`}
                  className="whitespace-pre-wrap break-words border-b border-slate-100/90 py-0.5 last:border-0"
                >
                  <span className="tabular-nums text-slate-500">{row.at.slice(11, 19)}</span>{' '}
                  <span>{row.m}</span>
                </div>
              ))}
            </div>
            <p className="border-t border-slate-200/90 px-2 py-1.5 text-[9px] leading-snug text-slate-500">
              API env <code className="rounded bg-slate-100 px-0.5 font-mono">PERSONAL_DEBUG_SOURCING=1</code> adds
              extra sourcing lines to the server console.
            </p>
          </details>
        ) : IN_PROGRESS_POST_STATUSES.has(post.status) ? (
          <p className="mt-2 text-[10px] leading-snug text-slate-400">
            A generation log will appear here as the API records each step (this page refreshes every few seconds
            while a post is generating).
          </p>
        ) : null}
        {post.errorMessage ? (
          <div className="mt-2 break-words rounded-md bg-rose-50 p-2 text-[11px] text-rose-700">
            {post.errorMessage}
          </div>
        ) : null}
      </div>
      <PostGenerationInfoDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        info={post.generationSummary ?? null}
        postTemplateId={post.templateId}
      />
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
      return { label: 'In queue', tone: 'warning' };
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
