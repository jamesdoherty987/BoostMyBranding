# Deployment — single-domain setup

BoostMyBranding deploys as **four independent services** that share one
public domain (`boostmybranding.com`) via Vercel rewrites:

```
boostmybranding.com/*          → apps/web          (Vercel)
boostmybranding.com/portal/*   → apps/portal       (Vercel)
boostmybranding.com/dashboard/* → apps/dashboard   (Vercel)
boostmybranding.com/api/*      → apps/api          (Render / Fly / anywhere)
```

The user only ever sees `boostmybranding.com` in the URL bar. Cookies
are shared automatically because every request hits the same origin.

## One-time setup

### 1. Deploy each app to its own Vercel (or Render) project

- **web** — Vercel, root dir `apps/web`. This is the project that owns
  the production domain (`boostmybranding.com`).
- **portal** — Vercel, root dir `apps/portal`. Give it any auto-assigned
  URL (e.g. `boost-portal.vercel.app`). No custom domain on this project.
- **dashboard** — Vercel, root dir `apps/dashboard`. Same as portal —
  no custom domain, just the auto-assigned `.vercel.app` URL.
- **api** — Render, root dir `apps/api`. Expose its `.onrender.com` URL.

Each project auto-detects its framework (Next.js or Node/Express) — no
manual config needed.

### 2. Set env vars

**On web project** (boostmybranding.com):
```
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_URL=https://boostmybranding.com
NEXT_PUBLIC_PORTAL_URL=https://boostmybranding.com/portal
NEXT_PUBLIC_DASHBOARD_URL=https://boostmybranding.com/dashboard
PORTAL_UPSTREAM=https://boost-portal.vercel.app
DASHBOARD_UPSTREAM=https://boost-dashboard.vercel.app
API_UPSTREAM=https://boost-api.onrender.com
```

**On portal project**:
```
PORTAL_BASE_PATH=/portal
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_URL=https://boostmybranding.com
NEXT_PUBLIC_PORTAL_URL=https://boostmybranding.com/portal
NEXT_PUBLIC_DASHBOARD_URL=https://boostmybranding.com/dashboard
```

**On dashboard project**:
```
DASHBOARD_BASE_PATH=/dashboard
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_URL=https://boostmybranding.com
NEXT_PUBLIC_PORTAL_URL=https://boostmybranding.com/portal
NEXT_PUBLIC_DASHBOARD_URL=https://boostmybranding.com/dashboard
```

**On api project** (Render):
```
NODE_ENV=production
APP_URL=https://boostmybranding.com
PORTAL_URL=https://boostmybranding.com/portal
DASHBOARD_URL=https://boostmybranding.com/dashboard
DATABASE_URL=<your Neon production URL>
AUTH_SECRET=<32-char random hex>
ANTHROPIC_API_KEY=<key>
FAL_KEY=<key>
STRIPE_SECRET_KEY=<key>
STRIPE_WEBHOOK_SECRET=<key>
# ...all other service keys from .env.example
VERCEL_API_TOKEN=<for custom domain feature>
VERCEL_PROJECT_ID=<the web project id>
```

### 3. DNS

Point the `boostmybranding.com` A record at the web project on Vercel.
That's the only DNS step. Vercel's rewrites handle the rest.

## Why this architecture?

- **One origin for cookies**. All login state works across `/`, `/portal`,
  `/dashboard`, and `/api` with no cross-origin complications.
- **Independent deploys**. A bug in the dashboard can't break the public
  marketing site. You can ship updates to each app on its own schedule.
- **Clean URLs**. Users see `boostmybranding.com/dashboard/clients` —
  not `dashboard-xyz.vercel.app/clients`.
- **Custom client domains stay separate**. When a client attaches
  `murphysplumbing.com`, the web middleware resolves that host to the
  client's slug and serves their site at `/sites/[slug]` — doesn't
  interfere with the platform paths above.

## Local development

Dev doesn't use any of the rewrite config. Each app runs on its own port:

```bash
pnpm dev
# web        → http://localhost:3000
# portal     → http://localhost:3000/portal
# dashboard  → http://localhost:3000/dashboard
# api        → http://localhost:4000
```

The `*_BASE_PATH` and `*_UPSTREAM` env vars are only read in production;
leaving them unset (as in the committed `.env`) keeps dev as before.
