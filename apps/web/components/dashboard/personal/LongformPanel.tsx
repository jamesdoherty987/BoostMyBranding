'use client';

/**
 * Long-form animated video panel — per account.
 *
 * Turns on the chapter-structured, 1-to-8-minute animated explainer mode
 * on an account. Users pick:
 *
 *   1. Target duration (60–480 seconds).
 *   2. Max AI-video shots (the remainder become cheaper AI stills with
 *      Ken Burns — keeps the cost of an 8-minute video manageable).
 *
 * **Visual style** comes only from Media library items tagged **Inspiration**
 * or **Style reference** (required for long-form). There is no separate
 * “animation style” preset — those references drive every AI shot.
 */

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Save, Sparkles, Clock, Film, Info } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Spinner,
  toast,
} from '@boost/ui';
import type {
  PersonalAccount,
  PersonalGeneratorConfig,
  PersonalCharacter,
  PersonalThemeSummary,
} from '@boost/api-client';
import { api } from '@/lib/dashboard/api';

const DURATION_PRESETS: Array<{ seconds: number; label: string }> = [
  { seconds: 60, label: '1 min' },
  { seconds: 120, label: '2 min' },
  { seconds: 180, label: '3 min' },
  { seconds: 240, label: '4 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 360, label: '6 min' },
  { seconds: 480, label: '8 min' },
];

export function LongformPanel({
  account,
  theme,
  onChanged,
  /** Called after kicking off generation so the Overview posts list refetches (SWR does not auto-invalidate). */
  onPostsChanged,
  onSwitchTab,
}: {
  account: PersonalAccount;
  theme: PersonalThemeSummary | undefined;
  onChanged: () => void;
  onPostsChanged?: () => void | Promise<void>;
  onSwitchTab?: (tab: 'media' | 'characters' | 'config') => void;
}) {
  const { data: characters } = useSWR('personal:characters', () =>
    api.listCharacters(),
  );
  const { data: mediaList } = useSWR(['personal:media-longform', account.id], () =>
    api.listPersonalMedia(account.id, {}),
  );

  const genConfig = account.generatorConfig ?? {};
  const isAnimatedTheme = theme?.template === 'animated-explainer';

  // Long-form is auto-on for animated themes, or opt-in otherwise.
  const [enabled, setEnabled] = useState<boolean>(
    Boolean(genConfig.longformEnabled) || isAnimatedTheme,
  );
  const [targetSeconds, setTargetSeconds] = useState<number>(
    clamp(genConfig.longformTargetSeconds ?? theme?.targetDurationSeconds ?? 240, 60, 480),
  );
  const [maxAiVideo, setMaxAiVideo] = useState<number>(
    genConfig.longformMaxAiVideoShots ?? defaultAiVideoShots(genConfig.qualityTier),
  );
  const [busy, setBusy] = useState(false);

  // Estimate what the director will plan — gives users an up-front sense
  // of "how many shots / how much cost". Mirrors the logic in the
  // planStoryboard prompt builder so numbers stay honest.
  const estimate = useMemo(() => {
    // Chapter count scales with target duration (~45s / chapter) and is
    // clamped to the same 4-10 range the prompt uses.
    const chapters = Math.max(4, Math.min(10, Math.round(targetSeconds / 45)));
    // Each chapter gets as many shots as fit at ~7s average.
    const shotsPerChapter = Math.max(
      3,
      Math.min(8, Math.round(targetSeconds / (chapters * 7))),
    );
    const totalShots = chapters * shotsPerChapter;
    const aiVideoCount = Math.min(maxAiVideo, Math.round(totalShots * 0.25));
    const aiImageCount = Math.max(0, totalShots - aiVideoCount);
    // Rough cost model:
    //   AI video (kling-v2 balanced): ~14¢/s × ~7s avg = 98¢ / clip
    //   AI image (nano-banana):        ~4¢ / still
    //   TTS:                           ~3¢ / 1k chars × ~1200 chars = 4¢
    //   Storyboard plan (Claude):       ~3¢
    //   Stitch:                         ~3¢
    const costCents =
      aiVideoCount * 98 + aiImageCount * 4 + 10 /* audio */ + 6 /* plan+stitch */;
    // Generation time estimate for the progress copy downstream.
    const renderMinutes = Math.max(
      2,
      Math.ceil(aiVideoCount * 0.7 + aiImageCount * 0.1),
    );
    return {
      chapters,
      totalShots,
      aiVideoCount,
      aiImageCount,
      costCents,
      renderMinutes,
    };
  }, [targetSeconds, maxAiVideo]);

  const exampleTitleCount = (account.styleBible?.exampleVideoTitles ?? []).filter(
    (t) => String(t).trim().length > 0,
  ).length;

  const inspirationRefCount = useMemo(() => {
    return (mediaList ?? []).filter(
      (m) => m.role === 'inspiration' || m.role === 'style_reference',
    ).length;
  }, [mediaList]);

  const characterRefCount = useCharacterRefCount(
    characters ?? [],
    account.characterId,
  );

  /** Only long-form keys — server merges into existing `generator_config`. Spreading the whole account snapshot here can overwrite newer Style & config values (e.g. letterbox, Ken Burns) when this tab's `account` props are stale. */
  function longformGeneratorPatch(): Pick<
    PersonalGeneratorConfig,
    'longformEnabled' | 'longformTargetSeconds' | 'longformAnimationStyle' | 'longformMaxAiVideoShots'
  > {
    return {
      longformEnabled: enabled,
      longformTargetSeconds: targetSeconds,
      /** Server long-form path always uses `custom` — look from inspiration / style_reference only. */
      longformAnimationStyle: 'custom',
      longformMaxAiVideoShots: maxAiVideo,
    };
  }

  async function save() {
    setBusy(true);
    try {
      await api.updatePersonalAccount(account.id, {
        generatorConfig: longformGeneratorPatch(),
      });
      toast.success('Long-form settings saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const fresh = await api.getPersonalAccount(account.id);
      const exampleCt = (fresh.styleBible?.exampleVideoTitles ?? []).filter(
        (t) => String(t).trim().length > 0,
      ).length;
      if ((fresh.formatKind ?? 'video') === 'video' && exampleCt < 1) {
        toast.error(
          'Example video titles required',
          'Add at least one under Style & config (and save) before generating — same rule as the API.',
        );
        return;
      }
      const media = await api.listPersonalMedia(account.id, {});
      const inspCount = media.filter(
        (m) => m.role === 'inspiration' || m.role === 'style_reference',
      ).length;
      if (inspCount < 1) {
        toast.error(
          'Inspiration or style reference required',
          'Long-form uses your Media library for the look. Upload at least one image (or video still) with role Inspiration or Style reference, then try again.',
        );
        return;
      }
      // Make sure the on-disk settings reflect what's on screen — otherwise
      // the pipeline reads the previous generator_config and produces a
      // video with the wrong duration/style.
      await api.updatePersonalAccount(account.id, {
        generatorConfig: longformGeneratorPatch(),
      });
      onChanged();
      await api.generatePersonalPost(account.id, {});
      await Promise.resolve(onPostsChanged?.());
      setTimeout(() => void Promise.resolve(onPostsChanged?.()), 2000);
      setTimeout(() => void Promise.resolve(onPostsChanged?.()), 8000);
      toast.success(
        'Long-form generation started',
        `This takes ~${estimate.renderMinutes} min. Open Overview to watch progress — your ${formatMinutes(targetSeconds)} video will appear in Recent posts.`,
      );
    } catch (e) {
      toast.error('Could not start generation', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
              <Film className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
                Long-form animated video
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Chapter-structured, 1&ndash;8 minute narrations. The director matches the{' '}
                <strong>visual look of your inspiration and style-reference media</strong> on
                every AI frame — upload those under Media before generating.
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5 accent-violet-600"
              />
              <span className="text-sm font-semibold text-slate-900">
                {enabled ? 'On' : 'Off'}
              </span>
            </label>
          </div>

          {isAnimatedTheme ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This theme (<strong>{theme?.name}</strong>) is built for
                long-form animation, so long-form mode is on by default.
              </span>
            </div>
          ) : null}

          {!enabled ? (
            <p className="text-xs text-slate-500">
              Turn this on to get minute-plus animated videos on top of the
              usual short-form output. You can still generate regular shorts
              for this account — long-form only kicks in when explicitly
              enabled or when the theme requires it.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {enabled ? (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <h4 className="text-sm font-bold text-slate-900">Title style</h4>
              </div>
              {exampleTitleCount === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <strong>No example video titles saved.</strong> Add examples under{' '}
                  <strong>Style & config → Example video titles</strong> and click{' '}
                  <strong>Save configuration</strong> before generating (required for video).
                  {onSwitchTab ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => onSwitchTab('config')}
                        className="font-semibold text-violet-800 underline-offset-2 hover:underline"
                      >
                        Open Style & config →
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Using <strong>{exampleTitleCount}</strong> saved example title
                  {exampleTitleCount === 1 ? '' : 's'} — the headline model studies them for tone,
                  length, and punctuation, and tries not to echo titles already on this channel. You can
                  add extra title instructions in{' '}
                  {onSwitchTab ? (
                    <button
                      type="button"
                      onClick={() => onSwitchTab('config')}
                      className="font-semibold text-violet-700 underline-offset-2 hover:underline"
                    >
                      Style & config
                    </button>
                  ) : (
                    'Style & config'
                  )}
                  .
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-fuchsia-500" />
                <h4 className="text-sm font-bold text-slate-900">Visual references (required)</h4>
              </div>
              {inspirationRefCount === 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                  <strong>No inspiration or style-reference media.</strong> Long-form needs at least
                  one library item with role <strong>Inspiration</strong> or{' '}
                  <strong>Style reference</strong> so every shot matches your channel's art
                  direction. The API will reject generation without them.
                  {onSwitchTab ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => onSwitchTab('media')}
                        className="font-semibold text-rose-800 underline-offset-2 hover:underline"
                      >
                        Open Media →
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  <strong>{inspirationRefCount}</strong> inspiration / style-reference
                  {inspirationRefCount === 1 ? ' item' : ' items'} — the director and image models use
                  these for colour, line weight, and composition. There is no separate "animation
                  style" preset.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Duration ────────────────────────────────────── */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <h4 className="text-sm font-bold text-slate-900">
                  Target duration
                </h4>
                <span className="ml-auto text-sm font-mono text-slate-700">
                  {formatMinutes(targetSeconds)}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    onClick={() => setTargetSeconds(p.seconds)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                      targetSeconds === p.seconds
                        ? 'border-violet-500 bg-violet-50 text-violet-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={60}
                max={480}
                step={15}
                value={targetSeconds}
                onChange={(e) => setTargetSeconds(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <p className="mt-2 text-[11px] text-slate-400">
                Longer videos produce more chapters and more shots — great
                for documentaries and explainers, but each minute adds cost.
              </p>
            </CardContent>
          </Card>

          {/* ── AI video cap ────────────────────────────────── */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  Max AI-video shots
                </h4>
                <span className="ml-auto text-sm font-mono text-slate-700">
                  {maxAiVideo}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                AI-video clips are richer but ~10× more expensive than AI stills. The rest become
                stills with Ken Burns — they still follow your{' '}
                <strong>inspiration / style-reference</strong> look because those refs are baked
                into every prompt.
              </p>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={maxAiVideo}
                onChange={(e) => setMaxAiVideo(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-slate-400">
                <span>Stills only (cheap)</span>
                <span>Mixed (balanced)</span>
                <span>Video-heavy (premium)</span>
              </div>
            </CardContent>
          </Card>

          {/* ── Character + refs reminder ───────────────────── */}
          <Card>
            <CardContent className="p-6">
              <h4 className="mb-1 text-sm font-bold text-slate-900">
                Character consistency
              </h4>
              <p className="mb-3 text-xs text-slate-500">
                Upload drawings of your hero under{' '}
                <strong>Media → role: inspiration</strong> or{' '}
                <strong>avatar reference</strong>, or attach a{' '}
                <strong>character</strong> in the Style tab. Those assets are passed into AI
                generations alongside your <strong>style-reference</strong> stills.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={account.characterId ? 'success' : 'warning'}>
                  {account.characterId
                    ? `Character attached (${characterRefCount} refs)`
                    : 'No character attached'}
                </Badge>
                {onSwitchTab ? (
                  <button
                    type="button"
                    onClick={() => onSwitchTab('characters')}
                    className="text-violet-700 underline-offset-2 hover:underline"
                  >
                    Manage characters →
                  </button>
                ) : null}
                {onSwitchTab ? (
                  <button
                    type="button"
                    onClick={() => onSwitchTab('media')}
                    className="text-violet-700 underline-offset-2 hover:underline"
                  >
                    Upload inspiration →
                  </button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* ── Estimate ─────────────────────────────────────── */}
          <Card>
            <CardContent className="p-6">
              <h4 className="mb-3 text-sm font-bold text-slate-900">
                What the director will plan
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  label="Chapters"
                  value={`${estimate.chapters}`}
                />
                <StatTile
                  label="Total shots"
                  value={`${estimate.totalShots}`}
                />
                <StatTile
                  label="AI video clips"
                  value={`${estimate.aiVideoCount}`}
                />
                <StatTile
                  label="AI stills"
                  value={`${estimate.aiImageCount}`}
                />
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                Estimated generation cost ≈ $
                {(estimate.costCents / 100).toFixed(2)} per video (AI
                compute + storage). Generation takes roughly{' '}
                {estimate.renderMinutes}&ndash;{estimate.renderMinutes + 3} minutes
                end-to-end depending on how many AI-video clips you allow.
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* ── Actions ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
        {enabled ? (
          <Button
            variant="secondary"
            onClick={() => void generate()}
            disabled={busy || account.status === 'archived' || inspirationRefCount < 1}
            title={
              account.status === 'archived'
                ? 'Archived channels cannot generate new videos.'
                : inspirationRefCount < 1
                  ? 'Add at least one Media item with role Inspiration or Style reference.'
                  : exampleTitleCount < 1
                    ? 'Add example video titles under Style & config (and save). You can still try once they exist on the server.'
                    : undefined
            }
          >
            <Sparkles className="h-4 w-4" />
            Generate {formatMinutes(targetSeconds)} video now
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Helpers                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function defaultAiVideoShots(tier: PersonalGeneratorConfig['qualityTier']): number {
  if (tier === 'max') return 10;
  if (tier === 'budget') return 2;
  return 5;
}

function useCharacterRefCount(
  characters: PersonalCharacter[],
  characterId: string | null,
): number {
  if (!characterId) return 0;
  const c = characters.find((x) => x.id === characterId);
  return c?.referenceImageCount ?? 0;
}
