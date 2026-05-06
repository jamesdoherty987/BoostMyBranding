# Personal content automation

A parallel, fully-automated content pipeline for the operator's own
social accounts, living alongside (and separate from) the agency's
client-facing pipeline.

## What it is

A set of services + one Remotion template + one dashboard page that
lets the authenticated user:

1. **Create many "personal channels"**, each locked to one viral niche
   (finance, educational facts, news, language learning, brainrot, etc).
2. **Schedule automation** — posts per day, posting window, spacing.
3. **Walk away**. Every 5 minutes the scheduler checks for due channels
   and runs a full generation pipeline for each.

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
| Music          | `personalMusic.ts`       | Pixabay music → built-in R2 library |
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

```
pnpm --filter @boost/database migrate
```

## Extending

- **Add a theme** — append to `THEMES` in `personalThemes.ts`. No
  DB migration needed.
- **Add a scraper** — implement in `personalScraper.ts` + register in
  the `searchAssets` switch + add to the `MediaSource` union.
- **Add a template variant** — extend `ViralShort.tsx` variants + map
  in `personalRender.ts::themeVariant`.
