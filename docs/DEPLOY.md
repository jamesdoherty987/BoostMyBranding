# Deploy to Render

The fastest path from local dev to a live API with a real Postgres. One-time setup, ~10 minutes.

The repo ships with a [`render.yaml`](../render.yaml) Blueprint that provisions everything in one click: a managed Postgres, the Express API, migrations on every deploy, and a cron job. You only need to paste API keys at the end.

---

## 1. Push your repo to GitHub / GitLab

Render deploys from a git repo, so make sure yours is pushed.

```bash
git add .
git commit -m "chore: ready for render"
git push
```

## 2. Create the Blueprint on Render

1. Go to https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect your GitHub account if you haven't, then select this repo.
3. Render reads `render.yaml` and proposes:
   - `boostmybranding-db` — managed Postgres 16 (free plan)
   - `boostmybranding-api` — Express web service
   - `boostmybranding-publish-due` — every-minute cron hitting the publish endpoint
4. Click **Apply**. Render provisions the database first, then starts the build.

That's it — you don't need to run `createdb` anywhere. Render manages the Postgres instance for you, and `DATABASE_URL` is wired into the API automatically via `fromDatabase` in the blueprint.

## 3. First deploy

During the first deploy Render will:

1. Run `pnpm install --frozen-lockfile && pnpm --filter api build` to compile the API.
2. Run `pnpm db:migrate` via the blueprint's `preDeployCommand`. This creates every table in the new Postgres from the drizzle migrations in `packages/database/drizzle/`.
3. Start the server with `pnpm --filter api start`.
4. Probe `/health` until it returns 200, then route traffic.

You can watch the logs in the Render dashboard as it goes. When it's green, hit `https://boostmybranding-api.onrender.com/health` to confirm.

## 4. Seed demo data (optional, one-time)

If you want the three demo clients (Murphy's Plumbing, Atlas Fitness, Verde Cafe) in your live DB:

Render dashboard → `boostmybranding-api` → **Shell** tab → run:

```bash
pnpm db:seed
```

Skip this for a clean empty database — real clients will sign up through `/signup` on the marketing site.

## 5. Fill in API keys

Open `boostmybranding-api` → **Environment** tab. You'll see slots pre-declared (thanks to the blueprint) with `sync: false` — set each one when you've got the key:

| Variable                            | Where to get it                                               |
| ----------------------------------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                 | https://console.anthropic.com                                 |
| `FAL_KEY`                           | https://fal.ai dashboard                                      |
| `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET_NAME` + `R2_PUBLIC_URL` | Cloudflare → R2 → bucket + API token |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` | Stripe → API keys + Products     |
| `RESEND_API_KEY`                    | https://resend.com (verified sending domain)                  |
| `CONTENTSTUDIO_API_KEY` + `CONTENTSTUDIO_WORKSPACE_ID` | ContentStudio → settings             |

`AUTH_SECRET` and `CRON_SECRET` are generated automatically — don't overwrite them.

After each change Render redeploys. That's expected.

## 6. Deploy the three frontends on Vercel

The API + DB are the hard part. The frontends are plain Next.js, best on Vercel:

1. https://vercel.com/new → import the same repo **three times** with these settings:

| Project          | Root directory    | Output settings | Domain you'll use               |
| ---------------- | ----------------- | --------------- | ------------------------------- |
| `web`            | `apps/web`        | (defaults)      | `boostmybranding.com`           |
| `portal`         | `apps/portal`     | (defaults)      | `app.boostmybranding.com`       |
| `dashboard`      | `apps/dashboard`  | (defaults)      | `team.boostmybranding.com`      |

2. For each Vercel project → Settings → Environment Variables, add:
   - `NEXT_PUBLIC_API_URL` = your Render API URL (e.g. `https://boostmybranding-api.onrender.com`)
   - `NEXT_PUBLIC_APP_URL` = `https://boostmybranding.com`
   - `NEXT_PUBLIC_PORTAL_URL` = `https://app.boostmybranding.com`
   - `NEXT_PUBLIC_DASHBOARD_URL` = `https://team.boostmybranding.com`

3. In Render → `boostmybranding-api` → Environment, update `APP_URL`, `PORTAL_URL`, `DASHBOARD_URL` to match the real Vercel domains. (The CORS allowlist reads these, so this is important.)

## 7. Point Stripe at production

1. Stripe dashboard → **Live mode** → Products → recreate your three prices (Social €700, Website €150, Full €800) and update the three `STRIPE_PRICE_*` vars in Render.
2. Developers → Webhooks → add endpoint:
   - URL: `https://boostmybranding-api.onrender.com/api/v1/webhooks/stripe`
   - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
   - Copy the signing secret → Render env → `STRIPE_WEBHOOK_SECRET`.

## 8. Verify end-to-end

- `GET https://boostmybranding-api.onrender.com/health` → `{ data: { ok: true, env: "production" } }`
- Visit `https://boostmybranding.com` → marketing site loads with real API (no mocks).
- Visit `https://team.boostmybranding.com` → sign in as `admin@boostmybranding.com` (or whoever you seeded). You'll get a magic link by email via Resend.
- Run through `/signup` with Stripe test card `4242 4242 4242 4242` to confirm the whole checkout → client creation → magic-link → portal onboarding flow.

---

## Things to know

**Free tier caveats.** Render's free Postgres is fine for a demo but it's paused after 30 days of inactivity and is capped at ~1 GB. Upgrade `plan: free` → `plan: starter` in `render.yaml` before launch.

**The API's free plan sleeps** after 15 minutes of inactivity, which breaks the in-process cron. The separate `boostmybranding-publish-due` cron job declared in `render.yaml` wakes it up once a minute, so publishing still happens on schedule. For production, upgrade the web service to a paid plan so it never sleeps.

**Region.** The blueprint defaults to `frankfurt`. Switch to `oregon`/`virginia`/`singapore` if your users are closer — lower latency for the SSE realtime connections.

**Backups.** Render's managed Postgres takes automatic daily snapshots on paid plans. Check Dashboard → your database → **Backups**.

**Migrating an existing local DB.** If you already seeded data locally and want to copy it up:

```bash
pg_dump postgresql://jkdoh@localhost:5432/boostmybranding \
  | psql "$(render services vars get boostmybranding-db DATABASE_URL)"
```

## Troubleshooting

| Symptom                                   | Fix                                                                |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Build fails on "corepack: command not found" | Bump Node version in Render service Settings → ensure ≥ 20.     |
| `/health` returns but `/api/v1/...` 5xx   | `boostmybranding-api` logs will show the real error. Usually missing env var. |
| Magic links never arrive                  | `RESEND_API_KEY` not set — the API falls back to logging the link in stdout. Check Render logs. |
| Scheduler isn't publishing                | Set `CONTENTSTUDIO_API_KEY`, or check the separate cron job's logs. |
| CORS errors in the browser                | `APP_URL` / `PORTAL_URL` / `DASHBOARD_URL` on the API service must exactly match the Vercel domains, including `https://`. |
