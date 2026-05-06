'use client';

/**
 * Personal content automation — the "secret" dashboard.
 *
 * Intentionally not linked from the main sidebar (reach it via
 * /dashboard/personal). Lets the authenticated user create multiple
 * personal social accounts, lock each to a viral-content theme, and
 * kick off daily fully-automated video generation.
 *
 * Three columns at desktop:
 *   1. account list + add button
 *   2. selected account detail (theme, schedule, direction)
 *   3. posts grid for that account
 */

import { useEffect, useState } from 'react';
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
  Eye,
  EyeOff,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Textarea, Spinner, toast } from '@boost/ui';
import type {
  PersonalAccount,
  PersonalPost,
  PersonalThemeSummary,
  PersonalPlatform,
} from '@boost/api-client';
import { api } from '@/lib/dashboard/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { MediaLibrary } from '@/components/dashboard/personal/MediaLibrary';
import { CharacterStudio } from '@/components/dashboard/personal/CharacterStudio';
import { GeneratorConfigPanel } from '@/components/dashboard/personal/GeneratorConfig';

const PLATFORMS: PersonalPlatform[] = [
  'instagram', 'tiktok', 'facebook', 'youtube', 'x', 'linkedin', 'pinterest', 'bluesky', 'google_business',
];

/* ═══════════════════════════════════════════════════════════════════ */
/* Page                                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export default function PersonalDashboardPage() {
  const { data: themes } = useSWR('personal:themes', () => api.personalThemes());
  const { data: accounts, mutate: refetchAccounts } = useSWR(
    'personal:accounts',
    () => api.listPersonalAccounts(),
  );
  const { data: features } = useSWR('personal:features', () => api.personalFeatures());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!selectedId && accounts && accounts.length > 0) {
      setSelectedId(accounts[0]!.id);
    }
  }, [accounts, selectedId]);

  const selected = accounts?.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <PageHeader
        title="Personal channels"
        subtitle="A secret, fully-automated pipeline for your own social accounts. Pick a viral niche, set a schedule, walk away."
      />

      <FeatureBanner features={features} />

      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
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
            <div className="mt-4 space-y-2">
              {accounts?.length === 0 ? (
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
                onChanged={refetchAccounts}
              />
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
  if (missing.length === 0) return null;
  return (
    <div className="mx-auto mb-4 max-w-[1400px] px-6 lg:px-10">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <span className="font-semibold">Running with mocks:</span> {missing.join(', ')} not configured. Videos will still generate but with placeholder assets. Add API keys in <code className="rounded bg-amber-100 px-1">.env</code> to go live.
        </div>
      </div>
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

  useEffect(() => {
    if (!themeId && themes[0]) setThemeId(themes[0].id);
  }, [themes, themeId]);

  const selectedTheme = themes.find((t) => t.id === themeId);

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create a channel</h2>
            <p className="mt-1 text-sm text-slate-500">
              Each channel locks to one viral niche and posts on its own schedule.
            </p>
          </div>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">Pick a theme</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                    themeId === t.id
                      ? 'border-slate-900 bg-slate-50 shadow-sm ring-1 ring-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="mb-1 flex w-full items-center justify-between">
                    <span className="text-2xl">{t.emoji}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: t.accentColor + '22', color: t.accentColor }}
                    >
                      {t.cpmTier} CPM
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                  <div className="mt-0.5 text-[12px] text-slate-500">{t.tagline}</div>
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
  onChanged,
}: {
  account: PersonalAccount;
  themes: PersonalThemeSummary[];
  onChanged: () => void;
}) {
  const theme = themes.find((t) => t.id === account.themeId);
  const { data: posts, mutate: refetchPosts } = useSWR(
    ['personal:posts', account.id],
    () => api.listPersonalPosts(account.id),
    { refreshInterval: 10_000 },
  );
  const { data: characters } = useSWR('personal:characters', () => api.listCharacters());

  const [tab, setTab] = useState<'overview' | 'media' | 'characters' | 'config'>('overview');
  const [generating, setGenerating] = useState(false);
  const [topicOverride, setTopicOverride] = useState('');

  async function runNow() {
    setGenerating(true);
    try {
      const res = await api.generatePersonalPost(account.id, {
        topic: topicOverride.trim() || undefined,
      });
      toast.success(
        res.pending ? 'Generation started' : 'Generation kicked off',
        res.pending
          ? 'This takes ~30-60s. Posts list refreshes automatically.'
          : 'Check the Posts tab shortly.',
      );
      setTopicOverride('');
      setTimeout(() => refetchPosts(), 2000);
    } catch (e) {
      toast.error('Could not generate', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header + tabs ──────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{account.themeEmoji}</span>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{account.accountName}</h2>
                <p className="text-sm text-slate-500">
                  {account.platform} · {account.themeName}
                  {account.handle ? ` · ${account.handle}` : ''}
                </p>
              </div>
            </div>
            <Badge tone={account.status === 'active' ? 'success' : 'default'}>
              {account.status}
            </Badge>
          </div>

          {/* ── Generate panel ──────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-900">Generate now</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={topicOverride}
                onChange={(e) => setTopicOverride(e.target.value)}
                placeholder={`Optional topic (${theme?.topicSeedExamples[0] ?? 'auto-pick'})`}
                className="flex-1"
              />
              <Button onClick={runNow} disabled={generating}>
                {generating ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Starting…' : 'Generate post'}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Scripts with Claude, scrapes real imagery, renders with voiceover + music, schedules to ContentStudio.
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
            <TabButton active={tab === 'config'} onClick={() => setTab('config')}>
              Style & config
            </TabButton>
          </div>
        </CardContent>
      </Card>

      {/* ── Tab content ────────────────────────────────────── */}
      {tab === 'overview' ? (
        <>
          <ScheduleCard account={account} onChanged={onChanged} />
          <TopicsCard account={account} onChanged={onChanged} theme={theme} />
          <PostsGrid posts={posts ?? []} />
        </>
      ) : null}

      {tab === 'media' ? (
        <MediaLibrary account={account} characters={characters ?? []} />
      ) : null}

      {tab === 'characters' ? <CharacterStudio /> : null}

      {tab === 'config' ? (
        <GeneratorConfigPanel
          account={account}
          characters={characters ?? []}
          onChanged={onChanged}
        />
      ) : null}
    </div>
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
  const [busy, setBusy] = useState(false);

  async function togglePause() {
    setBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        status: account.status === 'active' ? 'paused' : 'active',
      });
      onChanged();
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
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Schedule</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={togglePause} disabled={busy}>
              {account.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Activate
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
          <Toggle label="Auto-approve" checked={autoApprove} onChange={setAutoApprove} />
          <Toggle label="Auto-schedule to ContentStudio" checked={autoSchedule} onChange={setAutoSchedule} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-500">
            <Clock className="mr-1 inline h-3 w-3" />
            Next run: {account.nextRunAt ? new Date(account.nextRunAt).toLocaleString() : '—'}
          </div>
          <Button onClick={save} disabled={busy} size="sm">
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
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
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

function PostsGrid({ posts }: { posts: PersonalPost[] }) {
  if (posts.length === 0) {
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
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-600">
          Recent posts ({posts.length})
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ post }: { post: PersonalPost }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = statusFor(post.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div
        className="relative aspect-[9/16] overflow-hidden bg-slate-100"
        style={{ minHeight: 180 }}
      >
        {post.videoUrl ? (
          <video
            src={post.videoUrl}
            controls
            className="h-full w-full object-cover"
            poster={post.mediaAssets[0]?.url}
          />
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
      <div className="p-3">
        <div className="text-sm font-semibold text-slate-900 line-clamp-2">
          {post.title || post.topic}
        </div>
        <div className="mt-1 line-clamp-2 text-[12px] text-slate-500">{post.hook}</div>
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
        <button
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {expanded ? 'Hide caption' : 'Show caption'}
        </button>
        {expanded ? (
          <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-[11px] text-slate-700">
            {post.caption ?? '(no caption)'}
          </div>
        ) : null}
        {post.errorMessage ? (
          <div className="mt-2 rounded-md bg-rose-50 p-2 text-[11px] text-rose-700">
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
    case 'rendering':
      return { label: status.replace('_', ' '), tone: 'warning' };
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
  return (
    <Card>
      <CardContent className="p-10 text-center">
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
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {themes.slice(0, 6).map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-slate-200 bg-white p-3 text-left"
            >
              <div className="text-xl">{t.emoji}</div>
              <div className="mt-1 text-xs font-semibold text-slate-900">{t.name}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">{t.tagline}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
