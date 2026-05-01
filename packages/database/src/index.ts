/**
 * Drizzle client factory. We keep a single postgres connection across the API
 * process. In dev mode without DATABASE_URL, we export a mock db that throws
 * on use so callers know to either provide credentials or use the mock layer
 * from @boost/core.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export { schema };

type DB = PostgresJsDatabase<typeof schema>;

let _db: DB | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export function getDb(): DB {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. For local development you can run Postgres with Docker or use the mock data layer in @boost/core.',
    );
  }
  _client = postgres(url, { max: 10, prepare: false });
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
