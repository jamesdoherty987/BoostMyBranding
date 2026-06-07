/**
 * Prints `PERSONAL_TITLE_TEST_USER_ID` + `PERSONAL_TITLE_TEST_ACCOUNT_ID` for each
 * personal channel (owner user id + account row id).
 *
 *   pnpm --filter api print:personal-title-test-env
 *
 * Repo-root `.env` is loaded via `tsx --import ./scripts/load-root-env.ts` when
 * wired from package.json like the isolated title test.
 */

import { asc } from 'drizzle-orm';
import { getDb, isDbConfigured, loadRepoRootEnv, personalAccounts } from '@boost/database';

loadRepoRootEnv();

async function main() {
  if (!isDbConfigured()) {
    console.error('DATABASE_URL is not set in repo-root `.env`.');
    process.exit(1);
  }

  const db = getDb();
  const rows = await db
    .select({
      id: personalAccounts.id,
      userId: personalAccounts.userId,
      accountName: personalAccounts.accountName,
      platform: personalAccounts.platform,
      themeId: personalAccounts.themeId,
      createdAt: personalAccounts.createdAt,
    })
    .from(personalAccounts)
    .orderBy(asc(personalAccounts.createdAt));

  if (rows.length === 0) {
    console.log('No rows in `personal_accounts`. Create a channel in the dashboard first.');
    return;
  }

  console.log(`personal_accounts: ${rows.length} channel(s)\n`);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    console.log(`── #${i + 1} ${r.accountName} (${r.platform}) ──`);
    console.log(`PERSONAL_TITLE_TEST_USER_ID=${r.userId}`);
    console.log(`PERSONAL_TITLE_TEST_ACCOUNT_ID=${r.id}`);
    console.log(`theme_id=${r.themeId}  created_at=${r.createdAt.toISOString()}`);
    console.log('');
  }

  if (rows.length === 1) {
    const r = rows[0]!;
    console.log(
      'Tip: With exactly one channel, `pnpm test:isolated-channel-title` picks this account automatically — you only need the lines above in `.env` if you prefer to be explicit or will add more channels later.\n',
    );
  } else {
    console.log(
      'Copy the PERSONAL_TITLE_TEST_* pair for the channel you want into repo-root `.env` (or pass `<user-uuid> <account-uuid>` to the test script).\n',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
