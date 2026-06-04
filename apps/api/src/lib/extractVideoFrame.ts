/**
 * Extract a single JPEG frame from a video file (FFmpeg).
 * Used for YouTube thumbnails after director stitch.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const FRAME_TIMEOUT_MS = 120_000;

export async function extractVideoFrameJpeg(args: {
  ffmpegBin: string;
  /** Local path or http(s) URL readable by FFmpeg. */
  videoInput: string;
  /** Seek offset in seconds before decode (default 2). */
  atSeconds?: number;
}): Promise<Buffer> {
  const out = path.join(tmpdir(), `frame-${randomUUID()}.jpg`);
  const at = args.atSeconds ?? 2;
  await new Promise<void>((resolve, reject) => {
    const p = spawn(args.ffmpegBin, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(Math.max(0, at)),
      '-i',
      args.videoInput,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      out,
    ]);
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        p.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(new Error(`extract frame timeout after ${FRAME_TIMEOUT_MS}ms`));
    }, FRAME_TIMEOUT_MS);
    p.stderr.on('data', (b) => {
      stderr += b.toString();
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && existsSync(out)) resolve();
      else reject(new Error(`ffmpeg extract frame exit ${code}: ${stderr.slice(0, 400)}`));
    });
  });
  try {
    return readFileSync(out);
  } finally {
    try {
      if (existsSync(out)) unlinkSync(out);
    } catch {
      /* ignore */
    }
  }
}
