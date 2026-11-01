/**
 * Drizzle client factory. We keep a single postgres connection across the API
 * process. In dev mode without DATABASE_URL, we export a mock db that throws
 * on use so callers know to either provide credentials or use the mock layer
 * from @boost/core.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export * from './schema.js';
export { schema };
export { loadRepoRootEnv } from './load-env.js';

type DB = PostgresJsDatabase<typeof schema>;

let _db: DB | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function dbPoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 20) return n;
  }
  return 3;
}

/** Close idle pool connections after N seconds (helps Neon suspend between bursts). */
function dbIdleTimeoutSeconds(): number {
  const raw = process.env.DATABASE_IDLE_TIMEOUT_SEC?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n >= 0 && n <= 600) return n;
  }
  return 120;
}

export function getDb(): DB {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. For local development you can run Postgres with Docker or use the mock data layer in @boost/core.',
    );
  }
  _client = postgres(url, {
    max: dbPoolMax(),
    prepare: false,
    idle_timeout: dbIdleTimeoutSeconds(),
  });
  _db = drizzle(_client, { schema });
  return _db;
}

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function closeDb() {
  if (_client) {
    await _client.end({ timeout: 5 });
    _client = null;
    _db = null;
  }
}
