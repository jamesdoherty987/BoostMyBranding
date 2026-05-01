# BoostMyBranding

AI-powered social media agency platform. Marketing site, client PWA, agency dashboard, and backend — one monorepo.

**Brand:** `#48D886` green · `#1D9CA1` teal · `#FFEC3DD` yellow · rocket wordmark

---

## Quick start

```bash
pnpm install
cp .env.example .env           # fill in as you go
pnpm --filter @boost/database db:generate
pnpm --filter @boost/database db:migrate
pnpm --filter @boost/database db:seed
pnpm dev
```

Then open:

- http://localhost:3000 — marketing site with rocket-launch hero + Stripe checkout
- http://localhost:3001 — client portal PWA (magic-link sign-in)
- http://localhost:3002 — agency dashboard (multi-user with live presence)
- http://localhost:4000/health — API health check

**Full setup guide:** [docs/SETUP.md](./docs/SETUP.md).

---

## Repo layout

```
apps/
  web/          Marketing site (Next.js 15)            → :3000
  portal/       Client PWA (Next.js 15)                → :3001
  dashboard/    Agency dashboard (Next.js 15)          → :3002
  api/          Express API + cron + SSE realtime      → :4000

packages/
  ui/           Shared components, theme, tailwind preset
  core/         Shared types, mock data, helpers
  database/     Drizzle schema, migrations, seed
  api-client/   Typed fetch wrapper used by every frontend

docs/           Setup guide, original plan, tech spec
assets/         Source logo PNG
```

---

## What's in the box

### Marketing site (`apps/web`)
- Cinematic scroll-driven rocket launch hero (the rocket literally takes off)
- Auto-scrolling post marquee showing real brand posts
- Feature grid, scroll-driven how-it-works storyboard, comparison table
- Platform support strip (Instagram, FB, LinkedIn, TikTok, X, Bluesky, Pinterest)
- Animated stats, example client websites (Verde Cafe + Murphy's Plumbing), testimonials, FAQ
- Multi-step signup wizard → Stripe Checkout → magic-link email

### Client portal PWA (`apps/portal`)
- Magic-link sign-in with HttpOnly secure cookies
- Image upload (camera + gallery + drag-drop) with per-file progress
- Tinder-style approval calendar with keyboard shortcuts & undo
- Real-time chat (Server-Sent Events)
- Onboarding wizard for new clients
- Brand settings + billing/invoices
- PWA manifest, service worker, installable

### Agency dashboard (`apps/dashboard`)
- Live presence: see teammates' avatars and what post they're reviewing
- Soft-lock on review cards so two workers never approve the same post
- Realtime updates on every action (post approvals, new messages)
- Review queue with inline caption editing, AI rewrite suggestions
- Content generator with live pipeline progress
- Scheduler, clients directory, messages inbox, analytics, websites, settings

### Backend API (`apps/api`)
- Express + Drizzle ORM + Postgres
- Magic-link auth with session rotation and safe redirect validation
- Stripe Checkout sessions, customer portal, signed webhook handlers
- Claude (Sonnet + Haiku + Vision), fal.ai (Flux Kontext Max, Flux 2 Pro)
- Cloudflare R2 uploads with local disk fallback
- ContentStudio cross-platform publishing + Resend email
- node-cron scheduler publishing due posts every minute
- Server-Sent Events for realtime presence/updates

---

## Security

Production-hardened against the OWASP Top 10 (2021):

- **A01 Access control** — role + per-resource ownership checks on every route
- **A02 Cryptography** — 32-byte random tokens stored as SHA-256 hashes; HttpOnly Secure cookies
- **A03 Injection** — Zod validation on every body; Drizzle parameterized queries
- **A04 Insecure design** — enforced post state machine, rate-limited auth, one-time magic links
- **A05 Misconfiguration** — strict CORS allowlist, helmet + CSP, no stack traces to clients
- **A06 Vulnerable components** — pnpm lockfile + `pnpm audit` in CI
- **A07 Auth failures** — session rotation on login, revoke on logout, same-origin guard
- **A08 Data integrity** — Stripe webhook signature verification
- **A09 Logging** — structured request logs with secret redaction
- **A10 SSRF** — scraper blocks private IPs, loopback, link-local, and cloud metadata hosts

---

## Scripts

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
