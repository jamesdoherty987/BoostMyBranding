/**
 * Poster frame from the final stitched MP4 — dashboard cards + YouTube upload art.
 * Pure frame grab (no title/description overlay).
 */

import { randomUUID } from 'node:crypto';
import { extractVideoFrameJpeg } from '../lib/extractVideoFrame.js';
import { resolveFfmpegBin } from '../lib/ffmpegBin.js';
import { uploadFile } from './r2.js';

export async function extractPersonalVideoPosterToR2(params: {
  accountId: string;
  postId: string;
  videoUrl: string;
  /** When known, sample early in the timeline (not the last frames / CTA). */
  videoDurationSeconds?: number;
}): Promise<string | null> {
  try {
    const ffmpegBin = await resolveFfmpegBin();
    if (!ffmpegBin) return null;
    const dur =
      typeof params.videoDurationSeconds === 'number' &&
      Number.isFinite(params.videoDurationSeconds) &&
      params.videoDurationSeconds > 0.4
        ? params.videoDurationSeconds
        : 45;
    const atSeconds = Math.min(2.6, Math.max(0.35, dur * 0.07));
    const jpeg = await extractVideoFrameJpeg({
      ffmpegBin,
      videoInput: params.videoUrl,
      atSeconds,
    });
    const suffix = randomUUID().slice(0, 8);
    const { url } = await uploadFile(
      `personal/${params.accountId}/thumbnails`,
      jpeg,
      `${params.postId}-poster-${suffix}.jpg`,
      'image/jpeg',
    );
    return url;
  } catch (e) {
    console.warn('[personal] poster frame extract failed:', (e as Error).message);
    return null;
  }
}
