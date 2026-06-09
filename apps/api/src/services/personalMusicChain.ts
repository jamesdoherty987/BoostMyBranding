/**
 * Build a background-music bed long enough for the video by chaining
 * distinct library tracks when a single pick would end early (common on
 * long-form / director stitch and on Remotion renders where `<Audio>` does
 * not loop across the full composition).
 */

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pickMusic, type PickedMusic } from './personalMusic.js';
import { resolveFfmpegBin } from '../lib/ffmpegBin.js';
import { uploadFile } from './r2.js';

const TARGET_BUFFER_SEC = 2;
const MAX_TRACKS_DEFAULT = 8;
const FFMPEG_TIMEOUT_MS = 180_000;

async function probeDurationSeconds(ffmpegBin: string, file: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const p = spawn(ffmpegBin, ['-hide_banner', '-i', file], { windowsHide: true });
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        p.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(new Error(`probe duration timeout for ${path.basename(file)}`));
    }, 30_000);
    p.stderr.on('data', (b) => (stderr += b.toString()));
    p.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      if (!m) return reject(new Error('Could not probe duration'));
      const h = Number(m[1]);
      const mm = Number(m[2]);
      const s = Number(m[3]);
      const sec = h * 3600 + mm * 60 + s;
      if (!Number.isFinite(sec) || sec <= 0) {
        return reject(new Error(`Invalid probed duration (${sec})`));
      }
      resolve(sec);
    });
    p.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function downloadToFile(url: string, destPath: string, timeoutMs = 120_000): Promise<void> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error('Empty download body');
    writeFileSync(destPath, buffer);
  } finally {
    clearTimeout(timer);
  }
}

function runFfmpegConcat(bin: string, inputPaths: string[], outputMp3: string): Promise<void> {
  const args: string[] = [];
  for (const p of inputPaths) {
    args.push('-i', p);
  }
  const n = inputPaths.length;
  const resampled = inputPaths.map((_, i) => `[a${i}]`).join('');
  const filterParts: string[] = [];
  for (let i = 0; i < n; i++) {
    filterParts.push(`[${i}:a]aresample=48000[a${i}]`);
  }
  filterParts.push(`${resampled}concat=n=${n}:v=0:a=1[aout]`);
  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '192k', '-y', outputMp3);

  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true });
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        p.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(new Error(`music-chain concat timeout (${FFMPEG_TIMEOUT_MS}ms)`));
    }, FFMPEG_TIMEOUT_MS);
    p.stderr.on('data', (b) => (stderr += b.toString()));
    p.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`music-chain ffmpeg exit ${code}: ${stderr.slice(-800)}`));
    });
    p.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
  });
}

export interface ResolveChainedMusicBedArgs {
  mood: string;
  seed: string;
  accountId: string;
  postId: string;
  /** Video / VO timeline we must cover (seconds). */
  targetSeconds: number;
  /** Optional: prefer the first pick to be at least this long (Pixabay / metadata). */
  firstPickMinDurationSeconds?: number;
  maxTracks?: number;
}

/**
 * Returns a single `musicUrl` long enough for `targetSeconds` by concatenating
 * multiple distinct `pickMusic` results when needed. Falls back to one short
 * track if no more alternates exist (downstream FFmpeg may still loop that file).
 */
export async function resolveChainedMusicBed(
  args: ResolveChainedMusicBedArgs,
): Promise<PickedMusic | null> {
  const rawTarget =
    typeof args.targetSeconds === 'number' && Number.isFinite(args.targetSeconds)
      ? args.targetSeconds
      : 0;
  const need = Math.max(8, Math.ceil(rawTarget) + TARGET_BUFFER_SEC);
  const maxTracks = Math.min(12, Math.max(1, args.maxTracks ?? MAX_TRACKS_DEFAULT));
  const usedUrls = new Set<string>();
  const picks: PickedMusic[] = [];
  const localFiles: string[] = [];
  let accumulated = 0;

  const ffmpegBin = await resolveFfmpegBin();

  const cleanupLocals = () => {
    for (const f of localFiles) {
      try {
        unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  };

  try {
    for (let i = 0; i < maxTracks && accumulated < need; i++) {
      const pick = await pickMusic({
        mood: args.mood,
        seed: `${args.seed}:bedchain${i}`,
        accountId: args.accountId,
        minDurationSeconds: i === 0 ? args.firstPickMinDurationSeconds : undefined,
        excludeUrls: [...usedUrls],
      });
      if (!pick) break;
      const u = pick.url.trim();
      if (usedUrls.has(u)) break;

      const metaDur =
        typeof pick.durationSeconds === 'number' && Number.isFinite(pick.durationSeconds) && pick.durationSeconds > 1
          ? pick.durationSeconds
          : null;

      if (!ffmpegBin) {
        console.warn('[music-chain] ffmpeg not available — using first pick without chaining');
        return pick;
      }

      const ext = (() => {
        try {
          const pathname = new URL(pick.url, 'https://placeholder.local').pathname;
          const e = path.extname(pathname).toLowerCase();
          if (/^\.(mp3|m4a|aac|wav|flac|ogg)$/.test(e)) return e;
        } catch {
          /* ignore */
        }
        return '.mp3';
      })();

      const segPath = path.join(tmpdir(), `personal-bed-${randomUUID()}${ext}`);
      try {
        await downloadToFile(pick.url, segPath);
      } catch (e) {
        console.warn('[music-chain] segment download failed:', (e as Error).message);
        usedUrls.add(u);
        continue;
      }

      usedUrls.add(u);
      picks.push(pick);
      localFiles.push(segPath);

      let probed: number;
      try {
        probed = await probeDurationSeconds(ffmpegBin, segPath);
      } catch (e) {
        console.warn('[music-chain] probe failed, using metadata:', (e as Error).message);
        probed = metaDur ?? 120;
      }

      accumulated += probed;

      if (accumulated >= need) {
        break;
      }
    }

    if (picks.length === 0) return null;

    if (localFiles.length === 1) {
      const one = picks[0]!;
      return {
        url: one.url,
        attribution: one.attribution,
        creditUrl: one.creditUrl,
        durationSeconds: Math.round(accumulated * 10) / 10,
        source: one.source,
      };
    }

    const outPath = path.join(tmpdir(), `personal-bed-chain-${randomUUID()}.mp3`);
    localFiles.push(outPath);
    if (!ffmpegBin) {
      console.warn('[music-chain] ffmpeg missing at concat — using first track');
      return picks[0]!;
    }
    try {
      await runFfmpegConcat(ffmpegBin, localFiles.slice(0, -1), outPath);
    } catch (e) {
      console.warn('[music-chain] concat failed, using first track:', (e as Error).message);
      return picks[0]!;
    }

    const buf = readFileSync(outPath);
    const { url } = await uploadFile(
      `personal/${args.accountId}/music-beds`,
      buf,
      `${args.postId}-bed.mp3`,
      'audio/mpeg',
    );

    const attribution = [...new Set(picks.map((p) => p.attribution).filter(Boolean))].join(' · ');
    const creditUrl = picks.find((p) => p.creditUrl)?.creditUrl;

    return {
      url,
      attribution: attribution || 'Royalty-free music',
      creditUrl,
      durationSeconds: Math.round(accumulated * 10) / 10,
      source: picks[0]!.source,
    };
  } finally {
    cleanupLocals();
  }
}
