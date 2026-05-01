# BoostMyBranding — Setup guide

Everything you need to run the full stack locally and deploy to production.

---

## 0. What you're running

Four apps, one backend, one database.

| App              | Port | What it is                                                        |
| ---------------- | ---- | ----------------------------------------------------------------- |
| `apps/web`       | 3000 | Public marketing site with rocket launch hero + Stripe checkout   |
| `apps/portal`    | 3001 | Mobile-first client PWA (upload, approve, chat, settings)         |
| `apps/dashboard` | 3002 | Agency team dashboard with realtime presence for two+ workers     |
| `apps/api`       | 4000 | Express API — auth, Stripe, automation, cron, SSE realtime        |

---

## 1. Prerequisites

- **Node.js 20+** — `node --version` should be ≥ 20
- **pnpm 9+** — `npm install -g pnpm@9` if you don't have it
- **Postgres 14+** — we'll set this up next

---

## 2. Database (required)

You'll use a real Postgres database locally. Pick one path:

### Fastest — Docker

```bash
docker run -d --name bmb-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=boostmybranding \
  postgres:16
```

### Homebrew (macOS)

```bash
brew install postgresql@16
brew services start postgresql@16
createdb boostmybranding
```

Either way, set in `.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/boostmybranding
```

Then create the tables and seed demo data:

```bash
pnpm install
pnpm --filter @boost/database db:generate   # generates SQL from schema.ts
pnpm --filter @boost/database db:migrate    # applies to DATABASE_URL
pnpm --filter @boost/database db:seed       # 3 demo clients + posts + messages
```

Now you can run `pnpm --filter @boost/database db:studio` at any time for a visual browser over your data.

---

## 3. Install and run

```bash
pnpm install
pnpm dev
```

That starts every app in parallel via Turborepo. Open:

- http://localhost:3000 — marketing site
- http://localhost:3001 — client portal
- http://localhost:3002 — agency dashboard
- http://localhost:4000/health — API health probe

To run just one app: `pnpm --filter web dev`.

---

## 4. API keys (optional, add as you get them)

Every integration has a mock fallback, so the app runs end-to-end with zero keys. Fill these in as you go.

### Anthropic Claude — captions, brand voice, image scoring

https://console.anthropic.com → API keys → `ANTHROPIC_API_KEY=sk-ant-...`

### fal.ai — Flux Kontext + Flux 2 Pro

https://fal.ai → dashboard → `FAL_KEY=fal-...`

### Cloudflare R2 — image uploads

Cloudflare dashboard → R2 → create bucket `boostmybranding-uploads` → API tokens with read/write → public access URL. Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

Without R2, uploads land in `apps/api/tmp/uploads/` and serve from the API.

### Stripe — subscriptions (the important one)

1. https://dashboard.stripe.com → sign up
2. In **test mode**, create three recurring products:
   - Social Only €700/month → copy price id → `STRIPE_PRICE_SOCIAL`
   - Website Only €150/month → `STRIPE_PRICE_WEBSITE`
   - Full Package €800/month → `STRIPE_PRICE_FULL`
3. Developers → API keys → secret key → `STRIPE_SECRET_KEY=sk_test_...`
4. Developers → Webhooks → add endpoint:
   - URL: `https://YOUR_API/api/v1/webhooks/stripe`
   - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET=whsec_...`

**Local webhook testing:** install the Stripe CLI and run:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
```

It prints a `whsec_...` for your `.env`.

### Resend — magic-link + transactional email

https://resend.com → verify a sending domain → `RESEND_API_KEY=re_...`. Without Resend, the portal shows a "dev link" to click instead.

### ContentStudio — auto-publishing to Instagram, Facebook, LinkedIn, TikTok, X, Bluesky, Pinterest

https://contentstudio.io → paid plan (~$49/mo) → API key + workspace id.

Without ContentStudio, the scheduler still marks posts as published on schedule; it just skips the actual cross-posting.

---

## 5. Sign-in flow (first run)

Once seeded, sign in to each app with these demo emails:

- `admin@boostmybranding.com` → agency admin (dashboard)
- `sean@murphysplumbing.ie` → client user (portal)
- `nora@atlasfitness.co` → another client
- `luca@verdecafe.com` → another client

Each login flow is the same: enter the email, click **Send magic link**, then follow the "dev link" the portal displays (since Resend isn't set up yet). You'll be signed in with a cookie.

---

## 6. Going to production

### Frontends — Vercel (free)

Import the repo three times, one per app. Set root directory to `apps/web`, `apps/portal`, `apps/dashboard`, and set custom subdomains.

### API — Render Web Service

- Root: `apps/api`
- Build: `pnpm install --frozen-lockfile && pnpm --filter api build`
- Start: `pnpm --filter api start`
- Add Render Postgres as `DATABASE_URL`
- Add a Render Cron Job hitting `POST https://YOUR_API/api/v1/automation/publish-due` every minute with `x-cron-secret: <CRON_SECRET>` header (belt & braces; the in-process cron also runs)

### Post-deploy checklist

- [ ] Swap Stripe to live mode with live price IDs
- [ ] Stripe webhook endpoint points to your production API
- [ ] Resend verified sending domain
- [ ] ContentStudio workspace created per client and linked to their socials
- [ ] `AUTH_SECRET` is 32+ random chars (unique per env)
- [ ] Database has automatic backups enabled

---

## 7. How the automation works

**Monthly content** (agency clicks **Generate** in the dashboard)

```
POST /api/v1/automation/generate
    { clientId, month, postsCount, platforms, direction }

→ Jina Reader scrapes the client's website (if brand voice not cached)
→ Claude Sonnet generates brand-voice JSON + caches on the client row
→ For each un-scored uploaded image, Claude Vision returns quality + caption angle
→ For each image marked needsEditing, Flux Kontext Max enhances it
→ Claude Sonnet drafts the calendar of N posts, mixed content types
→ Gap-fill images are generated with Flux 2 Pro
→ Posts persist with status=pending_internal (agency pre-review)
```

**Daily auto-publish** (node-cron every minute, inside the API process)

```
Find posts where status='scheduled' AND scheduledAt <= now()
→ Mark publishing
→ POST to ContentStudio
→ Mark published with ContentStudio post ID, or mark failed with error
```

**Realtime collaboration** (Server-Sent Events)

Every dashboard user opens an SSE connection to `/api/v1/realtime/stream` on load. Any post mutation (`approve`, `reject`, `update`) broadcasts to every connected client. The review queue shows presence chips with each teammate's initial, and when a teammate opens a card they "lock" it — others see *"Jamie is reviewing this"* and can't approve until they move on.

You always stay in control. Posts move through clear states:

```
draft → pending_internal → pending_approval → approved → scheduled → publishing → published
                                                               ↘ rejected
                                                                     ↘ failed (with error)
```

---

## 8. Useful scripts

```bash
pnpm dev                                     # every app at once
pnpm build                                   # build everything
pnpm lint                                    # typecheck every package

pnpm --filter web dev                        # marketing site only
pnpm --filter portal dev                     # portal PWA only
pnpm --filter dashboard dev                  # agency dashboard only
pnpm --filter api dev                        # backend only

pnpm --filter @boost/database db:generate    # create migration SQL from schema.ts
pnpm --filter @boost/database db:migrate     # apply migrations
pnpm --filter @boost/database db:seed        # seed demo data
pnpm --filter @boost/database db:studio      # visual DB browser
```

---

## 9. FAQ

**I see "mock" data everywhere.**
Without `DATABASE_URL`, the API returns the `@boost/core` mock data. Set up Postgres (step 2), run migrate + seed, and everything turns real.

**My changes in one browser tab don't show up in another.**
They do via the realtime SSE stream — just give it a second. Check `localhost:4000/api/v1/realtime/presence` to verify connections.

**How do I add a new client?**
The easiest way is for the client to sign up at `/signup` on the marketing site. That pulls them through the wizard and Stripe Checkout, then emails them a magic link to the portal. Dashboard users can also add clients directly via `POST /api/v1/clients`.

**How do I change pricing?**
Update the three Stripe price IDs in `.env`. The frontend reads them through the backend — no code changes needed.

**Auto-posting isn't going out.**
Check `apps/api/src/services/scheduler.ts`. Common causes: `CONTENTSTUDIO_API_KEY` not set (scheduler runs but skips posting) or the client hasn't connected their social accounts in ContentStudio.

**How many agency members can log in at once?**
Any number. The dashboard uses Server-Sent Events to show presence chips for each teammate, and post approval uses soft locks so two people never approve the same card. No conflicts, no stale state.
