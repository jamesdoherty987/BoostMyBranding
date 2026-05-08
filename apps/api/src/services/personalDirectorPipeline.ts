/**
 * Director-first pipeline.
 *
 * An alternative to the script-first pipeline (personalPipeline.ts) that
 * plans a multi-shot storyboard, resolves each shot to an asset (AI
 * video, AI still with Ken Burns, scraped, or user media), then stitches
 * them with real editorial cuts + audio mix.
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

import { eq } from 'drizzle-orm';
import {
  getDb,
  personalAccounts,
  personalPosts,
  type PersonalAccountStyleBible,
  type PersonalGeneratorConfig,
} from '@boost/database';
import { getTheme, type PersonalTheme } from './personalThemes.js';
import { findThemeForUser } from './personalCustomThemes.js';
import {
  planStoryboard,
  shotToPrompt,
  flattenStoryboard,
  animationStyleHintFor,
  type Storyboard,
  type DirectorShot,
} from './personalDirector.js';
import {
  searchAssets,
  pickGameplayLoop,
} from './personalScraper.js';
import { synthesizeVoice, estimateDurationSeconds } from './personalVoice.js';
import { pickMusic } from './personalMusic.js';
import { schedulePost } from './contentStudio.js';
import { broadcast } from './realtime.js';
import { recentTopics } from './personalAccounts.js';
import { chooseTopic } from './personalScript.js';
import { features } from '../env.js';
import { withRetry } from './retry.js';
import { getCharacterUnsafe, getCharacterAnchorImages } from './personalCharacters.js';
import { internalListForPipeline } from './personalAccountMedia.js';
import { researchTopic, researchToPromptBlock } from './personalResearch.js';
import {
  generateAiImage,
  generateAiVideo,
  pickDefaultModel,
  listAiModels,
} from './personalAiModels.js';
import { stitchShots, type StitchShotInput } from './personalStitcher.js';
import type { GenerateForAccountArgs, GenerateForAccountResult } from './personalPipeline.js';
import {
  getViralFormat,
  defaultFormatFor,
  formatToPromptBlock,
} from './viralFormats.js';
import { getHookFormula, hookFormulaToDirective } from './viralHooks.js';

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
  if (account.status !== 'active') {
    return {
      postId: '',
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

  const recent = await recentTopics(account.id, 15);
  const topic =
    args.topic?.trim() ??
    (await chooseTopic({
      theme,
      topicSeeds: account.topicSeeds ?? undefined,
      recentTopics: recent,
      customDirection: account.customDirection ?? undefined,
    }));

  // Create row.
  const [post] = await db
    .insert(personalPosts)
    .values({
      accountId: account.id,
      templateId: `director:${theme.template}`,
      postKind: (account.formatKind as 'video' | 'slideshow' | 'static_image') ?? 'video',
      topic,
      script: {},
      status: 'scripting',
    })
    .returning();
  if (!post) throw new Error('Failed to create personal post row');
  const postId = post.id;

  broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'started:director' } });

  if (args.dryRun) {
    await markStatus(postId, 'ready');
    return { postId, videoUrl: null, status: 'ready', durationSeconds: 0, costCents: 0, skipped: true, reason: 'dry run' };
  }

  try {
    let totalCostCents = 0;

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
              (m.tags && m.tags.length > 0 ? m.tags.join(', ') : 'reference image');
            return `[${i + 1}] ${desc}`;
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

    /* ── Long-form mode ──────────────────────────────────────
     * Auto-enabled when:
     *   - the theme is `animated-explainer` (the themes built for it)
     *   - OR the operator turns it on in generator config
     *
     * Duration is clamped to 60–480 seconds (1–8 minutes). When the
     * operator picks an explicit `longformTargetSeconds` we use that
     * directly; otherwise we fall back to the theme's target. Both
     * conditions bypass the viral-format duration (which is tuned for
     * shorts). */
    const isAnimatedTheme = theme.template === 'animated-explainer';
    const longformEnabled =
      genConfig.longformEnabled === true || isAnimatedTheme;
    const longformTargetSeconds = longformEnabled
      ? clampLongformSeconds(
          genConfig.longformTargetSeconds ?? theme.targetDurationSeconds,
        )
      : undefined;
    const longformAnimationStyle =
      genConfig.longformAnimationStyle ??
      (theme.id === 'ancient-origins' || theme.id === 'storybook-myth'
        ? 'storybook'
        : theme.id === 'science-cartoon'
          ? 'cartoon'
          : theme.id === 'stick-figure-explainer'
            ? 'stick_figure'
            : undefined);

    const storyboard = await planStoryboard({
      theme,
      topic,
      // Respect the format's sweet-spot duration when it's been picked
      // explicitly; otherwise fall back to the theme default. When
      // long-form is on, the long-form target takes precedence.
      targetDurationSeconds: longformEnabled
        ? (longformTargetSeconds ?? theme.targetDurationSeconds)
        : genConfig.viralFormatId
          ? chosenFormat.targetDurationSeconds
          : theme.targetDurationSeconds,
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
      longform: longformEnabled
        ? {
            enabled: true,
            targetDurationSeconds: longformTargetSeconds!,
            animationStyle: longformAnimationStyle,
          }
        : undefined,
    });
    totalCostCents += 3;

    if (storyboard.blocked) {
      await markFailed(postId, `Blocked: ${storyboard.blockReason ?? 'unspecified'}`);
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

    await db
      .update(personalPosts)
      .set({
        script: storyboard as any,
        status: 'sourcing_media',
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));

    /* ── 4. Resolve each shot to a concrete asset ─────────── */
    broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'sourcing_media' } });

    const characterAnchors = character
      ? await getCharacterAnchorImages(character.id, 3)
      : [];

    // Both 'style_reference' and 'inspiration' are visual anchors — the
    // distinction in the media library is bookkeeping, not intent. Pass
    // both into AI image/video models as reference URLs so the output
    // inherits the look.
    const styleRefUrls = accountMedia
      .filter((m) => m.role === 'style_reference' || m.role === 'inspiration')
      .filter((m) => (m.mimeType ?? '').startsWith('image/'))
      .slice(0, 4)
      .map((m) => m.fileUrl);

    const defaultImageModel =
      genConfig.imageModelId ??
      pickImageModelForLongform(
        longformEnabled ? longformAnimationStyle : undefined,
        genConfig.qualityTier ?? 'balanced',
      );
    const defaultVideoModel =
      genConfig.videoModelId ??
      pickDefaultModel('video', genConfig.qualityTier ?? 'balanced')?.id;

    const flat = flattenStoryboard(storyboard);
    const shotAssets: Array<{
      fs: ReturnType<typeof flattenStoryboard>[number];
      asset: { url: string; kind: 'image' | 'video' } | null;
      costCents: number;
      error?: string;
    }> = [];

    // Long-form animation style hint — one line per shot so every
    // AI image/video in a long-form video keeps the same medium.
    const animationStyleHint = longformEnabled
      ? animationStyleHintFor(longformAnimationStyle ?? 'custom')
      : undefined;

    // Aspect ratio: long-form documentaries work best at 16:9 on
    // YouTube / web. Short-form stays at 9:16 for Reels / TikTok. The
    // user's explicit setting always wins.
    const aspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
      genConfig.aspectRatio ?? (longformEnabled ? '16:9' : '9:16');

    // Per-shot generation as a separate function so we can pool it.
    // Returns the resolved asset + cost + (on failure) the error message
    // so the outer loop can surface a meaningful diagnostic if too many
    // shots fail.
    const generateShotAsset = async (
      fs: (typeof flat)[number],
    ): Promise<{
      fs: (typeof flat)[number];
      asset: { url: string; kind: 'image' | 'video' } | null;
      costCents: number;
      error?: string;
    }> => {
      const prompt = shotToPrompt({
        shot: fs.shot,
        themeVisualStyle: theme.visualStyle,
        styleBibleVibe: styleBible.vibe ?? undefined,
        characterFragment: character?.promptFragment ?? undefined,
        globalColourGrade: storyboard.editPlan.colourGrade,
        inspirationStyleHint,
        animationStyleHint,
      });
      const negativePrompt = [
        ...(styleBible.donts ?? []),
        ...(character?.negativePrompt ? [character.negativePrompt] : []),
      ]
        .filter(Boolean)
        .join(', ');

      // In long-form mode we send up to 4 refs (nano-banana's cap) so
      // character + style consistency holds across 40+ shots. Short-form
      // keeps the tight 2+2 split for speed.
      const refs = longformEnabled
        ? [...characterAnchors.slice(0, 3), ...styleRefUrls.slice(0, 3)].slice(0, 6)
        : [...characterAnchors.slice(0, 2), ...styleRefUrls.slice(0, 2)];

      let asset: { url: string; kind: 'image' | 'video' } | null = null;
      let shotCost = 0;
      let error: string | undefined;

      try {
        if (fs.shot.kind === 'ai_video' && defaultVideoModel && features.fal) {
          const video = await withRetry(
            () =>
              generateAiVideo({
                modelId: defaultVideoModel,
                prompt,
                negativePrompt: negativePrompt || undefined,
                aspectRatio: videoAspectFrom(aspectRatio),
                durationSeconds: Math.min(
                  // Long-form allows up to 10s per AI video clip so
                  // establishing and reveal shots have room; short-form
                  // keeps the tight 5s default for snappy pacing.
                  genConfig.clipMaxSeconds ?? (longformEnabled ? 10 : 5),
                  Math.max(
                    genConfig.clipMinSeconds ?? (longformEnabled ? 4 : 2),
                    fs.shot.durationSeconds,
                  ),
                ),
                referenceImageUrls: refs,
                scopePath: `personal/${account.id}/ai-video`,
              }),
            { label: `director_video:${account.id}:${fs.shot.id}`, attempts: 1 },
          );
          asset = { url: video.url, kind: 'video' };
          shotCost = video.costCents;
        } else if (
          fs.shot.kind === 'scraped_video' ||
          fs.shot.kind === 'scraped_image' ||
          fs.shot.kind === 'b_roll'
        ) {
          const { items } = await searchAssets({
            query: fs.shot.imageQuery ?? fs.shot.description ?? topic,
            sources: theme.mediaSources.filter(
              (s): s is 'pexels' | 'unsplash' | 'pixabay' | 'wikipedia' | 'news' =>
                s !== 'ai' && s !== 'gameplay',
            ),
            count: 3,
            preferVideo: fs.shot.kind === 'scraped_video' || fs.shot.kind === 'b_roll',
          });
          if (items.length > 0) {
            const pick = items[0]!;
            asset = {
              url: pick.downloadUrl ?? pick.url,
              kind: pick.kind === 'video' ? 'video' : 'image',
            };
          } else if (fs.shot.kind === 'b_roll' && theme.mediaSources.includes('gameplay')) {
            const loop = pickGameplayLoop(fs.shot.id);
            asset = { url: loop.url, kind: 'video' };
          }
        }

        // Either the shot asked for ai_image OR an ai_video/scraped fell
        // through — fill with an ai_image so the beat still renders.
        if (!asset && defaultImageModel && !theme.requiresGroundedImages) {
          const image = await withRetry(
            () =>
              generateAiImage({
                modelId: defaultImageModel,
                prompt,
                negativePrompt: negativePrompt || undefined,
                aspectRatio: aspectRatio,
                referenceImageUrls: refs,
                scopePath: `personal/${account.id}/ai-image`,
              }),
            { label: `director_image:${account.id}:${fs.shot.id}`, attempts: 1 },
          );
          asset = { url: image.url, kind: 'image' };
          shotCost = image.costCents;
        }
      } catch (e) {
        error = (e as Error).message;
        console.warn(`[director] shot ${fs.shot.id} failed:`, error);
      }

      return { fs, asset, costCents: shotCost, error };
    };

    // Bounded parallelism — generate shots 4 at a time. With 40 shots
    // × 20s each sequential that's 13 minutes; at 4-way concurrency
    // it's ~3 minutes. We also emit progress after every completion so
    // the UI can show "Shot 17/40".
    const concurrency = longformEnabled ? 4 : 2;
    const shotResultsOrdered: Array<Awaited<ReturnType<typeof generateShotAsset>>> =
      new Array(flat.length);
    let completed = 0;
    let nextIdx = 0;
    const workers: Promise<void>[] = [];
    const worker = async () => {
      while (true) {
        const idx = nextIdx++;
        if (idx >= flat.length) return;
        const result = await generateShotAsset(flat[idx]!);
        shotResultsOrdered[idx] = result;
        completed++;
        totalCostCents += result.costCents;
        broadcast({
          type: 'personal:progress',
          payload: {
            accountId: account.id,
            postId,
            phase: 'sourcing_media',
            progress: { done: completed, total: flat.length },
          },
        });
      }
    };
    for (let w = 0; w < concurrency; w++) workers.push(worker());
    await Promise.all(workers);
    shotAssets.push(...shotResultsOrdered);

    // Drop shots with no asset.
    const resolved = shotAssets.filter((s) => s.asset !== null) as Array<{
      fs: ReturnType<typeof flattenStoryboard>[number];
      asset: { url: string; kind: 'image' | 'video' };
      costCents: number;
    }>;
    const failedSamples = shotAssets
      .filter((s) => s.asset === null && (s as any).error)
      .slice(0, 3)
      .map((s) => (s as any).error as string);
    const minShotsRequired = longformEnabled ? 8 : 3;
    if (resolved.length < minShotsRequired) {
      const label = longformEnabled ? 'long-form video' : 'short';
      const hint = failedSamples.length
        ? ` First failures: ${failedSamples.join(' | ')}`
        : '';
      await markFailed(
        postId,
        `Only ${resolved.length}/${flat.length} shots resolved — need at least ${minShotsRequired} for a watchable ${label}.${hint}`,
      );
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: totalCostCents,
        skipped: true,
        reason: 'insufficient resolved shots',
      };
    }

    /* ── 5. Voiceover (stitched narration) ───────────────── */
    const useVoiceover = genConfig.useVoiceover ?? theme.useVoiceover;
    let voiceoverUrl: string | null = null;
    let estimatedDuration = resolved.reduce(
      (acc, r) => acc + r.fs.shot.durationSeconds,
      0,
    );
    if (useVoiceover) {
      broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'voicing' } });
      const narration = [
        storyboard.hook,
        ...resolved.map((r) => r.fs.shot.voiceover).filter(Boolean),
        storyboard.outro,
      ]
        .filter(Boolean)
        .join(' ');
      if (narration.length > 0) {
        const voice = await synthesizeVoice({
          text: narration,
          voiceId:
            genConfig.ttsVoiceId ??
            character?.voiceId ??
            account.voiceId ??
            'default',
          language: account.language,
          accountId: account.id,
        });
        voiceoverUrl = voice.audioUrl;
        estimatedDuration = Math.max(estimatedDuration, voice.durationSeconds);
        totalCostCents += voice.costCents;
      }
    } else {
      const onScreenText = [
        storyboard.hook,
        ...resolved.map((r) => r.fs.shot.onScreen).filter(Boolean),
        storyboard.outro,
      ].join(' ');
      if (onScreenText.length > 0) {
        estimatedDuration = Math.max(
          estimatedDuration,
          estimateDurationSeconds(onScreenText),
        );
      }
    }

    /* ── 6. Music ────────────────────────────────────────── */
    let musicUrl: string | null = null;
    let musicAttribution: string | null = null;
    if (account.customAudioUrl) {
      musicUrl = account.customAudioUrl;
      musicAttribution = account.customAudioAttribution ?? null;
    } else {
      const useMusic = genConfig.useMusic ?? theme.useMusic;
      if (useMusic) {
        // For long-form we cap the "min length" request at 60s because the
        // stitcher loops music anyway — asking for 480s tracks will
        // frequently miss the available pool and return nothing.
        const minMusicSeconds = longformEnabled
          ? Math.min(60, Math.ceil(estimatedDuration))
          : Math.ceil(estimatedDuration);
        const music = await pickMusic({
          mood: theme.musicMood,
          seed: postId,
          minDurationSeconds: minMusicSeconds,
        }).catch(() => null);
        if (music) {
          musicUrl = music.url;
          musicAttribution = music.attribution;
        }
      }
    }

    /* ── 7. Stitch ───────────────────────────────────────── */
    broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'stitching' } });
    await db
      .update(personalPosts)
      .set({
        voiceoverUrl,
        musicUrl,
        musicAttribution,
        status: 'rendering',
        mediaAssets: resolved.map((r) => ({
          url: r.asset.url,
          kind: r.asset.kind,
          source: (r.fs.shot.kind === 'ai_video' || r.fs.shot.kind === 'ai_image'
            ? 'ai'
            : r.fs.shot.kind === 'b_roll'
              ? 'gameplay'
              : r.fs.shot.kind === 'scraped_video' || r.fs.shot.kind === 'scraped_image'
                ? 'pexels'
                : 'upload') as any,
          startAtSeconds: 0,
          durationSeconds: r.fs.shot.durationSeconds,
        })),
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));

    const stitchInputs: StitchShotInput[] = resolved.map((r) => ({
      url: r.asset.url,
      kind: r.asset.kind,
      durationSeconds: r.fs.shot.durationSeconds,
      transitionOut: r.fs.shot.transitionOut,
      speedRamp: r.fs.shot.speedRamp,
      focalX: r.fs.shot.focalX,
      focalY: r.fs.shot.focalY,
    }));

    // Pick the stitcher's target duration. Priority:
    //   1. Real voiceover duration (ffmpeg-probed) if we have one.
    //   2. Long-form user target.
    //   3. Sum of shot durations (falls through to no scaling).
    // The goal is to never cut narration mid-sentence: whichever of
    // (narration, visuals, target) is longest wins.
    const shotSum = stitchInputs.reduce((a, s) => a + s.durationSeconds, 0);
    let stitchTarget: number | undefined;
    if (longformEnabled) {
      stitchTarget = Math.max(
        longformTargetSeconds ?? 0,
        estimatedDuration,
        shotSum,
      );
    } else if (useVoiceover && estimatedDuration > shotSum + 1) {
      // For short-form, only extend visuals when narration is obviously
      // longer than the planned visuals so we don't chop off words.
      stitchTarget = estimatedDuration;
    }

    const stitched = await stitchShots({
      accountId: account.id,
      postId,
      shots: stitchInputs,
      audio: {
        voiceoverUrl: voiceoverUrl ?? undefined,
        musicUrl: musicUrl ?? undefined,
      },
      aspectRatio: aspectRatio,
      colourGrade: mapGrade(storyboard.editPlan.colourGrade),
      useGrain: storyboard.editPlan.useGrain,
      letterbox: storyboard.editPlan.letterbox,
      targetDurationSeconds: stitchTarget,
    });
    totalCostCents += 3;

    /* ── 8. Schedule ──────────────────────────────────────── */
    let contentStudioPostId: string | null = null;
    let scheduledAt: Date | null = null;
    const shouldSchedule =
      (args.autoSchedule ?? account.autoSchedule) && account.autoApprove;
    if (shouldSchedule) {
      const when = args.scheduledAt
        ? new Date(args.scheduledAt)
        : new Date(Date.now() + 60 * 60 * 1000);
      try {
        const res = await schedulePost({
          platform: account.platform,
          caption: composeCaption(storyboard),
          videoUrl: stitched.videoUrl,
          scheduledAt: when,
          workspaceId: account.contentStudioWorkspaceId ?? undefined,
        });
        contentStudioPostId = res.id;
        scheduledAt = when;
      } catch (e) {
        console.warn('[director] schedule failed:', (e as Error).message);
      }
    }

    /* ── 9. Persist ───────────────────────────────────────── */
    await db
      .update(personalPosts)
      .set({
        videoUrl: stitched.videoUrl,
        durationSeconds: Math.round(stitched.durationSeconds),
        caption: composeCaption(storyboard),
        hashtags: storyboard.hashtags ?? theme.defaultHashtags,
        contentStudioPostId,
        scheduledAt,
        status: scheduledAt ? 'scheduled' : 'ready',
        costCents: totalCostCents,
        postKind: 'video',
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));

    await db
      .update(personalAccounts)
      .set({
        lastGeneratedAt: new Date(),
        totalPosts: (account.totalPosts ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(personalAccounts.id, account.id));

    broadcast({
      type: 'personal:progress',
      payload: { accountId: account.id, postId, phase: 'done:director', videoUrl: stitched.videoUrl },
    });

    return {
      postId,
      videoUrl: stitched.videoUrl,
      status: scheduledAt ? 'scheduled' : 'ready',
      durationSeconds: stitched.durationSeconds,
      costCents: totalCostCents,
    };
  } catch (e) {
    await markFailed(postId, (e as Error).message);
    broadcast({
      type: 'personal:progress',
      payload: { accountId: account.id, postId, phase: 'failed:director', error: (e as Error).message },
    });
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
  const tier = cfg.qualityTier ?? 'balanced';
  if (cfg.useAiVideo === false) return 0;
  if (longform) {
    // Long-form can afford more AI-video money shots without the cost
    // dominating, but still keeps ai_image as the bulk of the video.
    if (cfg.longformMaxAiVideoShots && cfg.longformMaxAiVideoShots > 0) {
      return Math.min(20, Math.max(0, cfg.longformMaxAiVideoShots));
    }
    if (tier === 'max') return 10;
    if (tier === 'balanced') return 5;
    return 2;
  }
  if (tier === 'max') return 5;
  if (tier === 'balanced') return 3;
  return 1;
}

/** Clamp long-form duration to 60–480 seconds (1–8 minutes). */
function clampLongformSeconds(s: number | undefined): number {
  const n = typeof s === 'number' && Number.isFinite(s) ? s : 240;
  return Math.max(60, Math.min(480, Math.round(n)));
}

/**
 * Choose an image model tuned for long-form animation.
 *
 *   - stick_figure / cartoon / pixel_art → prefer `recraft-v3` or
 *     `ideogram-v3` (illustration-native, non-photoreal).
 *   - storybook / watercolour / claymation → prefer `nano-banana`
 *     (best multi-ref character consistency) then `flux-pro-ultra`
 *     because painterly AI images can get away with subtle photoreal
 *     undertones.
 *   - custom / not-longform → pickDefaultModel() default chain.
 *
 * We only recommend models that are `available` in the current deploy
 * — if the preferred model isn't configured we walk down the list.
 */
function pickImageModelForLongform(
  style:
    | 'storybook'
    | 'cartoon'
    | 'stick_figure'
    | 'claymation'
    | 'pixel_art'
    | 'watercolour'
    | 'custom'
    | undefined,
  tier: 'max' | 'balanced' | 'budget',
): string | undefined {
  if (!style || style === 'custom') {
    return pickDefaultModel('image', tier)?.id;
  }

  const priority: Record<string, string[]> = {
    stick_figure: ['recraft-v3', 'ideogram-v3', 'nano-banana', 'flux-dev'],
    cartoon: ['recraft-v3', 'ideogram-v3', 'nano-banana', 'flux-pro-ultra'],
    pixel_art: ['recraft-v3', 'ideogram-v3', 'flux-dev'],
    storybook: ['nano-banana', 'flux-pro-ultra', 'seedream-v4', 'ideogram-v3'],
    watercolour: ['nano-banana', 'flux-pro-ultra', 'seedream-v4', 'recraft-v3'],
    claymation: ['flux-pro-ultra', 'nano-banana', 'seedream-v4'],
  };

  const preferred = priority[style] ?? [];
  const available = listAiModels();
  for (const id of preferred) {
    const m = available.find((x) => x.id === id && x.available && x.kind === 'image');
    if (m) return m.id;
  }
  return pickDefaultModel('image', tier)?.id;
}

function videoAspectFrom(a: '9:16' | '1:1' | '16:9' | '4:5'): '9:16' | '1:1' | '16:9' {
  return a === '4:5' ? '9:16' : a;
}

function mapGrade(
  grade: string | undefined,
): 'natural' | 'warm' | 'cool' | 'teal_orange' | 'film' | 'bw' | 'high_contrast' {
  if (!grade) return 'natural';
  const g = grade.toLowerCase();
  if (/warm|golden|sun/.test(g)) return 'warm';
  if (/cool|blue|cold/.test(g)) return 'cool';
  if (/teal|orange|cinematic/.test(g)) return 'teal_orange';
  if (/film|grain|vintage/.test(g)) return 'film';
  if (/black.?(and|&).?white|mono/.test(g)) return 'bw';
  if (/contrast|punchy/.test(g)) return 'high_contrast';
  return 'natural';
}

function composeCaption(sb: Storyboard): string {
  const tags = (sb.hashtags ?? [])
    .slice(0, 8)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .join(' ');
  return [sb.caption?.trim(), tags].filter(Boolean).join('\n\n');
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
    .set({ status: 'failed', errorMessage: message.slice(0, 500), updatedAt: new Date() })
    .where(eq(personalPosts.id, postId));
}
