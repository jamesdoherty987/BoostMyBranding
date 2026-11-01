/**
 * Tunables to reduce Postgres (Neon) churn: cron cadence, heartbeats, pool size.
 * Override via env — see repo-root `.env.example`.
 */

function readIntEnv(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[key]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Cron expression: every N minutes (1–59). */
export function cronEveryNMinutes(minutes: number): string {
  const n = Math.min(59, Math.max(1, Math.floor(minutes)));
  if (n === 1) return '* * * * *';
  return `*/${n} * * * *`;
}

export function cronPublishIntervalMinutes(): number {
  return readIntEnv('CRON_PUBLISH_INTERVAL_MINUTES', 5, 1, 30);
}

export function cronPersonalScheduleReadyIntervalMinutes(): number {
  return readIntEnv('CRON_PERSONAL_SCHEDULE_READY_INTERVAL_MINUTES', 5, 1, 30);
}

export function cronAnalyzeImagesIntervalMinutes(): number {
  return readIntEnv('CRON_ANALYZE_IMAGES_INTERVAL_MINUTES', 5, 2, 30);
}

export function cronPersonalAutopilotIntervalMinutes(): number {
  return readIntEnv('CRON_PERSONAL_AUTOPILOT_INTERVAL_MINUTES', 5, 2, 30);
}

export function cronPersonalStaleIntervalMinutes(): number {
  return readIntEnv('CRON_PERSONAL_STALE_INTERVAL_MINUTES', 10, 5, 60);
}

/** DB `updated_at` touch while a personal post generates (default 2m). */
export function personalInFlightHeartbeatMs(): number {
  return readIntEnv('PERSONAL_IN_FLIGHT_HEARTBEAT_MS', 120_000, 30_000, 300_000);
}

/** Poll ticks in {@link withAbortWhenPersonalPostFailed} between heartbeats (× 1.5s). Default 80 ≈ 2m. */
export function personalAbortHeartbeatTicks(): number {
  return readIntEnv('PERSONAL_ABORT_HEARTBEAT_TICKS', 80, 20, 200);
}
