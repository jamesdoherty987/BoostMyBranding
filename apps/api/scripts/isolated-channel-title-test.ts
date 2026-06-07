/**
 * Isolated title test — calls **{@link channelVideoTitleLikeIsolatedTest}** (same as
 * `personalDirectorPipeline` / `personalPipeline` before storyboard/script JSON).
 *
 * Loads **repo-root `.env`** before other modules:
 * `pnpm test:isolated-channel-title` uses `tsx --import ./scripts/load-root-env.ts`.
 * A second `loadRepoRootEnv()` from `@boost/database` still runs if you invoke the script directly.
 *
 * Account selection (DB-backed — uses your saved example titles + `recentVideoTitles` like production):
 *   1) `PERSONAL_TITLE_TEST_USER_ID` + `PERSONAL_TITLE_TEST_ACCOUNT_ID` in repo-root `.env`, or
 *   2) First two CLI args as UUIDs: `<userId> <accountId> "topic"`, or
 *   3) If `DATABASE_URL` is set and there is **exactly one** row in `personal_accounts`, that channel is used automatically (no env vars).
 *
 * Topic: remaining CLI text, or pass nothing to auto-invent a topic seed (same helper as before).
 *
 * **Fixture mode:** built-in `FIXTURE_EXAMPLE_TITLES` in this file (no DB account).
 *   - Pass `--fixture` to force it, or you get fixture when there is no way to pick a DB account
 *     (`DATABASE_URL` unset, or **zero / 2+** personal channels and no ids in env/CLI).
 * Edit `FIXTURE_EXAMPLE_TITLES` to match your channel when using fixture.
 * Optional: `PERSONAL_TITLE_TEST_LONGFORM=1` for long-form title rules in fixture mode.
 *
 * From monorepo root:
 *   pnpm print:personal-title-test-env   # copy PERSONAL_TITLE_TEST_* from DB
 *   pnpm test:isolated-channel-title
 *   pnpm test:isolated-channel-title "your topic"
 *   pnpm test:isolated-channel-title <user-uuid> <account-uuid> "your topic"
 */

import { randomInt, randomUUID } from 'node:crypto';
import type { PersonalAccountStyleBible, PersonalGeneratorConfig } from '@boost/database';
import { getDb, isDbConfigured, loadRepoRootEnv, personalAccounts } from '@boost/database';
import { asc } from 'drizzle-orm';
import { getAccount } from '../src/services/personalAccounts.js';
import { generateJSON } from '../src/services/claude.js';
import { channelVideoTitleLikeIsolatedTest, resolveLockedChannelVideoTitle } from '../src/services/personalChannelTitle.js';
import { countTrimmedExampleVideoTitles } from '../src/services/personalTitlePolicy.js';
import { getTheme } from '../src/services/personalThemes.js';
import { findThemeForUser } from '../src/services/personalCustomThemes.js';

loadRepoRootEnv();

/**
 * Default examples for `--fixture` (no database). Replace with your channel’s
 * saved example titles to mirror production tone/shape checks.
 */
const FIXTURE_EXAMPLE_TITLES: string[] = [
  'How Did the First War in Human History Begin?',
  'What Did Ancient Humans Do All Day?',
  'How Did Ancient Humans Mate?',
  'Ancient Humans Got High Every Day',
  'How Did Ancient Humans Survive Deadly Winters?',
  'What Do Animals Think Of Humans?',
];

/** Loose UUID shape so CLI detection does not reject valid DB ids. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Diversity hints for topic invention only — not video title examples. */
const TOPIC_SPIN_AXES = [
  'food, hunger, digestion, or feasts',
  'stone tools, fire, clothing, or shelter',
  'walking far, getting lost, coasts, boats, or migration',
  'babies, kids, elders, or family tension',
  'pain, injury, parasites, or healing without hospitals',
  'night, sleep, dreams, boredom, or fear',
  'hunting, megafauna, dogs, or dangerous animals',
  'extreme cold, heat, storms, drought, or sea ice',
  'sex, jealousy, courtship norms, or taboos',
  'raids, revenge, first organized violence, or peace tricks',
  'caves, pigments, ornaments, drums, or early play',
  'burials, corpses, grief, or the afterlife imagination',
] as const;

function normTitle(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[""`''’]/g, '');
}

function isVerbatimExample(title: string, examples: string[]): boolean {
  const n = normTitle(title);
  return examples.some((ex) => normTitle(ex) === n);
}

function inventModelKey(): 'opus' | 'sonnet' {
  const m = process.env.PERSONAL_TOPIC_INVENT_MODEL?.trim().toLowerCase();
  return m === 'opus' || m === 'sonnet' ? m : 'sonnet';
}

async function inventTopicFromExamples(examples: string[]): Promise<{ topic: string; spin: string; model: string }> {
  const list = examples.map((e, i) => `${i + 1}. ${e}`).join('\n');
  const rid = randomUUID();
  const spin = TOPIC_SPIN_AXES[randomInt(0, TOPIC_SPIN_AXES.length)]!;
  const model = inventModelKey();

  const prompt = `(Ignore: request_id=${rid})

These are real video titles from one channel (tone + subject-matter hints only):

${list}

TASK
- Infer what kinds of stories this channel covers.
- Invent **one** new video **topic seed**: 1–3 short sentences naming a concrete angle (place, era, behavior, or mystery) that would still fit this channel.
- Do **not** copy the exact question or subject of any line above.
- Plain factual seed text only (not a clickbait title).
- **Do not** default to "origins of language / first words / symbolic communication" unless it is the only honest fit — that cluster is overused; explore other angles first.
- **This run:** let your invented topic lean toward material about: **${spin}** (do not paste this bullet into the JSON verbatim).

Return ONLY valid JSON: {"topic":"..."}`;

  const raw = await generateJSON<{ topic?: string }>(prompt, {
    model,
    maxTokens: 260,
    temperature: Math.min(1, 0.94 + Math.random() * 0.06),
  });
  const topic = String(raw.topic ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!topic) {
    throw new Error('[isolated-channel-title-test] inventTopicFromExamples: model returned an empty topic.');
  }
  return { topic, spin, model };
}

function parseArgv(): {
  fixture: boolean;
  userId: string;
  accountId: string;
  topicCli: string;
} {
  const fixture = process.argv.slice(2).includes('--fixture');
  const rest = process.argv.slice(2).filter((a) => a !== '--fixture');
  let userId = process.env.PERSONAL_TITLE_TEST_USER_ID?.trim() ?? '';
  let accountId = process.env.PERSONAL_TITLE_TEST_ACCOUNT_ID?.trim() ?? '';
  let topicCli = '';

  if (rest.length >= 2 && UUID_RE.test(rest[0]!) && UUID_RE.test(rest[1]!)) {
    userId = rest[0]!;
    accountId = rest[1]!;
    topicCli = rest.slice(2).join(' ').trim();
  } else {
    topicCli = rest.join(' ').trim();
  }

  return { fixture, userId, accountId, topicCli };
}

/** When the DB has exactly one personal channel, we can resolve ids without env vars. */
async function tryResolveSolePersonalAccountFromDb(): Promise<{ userId: string; accountId: string } | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select({ id: personalAccounts.id, userId: personalAccounts.userId })
    .from(personalAccounts)
    .orderBy(asc(personalAccounts.createdAt))
    .limit(2);
  if (rows.length !== 1) return null;
  return { userId: rows[0]!.userId, accountId: rows[0]!.id };
}

async function runFixtureMode(topicCli: string) {
  const longform = process.env.PERSONAL_TITLE_TEST_LONGFORM === '1';
  const styleBible: PersonalAccountStyleBible = {
    exampleVideoTitles: [...FIXTURE_EXAMPLE_TITLES],
  };

  let topic: string;
  let inventMeta: { spin: string; model: string } | undefined;
  if (topicCli.trim()) {
    topic = topicCli.trim();
  } else {
    const invented = await inventTopicFromExamples(FIXTURE_EXAMPLE_TITLES);
    topic = invented.topic;
    inventMeta = { spin: invented.spin, model: invented.model };
  }

  console.log('========== FIXTURE MODE (built-in example titles — no DB account) ==========');
  console.log(`Long-form resolver flag: ${longform} (set PERSONAL_TITLE_TEST_LONGFORM=1 for true)`);
  console.log('');

  console.log('========== EXAMPLE TITLES (fixture list — edit FIXTURE_EXAMPLE_TITLES in script) ==========');
  FIXTURE_EXAMPLE_TITLES.forEach((t, i) => console.log(`${i + 1}. ${t}`));
  console.log('==========================================================================\n');

  if (topicCli.trim()) {
    console.log('========== TOPIC (from CLI) ==========');
  } else {
    console.log('========== TOPIC (model-invented — no CLI topic) ==========');
  }
  console.log(topic);
  console.log('======================================\n');

  console.log('Generating title (resolveLockedChannelVideoTitle — same rules as production)…\n');

  const title = await resolveLockedChannelVideoTitle({
    topic,
    language: 'en',
    styleBible,
    recentVideoTitles: [],
    longform,
  });

  if (!title?.trim()) {
    throw new Error('[isolated-channel-title-test] No title produced in fixture mode.');
  }

  if (isVerbatimExample(title, FIXTURE_EXAMPLE_TITLES)) {
    throw new Error(
      `[isolated-channel-title-test] Generated title matched a fixture example verbatim — unexpected:\n${title}`,
    );
  }

  console.log('========== GENERATED TITLE ==========');
  console.log(title);
  console.log('=====================================\n');

  console.log('Unique vs fixture example list (no verbatim copy): yes');
  if (inventMeta) {
    console.log(
      `(topic invention: model=${inventMeta.model}, spin_axis="${inventMeta.spin}" — fixture-only when no CLI topic)`,
    );
  }
}

async function main() {
  const { fixture, userId: parsedUserId, accountId: parsedAccountId, topicCli } = parseArgv();

  const envUser = process.env.PERSONAL_TITLE_TEST_USER_ID?.trim() ?? '';
  const envAcct = process.env.PERSONAL_TITLE_TEST_ACCOUNT_ID?.trim() ?? '';
  if ((envUser && !envAcct) || (!envUser && envAcct)) {
    console.error(
      'Incomplete PERSONAL_TITLE_TEST_* env: set both PERSONAL_TITLE_TEST_USER_ID and PERSONAL_TITLE_TEST_ACCOUNT_ID, or remove both so the script can use your only DB channel or fixture mode.',
    );
    process.exit(1);
  }

  let userId = parsedUserId;
  let accountId = parsedAccountId;

  if (fixture) {
    await runFixtureMode(topicCli);
    return;
  }

  if (!userId || !accountId) {
    if (isDbConfigured()) {
      const sole = await tryResolveSolePersonalAccountFromDb();
      if (sole) {
        userId = sole.userId;
        accountId = sole.accountId;
        console.log(
          `Using the only personal account in the database (no PERSONAL_TITLE_TEST_* env vars needed): user=${userId} account=${accountId}\n`,
        );
      }
    }
  }

  if (!userId || !accountId) {
    console.log(
      'No account selected (multiple channels in DB, or no DATABASE_URL) — running built-in fixture mode. Set PERSONAL_TITLE_TEST_USER_ID + PERSONAL_TITLE_TEST_ACCOUNT_ID, pass two UUIDs, or keep a single channel to auto-pick from the DB.\n',
    );
    await runFixtureMode(topicCli);
    return;
  }

  if (!isDbConfigured()) {
    console.error('DATABASE_URL is not set — add it to repo-root `.env` (loaded automatically).');
    process.exit(1);
  }

  const account = await getAccount(userId, accountId);
  if (!account) {
    console.error('Account not found for the given user + account ids (wrong owner or bad uuid).');
    process.exit(1);
  }

  const styleBible = (account.styleBible as PersonalAccountStyleBible) ?? {};
  const examples = (styleBible.exampleVideoTitles ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (examples.length === 0) {
    console.error(
      'This account has no example video titles saved. Add them under Style & config in the UI (same requirement as production generate).',
    );
    process.exit(1);
  }

  const gen = (account.generatorConfig as PersonalGeneratorConfig) ?? {};
  const theme =
    getTheme(account.themeId) ?? (await findThemeForUser(account.userId, account.themeId));
  const longform = gen.longformEnabled === true || theme?.template === 'animated-explainer';

  let topic: string;
  let inventMeta: { spin: string; model: string } | undefined;
  if (topicCli) {
    topic = topicCli;
  } else {
    const invented = await inventTopicFromExamples(examples);
    topic = invented.topic;
    inventMeta = { spin: invented.spin, model: invented.model };
  }

  console.log(`Account: ${account.id} (${account.accountName ?? 'unnamed'})`);
  console.log(`Example title count (UI): ${countTrimmedExampleVideoTitles(styleBible)}`);
  console.log(`Long-form flag (matches planStoryboard): ${longform}`);
  console.log('');
  console.log('========== EXAMPLE TITLES (from account style bible) ==========');
  examples.forEach((t, i) => console.log(`${i + 1}. ${t}`));
  console.log('================================================================\n');

  if (topicCli) {
    console.log('========== NEW TOPIC (from CLI) ==========');
  } else {
    console.log('========== NEW TOPIC (model-invented — no CLI topic) ==========');
  }
  console.log(topic);
  console.log('==============================================================\n');

  console.log('Generating title (channelVideoTitleLikeIsolatedTest — same as production)…\n');

  const title = await channelVideoTitleLikeIsolatedTest({
    account: {
      id: account.id,
      userId: account.userId,
      themeId: account.themeId,
      language: account.language,
      styleBible: account.styleBible,
      generatorConfig: account.generatorConfig,
    },
    topic,
  });
  if (!title?.trim()) {
    throw new Error('[isolated-channel-title-test] No title produced — account needs example video titles.');
  }

  if (isVerbatimExample(title, examples)) {
    throw new Error(
      `[isolated-channel-title-test] Generated title matched an example verbatim after validation — unexpected:\n${title}`,
    );
  }

  console.log('========== GENERATED TITLE ==========');
  console.log(title);
  console.log('=====================================\n');

  console.log('Unique vs example list (no verbatim copy): yes');
  if (inventMeta) {
    console.log(
      `(topic invention: model=${inventMeta.model}, spin_axis="${inventMeta.spin}" — test-only; production supplies topic from pipeline)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
