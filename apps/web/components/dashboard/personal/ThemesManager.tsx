'use client';

/**
 * Custom themes manager.
 *
 * Lets the user:
 *   - See every theme available to them (built-ins merged with customs)
 *   - Create a net-new theme from scratch
 *   - Clone-edit a built-in (either as a duplicate or an override)
 *   - Edit any of their custom themes in a single form
 *   - Delete customs
 *
 * Editable fields map 1:1 to PersonalTheme (plus the `slug` stable id).
 * Free-text arrays (hook formulas, topic seeds, hashtags) are edited as
 * newline-separated textareas which is both easier to paste into and
 * trivially mappable to string[].
 */

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Plus,
  Edit3,
  Copy,
  Trash2,
  Save,
  Sparkles,
  Loader2,
  Zap,
  Lock,
} from 'lucide-react';
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
import type {
  CreateCustomThemeBody,
  PersonalCustomTheme,
  PersonalThemeSummary,
} from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

const PLATFORMS = [
  'instagram', 'tiktok', 'facebook', 'youtube', 'x', 'linkedin', 'pinterest', 'bluesky', 'google_business',
] as const;

const MEDIA_SOURCES = [
  'pexels', 'unsplash', 'pixabay', 'wikipedia', 'news', 'ai', 'gameplay',
] as const;

const TEMPLATES = [
  'viral-text',
  'news-reel',
  'fact-drop',
  'quote-card',
  'language-card',
  'listicle',
  'brainrot',
  'story-narration',
  'slideshow',
  'satisfying-loop',
  'scripture-card',
] as const;

const CPM_TIERS = ['low', 'medium', 'high', 'premium'] as const;

type Mode = 'list' | 'create' | 'edit';

export function ThemesManager() {
  const {
    data: customs,
    mutate,
    isLoading: loadingCustoms,
  } = useSWR('personal:custom-themes', () => api.listCustomThemes());
  const { data: allThemes } = useSWR('personal:themes', () => api.personalThemes());

  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<PersonalCustomTheme | null>(null);
  const [query, setQuery] = useState('');

  // allThemes is the merged list — built-ins + customs. We compute an
  // `isBuiltin` flag by checking presence in `customs` (by slug).
  const customSlugs = useMemo(
    () => new Set((customs ?? []).map((c) => c.slug)),
    [customs],
  );

  const rows = useMemo(() => {
    if (!allThemes) return [];
    const filtered = query
      ? allThemes.filter((t) => {
          const q = query.toLowerCase();
          return (
            t.name.toLowerCase().includes(q) ||
            t.tagline.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
          );
        })
      : allThemes;
    return filtered.map((t) => {
      const custom = customs?.find((c) => c.slug === t.id);
      return {
        summary: t,
        custom: custom ?? null,
        isBuiltin: !custom,
      };
    });
  }, [allThemes, customs, query]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Themes library
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              <strong className="font-semibold text-slate-600">Account setup uses Overview</strong> to pick a
              built-in theme per channel. This tab is only if you need <strong className="font-semibold text-slate-600">custom templates</strong>: create or clone a theme, edit defaults (voice, visuals, duration), then it appears in that same picker. Skip it if built-ins are enough.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search themes…"
              className="w-56"
            />
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setMode('create');
              }}
            >
              <Plus className="h-4 w-4" /> New theme
            </Button>
          </div>
        </div>

        {mode === 'list' ? (
          <ThemeList
            rows={rows}
            loading={loadingCustoms}
            onEdit={(c) => {
              setEditing(c);
              setMode('edit');
            }}
            onChanged={mutate}
          />
        ) : (
          <ThemeEditor
            initial={editing}
            onCancel={() => {
              setMode('list');
              setEditing(null);
            }}
            onSaved={() => {
              mutate();
              setMode('list');
              setEditing(null);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* List view                                                             */
/* ═══════════════════════════════════════════════════════════════════ */

function ThemeList({
  rows,
  loading,
  onEdit,
  onChanged,
}: {
  rows: Array<{ summary: PersonalThemeSummary; custom: PersonalCustomTheme | null; isBuiltin: boolean }>;
  loading: boolean;
  onEdit: (c: PersonalCustomTheme) => void;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function clone(builtinId: string, mode: 'override' | 'duplicate') {
    setBusyId(builtinId);
    try {
      const c = await api.cloneBuiltinTheme({ builtinId, mode });
      toast.success(
        mode === 'override' ? 'Theme cloned as override' : 'Theme duplicated',
        'Click the pencil icon on it to customise.',
      );
      onChanged();
      // Immediately open the newly-created row for editing.
      onEdit(c);
    } catch (e) {
      toast.error('Could not clone', (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (
      !(await confirmDialog({
        title: 'Delete this custom theme?',
        description:
          'Accounts already using it keep working, but the theme will no longer be selectable for new channels.',
        confirmLabel: 'Delete theme',
        danger: true,
      }))
    ) {
      return;
    }
    setBusyId(id);
    try {
      await api.deleteCustomTheme(id);
      toast.success('Theme deleted');
      onChanged();
    } catch (e) {
      toast.error('Could not delete', (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Spinner className="mx-auto h-6 w-6 text-slate-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No themes match that search.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ summary, custom, isBuiltin }) => (
        <div
          key={summary.id}
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="mb-1 flex w-full items-center justify-between">
            <span className="text-2xl">{summary.emoji}</span>
            <div className="flex items-center gap-1">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: summary.accentColor + '22', color: summary.accentColor }}
              >
                {summary.cpmTier} CPM
              </span>
              {isBuiltin ? (
                <Badge tone="default">
                  <Lock className="mr-1 h-3 w-3" /> built-in
                </Badge>
              ) : (
                <Badge tone="brand">custom</Badge>
              )}
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-900">{summary.name}</div>
          <div className="mt-0.5 line-clamp-2 text-[12px] text-slate-500">{summary.tagline}</div>

          <div className="mt-3 flex flex-wrap gap-1">
            {Array.from(new Set(summary.preferredPlatforms)).slice(0, 3).map((p, i) => (
              <span
                key={`${summary.id}-plat-${i}-${p}`}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
              >
                {p}
              </span>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-1 border-t border-slate-200 pt-3 text-xs">
            {isBuiltin ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => clone(summary.id, 'duplicate')}
                  disabled={busyId === summary.id}
                  title="Create an editable copy"
                >
                  {busyId === summary.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => clone(summary.id, 'override')}
                  disabled={busyId === summary.id}
                  title="Override built-in with same id"
                >
                  <Edit3 className="h-4 w-4" /> Override
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => onEdit(custom!)}>
                  <Edit3 className="h-4 w-4" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(custom!.id)}
                  disabled={busyId === custom!.id}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
                {custom?.derivedFrom ? (
                  <span className="ml-auto text-[10px] text-slate-400" title={`Cloned from ${custom.derivedFrom}`}>
                    clone of {custom.derivedFrom}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Editor (create + edit)                                               */
/* ═══════════════════════════════════════════════════════════════════ */

function ThemeEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: PersonalCustomTheme | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState<CreateCustomThemeBody>(() => ({
    slug: initial?.slug ?? '',
    name: initial?.name ?? '',
    tagline: initial?.tagline ?? '',
    description: initial?.description ?? '',
    emoji: initial?.emoji ?? '✨',
    accentColor: initial?.accentColor ?? '#6366F1',
    viralityScore: initial?.viralityScore ?? 7,
    cpmTier: (initial?.cpmTier as 'low' | 'medium' | 'high' | 'premium') ?? 'medium',
    preferredPlatforms: (initial?.preferredPlatforms as any) ?? ['instagram', 'tiktok'],
    template: initial?.template ?? 'viral-text',
    mediaSources: (initial?.mediaSources as any) ?? ['pexels', 'unsplash'],
    useVoiceover: initial?.useVoiceover ?? true,
    useMusic: initial?.useMusic ?? true,
    hookFormulas: initial?.hookFormulas ?? [],
    topicSeeds: initial?.topicSeeds ?? [],
    voiceGuide: initial?.voiceGuide ?? '',
    visualStyle: initial?.visualStyle ?? '',
    musicMood: initial?.musicMood ?? '',
    targetDurationSeconds: initial?.targetDurationSeconds ?? 35,
    defaultHashtags: initial?.defaultHashtags ?? [],
    requiresGroundedImages: initial?.requiresGroundedImages ?? false,
    defaultFormat: (initial?.defaultFormat as 'video' | 'slideshow' | 'static_image') ?? 'video',
    overridesBuiltin: initial?.overridesBuiltin ?? false,
  }));
  const [busy, setBusy] = useState(false);

  // Free-text arrays as newline-separated textareas.
  const [hookFormulasText, setHookFormulasText] = useState(
    (initial?.hookFormulas ?? []).join('\n'),
  );
  const [topicSeedsText, setTopicSeedsText] = useState(
    (initial?.topicSeeds ?? []).join('\n'),
  );
  const [hashtagsText, setHashtagsText] = useState(
    (initial?.defaultHashtags ?? []).join('\n'),
  );

  function update<K extends keyof CreateCustomThemeBody>(key: K, value: CreateCustomThemeBody[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePlatform(p: (typeof PLATFORMS)[number]) {
    const cur = new Set(form.preferredPlatforms ?? []);
    if (cur.has(p)) cur.delete(p);
    else cur.add(p);
    update('preferredPlatforms', Array.from(cur) as any);
  }

  function toggleMediaSource(s: (typeof MEDIA_SOURCES)[number]) {
    const cur = new Set(form.mediaSources ?? []);
    if (cur.has(s)) cur.delete(s);
    else cur.add(s);
    update('mediaSources', Array.from(cur) as any);
  }

  async function save() {
    const payload: CreateCustomThemeBody = {
      ...form,
      hookFormulas: splitLines(hookFormulasText),
      topicSeeds: splitLines(topicSeedsText),
      defaultHashtags: splitLines(hashtagsText),
      slug: isEdit ? (initial?.slug ?? form.slug) : form.slug || autoSlug(form.name),
    };
    if (!payload.name.trim() || !payload.slug.trim() || !payload.tagline.trim() || !payload.description.trim()) {
      toast.error('Missing required fields', 'Name, slug, tagline, and description are all required.');
      return;
    }
    setBusy(true);
    try {
      if (isEdit && initial) {
        const { slug, ...rest } = payload;
        await api.updateCustomTheme(initial.id, rest);
        toast.success('Theme updated');
      } else {
        await api.createCustomTheme(payload);
        toast.success('Theme created');
      }
      onSaved();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">
          {isEdit ? `Edit theme: ${initial?.name}` : 'Create a new theme'}
        </h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      {/* ── Identity ─────────────────────────────── */}
      <Section title="Identity">
        <Grid>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
          </Field>
          <Field label="Slug" hint={isEdit ? 'Locked after creation' : 'Auto-generated from name if blank'}>
            <Input
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              placeholder={autoSlug(form.name) || 'my-theme'}
              disabled={isEdit}
            />
          </Field>
          <Field label="Emoji">
            <Input value={form.emoji ?? '✨'} onChange={(e) => update('emoji', e.target.value)} />
          </Field>
          <Field label="Accent colour">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.accentColor ?? '#6366F1'}
                onChange={(e) => update('accentColor', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-slate-200"
              />
              <Input
                value={form.accentColor ?? ''}
                onChange={(e) => update('accentColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </Field>
        </Grid>
        <Field label="Tagline" hint="One-line pitch">
          <Input value={form.tagline} onChange={(e) => update('tagline', e.target.value)} />
        </Field>
        <Field label="Description" hint="Longer explanation of the niche">
          <Textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </Field>
      </Section>

      {/* ── Placement ─────────────────────────────── */}
      <Section title="Placement & format">
        <Grid>
          <Field label="Template" hint="Which Remotion composition to render">
            <select
              value={form.template}
              onChange={(e) => update('template', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {TEMPLATES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Default format">
            <select
              value={form.defaultFormat ?? 'video'}
              onChange={(e) => update('defaultFormat', e.target.value as 'video' | 'slideshow' | 'static_image')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="video">Video</option>
              <option value="slideshow">Slideshow</option>
              <option value="static_image">Static image</option>
            </select>
          </Field>
          <Field label="Target duration (s)">
            <Input
              type="number"
              min={8}
              max={120}
              value={form.targetDurationSeconds ?? 35}
              onChange={(e) => update('targetDurationSeconds', Number(e.target.value) || 35)}
            />
          </Field>
          <Field label="CPM tier">
            <select
              value={form.cpmTier ?? 'medium'}
              onChange={(e) => update('cpmTier', e.target.value as 'low' | 'medium' | 'high' | 'premium')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {CPM_TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Virality score (1-10)">
            <Input
              type="number"
              min={1}
              max={10}
              value={form.viralityScore ?? 7}
              onChange={(e) => update('viralityScore', Number(e.target.value) || 7)}
            />
          </Field>
        </Grid>

        <Field label="Preferred platforms">
          <div className="flex flex-wrap gap-1">
            {PLATFORMS.map((p) => {
              const active = (form.preferredPlatforms ?? []).includes(p as any);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Media sources" hint="Ordered: first provider that returns results is used.">
          <div className="flex flex-wrap gap-1">
            {MEDIA_SOURCES.map((s) => {
              const active = (form.mediaSources ?? []).includes(s as any);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleMediaSource(s)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Field>

        <Grid>
          <ToggleRow
            label="Use voiceover"
            value={form.useVoiceover ?? true}
            onChange={(v) => update('useVoiceover', v)}
          />
          <ToggleRow
            label="Use music bed"
            value={form.useMusic ?? true}
            onChange={(v) => update('useMusic', v)}
          />
          <ToggleRow
            label="Requires real-world imagery"
            hint="Refuses posts when no grounded media found (News, History themes)."
            value={form.requiresGroundedImages ?? false}
            onChange={(v) => update('requiresGroundedImages', v)}
          />
          {!isEdit ? (
            <ToggleRow
              label="Override built-in"
              hint="When enabled, this theme replaces the built-in with the same slug."
              value={form.overridesBuiltin ?? false}
              onChange={(v) => update('overridesBuiltin', v)}
            />
          ) : null}
        </Grid>
      </Section>

      {/* ── Creative direction ─────────────────────── */}
      <Section title="Creative direction">
        <Field label="Voice guide" hint="How every script should sound">
          <Textarea rows={3} value={form.voiceGuide ?? ''} onChange={(e) => update('voiceGuide', e.target.value)} />
        </Field>
        <Field label="Visual style" hint="What every image/video should look like">
          <Textarea rows={3} value={form.visualStyle ?? ''} onChange={(e) => update('visualStyle', e.target.value)} />
        </Field>
        <Grid>
          <Field label="Music mood">
            <Input value={form.musicMood ?? ''} onChange={(e) => update('musicMood', e.target.value)} />
          </Field>
        </Grid>
        <Field label="Hook formulas" hint="One per line. Use {placeholders} freely.">
          <Textarea rows={4} value={hookFormulasText} onChange={(e) => setHookFormulasText(e.target.value)} />
        </Field>
        <Field label="Topic seeds" hint="Starter ideas the engine rotates through.">
          <Textarea rows={4} value={topicSeedsText} onChange={(e) => setTopicSeedsText(e.target.value)} />
        </Field>
        <Field label="Default hashtags" hint="Appended to every caption.">
          <Textarea rows={3} value={hashtagsText} onChange={(e) => setHashtagsText(e.target.value)} />
        </Field>
      </Section>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Zap className="h-3 w-3" />
          Custom themes appear alongside built-ins in the account picker.
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Save changes' : 'Create theme'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Small layout helpers                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
        {hint ? <span className="ml-1 font-normal text-slate-400">· {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300"
      />
      <span className="flex-1">
        <span className="block font-medium text-slate-700">{label}</span>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </span>
    </label>
  );
}

function splitLines(s: string): string[] {
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function autoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
