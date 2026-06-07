/**
 * Shared long-form target duration clamp (1–8 minutes).
 * Must match {@link LongformPanel} / Style & config expectations.
 */
export function clampLongformTargetSeconds(seconds: number | undefined): number {
  const n = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 240;
  return Math.max(60, Math.min(480, Math.round(n)));
}
