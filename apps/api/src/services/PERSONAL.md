# Personal content automation

A parallel, fully-automated content pipeline for the operator's own
social accounts, living alongside (and separate from) the agency's
client-facing pipeline.

## What it is

A set of services + one Remotion template + one dashboard page that
lets the authenticated user:

1. **Create many "personal channels"**, each locked to one viral niche
   (finance, educational facts, news, language learning, brainrot, etc).
2. **Schedule** (Overview) — cadence (every N days / weekly), posts per posting
   day, posting window, spacing; optional
   **Automatically generate videos on schedule** (off by default). When off,
   only **Generate** creates videos.
3. **Autopilot** — when scheduled generation is on, every 5 minutes the API
   checks `next_run_at` and runs the pipeline for due channels.

Everything lives at `/dashboard/personal` — intentionally not linked in
the sidebar so it stays out of the agency-facing UI.

## How a single post is generated

```
┌──────────────┐    ┌────────────────┐    ┌──────────────┐
│ choose topic │ → │ Claude script  │ → │ scrape media │
│ (rotator)    │    │ hook + beats   │    │ (real imgs)  │
└──────────────┘    └────────────────┘    └──────────────┘
                                                  │
       ┌──────────────┐    ┌────────────────┐    │
       │ ContentStudio│ ← │ Remotion render│ ← ─┘
       │   schedule   │    │ VO + music + b │
       └──────────────┘    └────────────────┘
```

| Stage          | Service                  | Notes |
| -------------- | ------------------------ | ----- |
| Theme library  | `personalThemes.ts`      | 15 curated viral niches with voice/visual/music guides |
| Topic choice   | `personalScript.ts`      | Rotates user seeds, avoids recent dupes |
| Script         | `personalScript.ts`      | Claude writes hook + beats + caption |
| Media sourcing | `personalScraper.ts`     | Pexels / Unsplash / Pixabay / Wikipedia / Google News / gameplay loops |
| Voiceover      | `personalVoice.ts`       | ElevenLabs → OpenAI → mock fallback |
| Music          | `personalMusic.ts` + `personalMusicChain.ts` | Pixabay / R2 / built-in; long videos chain distinct tracks into one bed |
| Render         | `personalRender.ts`      | Wraps Remotion ViralShort template |
| Schedule       | `contentStudio.ts`       | Posts to platform via ContentStudio |

The **ViralShort** Remotion template lives at
`packages/video/src/templates/ViralShort.tsx` and handles every
visual variant: fact-drop, news-reel, language-card, quote-card,
listicle, brainrot, story-narration, viral-text. It burns captions
into the frame and mixes VO + music via Remotion `<Audio>`.

## Theme library (15 niches)

| id                    | name             | template        | grounded media |
| --------------------- | ---------------- | --------------- | -------------- |
| `finance-bite`        | Finance Bite     | fact-drop       | optional       |
| `mega-facts`          | Mega Facts       | fact-drop       | optional       |
| `language-a-day`      | Language a Day   | language-card   | optional       |
| `news-in-60`          | News in 60       | news-reel       | **required**   |
| `ai-edge`             | AI Edge          | news-reel       | **required**   |
| `stoic-daily`         | Stoic Daily      | quote-card      | optional       |
| `history-unboxed`     | History Unboxed  | story-narration | **required**   |
| `lab-notes`           | Lab Notes        | fact-drop       | optional       |
| `mind-hacks`          | Mind Hacks       | fact-drop       | optional       |
| `brainrot-explainer`  | Brainrot         | brainrot        | gameplay loops |
| `top-five`            | Top Five         | listicle        | optional       |
| `health-bite`         | Health Bite      | fact-drop       | optional       |
| `hidden-places`       | Hidden Places    | listicle        | optional       |
| `pop-explained`       | Pop Explained    | viral-text      | optional       |
| `story-time`          | Story Time       | brainrot        | gameplay loops |

Grounded themes (News, History, AI news) refuse AI-generated imagery
and fail the post rather than fabricate visuals.

## Adding env vars

Add to `.env` as needed — all are optional:

```
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
PIXABAY_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_API_KEY=
```

With none of them set, the pipeline still runs end-to-end with mocks.

## Running the migration

After pulling schema changes, apply SQL in `packages/database/drizzle/` to the **same** database as `DATABASE_URL` (repo-root `.env`). If `GET /personal/accounts` fails with `column "contentstudio_account_id" does not exist`, you skipped this step.

```bash
pnpm db:migrate
# same as:
pnpm --filter @boost/database db:migrate
```

Then restart the API dev process so it reconnects cleanly.

## ContentStudio posting

- **Credentials:** `CONTENTSTUDIO_API_KEY` and `CONTENTSTUDIO_WORKSPACE_ID` in `.env` (API).
- **Per channel:** Optional `contentstudio_workspace_id` and `contentstudio_account_id` on `personal_accounts` (Overview → Publishing). Account id pins which connected social account receives the post when several exist for the same platform.
- **When posts are scheduled:** (1) **Auto-schedule** is on (Posting tab: send finished videos to Content Studio; workspace + API key required), or (2) dashboard **Generate & schedule post** (`scheduleToContentStudio: true` on `POST …/generate`), or (3) cron autopilot uses the same rules as (1). Schedule intent is persisted on the post so restarts still queue to ContentStudio; a 1-minute cron retries `ready` posts that still need scheduling.
- **Scheduler:** `runDuePersonalAccounts` runs every **5 minutes** (`scheduler.ts`), selects `active` accounts with `auto_generate_on_schedule`, due `next_run_at`, and calls `generateForAccount({ accountId, fromScheduleAutopilot: true })`. Overlapping ticks are skipped while a pass is in flight. Soft failures (no video / `status: failed` without a throw) delay `next_run_at` by **1 hour** and email the failure (using the post `error_message` when present) to `video_delivery_email`. Successful autopilot runs force the delivery email when that address is set, and push to Content Studio when `auto_schedule` is on. `scheduleReadyPersonalPosts` runs every **1 minute** for ContentStudio enqueue retries.
- **Stale-job cron (same 5‑minute tick):** fails posts with no progress for too long. Encode uses `PERSONAL_STALE_PIPELINE_MS` (default 3h prod). Early phases (`queued` / `scripting` / `sourcing`) use `PERSONAL_STALE_EARLY_PHASE_MS` (default **12h** prod). Live generates keep a continuous `updated_at` heartbeat via `trackPersonalPostInFlight`; activity-log lines also count as progress.

## Extending

- **Add a theme** — append to `THEMES` in `personalThemes.ts`. No
  DB migration needed.
- **Add a scraper** — implement in `personalScraper.ts` + register in
  the `searchAssets` switch + add to the `MediaSource` union.
- **Add a template variant** — extend `ViralShort.tsx` variants + map
  in `personalRender.ts::themeVariant`.
