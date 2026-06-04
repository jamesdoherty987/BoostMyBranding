/**
 * Resolve the ffmpeg executable for local stitching / probes.
 * Uses FFMPEG_PATH when set, otherwise tries `ffmpeg` on PATH (works on
 * Windows + Unix). Avoids `which` — not available on stock Windows.
 */

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

export async function resolveFfmpegBin(): Promise<string | null> {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }
  return probeOnPath('ffmpeg');
}

function probeOnPath(binary: string): Promise<string | null> {
  return new Promise((resolve) => {
    const p = spawn(binary, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    p.on('error', () => resolve(null));
    p.on('close', (code) => {
      resolve(code === 0 ? binary : null);
    });
  });
}
