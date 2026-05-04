# BoostMyBranding — Product & Platform Overview

The complete reference for what this app is, what it does, how every piece fits together, and what happens from the moment a client signs up to the moment their post goes live.

---

## 1. What BoostMyBranding is

BoostMyBranding (BMB) is an AI-powered Social Media Marketing Agency platform. Local businesses pay a flat monthly fee and get a full month of on-brand content — captions, hashtags, images, and scheduling — across every major social platform.

The product is three customer-facing apps plus a backend, running as one monorepo:

- A **marketing website** that sells the service
- A **client portal PWA** where customers upload photos, approve posts, and chat
- An **agency dashboard** where the BMB team reviews, edits, and ships content
- An **API** with auth, billing, automation pipelines, and realtime updates

The whole system is designed around one principle: **the only manual step for the agency is picking the best AI drafts**. Everything else — scraping the client's website, writing the brand voice, scoring photos, enhancing images, drafting captions, matching images to posts, scheduling, cross-posting — happens automatically.

**Brand colors** (used throughout): `#48D886` primary green, `#1D9CA1` teal, `#FFEC3D` accent yellow.

---

## 2. The three apps

### 2.1 Marketing site — `apps/web` (port 3000)

The public site that drives signups. Every section was designed for a local-business owner scrolling on their phone.

**Sections on the landing page:**

1. **Launch hero** — cinematic scroll-driven rocket takeoff. Sky transitions from day → dawn → space, particles swirl, the rocket's flame scales and fades as it accelerates. Shimmer-border CTA button.
2. **Post marquee** — two rows of example client posts auto-scrolling in opposite directions, showing the volume of content the platform produces.
3. **Statement** — word-by-word scroll-reveal of a mission statement.
4. **Features bento** — six pillars in a Magic UI-style bento grid (brand voice AI, photos, 30 posts/day, chat, websites, reports) each with a unique animated decorative background.
5. **Demo storyboard** — scroll-pinned sequence walking through Monday → Tuesday → Wednesday → rest-of-month. Mobile gets a simpler vertical card stack.
6. **Integrations** — animated gradient beams connecting 7 social platform icons into a central rocket hub, showing the flow.
7. **Comparison table** — "Going it alone vs. BoostMyBranding" head-to-head across 6 dimensions.
8. **Stats panel** — number-ticker counters in the brand gradient.
9. **Example sites** — two interactive browser-frame previews (Verde Cafe + Murphy's Plumbing) demonstrating the website tier.
10. **Testimonials** — three star-rated quotes from real-looking clients.
11. **Pricing** — 3 tiers with a BorderBeam highlight on the most popular.
12. **FAQ accordion** — five short honest answers.
13. **Contact form** — short-circuit to signup or quick question, wires to API / mailto fallback.
14. **Footer**.

**Routes:**
- `/` landing
- `/signup` 4-step wizard (plan → business → confirm → done → Stripe)
- `/pricing/success` post-checkout confirmation
- `/opengraph-image` dynamic 1200×630 branded share card
- `/sitemap.xml` and `/robots.txt` generated via Next.js metadata routes
- `/not-found` and `/error` branded recovery screens

### 2.2 Client portal — `apps/portal` (port 3001)

A mobile-first PWA for the paying client. Installable on iOS/Android home screen.

**Pages:**
- `/` magic-link login
- `/onboarding` 3-step post-signup wizard (brand vibe → photo upload → done)
- `/dashboard` stats + pending posts + upcoming + latest messages
- `/upload` camera + gallery + drag-drop upload with progress, tag picker, auto-revoke of blob URLs
- `/calendar` Tinder-style swipe approval with undo + keyboard shortcuts (← reject, → approve)
- `/chat` realtime chat with the BMB team (SSE-driven, optimistic sends)
- `/settings` business info + brand colors + social account links + logout confirmation
- `/invoices` billing history

Bottom tab nav: Home · Upload · Review · Chat · You. PWA manifest, service worker, offline shell, safe-area aware on notched phones.

### 2.3 Agency dashboard — `apps/dashboard` (port 3002)

For the BMB team. Multi-user with live presence so two people can safely review at once.

**Pages:**
- `/` overview with live stats, pending queue preview, client list, and a `SystemStatus` chip showing which integrations are live
- `/clients` directory with search
- `/clients/[id]` per-client detail with tabs (posts / messages / settings)
- `/review` **the core workflow** — swipe-based approval with inline caption editing, AI rewrite shortcuts, soft-locks so teammates can see "Jamie is reviewing this"
- `/calendar` month-grid scheduler with per-day inspector
- `/generate` manual content generation with live pipeline progress bars
- `/websites` template gallery + live client sites + change-request tracker
- `/messages` two-pane inbox (drill-down on mobile)
- `/analytics` per-client sparklines and engagement stats
- `/settings` agency profile + integrations checklist

**Key UX:**
- **⌘K command palette** — jump to any client, page, or action via keyboard. Global event bus so buttons anywhere can open it.
- **Live presence** — SSE-driven avatars show teammates in real time; soft-locks prevent double-approvals.
- **Page transitions** — subtle fade-and-rise on route change.
- **Loading skeletons** — every page has placeholders while data loads.
- **Empty states** — every list has a warm "you're all set" variant.

### 2.4 API — `apps/api` (port 4000)

Express + Drizzle + Postgres + node-cron + SSE. Runs the whole system.

Route map:
- `/api/v1/auth` — `POST /send`, `GET /callback`, `GET /me`, `POST /logout`
- `/api/v1/clients` — list, create, `/me` get+patch, `/:id/onboard`
- `/api/v1/posts` — list, patch, `/:id/approve`, `/:id/reject`, `/batch-approve`
- `/api/v1/images` — list, upload (multipart), analyze, enhance, delete
- `/api/v1/messages` — list (scoped per role), send
- `/api/v1/automation` — generate, generate-all, analyze-pending, publish-due
- `/api/v1/billing` — Stripe Checkout, Stripe billing portal
- `/api/v1/webhooks` — Stripe (signed), ContentStudio
- `/api/v1/realtime/stream` — Server-Sent Events
- `/api/v1/realtime/lock` — post review lock
- `/api/v1/system/status` — which integrations are live

---

## 3. The automated pipeline — from upload to live post

Only one human decision is required end-to-end: **the agency picking the best AI drafts**. Everything else runs on its own.

```
Client uploads photos via PWA
  ↓ POST /api/v1/images/upload
  ↓ R2 upload + DB row with status=pending
  ↓ Fire-and-forget: Claude Vision analyze each image
  ↓   → quality score, mood, best platforms, caption angle
  ↓   → if needsEditing: Flux Kontext Max auto-enhances
  ↓ Broadcast image:analyzed → dashboard live updates
  ↓ Status ends at approved / enhanced / rejected

Cron fallback every 2 minutes
  ↓ analyzePendingImages() — picks up anything that slipped through

Monthly cron on the 1st at 09:00 UTC
  ↓ generateMonthlyBatches()
  ↓   for each active client (skip website_only):
  ↓     runMonthlyGeneration({ postsCount: 30 })
  ↓       1. scrape_site  — Jina Reader → Claude brand voice doc (cached on client)
  ↓       2. fetch_images — up to 30 most recent usable images
  ↓       3. analyze_images — catch any un-scored images
  ↓       4. enhance_images — Flux Kontext Max for flagged photos
  ↓       5. generate_calendar — Claude Sonnet drafts N posts
  ↓       6. persist_posts — with Flux 2 Pro gap-fill images, status=pending_internal
  ↓   notifyAgencyBatchReady() — emails the BMB admins

Agency pre-reviews batch in dashboard
  ↓ swipe approve/reject, optional inline caption edits
  ↓ PATCH /api/v1/posts/:id/approve
  ↓   agency on pending_internal → pending_approval (kicks to client)
  ↓ notifyClientPostsAwaiting() — emails client portal link

Client approves in portal
  ↓ PATCH /api/v1/posts/:id/approve → scheduled (with scheduledAt)

Cron every minute
  ↓ publishDue()
  ↓   SELECT posts WHERE status='scheduled' AND scheduledAt ≤ now
  ↓   for each: publishing → ContentStudio API (retry 3x) → published
  ↓   failures set status=failed with the error for the dashboard
```

**State machine on `posts`:**

```
draft → pending_internal → pending_approval → scheduled → publishing → published
                                           ↘ rejected
                                                       ↘ failed (with error)
```

---

## 4. Integrations

| Service         | Env var(s)                                   | What it powers                                  | Mock fallback |
| --------------- | -------------------------------------------- | ----------------------------------------------- | ------------- |
| Postgres        | `DATABASE_URL`                               | All persistent data                             | In-memory     |
| Claude (Anthropic) | `ANTHROPIC_API_KEY`                       | Brand voice, captions, Vision scoring           | Mock strings  |
| fal.ai          | `FAL_KEY`                                    | Flux Kontext Max (edit), Flux 2 Pro (generate)  | Picsum URLs   |
| Cloudflare R2   | `R2_*` (5 vars)                              | Image uploads                                   | Local disk    |
| Stripe          | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Subscription billing + customer portal | Fake URLs     |
| Resend          | `RESEND_API_KEY`, `FROM_EMAIL`               | Magic-link + transactional email                | Console logs  |
| ContentStudio   | `CONTENTSTUDIO_API_KEY`, `CONTENTSTUDIO_WORKSPACE_ID` | Cross-platform publishing             | Skips POST    |
| Jina Reader     | none needed                                  | Website scraping for brand voice                | Empty text    |

Every integration has a graceful mock fallback — the whole app runs end-to-end with zero API keys. Add them one at a time as you get access.

The dashboard's `SystemStatus` pill shows which of these are live at a glance.

---

## 5. Repo layout

```
boostmybranding/
├── README.md                  quick start
├── .env / .env.example        configuration
│
├── apps/
│   ├── web/                   marketing site (Next.js 15)
│   │   ├── app/               routes: /, /signup, /pricing/success
│   │   ├── components/        15 landing sections + navbar + footer
│   │   └── public/logo/       rocket PNG
│   │
│   ├── portal/                client PWA (Next.js 15)
│   │   ├── app/               routes: login, onboarding, dashboard, upload,
│   │   │                      calendar, chat, settings, invoices
│   │   ├── components/        BottomNav, Shell, SwipeCard
│   │   ├── lib/               api client wrapper
│   │   └── public/            manifest.json, sw.js, PWA icons
│   │
│   ├── dashboard/             agency dashboard (Next.js 15)
│   │   ├── app/               11 routes incl. review, generate, calendar,
│   │   │                      messages, analytics, settings, clients/[id]
│   │   ├── components/        Sidebar, PageHeader, Commander, SystemStatus
│   │   └── lib/               api client wrapper
│   │
│   └── api/                   backend (Express)
│       └── src/
│           ├── index.ts       entry + middleware
│           ├── env.ts         typed + prod-validated env loader
│           ├── routes/        auth, clients, posts, images, messages,
│           │                  automation, billing, webhooks, realtime, system
│           ├── middleware/    rateLimit, logger, security (CORS + CSP)
│           └── services/      auth, claude, fal, r2, stripe, resend,
│                              contentStudio, scraper, automation,
│                              scheduler (crons), realtime (SSE),
│                              notifications, retry, prompts
│
├── packages/
│   ├── ui/                    shared UI library
│   │   └── src/
│   │       ├── button, card, input, badge, dialog, kbd, spinner
│   │       ├── toast, skeleton, empty-state, error-boundary
│   │       ├── logo (rocket), aurora-bg, parallax
│   │       ├── animated-counter, number-ticker, text-reveal
│   │       ├── particles, border-beam, retro-grid, orbit, animated-beam
│   │       ├── shimmer-button, bento-grid
│   │       ├── page-transition, command-palette
│   │       ├── api-provider, realtime (SSE hooks)
│   │       ├── theme.ts       brand tokens
│   │       ├── styles.css     tailwind + keyframes
│   │       └── tailwind-preset.cjs, postcss-preset.cjs
│   │
│   ├── core/                  shared types + mock fixtures + helpers
│   │   └── src/
│   │       ├── types.ts       Client, Post, Message, Image, helpers
│   │       ├── mock.ts        demo dataset
│   │       └── index.ts       formatCurrency, timeAgo, postImageUrl, ...
│   │
│   ├── database/              Drizzle ORM
│   │   └── src/
│   │       ├── schema.ts      12 tables with enums + indexes
│   │       ├── migrate.ts     CLI migrator
│   │       ├── seed.ts        demo data seeder
│   │       └── index.ts       getDb() + isDbConfigured()
│   │
│   └── api-client/            typed fetch wrapper shared by all frontends
│       └── src/index.ts       every API method as a typed function
│
├── docs/
│   ├── OVERVIEW.md            this file
│   ├── SETUP.md               install + deploy guide
│   └── SMMA_*                 original planning docs
│
├── assets/
│   └── rocket-logo.png        source logo
│
├── turbo.json, pnpm-workspace.yaml, tsconfig.base.json
```

---

## 6. Database schema (summary)

12 tables, all in `packages/database/src/schema.ts`.

| Table                | What it stores                                                 |
| -------------------- | -------------------------------------------------------------- |
| `users`              | Identity records — agency + client users                       |
| `magic_links`        | One-time sign-in tokens (hashed, TTL'd, single-use)            |
| `sessions`           | Active session tokens (hashed, 30-day TTL)                     |
| `clients`            | The paying businesses                                          |
| `client_images`      | Every uploaded photo with AI scoring + enhanced URL            |
| `content_batches`    | Each monthly generation run with timing + cost                 |
| `posts`              | Individual social posts (caption, image, platform, schedule)   |
| `messages`           | Client ↔ agency chat                                           |
| `website_requests`   | Client change requests for website tier                        |
| `invoices`           | Billing history mirrored from Stripe                           |
| `cron_runs`          | Audit log of every background job run                          |

Role enum on `users`: `agency_admin`, `agency_member`, `client`. Access control throughout enforces that clients can only see their own data.

---

## 7. Security posture (OWASP Top 10)

| Category | Defense |
| -------- | ------- |
| **A01 Access Control** | Per-route role guards + per-resource ownership checks. Clients can only see their own posts/images/messages. |
| **A02 Cryptographic Failures** | Magic-link tokens are 32 random bytes stored as SHA-256 hashes. Sessions use HttpOnly + Secure + SameSite cookies. |
| **A03 Injection** | Zod validates every body with length caps. Drizzle produces parameterized queries throughout. |
| **A04 Insecure Design** | Enforced post state machine in validation. One-time magic links with conditional update prevent reuse races. |
| **A05 Security Misconfiguration** | CORS allowlist from env. Helmet + custom CSP. `X-Frame-Options: DENY`, HSTS in prod. No stack traces to clients. |
| **A06 Vulnerable Components** | `pnpm audit --prod` returns zero vulnerabilities. Critical overrides pinned in root `package.json`. |
| **A07 Authentication Failures** | Session rotation on login, `revokeSession()` on logout, rate-limited `/auth/send`, safe-redirect validation. |
| **A08 Data Integrity** | Stripe webhooks verified by signature. No `eval`, no dynamic `require`. |
| **A09 Logging** | Structured request logger with secret redaction (tokens in query strings become `[redacted]`). |
| **A10 SSRF** | Scraper blocks private IPs, loopback, link-local, cloud metadata hostnames, `.local`/`.internal` TLDs. |

Production env check refuses to boot if `AUTH_SECRET` is still the dev default or if `STRIPE_WEBHOOK_SECRET` isn't set.

---

## 8. Realtime layer

Server-Sent Events (no WebSocket, no external service needed — works through every proxy).

Events flowing through `/api/v1/realtime/stream`:

| Event              | When it fires                      | Who listens                 |
| ------------------ | ---------------------------------- | --------------------------- |
| `presence:snapshot`| On connect                         | Dashboard sidebar + review  |
| `presence:join`    | Teammate opens dashboard           | Same                        |
| `presence:leave`   | Teammate disconnects               | Same                        |
| `presence:lock`    | Teammate starts reviewing a post   | Review queue (shows lock)   |
| `presence:unlock`  | Teammate finishes / navigates away | Review queue                |
| `post:updated`     | Any post mutation                  | Review queue, calendar, overview |
| `post:batch-updated` | Batch approve fires              | Same                        |
| `message:new`      | New chat message                   | Portal chat, dashboard messages |
| `image:uploaded`   | Client uploads photos              | Dashboard                   |
| `image:analyzed`   | Claude Vision finishes             | Dashboard                   |
| `batch:started`    | AI generation begins               | Generate page               |
| `batch:ready`      | AI generation finishes             | Overview + review queue     |

Client-side reconnects with exponential backoff (1s → 30s max) and resets on tab visibility change.

---

## 9. Stripe billing

Three tiers with live + test prices:

| Tier          | Price        | Setup | Includes                                        |
| ------------- | ------------ | ----- | ----------------------------------------------- |
| Social Only   | €700/mo      | —     | 30 posts, 4 platforms, AI brand voice, portal   |
| Full Package  | €800/mo      | €800  | Social + custom website + unlimited changes     |
| Website Only  | €150/mo      | €800  | Custom website + hosting + monthly tweaks       |

**Signup flow:** `/signup` wizard → `POST /api/v1/billing/checkout` → Stripe Checkout → webhook `checkout.session.completed` activates client.

**Webhook events handled:**
- `checkout.session.completed` → marks client active + stores `stripeCustomerId`/`stripeSubscriptionId`
- `invoice.paid` → upserts into `invoices` table
- `customer.subscription.deleted` → deactivates client

Customer portal linked for self-serve billing changes.

---

## 10. UX principles (what you'll see repeated)

1. **Mobile-first, thumb-friendly.** 44px minimum tap target on coarse pointers. Safe-area-aware sticky bars. No iOS zoom-on-tap (`no-zoom` class on inputs).
2. **Progress over spinners.** Every async step has a concrete indicator — skeleton rows, animated pipeline stages, upload progress bars.
3. **Optimistic UI with rollback.** Approvals, chat sends, and toggles update immediately and revert on failure with a toast.
4. **Empty states are warm, not empty.** Every list has a "queue's clear 🎉" variant, not a blank white space.
5. **Keyboard-first on desktop.** ⌘K palette, ←/→ swipe, ⌘Z undo, Esc to close dialogs.
6. **Consistent radii, shadows, gradients.** Always `rounded-2xl` for cards, `rounded-xl` for interactive inputs. Primary CTA always uses `bg-gradient-cta` with `shadow-brand`.
7. **Motion respects reduced-motion.** Every animated component collapses gracefully under `prefers-reduced-motion: reduce`.
8. **Accessibility**: proper focus rings, `aria-label`s on every icon button, `role="dialog"` with focus trap, color contrast above AA throughout.

---

## 11. Technology stack

**Frontend**
- Next.js 15 (App Router, RSC)
- React 19
- Tailwind CSS 3.4 with shared preset (`@boost/ui/tailwind-preset`)
- Framer Motion 11
- Lucide icons
- SWR for data fetching
- Server-Sent Events for realtime
- PWA (portal only — manifest + service worker)

**Backend**
- Node 20+
- Express 4
- Drizzle ORM 0.45
- Postgres 14+
- node-cron for scheduled jobs
- Zod for validation
- helmet + CORS allowlist
- Multer for multipart uploads
- Anthropic SDK, fal.ai SDK, Stripe SDK, AWS SDK (for R2), Resend SDK

**Tooling**
- pnpm 9 workspaces
- Turborepo 2
- TypeScript 5.6 (strict)
- ESLint + Prettier

---

## 12. Feature checklist

### Marketing site
- ✅ Rocket launch scroll-driven hero
- ✅ Auto-scrolling post marquee
- ✅ Text-reveal mission statement
- ✅ Bento feature grid
- ✅ Scroll-pinned weekly demo storyboard
- ✅ Animated-beam integrations hub
- ✅ DIY vs. BMB comparison table
- ✅ Animated stats with number ticker
- ✅ Two interactive example client sites
- ✅ Testimonials
- ✅ Pricing with BorderBeam on most popular
- ✅ FAQ accordion
- ✅ Contact form with validation + mailto fallback
- ✅ Dynamic OG image
- ✅ sitemap.xml + robots.txt
- ✅ 4-step signup wizard → Stripe
- ✅ Post-checkout success page
- ✅ Branded 404 + error pages

### Client portal
- ✅ Magic-link sign-in
- ✅ 3-step post-signup onboarding
- ✅ Dashboard with pending / upcoming / messages
- ✅ Photo upload (camera + gallery + drag-drop) with progress
- ✅ Tinder-style swipe approval with undo
- ✅ Keyboard shortcuts (arrows, ⌘Z)
- ✅ Real-time chat (SSE)
- ✅ Settings (industry / website / social accounts / logout confirmation)
- ✅ Invoices with Stripe portal link
- ✅ Branded 404 + error pages
- ✅ PWA manifest + service worker + installable
- ✅ Safe-area aware bottom nav
- ✅ Mobile toast positioning (top on mobile, bottom-right on desktop)

### Agency dashboard
- ✅ Overview with stats, pending queue, client list
- ✅ System status pill (which integrations live)
- ✅ ⌘K command palette for instant navigation
- ✅ Live presence (see teammate avatars)
- ✅ Post soft-locks ("Jamie is reviewing this")
- ✅ Review queue with swipe + inline caption edit
- ✅ Clients directory with search
- ✅ Per-client detail page (posts / messages / settings tabs)
- ✅ Scheduler (month grid, day inspector)
- ✅ Generate page with live pipeline progress
- ✅ Websites (template picker + live sites + change requests)
- ✅ Multi-client message inbox (drill-down on mobile)
- ✅ Per-client analytics with sparklines
- ✅ Settings with integrations checklist
- ✅ Branded 404 + error pages
- ✅ Page transitions
- ✅ Loading skeletons throughout

### Backend API
- ✅ Magic-link auth with HttpOnly cookies
- ✅ Session rotation + revoke
- ✅ Role + ownership middleware
- ✅ Full CRUD for clients, posts, images, messages
- ✅ Multipart image uploads to R2 (or local fallback)
- ✅ Rate limiting (general / auth / upload)
- ✅ Helmet + CSP + CORS allowlist + same-origin guard
- ✅ SSRF protection on scraper
- ✅ Stripe Checkout + billing portal + signed webhooks
- ✅ Claude integration (Sonnet + Haiku + Vision) with retry
- ✅ fal.ai integration (Flux Kontext Max + Flux 2 Pro) with retry
- ✅ Cloudflare R2 with presigned URLs
- ✅ Resend email with branded templates
- ✅ ContentStudio publishing with retry
- ✅ Jina Reader scraping with SSRF guard
- ✅ node-cron: publish-due, analyze-pending, monthly batch
- ✅ SSE realtime with reconnect
- ✅ Structured logging with secret redaction
- ✅ Graceful shutdown
- ✅ Production env validation (refuses to boot with dev defaults)

### Automation
- ✅ Auto-analyze on image upload (fire-and-forget)
- ✅ Cron fallback analyzer every 2 minutes
- ✅ Auto-enhance flagged images via Flux Kontext
- ✅ Monthly content generation on the 1st at 09:00 UTC
- ✅ Idempotent batches (skip if already generated)
- ✅ Auto-notification to agency when batch is ready
- ✅ Auto-notification to client when agency pre-approves
- ✅ Auto-publish on schedule via ContentStudio
- ✅ Retry with exponential backoff on every upstream call
- ✅ Failed posts surface in dashboard with error message

### Security
- ✅ All 10 OWASP Top 10 categories addressed
- ✅ Zero known dependency vulnerabilities
- ✅ CSRF via same-origin guard
- ✅ SSRF via DNS + IP allowlist
- ✅ Production config validation on boot

---

## 13. What's not in the app yet

Things deliberately left for later:
- **Instagram / TikTok direct API publishing** — we route through ContentStudio for now (simpler OAuth story)
- **Video content / Reels** — Remotion was scoped as Phase 6
- **Multi-language brand voices** — currently English
- **Client-side analytics dashboard** — the portal has no dedicated analytics view, only the agency dashboard does
- **Mobile app stores** — portal is a PWA; no native iOS/Android builds
- **White-label / multi-tenant** — single agency per deployment
- **Custom domain per client website** — template system exists but not yet auto-deploy to Vercel

---

## 14. How to run it

See `docs/SETUP.md` for the full guide. Shortest path:

```bash
# 1. Postgres (Docker)
docker run -d --name bmb-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=boostmybranding \
  postgres:16

# 2. Install + seed
pnpm install
cp .env.example .env
pnpm --filter @boost/database db:generate
pnpm --filter @boost/database db:migrate
pnpm --filter @boost/database db:seed

# 3. Run everything
pnpm dev
```

Open:
- http://localhost:3000 — marketing site
- http://localhost:3000/portal — client portal
- http://localhost:3000/dashboard — agency dashboard
- http://localhost:4000/health — API

Every integration is optional — the app runs end-to-end with zero API keys, using mock data where upstream services would normally reply. Add keys as you get them (see `docs/SETUP.md` for each provider's step-by-step).
