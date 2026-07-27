/**
 * Director-first pipeline.
 *
 * An alternative to the script-first pipeline (personalPipeline.ts) that
 * plans a multi-shot storyboard, then (on fresh runs) measures real TTS
 * length and repartitions shots to match dashboard avg clip before
 * resolving each shot to an asset (AI video, AI still with Ken Burns,
 * scraped, or user media), then stitches them with editorial cuts + audio.
 *
 * Produces noticeably more engaging output than the flat "image per beat"
 * path because:
 *   - Each shot has its own camera move, framing, lighting
 *   - Cuts are intentional (hard_cut, cross_dissolve, match_cut, …)
 *   - Process / before-after / transformation videos split into acts
 *   - Character reference images get passed through to every shot
 *
 * Returned as a separate function so the caller (generateForAccount)
 * can dispatch based on genConfig.useDirector.
 */

import { and, eq, like, lt, or } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalAccounts,
  personalPosts,
  type PersonalAccountStyleBible,
  type PersonalGeneratorConfig,
} from '@boost/database';
import { getTheme, type PersonalTheme } from './personalThemes.js';
import { clampLongformTargetSeconds } from './personalLongform.js';
import { findThemeForUser } from './personalCustomThemes.js';
import {
  planStoryboard,
  stripDirectorResumeKeys,
  type Storyboard,
} from './personalDirector.js';
import { channelVideoTitleLikeIsolatedTest } from './personalChannelTitle.js';
import { broadcast } from './realtime.js';
import {
  recentTopics,
  getPersonalProcessBootAt,
  personalPostIsFailed,
  recentVideoTitles,
  markPersonalPostQueuedFailedIfStillQueued,
  PERSONAL_POST_CANCELLED_MESSAGE,
} from './personalAccounts.js';
import { chooseTopic } from './personalScript.js';
import { getCharacterUnsafe } from './personalCharacters.js';
import { internalListForPipeline } from './personalAccountMedia.js';
import { researchTopic, researchToPromptBlock } from './personalResearch.js';
import { pickImageModelForLongform } from './personalAiModels.js';
import { StitcherError } from './personalStitcher.js';
import { assertPersonalVideoExampleTitlesOrThrow } from './personalTitlePolicy.js';
import type { GenerateForAccountArgs, GenerateForAccountResult } from './personalPipeline.js';
import { generateForAccount } from './personalPipeline.js';
import { enqueuePersonalGenerateForAccount } from './personalGenerateQueue.js';
import {
  buildPersonalContentRulesPrompt,
  buildMediaPreferencePrompt,
  buildAverageShotPrompt,
  buildMinShotsForRuntimePrompt,
} from './personalContentHints.js';
import {
  getViralFormat,
  defaultFormatFor,
  formatToPromptBlock,
} from './viralFormats.js';
import { getHookFormula, hookFormulaToDirective } from './viralHooks.js';
import {
  directorPipelineFromResolvedStoryboard,
  finishDirectorFromPreStitchCheckpoint,
  parsePreStitchCheckpoint,
  parseSourcingCheckpointByShotId,
  hasDirectorStoryboard,
} from './personalDirectorPipelineMid.js';
import { maybeEmailPersonalPostFailed } from './personalVideoDeliveryEmail.js';
import {
  buildPersonalScheduleIntent,
  mergePersonalScheduleIntentIntoArgs,
  withPersonalScheduleIntent,
} from './personalContentPosting.js';

async function resumeDirectorInto(
  args: GenerateForAccountArgs,
  account: typeof personalAccounts.$inferSelect,
  theme: PersonalTheme,
  genConfig: PersonalGeneratorConfig,
  styleBible: PersonalAccountStyleBible,
  character: Awaited<ReturnType<typeof getCharacterUnsafe>>,
): Promise<GenerateForAccountResult> {
  const db = getDb();
  const [post] = await db
    .select()
    .from(personalPosts)
    .where(eq(personalPosts.id, args.resumeFromPostId!));
  if (!post || post.accountId !== account.id) {
    throw new Error('Resume post not found for this account');
  }
  // Restore "Generate & schedule" / autopilot intent after process restart.
  args = mergePersonalScheduleIntentIntoArgs(args, post.script);
  if (!post.templateId.startsWith('director:')) {
    const msg = 'Cannot resume — this post was not generated in director mode.';
    await markFailed(post.id, msg);
    void maybeEmailPersonalPostFailed({
      accountId: account.id,
      postId: post.id,
      topic: post.topic,
      error: msg,
      includeSaveLink: false,
    }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
    return {
      postId: post.id,
      videoUrl: null,
      status: 'failed',
      durationSeconds: 0,
      costCents: 0,
      skipped: true,
      reason: 'not director',
    };
  }

  const pre = parsePreStitchCheckpoint(post.script);
  if (pre && post.status === 'rendering') {
    try {
      return await finishDirectorFromPreStitchCheckpoint(post, account, theme, args, pre);
    } catch (e) {
      const msg =
        e instanceof StitcherError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      await markFailed(post.id, msg);
      void maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId: post.id,
        topic: post.topic,
        error: msg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
      throw e;
    }
  }

  if (post.status === 'sourcing_media' && hasDirectorStoryboard(post.script)) {
    const storyboard = stripDirectorResumeKeys(post.script as Record<string, unknown>) as unknown as Storyboard;
    const topic = post.topic;
    const ar = (post.script as Record<string, unknown>)?.outputAspectRatio;
    const aspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
      ar === '16:9' || ar === '1:1' || ar === '4:5' || ar === '9:16' ? ar : '9:16';

    const isAnimatedTheme = theme.template === 'animated-explainer';
    const longformEnabled = genConfig.longformEnabled === true || isAnimatedTheme;
    const longformTargetSeconds = longformEnabled
      ? clampLongformTargetSeconds(genConfig.longformTargetSeconds ?? theme.targetDurationSeconds)
      : undefined;
    const longformAnimationStyle = longformEnabled ? ('custom' as const) : undefined;

    const accountMedia = await internalListForPipeline(account.id);
    const inspirationResumeCount = accountMedia.filter(
      (m) => m.role === 'inspiration' || m.role === 'style_reference',
    ).length;
    if (longformEnabled && inspirationResumeCount < 1) {
      const msg =
        'Long-form requires at least one Media library item with role “Inspiration” or “Style reference” so every shot matches your visual references. Open Media → upload → set role → save.';
      await markFailed(post.id, msg);
      void maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId: post.id,
        topic: post.topic,
        error: msg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
      return {
        postId: post.id,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: post.costCents ?? 0,
        skipped: true,
        reason: 'no_longform_inspiration',
      };
    }
    const resumedShotById = parseSourcingCheckpointByShotId(post.script);

    broadcast({
      type: 'personal:progress',
      payload: { accountId: account.id, postId: post.id, phase: 'resumed:director' },
    });

    try {
      return await directorPipelineFromResolvedStoryboard({
        account,
        theme,
        genConfig,
        styleBible,
        character,
        postId: post.id,
        topic,
        storyboard,
        aspectRatio,
        longformEnabled,
        longformTargetSeconds,
        longformAnimationStyle,
        accountMedia,
        initialCostCents: (post.costCents ?? 0) === 0 ? 3 : (post.costCents ?? 0),
        args,
        resumedShotById,
        markFailed,
        pickImageModelForLongform,
      });
    } catch (e) {
      const msg =
        e instanceof StitcherError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      await markFailed(post.id, msg);
      void maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId: post.id,
        topic: post.topic,
        error: msg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
      throw e;
    }
  }

  const cannotResumeMsg =
    'This generation cannot be resumed automatically. Start a new generate.';
  await markFailed(post.id, cannotResumeMsg);
  void maybeEmailPersonalPostFailed({
    accountId: account.id,
    postId: post.id,
    topic: post.topic,
    error: cannotResumeMsg,
    includeSaveLink: false,
  }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
  return {
    postId: post.id,
    videoUrl: null,
    status: 'failed',
    durationSeconds: 0,
    costCents: 0,
    skipped: true,
    reason: 'not resumable',
  };
}

/**
 * Enqueues director-mode posts that were interrupted by a process restart so
 * they can continue from DB checkpoints (see personalDirectorPipelineMid).
 *
 * Gated by {@link personalDirectorResumeOnBootEnabled} from `personalAccounts.ts`
 * so local API restarts do not surprise-restart long jobs (see scheduler startup).
 */
export async function resumeInterruptedDirectorPersonalPostsOnBoot(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const bootAt = getPersonalProcessBootAt();
  const rows = await db
    .select()
    .from(personalPosts)
    .where(
      and(
        lt(personalPosts.updatedAt, bootAt),
        or(
          and(eq(personalPosts.status, 'rendering'), like(personalPosts.templateId, 'director:%')),
          and(eq(personalPosts.status, 'sourcing_media'), like(personalPosts.templateId, 'director:%')),
        ),
      ),
    )
    .limit(128);

  let n = 0;
  for (const post of rows) {
    const pre = parsePreStitchCheckpoint(post.script);
    const canStitch = Boolean(pre && post.status === 'rendering');
    const canSource = post.status === 'sourcing_media' && hasDirectorStoryboard(post.script);
    if (!canStitch && !canSource) continue;

    await db
      .update(personalPosts)
      .set({
        updatedAt: new Date(),
        renderProgressLabel: canStitch
          ? 'Resuming video encode after restart…'
          : 'Resuming shot generation after restart…',
        errorMessage: null,
      })
      .where(eq(personalPosts.id, post.id));

    const { mergePersonalScheduleIntentIntoArgs } = await import('./personalContentPosting.js');
    const resumeArgs = mergePersonalScheduleIntentIntoArgs(
      {
        accountId: post.accountId,
        resumeFromPostId: post.id,
        dryRun: false,
      },
      post.script,
    );
    void enqueuePersonalGenerateForAccount(post.accountId, () =>
      generateForAccount(resumeArgs),
    );
    n++;
  }
  if (n > 0) {
    console.warn(`[personal] enqueued ${n} interrupted director job(s) to resume`);
  }
  return n;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Entry point                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

export async function generateForAccountDirector(
  args: GenerateForAccountArgs,
): Promise<GenerateForAccountResult> {
  const db = getDb();
  const [account] = await db
    .select()
    .from(personalAccounts)
    .where(eq(personalAccounts.id, args.accountId));
  if (!account) throw new Error('Personal account not found');
  if (account.status === 'archived') {
    if (args.reservedPostId) {
      await markPersonalPostQueuedFailedIfStillQueued(
        args.reservedPostId,
        'This channel is archived — generation was not started.',
      );
    }
    return {
      postId: args.reservedPostId ?? '',
      videoUrl: null,
      status: 'skipped',
      durationSeconds: 0,
      costCents: 0,
      skipped: true,
      reason: `account status is "${account.status}"`,
    };
  }

  const theme =
    getTheme(account.themeId) ??
    (await findThemeForUser(account.userId, account.themeId));
  if (!theme) throw new Error(`Theme not found: ${account.themeId}`);

  const genConfig: PersonalGeneratorConfig =
    (account.generatorConfig as PersonalGeneratorConfig) ?? {};
  const styleBible: PersonalAccountStyleBible =
    (account.styleBible as PersonalAccountStyleBible) ?? {};
  const character = account.characterId
    ? await getCharacterUnsafe(account.characterId)
    : null;

  if (args.resumeFromPostId) {
    return resumeDirectorInto(args, account, theme, genConfig, styleBible, character);
  }

  assertPersonalVideoExampleTitlesOrThrow(account.formatKind, styleBible);

  const recent = await recentTopics(account.id, 15);
  const topic =
    args.topic?.trim() ??
    (await chooseTopic({
      theme,
      topicSeeds: account.topicSeeds ?? undefined,
      recentTopics: recent,
      customDirection: account.customDirection ?? undefined,
      styleBible,
    }));

  const expectedTemplateId = `director:${theme.template}`;
  let postId: string;
  if (args.reservedPostId) {
    const [existing] = await db
      .select()
      .from(personalPosts)
      .where(eq(personalPosts.id, args.reservedPostId));
    if (!existing || existing.accountId !== account.id) {
      throw new Error('Reserved post not found for this account');
    }
    if (existing.status !== 'queued') {
      throw new Error('Reserved post is no longer queued');
    }
    if (!existing.templateId.startsWith('director:')) {
      throw new Error('Reserved post was not created for director mode');
    }
    if (existing.templateId !== expectedTemplateId) {
      await markPersonalPostQueuedFailedIfStillQueued(
        args.reservedPostId,
        'Theme changed while this post was waiting in queue.',
      );
      throw new Error('Theme changed while post was in queue');
    }
    postId = args.reservedPostId;
    args = mergePersonalScheduleIntentIntoArgs(args, existing.script);
    const scheduleIntent = buildPersonalScheduleIntent(args, account);
    const [claimed] = await db
      .update(personalPosts)
      .set({
        topic,
        status: 'scripting',
        script: withPersonalScheduleIntent({}, scheduleIntent) as any,
        updatedAt: new Date(),
      })
      .where(and(eq(personalPosts.id, postId), eq(personalPosts.status, 'queued')))
      .returning({ id: personalPosts.id });
    if (!claimed) {
      throw new Error('Could not claim reserved post — it may have been cancelled or superseded.');
    }
  } else {
    const scheduleIntent = buildPersonalScheduleIntent(args, account);
    const [post] = await db
      .insert(personalPosts)
      .values({
        accountId: account.id,
        templateId: expectedTemplateId,
        postKind: (account.formatKind as 'video' | 'slideshow' | 'static_image') ?? 'video',
        topic,
        script: withPersonalScheduleIntent({}, scheduleIntent) as any,
        status: 'scripting',
      })
      .returning();
    if (!post) throw new Error('Failed to create personal post row');
    postId = post.id;
  }

  broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'started:director' } });

  if (args.dryRun) {
    await markStatus(postId, 'ready');
    return { postId, videoUrl: null, status: 'ready', durationSeconds: 0, costCents: 0, skipped: true, reason: 'dry run' };
  }

  try {
    let totalCostCents = 0;

    const abortIfStopped = async () => {
      if (!(await personalPostIsFailed(postId))) return null;
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: totalCostCents,
        skipped: true,
        reason: 'stopped',
      } as const;
    };

    /* ── 1. Research (optional) ───────────────────────────── */
    let newsContext: string | undefined;
    if (theme.mediaSources.includes('news') || genConfig.allowWebResearch) {
      try {
        const research = await researchTopic(topic);
        newsContext = researchToPromptBlock(research);
      } catch {
        /* non-fatal */
      }
    }

    {
      const stopped = await abortIfStopped();
      if (stopped) return stopped;
    }

    /* ── 2. Reference library digest ─────────────────────── */
    const accountMedia = await internalListForPipeline(account.id);
    const refMediaDigest = accountMedia.length
      ? accountMedia
          .slice(0, 12)
          .map(
            (m, i) =>
              `[${i}] (${m.role}) ${m.description ?? m.aiDescription ?? 'no description'}${
                m.tags && m.tags.length > 0 ? ` · tags: ${m.tags.join(', ')}` : ''
              }`,
          )
          .join('\n')
      : undefined;

    /* ── 2b. Inspiration style block ─────────────────────── */
    // Pull everything the user tagged as inspiration / style reference,
    // and render it as a short multi-line style brief the director and
    // every AI shot can read. This is the single biggest quality lever
    // for "feels like our inspiration" — without it each shot drifts.
    const inspirationItems = accountMedia.filter(
      (m) => m.role === 'inspiration' || m.role === 'style_reference',
    );
    const inspirationStyleBlock = inspirationItems.length
      ? inspirationItems
          .slice(0, 8)
          .map((m, i) => {
            const desc =
              m.description ??
              m.aiDescription ??
              (m.tags && m.tags.length > 0 ? m.tags.join(', ') : 'reference still or clip');
            const mime = (m.mimeType ?? '').toLowerCase();
            const kind =
              mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i.test(m.fileUrl ?? '')
                ? 'video'
                : mime.startsWith('image/') ||
                    /\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(m.fileUrl ?? '')
                  ? 'image'
                  : 'media';
            return `[${i + 1}] (${kind}) ${desc}`;
          })
          .join('\n')
      : undefined;
    // Short one-line version for per-shot prompts. We compress every
    // ref down to whatever descriptive text the user or Claude wrote
    // and cap the whole thing so shots stay inside the model's token
    // budget.
    const inspirationStyleHint = inspirationItems.length
      ? inspirationItems
          .slice(0, 4)
          .map((m) => m.description ?? m.aiDescription ?? '')
          .filter((s) => s && s.length > 0)
          .join('; ')
          .slice(0, 400)
      : undefined;

    const isAnimatedTheme = theme.template === 'animated-explainer';
    const longformEnabled = genConfig.longformEnabled === true || isAnimatedTheme;

    if (longformEnabled && inspirationItems.length < 1) {
      const msg =
        'Long-form requires at least one Media library item with role “Inspiration” or “Style reference” so every shot matches your visual references. Open Media → upload → set role → save.';
      await markFailed(postId, msg);
      void maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId,
        topic,
        error: msg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: totalCostCents,
        skipped: true,
        reason: 'no_longform_inspiration',
      };
    }

    /* ── 3. Plan storyboard ──────────────────────────────── */
    broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'directing' } });

    // Viral format: the operator may have pinned one via generator
    // config; otherwise we pick a sensible default for the theme. A
    // character-driven account defaults to storytime; a faceless
    // educational theme defaults to listicle; everything else picks
    // the three-act curiosity loop.
    const chosenFormat =
      (genConfig.viralFormatId ? getViralFormat(genConfig.viralFormatId) : undefined) ??
      defaultFormatFor({
        niche: theme.template === 'slideshow' ? 'faceless_education' : 'general',
        productCentric: false,
        hasCharacter: Boolean(character),
      });
    const viralFormatBlock = formatToPromptBlock(chosenFormat);

    // Optional opening-hook formula. Locks the first beat.
    const hookFormulaDirective = genConfig.hookFormulaId
      ? (() => {
          const f = getHookFormula(genConfig.hookFormulaId!);
          return f ? hookFormulaToDirective(f) : undefined;
        })()
      : undefined;

    const usedVideoTitles = await recentVideoTitles(account.id, 40);

    {
      const stopped = await abortIfStopped();
      if (stopped) return stopped;
    }

    const channelTitlePass = await channelVideoTitleLikeIsolatedTest({
      account: {
        id: account.id,
        userId: account.userId,
        themeId: account.themeId,
        language: account.language,
        styleBible: account.styleBible,
        generatorConfig: account.generatorConfig,
      },
      topic,
    });

    if (channelTitlePass?.trim()) {
      const [row] = await db
        .select({ script: personalPosts.script })
        .from(personalPosts)
        .where(eq(personalPosts.id, postId));
      const base =
        row?.script && typeof row.script === 'object' && !Array.isArray(row.script)
          ? { ...(row.script as Record<string, unknown>) }
          : {};
      await db
        .update(personalPosts)
        .set({
          script: { ...base, title: channelTitlePass.trim() } as any,
          updatedAt: new Date(),
        })
        .where(eq(personalPosts.id, postId));
    }

    {
      const stopped = await abortIfStopped();
      if (stopped) return stopped;
    }

    /* ── Long-form mode ──────────────────────────────────────
     * Auto-enabled when:
     *   - the theme is `animated-explainer` (the themes built for it)
     *   - OR the operator turns it on in generator config
     *
     * Duration is clamped to 60–480 seconds (1–8 minutes). When the
     * operator picks an explicit `longformTargetSeconds` we use that
     * directly; otherwise we fall back to the theme's target. Both
     * conditions bypass the viral-format duration (which is tuned for
     * shorts).
     *
     * Visual look: long-form always uses `custom` animation style so the
     * ANIMATION STYLE preset block is omitted — look comes from inspiration
     * + style_reference media only (validated above). */
    const longformTargetSeconds = longformEnabled
      ? clampLongformTargetSeconds(genConfig.longformTargetSeconds ?? theme.targetDurationSeconds)
      : undefined;
    const longformAnimationStyle = longformEnabled ? ('custom' as const) : undefined;

    const storyboardTargetSeconds = longformEnabled
      ? (longformTargetSeconds ?? theme.targetDurationSeconds)
      : genConfig.viralFormatId
        ? chosenFormat.targetDurationSeconds
        : theme.targetDurationSeconds;

    {
      const stopped = await abortIfStopped();
      if (stopped) return stopped;
    }

    const storyboard = await planStoryboard({
      theme,
      topic,
      // Respect the format's sweet-spot duration when it's been picked
      // explicitly; otherwise fall back to the theme default. When
      // long-form is on, the long-form target takes precedence.
      targetDurationSeconds: storyboardTargetSeconds,
      styleBible,
      customDirection: account.customDirection ?? undefined,
      blacklist: account.topicBlacklist ?? undefined,
      newsContext,
      language: account.language,
      characterGuide: character
        ? {
            name: character.name,
            promptFragment: character.promptFragment ?? undefined,
            voiceTone: (character.characterSheet as any)?.voice?.tone,
            voicePace: (character.characterSheet as any)?.voice?.pace,
            catchphrases: (character.characterSheet as any)?.voice?.catchphrases,
          }
        : undefined,
      referenceMediaDigest: refMediaDigest,
      inspirationStyleBlock,
      viralFormatBlock: longformEnabled ? undefined : viralFormatBlock,
      hookFormulaDirective,
      allowMultiAct: true,
      maxAiVideoShots: maxAiShotsFor(genConfig, longformEnabled),
      mediaPreference: genConfig.mediaPreference ?? 'mixed',
      cutPace: genConfig.cutPace ?? 'normal',
      keywordPopStyle: genConfig.keywordPopStyle ?? 'off',
      allowSparseImageText: genConfig.allowSparseImageText === true,
      namesNumbersTitleCard: genConfig.namesNumbersTitleCard === true,
      directorShotOnScreenCopy: genConfig.directorShotOnScreenCopy !== false,
      averageShotSeconds: genConfig.averageClipSeconds,
      promptAppendix:
        [
          buildPersonalContentRulesPrompt(genConfig, styleBible),
          buildMediaPreferencePrompt(genConfig.mediaPreference),
          buildAverageShotPrompt(genConfig.averageClipSeconds),
          buildMinShotsForRuntimePrompt(
            storyboardTargetSeconds,
            genConfig.averageClipSeconds,
            { longform: longformEnabled, cutPace: genConfig.cutPace ?? 'normal' },
          ),
        ]
          .map((s) => s.trim())
          .filter(Boolean)
          .join('\n\n') || undefined,
      longform: longformEnabled
        ? {
            enabled: true,
            targetDurationSeconds: longformTargetSeconds!,
            animationStyle: longformAnimationStyle,
          }
        : undefined,
      scriptModel: genConfig.scriptModel,
      recentVideoTitles: usedVideoTitles,
      lockedVideoTitle: channelTitlePass ?? undefined,
    });
    totalCostCents += 3;

    {
      const stopped = await abortIfStopped();
      if (stopped) return stopped;
    }

    if (storyboard.blocked) {
      const msg = `Blocked: ${storyboard.blockReason ?? 'unspecified'}`;
      await markFailed(postId, msg);
      void maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId,
        topic,
        error: msg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: totalCostCents,
        skipped: true,
        reason: storyboard.blockReason,
      };
    }

    // Aspect ratio: long-form defaults to 16:9; short-form to 9:16 unless
    // the operator pinned one in generator config. Stored on `script` so
    // the dashboard can frame previews correctly.
    const aspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
      genConfig.aspectRatio ?? (longformEnabled ? '16:9' : '9:16');

    const durationHintSeconds = longformEnabled
      ? longformTargetSeconds
      : Math.round(storyboard.estimatedDurationSeconds ?? 0) > 2
        ? Math.round(storyboard.estimatedDurationSeconds ?? 0)
        : undefined;

    await db
      .update(personalPosts)
      .set({
        script: {
          ...(storyboard as unknown as Record<string, unknown>),
          outputAspectRatio: aspectRatio,
        } as any,
        status: 'sourcing_media',
        ...(durationHintSeconds != null ? { durationSeconds: durationHintSeconds } : {}),
        renderActivityLog: [
          {
            at: new Date().toISOString(),
            m: 'Storyboard ready — entering media sourcing (AI / stock assets; can take several minutes).',
          },
        ],
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));

    return await directorPipelineFromResolvedStoryboard({
      account,
      theme,
      genConfig,
      styleBible,
      character,
      postId,
      topic,
      storyboard,
      aspectRatio,
      longformEnabled,
      longformTargetSeconds,
      longformAnimationStyle,
      accountMedia,
      initialCostCents: totalCostCents,
      args,
      markFailed,
      pickImageModelForLongform,
    });
  } catch (e) {
    const msg =
      e instanceof StitcherError
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e);
    if (msg !== PERSONAL_POST_CANCELLED_MESSAGE) {
      try {
        await markFailed(postId, msg);
      } catch (dbErr) {
        console.error('[director] markFailed could not persist:', (dbErr as Error).message);
      }
      void maybeEmailPersonalPostFailed({
        accountId: account.id,
        postId,
        topic,
        error: msg,
        includeSaveLink: false,
      }).catch((err) => console.warn('[personal] failure email:', (err as Error).message));
    }
    try {
      broadcast({
        type: 'personal:progress',
        payload: { accountId: account.id, postId, phase: 'failed:director', error: msg },
      });
    } catch {
      /* ignore broadcast errors */
    }
    throw e;
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Helpers                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

function maxAiShotsFor(
  cfg: PersonalGeneratorConfig,
  longform = false,
): number {
  if (cfg.mediaPreference === 'stills_only') return 0;
  const tier = cfg.qualityTier ?? 'balanced';
  if (cfg.useAiVideo === false) return 0;
  const motionBoost =
    cfg.mediaPreference === 'motion_preferred' || cfg.mediaPreference === 'video_only';
  if (longform) {
    // Long-form can afford more AI-video money shots without the cost
    // dominating, but still keeps ai_image as the bulk of the video.
    if (cfg.longformMaxAiVideoShots && cfg.longformMaxAiVideoShots > 0) {
      return Math.min(20, Math.max(0, cfg.longformMaxAiVideoShots));
    }
    if (tier === 'max') return motionBoost ? 12 : 10;
    if (tier === 'balanced') return motionBoost ? 7 : 5;
    return motionBoost ? 3 : 2;
  }
  if (tier === 'max') return motionBoost ? 7 : 5;
  if (tier === 'balanced') return motionBoost ? 5 : 3;
  return motionBoost ? 2 : 1;
}

async function markStatus(postId: string, status: string) {
  const db = getDb();
  await db
    .update(personalPosts)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(personalPosts.id, postId));
}

async function markFailed(postId: string, message: string) {
  const db = getDb();
  await db
    .update(personalPosts)
    .set({
      status: 'failed',
      errorMessage: message.slice(0, 500),
      renderProgress: null,
      renderProgressLabel: null,
      updatedAt: new Date(),
    })
    .where(eq(personalPosts.id, postId));
}
