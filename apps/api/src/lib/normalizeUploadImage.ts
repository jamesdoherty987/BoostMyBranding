/**
 * Normalize uploaded images for pipelines that only accept common raster
 * types (e.g. AVIF → PNG).
 *
 * Primary path: sharp. Fallback: ffmpeg (many Windows builds ship ffmpeg
 * with libavif while the sharp/libvips binary may lack AVIF decode).
 */

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { resolveFfmpegBin } from './ffmpegBin.js';

const AVIF = 'image/avif';

export function isAvifMime(mimeType: string): boolean {
  const base = mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
  return base === AVIF;
}

export interface UploadImageFields {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

async function avifToPngSharp(buffer: Buffer): Promise<Buffer> {
  let last: unknown;
  const attempts: Array<() => Promise<Buffer>> = [
    // Multi-frame / animated HEIF/AVIF: first page only.
    () => sharp(buffer, { failOn: 'none', pages: 1 }).png().toBuffer(),
    () =>
      sharp(buffer, { failOn: 'none', animated: true, pages: 1 }).png().toBuffer(),
    () => sharp(buffer, { failOn: 'none' }).png().toBuffer(),
  ];
  for (const run of attempts) {
    try {
      return await run();
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function avifToPngFfmpeg(buffer: Buffer): Promise<Buffer> {
  const bin = await resolveFfmpegBin();
  if (!bin) throw new Error('ffmpeg not found on PATH');

  const id = randomUUID();
  const inPath = join(tmpdir(), `bmb-avif-${id}.avif`);
  const outPath = join(tmpdir(), `bmb-avif-${id}.png`);
  try {
    writeFileSync(inPath, buffer);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        bin,
        ['-hide_banner', '-y', '-i', inPath, '-frames:v', '1', '-c:v', 'png', outPath],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
      );
      let stderr = '';
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim().slice(-800) || `ffmpeg exit ${code}`));
      });
    });
    return readFileSync(outPath);
  } finally {
    try {
      unlinkSync(inPath);
    } catch {
      /* */
    }
    try {
      unlinkSync(outPath);
    } catch {
      /* */
    }
  }
}

/**
 * If the upload is AVIF, decodes and re-encodes as PNG. Otherwise returns
 * the input unchanged.
 */
export async function normalizeUploadImageIfAvif(
  input: UploadImageFields,
): Promise<UploadImageFields> {
  if (!isAvifMime(input.mimeType)) {
    return input;
  }

  const safeBase =
    input.fileName.replace(/[/\\]/g, '_').replace(/\.[^.]+$/, '') || 'image';
  const outName = `${safeBase}.png`;

  let pngBuffer: Buffer;
  try {
    pngBuffer = await avifToPngSharp(input.buffer);
  } catch (sharpErr) {
    try {
      pngBuffer = await avifToPngFfmpeg(input.buffer);
    } catch (ffmpegErr) {
      console.warn('[avif→png] sharp:', (sharpErr as Error).message);
      console.warn('[avif→png] ffmpeg:', (ffmpegErr as Error).message);
      throw sharpErr;
    }
  }

  return {
    buffer: pngBuffer,
    mimeType: 'image/png',
    fileName: outName,
  };
}
