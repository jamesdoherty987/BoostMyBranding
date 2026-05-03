/**
 * Run drizzle-kit generated SQL migrations against DATABASE_URL.
 * Loads the monorepo's root .env so running this from anywhere Just Works.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadRepoRootEnv } from './load-env.js';

loadRepoRootEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set. Did you configure the repo-root .env?');
    process.exit(1);
  }
  console.log('🚚 Running migrations against', maskUrl(url));
  const client = postgres(url, { max: 1, onnotice: () => {}, prepare: false });
  const db = drizzle(client);
  const here = path.dirname(fileURLToPath(import.meta.url));
  await migrate(db, { migrationsFolder: path.resolve(here, '..', 'drizzle') });
  await client.end();
  console.log('✅ Migrations applied');
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    const auth = u.username ? `${u.username}@` : '';
    return `${u.protocol}//${auth}${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return '[redacted]';
  }
}

main().catch((e) => {
  console.error('❌ Migration failed', e);
  process.exit(1);
});
