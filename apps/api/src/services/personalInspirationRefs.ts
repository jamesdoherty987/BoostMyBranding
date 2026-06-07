/**
 * Resolve inspiration / style_reference media to image URLs for img2img
 * (same logic as the director pipeline — shared so thumbnails match shots).
 */

import { personalAccountMedia } from '@boost/database';
import { extractVideoFrameJpeg } from '../lib/extractVideoFrame.js';
import { resolveFfmpegBin } from '../lib/ffmpegBin.js';
import { uploadFile } from './r2.js';

const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|m4v|avi)(\?|#|$)/i;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|avif|bmp|heic)(\?|#|$)/i;

function isVideoUrlByExtension(url: string): boolean {
  return VIDEO_EXT_RE.test(url);
}

function isImageUrlByExtension(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

function classifyInspirationMedia(
  mimeType: string | null | undefined,
  url: string,
): 'image' | 'video' | 'unknown' {
  const m = (mimeType ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (isImageUrlByExtension(url)) return 'image';
  if (isVideoUrlByExtension(url)) return 'video';
  return 'unknown';
}

/**
 * Inspiration / style_reference rows → image URLs usable by image models
 * (one representative frame per video clip, uploaded to object storage).
 */
export async function resolvePersonalInspirationImageUrls(
  accountId: string,
  inspirationRows: (typeof personalAccountMedia.$inferSelect)[],
): Promise<string[]> {
  const rows = inspirationRows.slice(0, 8);
  const ffmpegBin = await resolveFfmpegBin();
  const out: string[] = [];
  let videoExtractions = 0;
  const maxVideoFrames = 4;
  let loggedMissingFfmpeg = false;

  for (const m of rows) {
    const url = m.fileUrl?.trim();
    if (!url) continue;

    const kind = classifyInspirationMedia(m.mimeType, url);

    if (kind === 'image') {
      out.push(url);
      continue;
    }

    if (kind === 'video') {
      if (!ffmpegBin) {
        if (!loggedMissingFfmpeg) {
          console.warn('[director] ffmpeg unavailable — inspiration videos skipped for pixel refs');
          loggedMissingFfmpeg = true;
        }
        continue;
      }
      if (videoExtractions >= maxVideoFrames) continue;
      try {
        const jpeg = await extractVideoFrameJpeg({
          ffmpegBin,
          videoInput: url,
          atSeconds: 1,
        });
        const { url: uploaded } = await uploadFile(
          `personal/${accountId}/inspiration-frames`,
          jpeg,
          `${m.id}-insp-ref.jpg`,
          'image/jpeg',
        );
        out.push(uploaded);
        videoExtractions++;
      } catch (e) {
        console.warn('[director] inspiration video frame extract failed', m.id, (e as Error).message);
      }
      continue;
    }

    out.push(url);
  }

  return [...new Set(out)].slice(0, 8);
}
