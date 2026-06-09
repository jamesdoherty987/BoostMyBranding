# Deploy API (Railway) + Web (Vercel)

This app splits **Next.js** (Vercel) and **Express** (long-running Node: Railway). The browser talks to your Vercel origin; Vercel **rewrites** `/api/*` to the Railway URL via `API_UPSTREAM`.

## 0. Full setup order (recommended)

1. **Database** — Create Neon (or Postgres); copy `DATABASE_URL`.
2. **Railway** — Connect GitHub, deploy this repo, **Networking → Generate domain**, copy `https://….up.railway.app`.
3. **Railway env vars** — Add everything in §2 (at least `NODE_ENV`, `DATABASE_URL`, `AUTH_SECRET`, Stripe keys, `APP_URL` / `PORTAL_URL` / `DASHBOARD_URL` matching your **Vercel** URL, plus R2/AI keys as needed). Redeploy until the service is **green** and `GET /health` returns `ok`.
4. **Migrations** — On your machine: `DATABASE_URL='…prod…' pnpm --filter @boost/database db:migrate`
5. **Vercel** — Same repo (or existing web project). Set `API_UPSTREAM` = Railway URL and the `NEXT_PUBLIC_*` vars from §3. Redeploy.
6. **Smoke test** — Open your Vercel site → sign in → **Personal**; Network tab should show `/api/…` on your Vercel host.

**Yes, you connect Vercel to Railway** by setting **`API_UPSTREAM`** on Vercel to your Railway HTTPS URL (no trailing slash). You do **not** need a special “GitHub integration” between them beyond deploying both repos from GitHub and wiring that one variable.

## 1. Create the Railway service

1. In [Railway](https://railway.com), **New project** → **Deploy from GitHub repo** (same repo as Vercel).
2. Add a **single service** from that repo (no need for Railway Postgres if you use Neon — keep one DB).
3. **Settings → Root directory:** leave empty (monorepo root).
4. **Settings → Build**

   - **Watch paths** (optional): restrict redeploys to `apps/api/**`, `packages/**`, `pnpm-lock.yaml`, `package.json`, `turbo.json`, `nixpacks.toml`, `Dockerfile`.

5. **Build / start** — Railway uses the repo **`Dockerfile`** when present (recommended). Otherwise configure Nixpacks / Railpack manually:

   - **Install command:**  
     `corepack enable && corepack prepare pnpm@9.12.0 --activate && pnpm install --frozen-lockfile`
   - **Build command:**  
     `pnpm exec turbo run build --filter=api`  
     (`pnpm turbo …` can fail with **Command "turbo" not found** if devDependencies were skipped — see §7.)
   - **Start command:**  
     `pnpm --filter api start`

   Railway also sets **`PORT`**; the API maps it to `API_PORT` automatically (`apps/api/src/env.ts`).

6. **System dependency — FFmpeg**  
   Repo root `nixpacks.toml` installs **`ffmpeg`** (Apt). If your builder ignores it, set a Railway variable:  
   `NIXPACKS_APT_PKGS=ffmpeg`  
   (or Railpack: `RAILPACK_DEPLOY_APT_PACKAGES=ffmpeg` per current Railway docs.)

7. **Generate a public URL**  
   Service → **Networking → Generate domain** (e.g. `https://your-api.up.railway.app`). HTTPS is automatic.

## 2. Railway environment variables

Set these in the **API** service (copy from local `.env`, never commit secrets).

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon (or Postgres) connection string |
| `AUTH_SECRET` | Random string **32+ chars** (not the dev default) |
| `STRIPE_SECRET_KEY` | Required for API boot in production (use **test** keys for personal use) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret for the endpoint you configure |
| `APP_URL` | **Exact** browser origin of the marketing/dashboard site, e.g. `https://your-app.vercel.app` |
| `PORTAL_URL` | e.g. `https://your-app.vercel.app/portal` |
| `DASHBOARD_URL` | e.g. `https://your-app.vercel.app/dashboard` |
| `API_PUBLIC_URL` | **Optional on Railway** — defaults from `RAILWAY_PUBLIC_DOMAIN` if unset. Use your public API URL (`https://….up.railway.app` or custom domain). Needed for `/uploads/…` when R2 is off. |
| R2 / AI / Resend / etc. | As in `.env.example` |

**CORS:** the API allowlist is built from `APP_URL`, `PORTAL_URL`, and `DASHBOARD_URL`. They must match what users type in the browser (scheme + host + port).

**Cron / scheduled routes:** if you use `CRON_SECRET`, set the same value on whatever pings your cron URLs.

**Canva:** set `CANVA_REDIRECT_URI` to the **URL the user’s browser will hit** after OAuth — usually **`https://<your-site>/api/v1/canva/callback`** when the Next app proxies `/api` to Railway (same host as `APP_URL`). Only use the raw Railway host if the browser is sent there directly without the Vercel rewrite. The URI must **exactly** match what you register in the Canva developer portal.

**Migrations:** from your machine (or CI), with `DATABASE_URL` pointing at production:

```bash
pnpm --filter @boost/database db:migrate
```

## 3. Vercel (web) environment variables

In the Vercel project → **Settings → Environment Variables** (Production):

| Variable | Example / note |
|----------|----------------|
| `API_UPSTREAM` | `https://your-api.up.railway.app` — **no trailing slash** |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` (or custom domain) |
| `NEXT_PUBLIC_DASHBOARD_URL` | `https://your-app.vercel.app/dashboard` |
| `NEXT_PUBLIC_PORTAL_URL` | `https://your-app.vercel.app/portal` |
| `NEXT_PUBLIC_API_URL` | **Leave unset** for the recommended setup: browser calls same-origin `/api/…` and Next rewrites to Railway. Only set if you intentionally want the browser to call the API directly (must match CORS + cookies strategy). |

### Build-time requirement for `API_UPSTREAM`

Next.js runs **`rewrites()` from `next.config.ts` at `next build` time**, not on every request. That means:

- **`API_UPSTREAM` must be set in Vercel before the Production build** (same value you use at runtime is fine).
- If you **change the Railway public URL**, run a **new Vercel deployment** so the rewrite destination is rebuilt.
- **Preview** deployments: set `API_UPSTREAM` on the **Preview** environment too if previews should call an API; otherwise they may have no `/api` proxy unless you point Preview at a staging API.

The Production build **fails fast** with a clear error if `API_UPSTREAM` is missing when `VERCEL_ENV=production`.

**Turborepo:** `turbo.json` lists `API_UPSTREAM`, `VERCEL_*`, and `NEXT_PUBLIC_*` on the **`build`** task so they are **not stripped** in Turbo’s default strict env mode (otherwise `next build` would not see them).

### Vercel project settings (recommended)

1. **Root Directory:** `apps/web` (not the monorepo root).
2. **Framework Preset:** Next.js (auto-detected from `apps/web/vercel.json`).
3. **Install / Build:** Leave the dashboard **Install Command** and **Build Command** **empty** so Vercel uses **`apps/web/vercel.json`**, which runs from **`apps/web`** (pnpm discovers the monorepo root automatically):
   - Install: `corepack enable && corepack prepare pnpm@9.12.0 --activate && pnpm install --frozen-lockfile`
   - Build: `pnpm exec turbo run build --filter=web`
4. If you previously set a custom command like `pnpm --filter @boost/core build && … && next build`, **delete it** — it runs from `apps/web` without the workspace root and breaks; the `vercel.json` commands replace it.

After changing env vars, **redeploy** Vercel so `next.config.ts` is re-evaluated at build.

## 4. How URLs work in this repo

- **Browser → API:** `apps/web/lib/publicApiBaseUrl.ts` defaults to an **empty** base URL in production when `NEXT_PUBLIC_API_URL` is unset, so fetches go to `/api/v1/...` on the **Vercel** origin. Next.js **rewrites** those to `API_UPSTREAM` + `/api/v1/...`.
- **Server / middleware → API:** `apps/web/lib/serverApiBaseUrl.ts` prefers `API_UPSTREAM`, then an absolute `NEXT_PUBLIC_API_URL`, then on Vercel `https://${VERCEL_URL}` so RSC and middleware can reach the API without mis-typing localhost.
- **Railway → public API URL:** `RAILWAY_PUBLIC_DOMAIN` is mapped to `API_PUBLIC_URL` in `apps/api/src/env.ts` when you did not set it manually (helps `/uploads/…` and logs).
- **Session cookies (`bmb_session`):** On `*.vercel.app`, `*.railway.app`, and similar **public-suffix** hosts, the API **does not** set `Cookie: Domain=…` (browsers would reject it). Cookies are **host-only** for your Vercel hostname, which matches same-origin `/api` proxying. For your own apex domain (e.g. `app.brand.com` + `api.brand.com`), the API may set `Domain=.brand.com` and `SameSite=None` so cookies work across subdomains.

## 5. Smoke tests

1. `GET https://<railway>/health` → JSON `ok: true`.
2. Open Vercel dashboard → Personal (or any authenticated page) → confirm network tab shows `/api/...` **200** from your Vercel host (not `localhost:4000`).
3. **Download video** on Personal — should download via same-origin `/api/v1/personal/.../download`.

## 6. Optional: custom domain for API

Add a custom domain on Railway, set `API_PUBLIC_URL` and Vercel `API_UPSTREAM` to that HTTPS URL, and update any Stripe/Canva webhook URLs.

## 7. Troubleshooting: `turbo` not found / build exit 254

**Cause:** `turbo` is a **devDependency** at the repo root. If `NODE_ENV=production` during `pnpm install`, pnpm **omits devDependencies**, so `turbo` is never installed and `pnpm turbo …` fails.

**Fixes:**

- **Dockerfile (this repo):** Uses `NODE_ENV=development` for install + build, then sets `production` for runtime. Pull the latest `Dockerfile` and redeploy.
- **Railpack / custom install:** Run install with dev deps, e.g. prefix install with `NODE_ENV=development` if the platform forces production.
- **Always:** Prefer `pnpm exec turbo run build --filter=api` over `pnpm turbo …` so pnpm resolves the local binary explicitly once it is installed.

## 8. Troubleshooting: healthcheck fails on `/health` (“service unavailable”, replica never healthy)

**Symptom:** Docker build succeeds, deploy runs, then Railway (or similar) retries **`GET /health`** and eventually reports **replica never became healthy**.

**Cause:** The Node process **never binds to `PORT`** — almost always because it **exits during startup** before `app.listen` runs. Common reasons:

1. **Production env validation** (`apps/api/src/env.ts`) — in `NODE_ENV=production` the API **refuses to start** unless **`DATABASE_URL`**, **`AUTH_SECRET`** (not the dev default), **`STRIPE_SECRET_KEY`**, and **`STRIPE_WEBHOOK_SECRET`** are set, and R2 is not half-configured. Fix: add the variables from **§2**, redeploy, and read **Deploy / Runtime logs** for the `❌ Production environment is misconfigured` lines.
2. **Invalid Zod env** (malformed URL, etc.) — logs show `❌ Invalid environment` with field errors.
3. **Wrong health path** — this API serves **`GET /health`** at the **root** (not under `/api/v1`). Railway’s default **`/health`** path matches the app.

After fixing env, redeploy and confirm logs show **`🚀 BoostMyBranding API → …`** before assuming networking issues.
