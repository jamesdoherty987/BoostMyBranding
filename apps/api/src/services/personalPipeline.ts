/**
 * Personal content generation pipeline.
 *
 * The full end-to-end flow that turns "account X is due for a post" into
 * a scheduled MP4 on ContentStudio. Runs sequentially with detailed
 * status updates so the UI can track progress.
 *
 * Pipeline:
 *   1. script       — Claude writes the video script
 *   2. media        — scrape imagery per-beat (Pexels/Wiki/News/AI)
 *   3. voice        — synthesize TTS narration
 *   4. music        — pick a background track
 *   5. render       — Remotion renders MP4
 *   6. schedule     — ContentStudio schedules the post
 *
 * Each stage updates the personal_posts row so operators can watch
 * generation in real-time and debug failures.
 */

import { and, eq } from 'drizzle-orm';
import {
  getDb,
  isDbConfigured,
  personalAccounts,
  personalPosts,
  type PersonalPostMediaAsset,
  type PersonalAccountStyleBible,
  type PersonalGeneratorConfig,
} from '@boost/database';
import { getTheme, type PersonalTheme } from './personalThemes.js';
import { clampLongformTargetSeconds } from './personalLongform.js';
import { findThemeForUser } from './personalCustomThemes.js';
import { generateScript, chooseTopic, type PersonalScript } from './personalScript.js';
import { channelVideoTitleLikeIsolatedTest } from './personalChannelTitle.js';
import {
  buildPersonalContentRulesPrompt,
  buildLegacyMediaPreferenceLine,
} from './personalContentHints.js';
import {
  searchAssets,
  pickGameplayLoop,
} from './personalScraper.js';
import {
  synthesizeVoice,
  estimateDurationSeconds,
  joinNarrationParts,
  stripLeadingHookFromFirstVoiceover,
} from './personalVoice.js';
import { resolveChainedMusicBed } from './personalMusicChain.js';
import { renderPersonalVideo } from './personalRender.js';
import { buildLegacyGenerationInfo } from './personalGenerationMeta.js';
import {
  resolveMusicBedSlideshow,
  resolveMusicBedViral,
} from './personalMusicMix.js';
import { schedulePost } from './contentStudio.js';
import {
  contentStudioAccountIdsOverride,
  shouldSchedulePersonalToContentStudio,
} from './personalContentPosting.js';
import { generateImage } from './fal.js';
import { broadcast } from './realtime.js';
import {
  recentTopics,
  recentVideoTitles,
  markPersonalPostQueuedFailedIfStillQueued,
  withAbortWhenPersonalPostFailed,
  PERSONAL_POST_CANCELLED_MESSAGE,
  appendPersonalGenerationLog,
} from './personalAccounts.js';
import { features } from '../env.js';
import { maybeEmailPersonalVideoReady } from './personalVideoDeliveryEmail.js';
import { withRetry } from './retry.js';
import { checkScriptRules } from './personalQuality.js';
import { assertPersonalVideoExampleTitlesOrThrow } from './personalTitlePolicy.js';
import { getCharacterUnsafe } from './personalCharacters.js';
import { internalListForPipeline } from './personalAccountMedia.js';
import { researchTopic, researchToPromptBlock } from './personalResearch.js';
import {
  generateAiImage,
  generateAiVideo,
  pickDefaultModel,
} from './personalAiModels.js';

export interface GenerateForAccountArgs {
  accountId: string;
  /** Override topic — otherwise the engine picks one. */
  topic?: string;
  /** When false, just render and stop — don't schedule. */
  autoSchedule?: boolean;
  /**
   * When true, schedule to ContentStudio after render if the API is configured
   * and a workspace id exists (env or per-account), even when autoApprove is off.
   * Use for "Generate & schedule post" from the dashboard.
   */
  scheduleToContentStudio?: boolean;
  /** When set, schedule at this ISO time instead of the account default. */
  scheduledAt?: string;
  /** Dry-run — log what would happen without actually generating. */
  dryRun?: boolean;
  /**
   * When set, claim this `queued` row created by the HTTP handler instead of
   * inserting a new personal_posts row (per-account generation queue).
   */
  reservedPostId?: string;
  /**
   * Internal: continue an interrupted director-mode post (same row). Used by
   * boot recovery — not exposed on the public generate HTTP route.
   */
  resumeFromPostId?: string;
}

export interface GenerateForAccountResult {
  postId: string;
  videoUrl: string | null;
  status: string;
  durationSeconds: number;
  costCents: number;
  skipped?: boolean;
  reason?: string;
}

export async function generateForAccount(
  args: GenerateForAccountArgs,
): Promise<GenerateForAccountResult> {
  if (!isDbConfigured()) {
    throw new Error('DATABASE_URL is required for personal content generation');
  }
  const db = getDb();
  const [account] = await db
    .select()
    .from(personalAccounts)
    .where(eq(personalAccounts.id, args.accountId));
  if (!account) throw new Error('Personal account not found');

  // Dispatch: director-mode or legacy script-mode. Director is on by
  // default — operators can opt out by setting useDirector: false.
  const genConfig: PersonalGeneratorConfig =
    (account.generatorConfig as PersonalGeneratorConfig) ?? {};
  const useDirector = genConfig.useDirector ?? true;
  if (useDirector) {
    const { generateForAccountDirector } = await import('./personalDirectorPipeline.js');
    return generateForAccountDirector({
      accountId: args.accountId,
      topic: args.topic,
      autoSchedule: args.autoSchedule,
      scheduleToContentStudio: args.scheduleToContentStudio,
      scheduledAt: args.scheduledAt,
      dryRun: args.dryRun,
      resumeFromPostId: args.resumeFromPostId,
      reservedPostId: args.reservedPostId,
    });
  }
  return generateForAccountScript(args);
}

async function generateForAccountScript(
  args: GenerateForAccountArgs,
): Promise<GenerateForAccountResult> {
  if (!isDbConfigured()) {
    throw new Error('DATABASE_URL is required for personal content generation');
  }
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

  const styleBibleEarly = (account.styleBible as PersonalAccountStyleBible) ?? {};
  assertPersonalVideoExampleTitlesOrThrow(account.formatKind, styleBibleEarly);

  // 0. pick topic + create row (or claim a reserved `queued` row from the HTTP handler)
  const recent = await recentTopics(account.id, 15);
  const topic =
    args.topic?.trim() ??
    (await chooseTopic({
      theme,
      topicSeeds: account.topicSeeds ?? undefined,
      recentTopics: recent,
      customDirection: account.customDirection ?? undefined,
      styleBible: styleBibleEarly,
    }));

  const expectedTemplateId = theme.template;
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
    if (existing.templateId.startsWith('director:')) {
      throw new Error('Reserved post was created for director mode but legacy pipeline was selected');
    }
    if (existing.templateId !== expectedTemplateId) {
      await markPersonalPostQueuedFailedIfStillQueued(
        args.reservedPostId,
        'Theme changed while this post was waiting in queue.',
      );
      throw new Error('Theme changed while post was in queue');
    }
    postId = args.reservedPostId;
    const [claimed] = await db
      .update(personalPosts)
      .set({
        topic,
        status: 'scripting',
        script: {},
        updatedAt: new Date(),
      })
      .where(and(eq(personalPosts.id, postId), eq(personalPosts.status, 'queued')))
      .returning({ id: personalPosts.id });
    if (!claimed) {
      throw new Error('Could not claim reserved post — it may have been cancelled or superseded.');
    }
  } else {
    const [post] = await db
      .insert(personalPosts)
      .values({
        accountId: account.id,
        templateId: theme.template,
        postKind:
          (account.formatKind as 'video' | 'slideshow' | 'static_image') ??
          theme.defaultFormat ??
          'video',
        topic,
        script: {}, // filled in step 1
        status: 'scripting',
      })
      .returning();
    if (!post) throw new Error('Failed to create personal post row');
    postId = post.id;
  }

  broadcastEvent(account.id, postId, 'started', { topic });

  if (args.dryRun) {
    await markStatus(postId, 'ready', { costCents: 0 });
    return {
      postId,
      videoUrl: null,
      status: 'ready',
      durationSeconds: 0,
      costCents: 0,
      skipped: true,
      reason: 'dry run',
    };
  }

  try {
    let totalCostCents = 0;

    const styleBible: PersonalAccountStyleBible =
      (account.styleBible as PersonalAccountStyleBible) ?? {};
    const genConfig: PersonalGeneratorConfig =
      (account.generatorConfig as PersonalGeneratorConfig) ?? {};
    const longformScript =
      genConfig.longformEnabled === true || theme.template === 'animated-explainer';
    const outputAspectRatio: '9:16' | '1:1' | '16:9' | '4:5' =
      genConfig.aspectRatio ?? (longformScript ? '16:9' : '9:16');
    const effectiveGen: PersonalGeneratorConfig = {
      ...genConfig,
      aspectRatio: outputAspectRatio,
    };
    const character = account.characterId
      ? await getCharacterUnsafe(account.characterId)
      : null;

    // Pull the user's media library so scripts can reference the vibe.
    const accountMedia = await internalListForPipeline(account.id);
    const refMediaDigest = accountMedia.length
      ? accountMedia
          .slice(0, 12)
          .map(
            (m, i) =>
              `  [${i}] (${m.role}) ${m.description ?? m.aiDescription ?? 'no description'}${
                m.tags && m.tags.length > 0 ? ` · tags: ${m.tags.join(', ')}` : ''
              }`,
          )
          .join('\n')
      : undefined;

    /* ── 1. Research (optional) + News context ─────────────── */
    let newsContext: string | undefined;
    if (theme.mediaSources.includes('news') || genConfig.allowWebResearch) {
      try {
        const research = await researchTopic(topic);
        newsContext = researchToPromptBlock(research);
      } catch {
        /* non-fatal */
      }
    }

    broadcastEvent(account.id, postId, 'scripting', {});
    const scriptPromptAppendix = [
      buildPersonalContentRulesPrompt(genConfig, styleBible),
      buildLegacyMediaPreferenceLine(genConfig.mediaPreference),
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n\n');

    const usedVideoTitles = await recentVideoTitles(account.id, 40);

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

    const script = await withAbortWhenPersonalPostFailed(
      postId,
      generateScript({
        theme,
        topic,
        targetDurationSeconds: longformScript
          ? clampLongformTargetSeconds(genConfig.longformTargetSeconds ?? theme.targetDurationSeconds)
          : undefined,
        customDirection: account.customDirection ?? undefined,
        blacklist: account.topicBlacklist ?? undefined,
        language: account.language,
        longform: longformScript,
        newsContext,
        styleBible,
        characterGuide: character
          ? {
              name: character.name,
              promptFragment: character.promptFragment ?? undefined,
              voiceTone:
                (character.characterSheet as any)?.voice?.tone,
              voicePace:
                (character.characterSheet as any)?.voice?.pace,
              catchphrases:
                (character.characterSheet as any)?.voice?.catchphrases,
            }
          : undefined,
        referenceMediaDigest: refMediaDigest,
        promptAppendix: scriptPromptAppendix || undefined,
        averageClipSeconds: genConfig.averageClipSeconds,
        scriptModel: genConfig.scriptModel,
        recentVideoTitles: usedVideoTitles,
        lockedVideoTitle: channelTitlePass ?? undefined,
      }),
    );
    if (script.blocked) {
      await markFailed(postId, `Blocked by safety filter: ${script.blockReason ?? 'unspecified'}`);
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: 0,
        skipped: true,
        reason: script.blockReason,
      };
    }
    totalCostCents += 2;

    /* ── 1b. Anti-slop check ───────────────────────────────── */
    const rules = checkScriptRules(script, theme);
    const minScore = genConfig.minQualityScore ?? 65;
    if (rules.score < minScore) {
      await markFailed(
        postId,
        `Quality gate: ${rules.score}/100. ${rules.issues.slice(0, 3).join(' | ')}`,
      );
      return {
        postId,
        videoUrl: null,
        status: 'failed',
        durationSeconds: 0,
        costCents: totalCostCents,
        skipped: true,
        reason: `quality gate (${rules.score})`,
      };
    }

    await db
      .update(personalPosts)
      .set({
        script: {
          ...(script as unknown as Record<string, unknown>),
          outputAspectRatio,
        } as any,
        qualityScore: rules.score,
        status: 'sourcing_media',
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));

    /* ── 2. Media sourcing ───────────────────────────────────── */
    broadcastEvent(account.id, postId, 'sourcing_media', {});
    void appendPersonalGenerationLog(
      postId,
      `Legacy pipeline: sourcing media for ${script.beats?.length ?? 0} beat(s)…`,
    ).catch(() => {});
    const mediaAssets = await withAbortWhenPersonalPostFailed(
      postId,
      sourceMediaForBeats({
        theme,
        script,
        accountId: account.id,
        styleBible,
        genConfig: effectiveGen,
        characterRefs: character
          ? accountMedia.filter(
              (m) => m.role === 'avatar_reference' && m.characterId === character.id,
            )
          : [],
        character,
        // Treat 'inspiration' the same as 'style_reference' for the script
        // pipeline — they're both "make it look like this".
        styleRefs: accountMedia.filter(
          (m) => m.role === 'style_reference' || m.role === 'inspiration',
        ),
      }),
    );
    void appendPersonalGenerationLog(
      postId,
      `Legacy pipeline: sourced ${mediaAssets.length} media asset(s).`,
    ).catch(() => {});
    if (theme.requiresGroundedImages && mediaAssets.some((m) => m.source === 'ai')) {
      // Grounded themes (News, History) cannot fall back to AI imagery.
      const withoutAi = mediaAssets.filter((m) => m.source !== 'ai');
      if (withoutAi.length < script.beats.length - 1) {
        await markFailed(
          postId,
          `Grounded theme "${theme.name}" requires real imagery but scraper returned too few results.`,
        );
        return {
          postId,
          videoUrl: null,
          status: 'failed',
          durationSeconds: 0,
          costCents: totalCostCents,
          skipped: true,
          reason: 'insufficient grounded imagery',
        };
      }
    }
    totalCostCents += mediaAssets.filter((m) => m.source === 'ai').length * 8;

    await db
      .update(personalPosts)
      .set({
        mediaAssets,
        status: (genConfig.useVoiceover ?? theme.useVoiceover)
          ? 'sourcing_media'
          : 'rendering',
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));

    /* ── 3. Voiceover ────────────────────────────────────────── */
    let voiceoverUrl: string | null = null;
    let estimatedDuration =
      script.beats.reduce((sum, b) => sum + b.durationSeconds, 0) || theme.targetDurationSeconds;

    const useVoiceover = genConfig.useVoiceover ?? theme.useVoiceover;
    if (useVoiceover) {
      broadcastEvent(account.id, postId, 'voicing', {});
      const rawBeatVos = script.beats.map((b) => b.voiceover ?? '');
      const beatVosForNarration =
        rawBeatVos.length === 0
          ? rawBeatVos
          : [
              stripLeadingHookFromFirstVoiceover(script.hook ?? '', rawBeatVos[0] ?? ''),
              ...rawBeatVos.slice(1),
            ];
      const narration = joinNarrationParts([script.hook, ...beatVosForNarration, script.outro]);
      const voice = await synthesizeVoice({
        text: narration,
        voiceId:
          genConfig.ttsVoiceId ??
          character?.voiceId ??
          account.voiceId ??
          'default',
        voiceAccent: genConfig.voiceAccent,
        voiceGender: genConfig.voiceGender,
        language: account.language,
        accountId: account.id,
        speed: Math.min(1.2, Math.max(0.7, genConfig.ttsSpeed ?? 1)),
        providerPreference: genConfig.ttsProvider,
      });
      voiceoverUrl = voice.audioUrl;
      estimatedDuration = Math.max(estimatedDuration, voice.durationSeconds);
      totalCostCents += voice.costCents;
    } else {
      estimatedDuration = Math.max(
        estimatedDuration,
        estimateDurationSeconds(
          [script.hook, ...script.beats.map((b) => b.onScreen), script.outro].join(' '),
        ),
      );
    }

    /* ── 4. Music ────────────────────────────────────────────── */
    let musicUrl: string | null = null;
    let musicAttribution: string | null = null;
    const wantMusicBed =
      genConfig.useMusic === false ? false : (genConfig.useMusic ?? theme.useMusic);
    // Priority when music is on: custom bed URL → theme-mood picker → none.
    if (wantMusicBed && account.customAudioUrl) {
      musicUrl = account.customAudioUrl;
      musicAttribution = account.customAudioAttribution ?? null;
    } else if (wantMusicBed) {
      const lfTarget = longformScript
        ? clampLongformTargetSeconds(genConfig.longformTargetSeconds ?? theme.targetDurationSeconds)
        : 0;
      const musicTargetSeconds = Math.ceil(Math.max(estimatedDuration, longformScript ? lfTarget : 0));
      const firstPickMin = longformScript
        ? Math.min(480, Math.max(60, musicTargetSeconds))
        : Math.max(1, musicTargetSeconds);
      const music = await resolveChainedMusicBed({
        mood: script.musicMoodOverride ?? theme.musicMood,
        seed: postId,
        accountId: account.id,
        postId,
        targetSeconds: musicTargetSeconds,
        firstPickMinDurationSeconds: firstPickMin,
      }).catch(() => null);
      if (music) {
        musicUrl = music.url;
        musicAttribution = music.attribution;
      }
    }

    let musicSource: 'custom_bed' | 'library' | 'none' = 'none';
    if (musicUrl) {
      musicSource =
        wantMusicBed && account.customAudioUrl && musicUrl === account.customAudioUrl
          ? 'custom_bed'
          : 'library';
    }

    /* ── 5. Render ───────────────────────────────────────────── */
    await db
      .update(personalPosts)
      .set({
        voiceoverUrl,
        musicUrl,
        musicAttribution,
        status: 'rendering',
        renderProgress: 12,
        renderProgressLabel: 'Rendering with Remotion…',
        renderActivityLog: [],
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));
    broadcastEvent(account.id, postId, 'rendering', {});

    const rendered = await renderPersonalVideo({
      accountId: account.id,
      postId,
      theme,
      script,
      mediaAssets,
      voiceoverUrl,
      musicUrl,
      musicBedVolume: resolveMusicBedViral(genConfig),
      musicBedVolumeSlideshow: resolveMusicBedSlideshow(genConfig),
      useSubtitles: genConfig.useSubtitles !== false,
      accentColor: account.accentColor ?? theme.accentColor,
      watermarkHandle: account.watermarkHandle ?? undefined,
      logoUrl: account.logoUrl ?? undefined,
      durationSeconds: estimatedDuration,
      aspectRatio: outputAspectRatio,
      formatKind:
        (account.formatKind as 'video' | 'slideshow' | 'static_image') ??
        theme.defaultFormat ??
        'video',
    });
    totalCostCents += 3; // rough render cost (compute)

    const finalCaption = composeCaption(script);

    /* ── 6. Schedule ─────────────────────────────────────────── */
    let contentStudioPostId: string | null = null;
    let scheduledAt: Date | null = null;
    const shouldSchedule = shouldSchedulePersonalToContentStudio(args, account);

    if (shouldSchedule) {
      const when = args.scheduledAt
        ? new Date(args.scheduledAt)
        : new Date(Date.now() + 60 * 60 * 1000); // +1h default
      try {
        const res = await schedulePost({
          platform: account.platform,
          caption: finalCaption,
          // For slideshow / static_image accounts, ContentStudio will post
          // the rendered MP4 as a short — Reels/Shorts handle it the same
          // way they would a video. If we ever want to post a true image
          // slideshow on IG, we'd pass imageUrl + media[] instead.
          videoUrl: rendered.videoUrl,
          scheduledAt: when,
          workspaceId: account.contentStudioWorkspaceId ?? undefined,
          contentStudioAccountIds: contentStudioAccountIdsOverride(account),
        });
        contentStudioPostId = res.id;
        scheduledAt = when;
      } catch (e) {
        console.warn('[personalPipeline] schedule failed:', (e as Error).message);
      }
    }

    /* ── 7. Persist final state ──────────────────────────────── */
    const scriptFinal = {
      ...(script as unknown as Record<string, unknown>),
      outputAspectRatio,
      generationInfo: buildLegacyGenerationInfo({
        genConfig,
        account,
        character: character ? { voiceId: character.voiceId ?? null } : null,
        musicAttribution,
        musicSource,
        themeTemplate: theme.template,
        totalCostCents,
      }),
    };
    await db
      .update(personalPosts)
      .set({
        videoUrl: rendered.videoUrl,
        durationSeconds: Math.round(rendered.durationSeconds),
        caption: finalCaption,
        hashtags: script.hashtags ?? theme.defaultHashtags,
        contentStudioPostId,
        scheduledAt,
        status: scheduledAt ? 'scheduled' : 'ready',
        costCents: totalCostCents,
        postKind: rendered.formatKind,
        renderProgress: null,
        renderProgressLabel: null,
        renderActivityLog: [],
        script: scriptFinal as any,
        updatedAt: new Date(),
      })
      .where(eq(personalPosts.id, postId));

    // Update account roll-ups.
    await db
      .update(personalAccounts)
      .set({
        lastGeneratedAt: new Date(),
        totalPosts: (account.totalPosts ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(personalAccounts.id, account.id));

    void maybeEmailPersonalVideoReady({
      accountId: account.id,
      postId,
      videoUrl: rendered.videoUrl,
      topic,
      captionPreview: finalCaption,
    }).catch((e) => console.warn('[personal] video delivery email:', (e as Error).message));

    broadcastEvent(account.id, postId, 'done', { videoUrl: rendered.videoUrl });

    return {
      postId,
      videoUrl: rendered.videoUrl,
      status: scheduledAt ? 'scheduled' : 'ready',
      durationSeconds: rendered.durationSeconds,
      costCents: totalCostCents,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== PERSONAL_POST_CANCELLED_MESSAGE) {
      try {
        await markFailed(postId, msg);
      } catch (dbErr) {
        console.error('[personal] markFailed could not persist:', (dbErr as Error).message);
      }
    }
    try {
      broadcastEvent(account.id, postId, 'failed', { error: msg });
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Media sourcing                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

interface SourceMediaArgs {
  theme: PersonalTheme;
  script: PersonalScript;
  accountId: string;
  styleBible: PersonalAccountStyleBible;
  genConfig: PersonalGeneratorConfig;
  characterRefs: Array<{ fileUrl: string; description?: string | null }>;
  character: Awaited<ReturnType<typeof getCharacterUnsafe>>;
  styleRefs: Array<{ fileUrl: string; description?: string | null }>;
}

async function sourceMediaForBeats(
  args: SourceMediaArgs,
): Promise<PersonalPostMediaAsset[]> {
  const { theme, script, accountId, styleBible, genConfig, characterRefs, character, styleRefs } = args;

  // For "brainrot" / gameplay themes, one single gameplay loop backs
  // the whole video — no per-beat scraping (unless the account wants stills only).
  if (theme.mediaSources.includes('gameplay') && genConfig.mediaPreference !== 'stills_only') {
    const loop = pickGameplayLoop(script.title);
    return [
      {
        url: loop.url,
        kind: 'video',
        source: 'gameplay',
        durationSeconds: loop.durationSeconds,
        attribution: loop.attribution,
        creditUrl: loop.creditUrl,
      },
    ];
  }

  const useAiVideo =
    (genConfig.useAiVideo ?? false) && genConfig.mediaPreference !== 'stills_only';
  const useAiImages = genConfig.useAiImages ?? true;
  const useScraped = genConfig.useScrapedMedia ?? true;
  const useCharacter =
    (genConfig.useCharacter ?? true) && Boolean(character);

  const imageModelId =
    genConfig.imageModelId ??
    pickDefaultModel('image', genConfig.qualityTier ?? 'balanced')?.id;
  const videoModelId =
    genConfig.videoModelId ??
    pickDefaultModel('video', genConfig.qualityTier ?? 'balanced')?.id;

  // Build a "style prefix" that gets appended to every AI generation so
  // the whole reel feels coherent.
  const stylePrefix = [theme.visualStyle, styleBible.vibe].filter(Boolean).join('. ');

  const negativePrompt = [
    ...(styleBible.donts ?? []),
    ...(character?.negativePrompt ? [character.negativePrompt] : []),
  ]
    .filter(Boolean)
    .join(', ');

  const charPromptFragment = useCharacter
    ? character?.promptFragment ?? undefined
    : undefined;

  const scrapeSources = theme.mediaSources.filter(
    (s): s is 'pexels' | 'unsplash' | 'pixabay' | 'wikipedia' | 'news' =>
      s !== 'ai' && s !== 'gameplay',
  );

  const preferVideo = genConfig.mediaPreference === 'motion_preferred';

  const out: PersonalPostMediaAsset[] = [];
  let cursor = 0;
  for (const beat of script.beats) {
    let asset: PersonalPostMediaAsset | null = null;

    const tryBeatAiVideo = async () => {
      if (!useAiVideo || !videoModelId || theme.requiresGroundedImages) return;
      try {
        const prompt = buildAiPrompt(beat.imageQuery, stylePrefix, charPromptFragment);
        const videoAspect =
          genConfig.aspectRatio === '4:5' ? '9:16' : (genConfig.aspectRatio ?? '9:16');
        const cMin = genConfig.clipMinSeconds ?? 2;
        const cMax = genConfig.clipMaxSeconds ?? 5;
        const clipLo = Math.min(cMin, cMax);
        const clipHi = Math.max(cMin, cMax);
        const video = await withRetry(
          () =>
            generateAiVideo({
              modelId: videoModelId,
              prompt,
              negativePrompt: negativePrompt || undefined,
              aspectRatio: videoAspect,
              durationSeconds: Math.min(clipHi, Math.max(clipLo, beat.durationSeconds)),
              referenceImageUrls: collectReferenceImages(
                useCharacter ? characterRefs : [],
                styleRefs,
              ),
              scopePath: `personal/${accountId}/ai-video`,
            }),
          { label: `ai_video:${accountId}:${beat.order}`, attempts: 1 },
        );
        asset = {
          url: video.url,
          kind: 'video',
          source: 'ai',
          startAtSeconds: cursor,
          durationSeconds: video.durationSeconds,
        };
      } catch (e) {
        console.warn(`[pipeline] AI video failed beat ${beat.order}:`, (e as Error).message);
      }
    };

    // Motion-preferred: try AI video before stock so beats get native motion.
    if (preferVideo && !asset) {
      await tryBeatAiVideo();
    }

    // 1. Try scraping (unless the user turned it off).
    if (useScraped && !asset) {
      try {
        const { source, items } = await searchAssets({
          query: beat.imageQuery,
          sources: scrapeSources,
          count: 3,
          preferVideo: preferVideo && genConfig.mediaPreference !== 'stills_only',
        });
        if (items.length > 0) {
          let pick = items[0]!;
          if (genConfig.mediaPreference === 'stills_only' && pick.kind === 'video') {
            const still = items.find((i) => i.kind !== 'video');
            if (still) pick = still;
          }
          const knownSource =
            source === 'pexels' ||
            source === 'unsplash' ||
            source === 'wikipedia' ||
            source === 'pixabay' ||
            source === 'news'
              ? source
              : 'upload';
          asset = {
            url: pick.downloadUrl ?? pick.url,
            kind: pick.kind === 'video' ? 'video' : 'image',
            source: knownSource,
            width: pick.width,
            height: pick.height,
            attribution: pick.attribution,
            creditUrl: pick.creditUrl,
            startAtSeconds: cursor,
            durationSeconds: beat.durationSeconds,
          };
        }
      } catch (e) {
        console.warn('[pipeline] scrape failed:', (e as Error).message);
      }
    }

    // 2. AI video after scrape (default order), or retry if motion-first failed.
    if (!asset) {
      await tryBeatAiVideo();
    }

    // 3. AI still image (fallback / image-only themes).
    if (
      !asset &&
      useAiImages &&
      imageModelId &&
      !theme.requiresGroundedImages
    ) {
      try {
        const prompt = buildAiPrompt(beat.imageQuery, stylePrefix, charPromptFragment);
        // Prefer the reference-aware model route when we have refs.
        const refs = collectReferenceImages(
          useCharacter ? characterRefs : [],
          styleRefs,
        );
        const image = await withRetry(
          () =>
            generateAiImage({
              modelId: imageModelId,
              prompt,
              negativePrompt: negativePrompt || undefined,
              aspectRatio: genConfig.aspectRatio ?? '9:16',
              referenceImageUrls: refs,
              scopePath: `personal/${accountId}/ai-image`,
            }),
          { label: `ai_image:${accountId}:${beat.order}`, attempts: 1 },
        );
        asset = {
          url: image.url,
          kind: 'image',
          source: 'ai',
          startAtSeconds: cursor,
          durationSeconds: beat.durationSeconds,
        };
      } catch (e) {
        console.warn(
          `[pipeline] AI image failed beat ${beat.order}:`,
          (e as Error).message,
        );
        // Last-resort Flux fallback through the existing service.
        try {
          if (features.fal) {
            const url = await generateImage(
              buildAiPrompt(beat.imageQuery, stylePrefix, charPromptFragment),
              genConfig.aspectRatio ?? '9:16',
            );
            asset = {
              url,
              kind: 'image',
              source: 'ai',
              startAtSeconds: cursor,
              durationSeconds: beat.durationSeconds,
            };
          }
        } catch {
          /* keep asset null */
        }
      }
    }

    if (asset) {
      out.push(asset);
      cursor += beat.durationSeconds;
    }
  }
  return out;
}

function buildAiPrompt(
  beatQuery: string,
  stylePrefix: string,
  charFragment?: string,
): string {
  const parts = [beatQuery, charFragment, stylePrefix];
  return parts.filter(Boolean).join('. ');
}

function collectReferenceImages(
  characterRefs: Array<{ fileUrl: string }>,
  styleRefs: Array<{ fileUrl: string }>,
): string[] {
  const refs: string[] = [];
  // Prefer character reference first — it's the identity anchor.
  for (const r of characterRefs.slice(0, 3)) refs.push(r.fileUrl);
  for (const r of styleRefs.slice(0, 3)) refs.push(r.fileUrl);
  return refs;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Helpers                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

function composeCaption(script: PersonalScript): string {
  const tags = (script.hashtags ?? [])
    .slice(0, 8)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .join(' ');
  return [script.caption?.trim(), tags].filter(Boolean).join('\n\n');
}

async function markStatus(
  postId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(personalPosts)
    .set({ status: status as any, updatedAt: new Date(), ...(extra as any) })
    .where(eq(personalPosts.id, postId));
}

async function markFailed(postId: string, message: string) {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(personalPosts)
    .set({ status: 'failed', errorMessage: message.slice(0, 500), renderProgress: null, renderProgressLabel: null, renderActivityLog: [], updatedAt: new Date() })
    .where(eq(personalPosts.id, postId));
}

function broadcastEvent(
  accountId: string,
  postId: string,
  phase: string,
  payload: Record<string, unknown>,
) {
  broadcast({
    type: 'personal:progress',
    payload: { accountId, postId, phase, ...payload },
  });
}
