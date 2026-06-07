/**
 * Opt-in verbose logs for personal stitch / VO / mux timing.
 *
 * Any of these (case-insensitive: `1`, `true`, `yes`, `on`):
 * - `PERSONAL_DEBUG_VISUAL_PACING` — voice partition + per-shot FFmpeg + probes
 * - `PERSONAL_DEBUG_MIX_AUDIO` — concat probe vs canonical, apad, post-mux verify
 * - `PERSONAL_DEBUG_STITCH_TIMELINE` — same as enabling both pacing + mix detail
 */

function envTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function visualPacingDebugEnabled(): boolean {
  return envTruthy('PERSONAL_DEBUG_VISUAL_PACING');
}

export function mixAudioDebugEnabled(): boolean {
  return envTruthy('PERSONAL_DEBUG_MIX_AUDIO');
}

export function stitchTimelineDebugEnabled(): boolean {
  return (
    visualPacingDebugEnabled() ||
    mixAudioDebugEnabled() ||
    envTruthy('PERSONAL_DEBUG_STITCH_TIMELINE')
  );
}

export function logVisualPacing(
  scope: string,
  message: string,
  data?: Record<string, unknown> | unknown[],
): void {
  if (!visualPacingDebugEnabled()) return;
  logStitchTimelineRaw(`visual-pacing:${scope}`, message, data);
}

/** Verbose stitch / mux / concat (see {@link stitchTimelineDebugEnabled}). */
export function logStitchTimeline(
  scope: string,
  message: string,
  data?: Record<string, unknown> | unknown[],
): void {
  if (!stitchTimelineDebugEnabled()) return;
  logStitchTimelineRaw(scope, message, data);
}

function logStitchTimelineRaw(
  scope: string,
  message: string,
  data?: Record<string, unknown> | unknown[],
): void {
  if (data === undefined) {
    console.log(`[${scope}] ${message}`);
    return;
  }
  try {
    console.log(`[${scope}] ${message}`, JSON.stringify(data));
  } catch {
    console.log(`[${scope}] ${message}`, data);
  }
}
