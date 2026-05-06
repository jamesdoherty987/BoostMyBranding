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
import {
  planStoryboard,
  shotToPrompt,
  flattenStoryboard,
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
} from './personalAiModels.js';
import { stitchShots, type StitchShotInput } from './personalStitcher.js';
import type { GenerateForAccountArgs, GenerateForAccountResult } from './personalPipeline.js';

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

  const theme = getTheme(account.themeId);
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

    /* ── 3. Plan storyboard ──────────────────────────────── */
    broadcast({ type: 'personal:progress', payload: { accountId: account.id, postId, phase: 'directing' } });
    const storyboard = await planStoryboard({
      theme,
      topic,
      targetDurationSeconds: theme.targetDurationSeconds,
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
      allowMultiAct: true,
      maxAiVideoShots: maxAiShotsFor(genConfig),
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

    const styleRefUrls = accountMedia
      .filter((m) => m.role === 'style_reference')
      .slice(0, 3)
      .map((m) => m.fileUrl);

    const defaultImageModel =
      genConfig.imageModelId ??
      pickDefaultModel('image', genConfig.qualityTier ?? 'balanced')?.id;
    const defaultVideoModel =
      genConfig.videoModelId ??
      pickDefaultModel('video', genConfig.qualityTier ?? 'balanced')?.id;

    const flat = flattenStoryboard(storyboard);
    const shotAssets: Array<{
      fs: ReturnType<typeof flattenStoryboard>[number];
      asset: { url: string; kind: 'image' | 'video' } | null;
      costCents: number;
    }> = [];

    for (const fs of flat) {
      const prompt = shotToPrompt({
        shot: fs.shot,
        themeVisualStyle: theme.visualStyle,
        styleBibleVibe: styleBible.vibe ?? undefined,
        characterFragment: character?.promptFragment ?? undefined,
        globalColourGrade: storyboard.editPlan.colourGrade,
      });
      const negativePrompt = [
        ...(styleBible.donts ?? []),
        ...(character?.negativePrompt ? [character.negativePrompt] : []),
      ]
        .filter(Boolean)
        .join(', ');

      const refs = [...characterAnchors.slice(0, 2), ...styleRefUrls.slice(0, 1)];

      let asset: { url: string; kind: 'image' | 'video' } | null = null;
      let shotCost = 0;

      try {
        if (fs.shot.kind === 'ai_video' && defaultVideoModel && features.fal) {
          const video = await withRetry(
            () =>
              generateAiVideo({
                modelId: defaultVideoModel,
                prompt,
                negativePrompt: negativePrompt || undefined,
                aspectRatio: videoAspectFrom(genConfig.aspectRatio ?? '9:16'),
                durationSeconds: Math.min(
                  genConfig.clipMaxSeconds ?? 5,
                  Math.max(genConfig.clipMinSeconds ?? 2, fs.shot.durationSeconds),
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
                aspectRatio: genConfig.aspectRatio ?? '9:16',
                referenceImageUrls: refs,
                scopePath: `personal/${account.id}/ai-image`,
              }),
            { label: `director_image:${account.id}:${fs.shot.id}`, attempts: 1 },
          );
          asset = { url: image.url, kind: 'image' };
          shotCost = image.costCents;
        }
      } catch (e) {
        console.warn(`[director] shot ${fs.shot.id} failed:`, (e as Error).message);
      }

      shotAssets.push({ fs, asset, costCents: shotCost });
      totalCostCents += shotCost;
    }

    // Drop shots with no asset.
    const resolved = shotAssets.filter((s) => s.asset !== null) as Array<{
      fs: ReturnType<typeof flattenStoryboard>[number];
      asset: { url: string; kind: 'image' | 'video' };
      costCents: number;
    }>;
    if (resolved.length < 3) {
      await markFailed(
        postId,
        `Only ${resolved.length} shots resolved — need at least 3 for a watchable short.`,
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
        const music = await pickMusic({
          mood: theme.musicMood,
          seed: postId,
          minDurationSeconds: Math.ceil(estimatedDuration),
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

    const stitched = await stitchShots({
      accountId: account.id,
      postId,
      shots: stitchInputs,
      audio: {
        voiceoverUrl: voiceoverUrl ?? undefined,
        musicUrl: musicUrl ?? undefined,
      },
      aspectRatio: genConfig.aspectRatio ?? '9:16',
      colourGrade: mapGrade(storyboard.editPlan.colourGrade),
      useGrain: storyboard.editPlan.useGrain,
      letterbox: storyboard.editPlan.letterbox,
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

function maxAiShotsFor(cfg: PersonalGeneratorConfig): number {
  const tier = cfg.qualityTier ?? 'balanced';
  if (cfg.useAiVideo === false) return 0;
  if (tier === 'max') return 5;
  if (tier === 'balanced') return 3;
  return 1;
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
