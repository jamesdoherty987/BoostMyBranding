/**
 * Quality gate — second pass over Claude-drafted posts before they
 * land in the review queue.
 *
 * For each draft we ask Claude (with a smaller cheaper prompt) to
 * audit it against brand voice + anti-slop rules and either accept,
 * rewrite (once), or reject. The result is a structured record so the
 * review UI can show "rewritten 2x — removed AI tells, strengthened
 * hook" alongside the final copy.
 *
 * Running this adds ~1.5s per post at ~$0.02 extra but raises the
 * floor on output quality significantly. Mock mode returns the draft
 * unchanged.
 */

import { generateJSON } from './claude.js';
import { qualityGatePrompt } from './prompts.js';
import { features } from '../env.js';

export interface GateInput {
  businessName: string;
  industry: string;
  brandVoice: string;
  knownFacts: string;
  imageSubject?: string;
  platform: string;
  draftCaption: string;
  draftHashtags: string[];
}

export interface GateScores {
  factualIntegrity: number;
  brandVoiceFit: number;
  hookStrength: number;
  imageAlignment: number;
  aiTellFreedom: number;
  platformFit: number;
  specificity: number;
}

export interface GateOutput {
  caption: string;
  hashtags: string[];
  scores: GateScores;
  overall: number;
  issues: string[];
  verdict: 'accept' | 'rewrite' | 'reject';
  attempts: number;
  rewritten: boolean;
}

/**
 * Run the gate. Auto-rewrites up to `maxRewrites` times — default 1
 * (so max two inference calls per post). Returns the final caption
 * and hashtags ready to persist, plus the audit trail.
 */
export async function runQualityGate(
  input: GateInput,
  opts: { maxRewrites?: number } = {},
): Promise<GateOutput> {
  const maxRewrites = opts.maxRewrites ?? 1;

  if (!features.claude) {
    return {
      caption: input.draftCaption,
      hashtags: input.draftHashtags,
      scores: {
        factualIntegrity: 5,
        brandVoiceFit: 5,
        hookStrength: 5,
        imageAlignment: 5,
        aiTellFreedom: 5,
        platformFit: 5,
        specificity: 5,
      },
      overall: 5,
      issues: [],
      verdict: 'accept',
      attempts: 0,
      rewritten: false,
    };
  }

  let currentCaption = input.draftCaption;
  let currentHashtags = input.draftHashtags;
  let attempts = 0;
  let rewritten = false;
  let lastResult: {
    scores: GateScores;
    overall: number;
    issues: string[];
    verdict: 'accept' | 'rewrite' | 'reject';
  } | null = null;

  for (let i = 0; i <= maxRewrites; i++) {
    attempts++;
    const prompt = qualityGatePrompt({
      businessName: input.businessName,
      industry: input.industry,
      brandVoice: input.brandVoice,
      knownFacts: input.knownFacts,
      imageSubject: input.imageSubject,
      platform: input.platform,
      draftCaption: currentCaption,
      draftHashtags: currentHashtags,
    });

    let result: {
      scores: GateScores;
      overall: number;
      issues: string[];
      verdict: 'accept' | 'rewrite' | 'reject';
      rewrittenCaption?: string;
      rewrittenHashtags?: string[];
    };

    try {
      result = await generateJSON<typeof result>(prompt, {
        model: 'sonnet',
        maxTokens: 900,
        temperature: 0.3,
      });
    } catch (e) {
      // If the gate itself falls over, ship the draft rather than block.
      // Better to surface a so-so post than lose the whole run.
      console.warn('[qualityGate] audit failed, accepting draft:', (e as Error).message);
      return {
        caption: currentCaption,
        hashtags: currentHashtags,
        scores: {
          factualIntegrity: 3,
          brandVoiceFit: 3,
          hookStrength: 3,
          imageAlignment: 3,
          aiTellFreedom: 3,
          platformFit: 3,
          specificity: 3,
        },
        overall: 3,
        issues: ['Quality gate could not run — draft shipped unreviewed'],
        verdict: 'accept',
        attempts,
        rewritten,
      };
    }

    lastResult = {
      scores: result.scores,
      overall: result.overall,
      issues: result.issues,
      verdict: result.verdict,
    };

    if (result.verdict === 'accept' || result.verdict === 'reject') {
      return {
        caption: currentCaption,
        hashtags: currentHashtags,
        ...lastResult,
        attempts,
        rewritten,
      };
    }

    // verdict === 'rewrite' — adopt the rewrite, loop for re-audit.
    if (result.rewrittenCaption) {
      currentCaption = result.rewrittenCaption;
      currentHashtags = result.rewrittenHashtags ?? currentHashtags;
      rewritten = true;
    } else {
      // The gate wants a rewrite but didn't provide one — treat as accept.
      return {
        caption: currentCaption,
        hashtags: currentHashtags,
        ...lastResult,
        attempts,
        rewritten,
      };
    }
  }

  // Exhausted rewrite budget — return the last draft with its audit.
  return {
    caption: currentCaption,
    hashtags: currentHashtags,
    scores: lastResult?.scores ?? {
      factualIntegrity: 3,
      brandVoiceFit: 3,
      hookStrength: 3,
      imageAlignment: 3,
      aiTellFreedom: 3,
      platformFit: 3,
      specificity: 3,
    },
    overall: lastResult?.overall ?? 3,
    issues: lastResult?.issues ?? [],
    verdict: 'accept',
    attempts,
    rewritten,
  };
}
