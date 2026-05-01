# SMMA Automation Business — Full Build Plan

## Overview

This document covers the complete plan for building an automated Social Media Marketing Agency (SMMA) with three integrated projects:

1. **SMMA Social Media Automation Pipeline** — AI-powered content generation and publishing
2. **Client Website Builder** — Reusable Next.js component system for client sites
3. **Client Portal PWA** — Mobile app for clients to upload images, chat, and approve posts

---

## Competitors & Inspiration

| Company | What They Do | Pricing | URL |
|---|---|---|---|
| Native.no | Scrapes website, generates + auto-publishes posts | ~$45/mo | https://native.no |
| Predis.ai | Full post generation from single prompt — text, images, carousels, video | From $32/mo | https://predis.ai |
| Ocoya | AI content creation + scheduling + e-commerce integration | From $19/mo | https://ocoya.com |
| Postly.ai | AI auto-post with prompt queues, recurring workflows | From $15/mo | https://postly.ai |
| ContentStudio | Full platform with AI studio, white-label, API for n8n/Make | From $25/mo | https://contentstudio.io |
| MixBloom | White-label agency — they do the content, you resell | Custom | https://mixbloom.com |
| FeedHive | Content recycling, conditional posting, AI writing | From $19/mo | https://feedhive.com |
| Buffer | Simple scheduling + AI assistant for tailoring per platform | From $6/channel | https://buffer.com |
| Lately.ai | Learns brand voice from past content, generates posts | Custom | https://lately.ai |

---

## How Native.no Works (The Model to Follow)

1. Client provides their website URL
2. AI scrapes/reads the website to understand brand, industry, competitors
3. AI analyzes and generates a tailored content plan with posts for each channel
4. Client reviews/approves posts
5. Posts auto-publish on schedule across all platforms

Key insight: They don't create from scratch. They read the website, extract what makes the business unique, and generate posts from that. It's a scrape → LLM → schedule → publish pipeline.

Supported platforms: Facebook, Instagram, LinkedIn, X (Twitter), TikTok, Bluesky, Pinterest, Reddit, Stories

---

## What is a Brand Voice?

Brand voice is the consistent personality and tone a company uses in all communication. Think of it as "if this company were a person, how would they talk?"

Examples:
- **Luxury spa:** Calm, elegant, minimal words. "Restore. Renew. Return to yourself."
- **Plumber:** Direct, friendly, no-nonsense. "Pipe burst at 2am? We're on it. Call now."
- **Tech startup:** Casual, clever, slightly nerdy. "We just shipped the feature you didn't know you needed."

For the SMMA, capture this during onboarding by scraping the client's website and having Claude generate a brand voice document. Then include it in every prompt when generating content for that client.

---

## LLM Comparison for Social Media Content

| Model | Strength | Price (per 1M tokens in/out) | Best For |
|---|---|---|---|
| **Claude Sonnet 4.6** | Best brand voice matching, nuanced writing | $3 / $15 | Main workhorse — 80% of content |
| **Claude Haiku 4.5** | Fast, cheap, good enough for simple posts | $1 / $5 | Hashtags, reformatting, simple captions |
| **GPT-4o** | Broadest ecosystem, good all-rounder | $2.50 / $10 | Alternative if you want OpenAI tools |
| **Gemini 2.5 Flash** | Cheapest, great for structured content | ~$0.15 / $0.60 | Budget option, bulk generation |

**Recommendation:** Use Claude Sonnet 4.6 as primary. Use Haiku for simple tasks like hashtags and reformatting. The quality difference between Opus and Sonnet for social media copy is marginal — Sonnet is the sweet spot.

### Cost Saving Tips
- **Prompt caching** — saves up to 90% on repeated system prompts (brand voice docs)
- **Batch API** — 50% cheaper for non-real-time work (generating a month of content at once)
- **Haiku for simple tasks** — 3x cheaper than Sonnet for hashtags, reformatting

---

## Image Generation & Editing Tools

| Tool | Best For | Price per Image | Notes |
|---|---|---|---|
| **Flux 2 Pro** | Photorealistic images, product shots | ~$0.03-0.05 | Top tier quality |
| **Flux Kontext Max** | Editing real photos (background swap, enhancement) | ~$0.08 | Keeps real product, changes surroundings |
| **Flux Kontext Pro** | Lighter edits, multi-image reference | ~$0.04 | Good for batch processing |
| **Flux 2 Schnell** | Fast, cheap bulk generation | ~$0.003 | Good enough for stories |
| **Ideogram v3** | Text on images (quotes, announcements) | ~$0.04-0.08 | Best text rendering |
| **Nano Banana** | Free edits, quick mockups | Free | Decent, Gemini-powered |
| **Canva Pro** | Templates + brand kits | $13/mo | Most practical for agency work |

**Recommendation:** Use client photos as primary (60-70% of posts). Flux Kontext Max for enhancing client photos. Flux 2 Pro for generating gap-fill images. Ideogram v3 for text overlays.

### Claude Vision vs Google Cloud Vision

Claude Vision is what you want for 90% of the work. It understands context, mood, composition, and can write captions and make creative decisions. Google Cloud Vision returns raw labels/tags — useful for bulk pre-filtering at scale but not needed to start.

---

## Image Management Pipeline

### How to Handle Monthly Client Image Batches

```
Client drops 20 images in shared folder
            │
            ▼
    ┌─────────────────────┐
    │  Claude Vision       │  Analyze each image:
    │  (Sonnet 4.6)        │  - Quality score (1-10)
    │                      │  - What's in it
    │                      │  - Best platform fit
    │                      │  - Edit suggestions
    └──────────┬──────────┘
               │
        ┌──────┴──────┐
        │             │
    Score 7+      Score 4-6         Score <4
    (12 images)   (5 images)        (3 images)
        │             │                 │
        ▼             ▼                 ▼
   Use as-is     Send to Flux       REJECT
   (maybe crop)  Kontext for:       (notify client)
                 - Background fix
                 - Lighting fix
                 - Scene placement
                 │
                 ▼
         Enhanced images
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
 17 usable images        Need 13 more posts
 matched to posts        but no images fit
    │                         │
    │                         ▼
    │                  Flux 2 Pro generates
    │                  images using product
    │                  descriptions from
    │                  Claude Vision analysis
    │                         │
    └────────────┬────────────┘
                 ▼
        30 posts with images
        ready for approval
```

### Image Analysis Prompt

```
Analyze this image for social media suitability. Return JSON:
{
  "quality_score": 1-10,
  "usable": true/false,
  "issues": ["blurry", "bad lighting", "cluttered background", etc],
  "subject": "what's in the image",
  "mood": "professional/casual/energetic/warm/etc",
  "best_platforms": ["instagram_feed", "story", "linkedin", "tiktok_cover"],
  "suggested_crop": "portrait/landscape/square",
  "caption_angle": "suggested content angle for this image",
  "needs_editing": true/false,
  "editing_suggestions": ["brighten", "crop tighter", "remove background"]
}
```

---

## Website Scraping

### Will Firecrawl/Jina Reader work on all websites?

Works on most sites (~80%), especially standard business websites (WordPress, Wix, Squarespace, Shopify) — exactly the kind of sites SMMA clients have. Sometimes blocked by aggressive Cloudflare bot protection or heavy JavaScript SPAs.

**For this use case it barely matters.** You're scraping clients' own websites with their permission, once during onboarding. If a scrape fails, ask the client to send their website copy in a doc.

**Recommendation:** Use Jina Reader (free) first — just prepend `r.jina.ai/` to any URL. If it fails, try Firecrawl. If both fail, use a brand questionnaire instead.

---

## RECOMMENDED TECH STACK (Full Decision)

### Why NOT Use the Same Stack as the AI Receptionist Project

The current AI Receptionist project uses Python (Flask) + Starlette + raw psycopg2 + vanilla CSS. That stack was chosen for real-time voice AI — low-level WebSocket control, audio streaming, telephony webhooks. The SMMA project is fundamentally different: it's a CRUD app with image uploads, content calendars, chat, and scheduled automation. Different problem, different stack.

### Current Project Stack vs Recommended SMMA Stack

| Layer | AI Receptionist (Current) | SMMA (Recommended) | Why Change |
|---|---|---|---|
| Frontend | React 18 + Vite + vanilla CSS | Next.js 14 + Tailwind CSS | SSR for SEO, Tailwind is 5x faster to style, file-based routing |
| Animations | Manual IntersectionObserver + CSS | Framer Motion | Cleaner code, spring physics, scroll-linked animations |
| Backend | Python Flask + Starlette | Node.js (Express or Next.js API routes) | Same language as frontend, simpler deployment, better for CRUD |
| Database | Raw psycopg2 (PostgreSQL) | Prisma ORM + PostgreSQL (on Render) | Type-safe queries, migrations, no raw SQL |
| Auth | Custom sessions + signed tokens | NextAuth.js or Lucia Auth | Battle-tested, magic links built-in, OAuth ready |
| File Storage | Cloudflare R2 (custom code) | Cloudflare R2 (via S3-compatible SDK) | Keep R2 — you already know it, it's cheap |
| Real-time | N/A | Socket.io or Pusher (for chat) | Simple real-time chat without building from scratch |
| Hosting | Render | Render (backend) + Vercel (frontend) | Vercel is free for frontends, Render for backend/DB |

### The Recommended Stack in Detail

**Frontend (all 3 projects: SMMA site, client sites, client portal)**
```
Framework:        Next.js 15 (App Router) — the default for new projects in 2026
Language:         TypeScript (catches bugs, better AI code generation)
Styling:          Tailwind CSS v4
Animations:       Framer Motion (now called "Motion")
UI Components:    shadcn/ui (free, copy-paste, customizable)
State Management: React Query (TanStack Query) — you already use this
Forms:            React Hook Form + Zod validation
Charts:           Recharts — you already use this
Icons:            Lucide React (free, tree-shakeable)
```

**Backend (API + automation)**
```
Runtime:          Node.js 22 LTS
Framework:        Next.js API routes (for portal) + Express.js (for automation server on Render)
ORM:              Drizzle ORM (replaced Prisma — faster, lighter, no code generation step)
Database:         PostgreSQL on Render ($6/mo)
Auth:             Better Auth (replaced NextAuth — TypeScript-first, modern, framework-agnostic)
File Storage:     Cloudflare R2 (S3-compatible, cheap)
Real-time Chat:   Socket.io (self-hosted on Render) or Pusher ($0 free tier)
Cron Jobs:        node-cron (in-process) or Render Cron Jobs
Email:            Resend ($0 free tier, 3000 emails/mo)
Payments:         Stripe
```

**Automation Pipeline**
```
Orchestration:    Node.js scripts with node-cron (or Render Cron Jobs)
LLM:              Claude API (Anthropic SDK for Node.js)
Vision:           Claude Vision API
Image Editing:    Flux Kontext Max via fal.ai (Node.js SDK)
Image Generation: Flux 2 Pro via fal.ai
Text on Images:   Ideogram v3 API
Scheduling:       ContentStudio API
```

### Changes from Original Recommendation (After Research)

1. **Drizzle ORM instead of Prisma** — Drizzle has become the default for new projects in 2026. It's faster, lighter (no Rust binary), no code generation step, works at the edge, and gives you SQL-level control with full TypeScript type safety. Prisma 7.0 improved but Drizzle is the better fit for a new project.

2. **Better Auth instead of NextAuth** — Lucia Auth was deprecated in 2025. NextAuth (now Auth.js v5) works but has a complex API. Better Auth is the modern replacement — TypeScript-first, framework-agnostic, built-in magic links, 300%+ growth in 2026. It's what most new Next.js projects use now.

3. **Next.js 15 instead of 14** — Next.js 15 is stable and current. No reason to start on 14.

### Why This Stack

1. **One language everywhere.** JavaScript/TypeScript for frontend AND backend. No context-switching between Python and JS. Faster development.

2. **Next.js gives you everything.** File-based routing, API routes (no separate backend needed for simple endpoints), SSR for SEO (your SMMA landing page needs to rank on Google), image optimization, built-in PWA support.

3. **Tailwind CSS is 5x faster than vanilla CSS.** Your current Landing.css is 4,200 lines. With Tailwind, that same page would be ~200 lines of JSX with utility classes. No more naming CSS classes, no more switching between files.

4. **Prisma ORM eliminates raw SQL.** Your current project has raw psycopg2 queries everywhere. Prisma gives you type-safe queries, automatic migrations, and a visual database browser. Way less error-prone.

5. **shadcn/ui gives you beautiful components for free.** Buttons, modals, dropdowns, tabs, forms — all pre-built, accessible, and customizable. No more building UI primitives from scratch.

6. **You already know React.** The frontend is the same mental model — just with better tooling around it.

### What to Keep from the Current Project

- **React Query** — you already use it, it's great for data fetching
- **Recharts** — keep it for analytics dashboards
- **Cloudflare R2** — keep it for file storage, it's cheap and you know it
- **Render** — keep it for backend hosting
- **The design sensibility** — your Landing.jsx shows you can build impressive UIs. Bring that taste to the new project, just with better tools.

### Client Websites: Same Stack or Different?

**Client websites use the SAME Next.js + Tailwind + Framer Motion stack** but as static sites (SSG). Here's the key distinction:

| Project | Rendering | Backend | Database | Hosting |
|---|---|---|---|---|
| Your SMMA website | SSG (static) | None needed | None | Vercel (free) |
| Client websites | SSG (static) | None needed | None | Vercel (free) |
| Client portal PWA | SSR + client-side | Yes (API routes + Render) | PostgreSQL on Render | Vercel (free) |
| Automation pipeline | N/A (scripts) | Yes (Express on Render) | PostgreSQL on Render | Render ($7/mo) |

Client websites are **static marketing sites** — they get built at deploy time and served as plain HTML/CSS/JS from Vercel's CDN. No server, no database, no backend. They use the same component library (shadcn/ui, Tailwind, Framer Motion) but export as static HTML via `next export` or Next.js static generation.

This means:
- Zero hosting cost per client site (Vercel free tier)
- Lightning fast (served from CDN)
- Great SEO (pre-rendered HTML)
- Same components you use for your own site — just different content/colors/images

The client portal and automation pipeline are the only parts that need a backend and database.

### Alternative: Python Backend (If You Prefer)

If you'd rather stick with Python for the backend (since you're comfortable with it), here's the adjusted stack:

```
Backend:          FastAPI (modern, async, auto-docs) instead of Flask
ORM:              SQLAlchemy 2.0 + Alembic (migrations)
Everything else:  Same as above
```

FastAPI is a significant upgrade over Flask — it's async by default, has automatic OpenAPI docs, and type validation built in. But Node.js is still my top recommendation because one language across the whole project is a huge productivity win.

### Monorepo Structure

```
smma/
├── apps/
│   ├── web/                    # Your SMMA marketing website (Next.js)
│   ├── portal/                 # Client portal PWA (Next.js)
│   └── api/                    # Backend API (Express or Next.js API routes)
│
├── packages/
│   ├── ui/                     # Shared UI components (shadcn/ui based)
│   ├── database/               # Prisma schema + client
│   └── automation/             # Content generation pipeline
│
├── prisma/
│   └── schema.prisma           # Database schema
│
├── package.json                # Root workspace config
└── turbo.json                  # Turborepo config (optional, for monorepo builds)
```

This monorepo approach means shared components, shared database types, and shared utilities across all three apps. Change the Prisma schema once, all apps get the updated types.

---

## PROJECT 1: SMMA Social Media Automation Pipeline

### Tech Stack

| Tool | Role | Cost |
|---|---|---|
| n8n (self-hosted) or Python scripts | Workflow orchestration | Free (self-hosted) |
| Claude API (Sonnet 4.6) | Content writing, image analysis, brand voice | Pay per token |
| Claude API (Haiku 4.5) | Hashtags, reformatting, simple tasks | Pay per token |
| Flux Kontext Max (via fal.ai) | Image editing (keep product, change background) | $0.08/image |
| Flux 2 Pro (via fal.ai) | Image generation from scratch | $0.03-0.05/image |
| Ideogram v3 | Text overlay on images | $0.04-0.08/image |
| ContentStudio | Scheduling + publishing to all platforms | $50-70/mo |
| Supabase | Database + file storage | Free tier |
| Jina Reader / Firecrawl | Website scraping for onboarding | Free / $19/mo |
| Canva Pro | Template-based designs with brand kits | $13/mo |

### File Structure

```
smma-automation/
├── package.json
├── .env                              # API keys
│
├── src/
│   ├── onboarding/
│   │   ├── scrape-website.js         # Jina Reader → clean markdown
│   │   ├── generate-brand-voice.js   # Claude: website markdown → brand voice doc
│   │   └── store-client-profile.js   # Save to Supabase
│   │
│   ├── image-pipeline/
│   │   ├── analyze-images.js         # Claude Vision: score, describe, categorize
│   │   ├── enhance-images.js         # Flux Kontext: background swap, lighting fix
│   │   ├── generate-images.js        # Flux 2 Pro: create from scratch when needed
│   │   └── text-overlay.js           # Ideogram v3: quote graphics, announcements
│   │
│   ├── content-pipeline/
│   │   ├── generate-calendar.js      # Claude: brand voice + images → 30 posts
│   │   ├── format-per-platform.js    # Claude Haiku: reformat for IG/LinkedIn/TikTok/X
│   │   ├── generate-hashtags.js      # Claude Haiku: platform-specific hashtags
│   │   └── match-images-to-posts.js  # Claude: assign best image to each post
│   │
│   ├── publishing/
│   │   ├── schedule-posts.js         # ContentStudio API: schedule all posts
│   │   ├── publish-webhook.js        # Handle approval callbacks
│   │   └── analytics-report.js       # Pull engagement stats, generate monthly report
│   │
│   ├── prompts/
│   │   ├── brand-voice-generator.txt
│   │   ├── image-analyzer.txt
│   │   ├── content-calendar.txt
│   │   ├── platform-formatter.txt
│   │   └── monthly-report.txt
│   │
│   └── utils/
│       ├── claude-client.js          # Wrapper for Claude API with caching
│       ├── fal-client.js             # Wrapper for fal.ai (Flux) API
│       ├── supabase-client.js        # DB + file storage
│       └── contentstudio-client.js   # Scheduling API wrapper
│
├── workflows/                        # n8n workflow JSON exports (if using n8n)
│   ├── monthly-content-generation.json
│   ├── image-processing.json
│   └── auto-publish.json
│
└── scripts/
    ├── onboard-client.js             # CLI: onboard new client
    ├── run-monthly.js                # CLI: generate month of content for a client
    └── run-all-clients.js            # CLI: batch run for all clients
```

### The Core n8n / Automation Workflow

```
Trigger (monthly schedule or webhook)
  → Receive client images (Google Drive / Dropbox / Portal upload)
  → Claude Vision: analyze each image, generate descriptions
  → Claude: generate 30 posts using brand profile + image descriptions
  → Format posts per platform (IG caption vs LinkedIn vs TikTok script)
  → Push to ContentStudio / approval dashboard
  → On approval → auto-publish via ContentStudio API
```

---

## PROJECT 2: Client Website Builder

### Tech Stack

| Tool | Role | Cost |
|---|---|---|
| Next.js 14 (App Router) | Framework | Free |
| Tailwind CSS | Styling | Free |
| Framer Motion | Animations (parallax, scroll reveals) | Free |
| Formspree | Contact forms | Free tier |
| Cal.com or Calendly | Booking widget embed | Free tier |
| Google Maps embed | Map (no API key needed) | Free |
| Vercel | Hosting | Free tier ($0/site) |
| Namecheap | Domain registration | ~$10/yr per domain |

### Important: No Backend Needed for Client Sites

- **Calendar booking:** Embed Cal.com (free) or Calendly widget — one line of code
- **Google Maps:** Simple iframe embed, no API key needed
- **Contact forms:** Formspree (free) or Resend — no backend
- **These are marketing/brochure sites.** Static content + third-party embeds.

### File Structure

```
client-site-template/
├── package.json
├── next.config.js
├── tailwind.config.js
├── vercel.json
│
├── config/
│   └── site-config.json              # THE KEY FILE — all client-specific data
│
├── public/
│   ├── images/                        # Client images dropped here
│   ├── favicon.ico
│   ├── manifest.json
│   └── og-image.png
│
├── app/
│   ├── layout.jsx                     # Root layout, fonts, metadata from config
│   ├── page.jsx                       # Reads config, renders sections in order
│   └── globals.css
│
├── components/
│   ├── sections/                      # REUSABLE SECTION LIBRARY
│   │   ├── HeroParallax.jsx           # Full-screen image + headline + CTA
│   │   ├── HeroVideo.jsx              # Video background variant
│   │   ├── HeroMinimal.jsx            # Clean text-only hero
│   │   ├── ServicesGrid.jsx           # 3-6 cards with icons, stagger animation
│   │   ├── ServicesList.jsx           # Alternating image/text rows
│   │   ├── AboutSection.jsx           # Team photo + story + values
│   │   ├── BeforeAfterGallery.jsx     # Slider comparison (great for trades)
│   │   ├── TestimonialsCarousel.jsx   # Auto-rotating reviews
│   │   ├── TestimonialsGrid.jsx       # Static grid of review cards
│   │   ├── StatsCounter.jsx           # Animated number tickers
│   │   ├── PricingTable.jsx           # 2-3 tier pricing cards
│   │   ├── FAQAccordion.jsx           # Expandable Q&A
│   │   ├── ContactForm.jsx            # Formspree integration
│   │   ├── GoogleMapEmbed.jsx         # Responsive map embed
│   │   ├── BookingWidget.jsx          # Cal.com / Calendly embed
│   │   ├── GalleryGrid.jsx            # Photo portfolio grid with lightbox
│   │   ├── CTABanner.jsx              # Full-width call-to-action strip
│   │   ├── BlogPreview.jsx            # Latest 3 posts
│   │   └── Footer.jsx                 # Links, socials, copyright
│   │
│   ├── ui/                            # Shared UI primitives
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   ├── Container.jsx
│   │   ├── SectionWrapper.jsx         # Handles scroll-reveal animation
│   │   └── AnimatedCounter.jsx
│   │
│   └── layout/
│       ├── Navbar.jsx                 # Sticky nav with mobile hamburger
│       └── MobileMenu.jsx
│
├── lib/
│   ├── config.js                      # Reads site-config.json
│   └── animations.js                  # Shared Framer Motion variants
│
└── scripts/
    └── new-client.sh                  # Clone template, set up new repo
```

### site-config.json Example

```json
{
  "businessName": "Murphy's Plumbing",
  "tagline": "24/7 Emergency Plumbing in Dublin",
  "phone": "+353 1 234 5678",
  "email": "info@murphysplumbing.ie",
  "address": "123 Main St, Dublin",
  "colors": {
    "primary": "#0ea5e9",
    "secondary": "#ec4899",
    "accent": "#10b981"
  },
  "fonts": {
    "heading": "Outfit",
    "body": "Inter"
  },
  "socials": {
    "instagram": "https://instagram.com/murphysplumbing",
    "facebook": "https://facebook.com/murphysplumbing",
    "tiktok": ""
  },
  "services": [
    { "name": "Emergency Repairs", "description": "24/7 callout...", "icon": "wrench" },
    { "name": "Boiler Service", "description": "Annual servicing...", "icon": "fire" },
    { "name": "Bathroom Renovation", "description": "Full bathroom...", "icon": "bath" }
  ],
  "testimonials": [
    { "name": "Sarah M.", "text": "Brilliant service...", "rating": 5 },
    { "name": "James K.", "text": "Fixed our leak...", "rating": 5 }
  ],
  "faq": [
    { "q": "Do you offer emergency callouts?", "a": "Yes, we're available 24/7..." },
    { "q": "How much does a boiler service cost?", "a": "A standard service is €120..." }
  ],
  "booking": {
    "type": "cal.com",
    "url": "https://cal.com/murphysplumbing/consultation"
  },
  "mapEmbed": "https://www.google.com/maps/embed?pb=...",
  "sections": [
    "hero-parallax",
    "services-grid",
    "before-after",
    "stats-counter",
    "testimonials-carousel",
    "faq",
    "contact",
    "map",
    "footer"
  ]
}
```

### Per-Client Workflow

```
1. Clone template repo → new repo named "client-murphys-plumbing"
2. Edit config/site-config.json with client's info
3. Drop client images into public/images/
4. Run `npm run dev` → preview locally
5. Tweak any sections (2-3 hours max)
6. Push to GitHub → auto-deploys to Vercel
7. Point client's domain to Vercel (5 min DNS change)
8. Done — total time: 3-4 hours
```

### Framer vs Wix vs Custom (Why Custom Wins)

| | Custom (Next.js + Vercel) | Framer | Wix |
|---|---|---|---|
| Hosting cost per client | $0/mo | $10-30/mo | $17-29/mo |
| 20 clients hosting cost | $0/mo | $200-600/mo | $340-580/mo |
| Build time | 2-3 hours | 1-3 hours | 1-2 hours |
| Design quality | Highest | High | Medium |
| Animations/parallax | Full control | Good | Limited |
| Client self-editing | No (you handle) | Yes | Yes |
| Lock-in | None (you own code) | High | High |

### Website Pricing

| Item | Price |
|---|---|
| Setup fee | $800 (one-time) |
| Monthly hosting + maintenance | $150/mo |
| Your cost per client | ~$1/mo (domain amortized) |
| Your time per client setup | 3-4 hours |
| Your time per client per month | ~15 min (updates) |

---

## PROJECT 3: Client Portal PWA

### Tech Stack

| Tool | Role | Cost |
|---|---|---|
| Next.js 14 or React + Vite | Framework | Free |
| next-pwa or vite-plugin-pwa | PWA support | Free |
| Supabase Auth | Magic link login (no passwords) | Free tier |
| Supabase Database | Postgres | Free tier |
| Supabase Storage | Image uploads | Free tier (1GB) |
| Supabase Realtime | Live chat | Free tier |
| Web Push API | Notifications | Free |
| Vercel | Hosting | Free tier |

### Features

- **Image Upload** — Camera access + gallery picker, upload to Supabase Storage
- **Content Calendar** — View upcoming posts, approve/reject, leave comments
- **Chat** — Real-time messaging with you (Supabase Realtime)
- **Website Change Requests** — Quick action to request site updates
- **Analytics Dashboard** — Engagement stats from ContentStudio
- **Invoices** — View and pay invoices (Stripe integration)
- **PWA** — Installable on phone, works offline for viewing

### File Structure

```
client-portal/
├── package.json
├── next.config.js (with PWA config)
├── manifest.json
│
├── app/
│   ├── layout.jsx
│   ├── page.jsx                       # Login / magic link entry
│   ├── dashboard/page.jsx             # Overview: upcoming posts, stats
│   ├── upload/page.jsx                # Image upload with camera access
│   ├── calendar/page.jsx              # Content calendar + approve/reject
│   ├── chat/page.jsx                  # Real-time chat
│   ├── analytics/page.jsx             # Engagement stats
│   └── invoices/page.jsx              # Stripe invoices
│
├── components/
│   ├── BottomNav.jsx                  # Mobile tab bar
│   ├── ImageUploader.jsx              # Camera + gallery + drag-drop
│   ├── PostCard.jsx                   # Single post with approve/reject
│   ├── ChatBubble.jsx
│   ├── ChatInput.jsx                  # Text + image attachment
│   ├── StatsCard.jsx
│   └── InstallPrompt.jsx             # "Add to Home Screen" prompt
│
├── lib/
│   ├── supabase.js
│   ├── auth.js
│   └── push-notifications.js
│
└── public/
    ├── sw.js                          # Service worker
    ├── manifest.json
    └── icons/                         # PWA icons (192x192, 512x512)
```

### Database Schema (Supabase / Postgres)

```sql
-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  website_url TEXT,
  brand_voice TEXT,
  colors JSONB,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Images uploaded by clients
CREATE TABLE client_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  file_url TEXT NOT NULL,
  file_name TEXT,
  tags TEXT[],
  ai_description TEXT,
  quality_score INTEGER,
  status TEXT DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated social media posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  image_id UUID REFERENCES client_images(id),
  caption TEXT NOT NULL,
  platform TEXT NOT NULL,
  hashtags TEXT[],
  scheduled_date DATE,
  scheduled_time TIME,
  status TEXT DEFAULT 'draft',
  client_feedback TEXT,
  contentstudio_id TEXT,
  engagement JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  sender TEXT NOT NULL,
  message TEXT,
  attachment_url TEXT,
  message_type TEXT DEFAULT 'chat',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Website change requests
CREATE TABLE website_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  description TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  description TEXT,
  status TEXT DEFAULT 'pending',
  due_date DATE,
  stripe_invoice_id TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Where to Host: Supabase vs Render

### Supabase (Recommended for this project)

Supabase gives you database + auth + file storage + realtime in one platform. Free tier is generous:
- 500MB database
- 1GB file storage
- 50,000 monthly active users
- Realtime subscriptions
- Edge Functions (serverless)

**Use Supabase for:** Database, auth, file storage, realtime chat, edge functions for API routes.

### Render

Render is a good platform for hosting backend services (Node.js, Python, Docker). It's similar to Heroku but cheaper.

**Render pricing:**
- Free tier: 750 hours/mo of web services (spins down after 15 min inactivity)
- Starter: $7/mo per service (always on)
- Postgres: $7/mo for 1GB database

**Render is good for:**
- Running n8n (self-hosted workflow automation) — $7/mo
- Running custom backend APIs if you outgrow Supabase Edge Functions
- Running cron jobs (scheduled content generation)

**Render is NOT needed if:**
- You use Supabase for everything (database, auth, storage, realtime)
- You use Vercel for hosting frontends
- You use ContentStudio API for publishing

### Recommended Architecture

```
Vercel (free)          → Host all frontends (client sites, portal, your SMMA site)
Supabase (free)        → Database, auth, file storage, realtime chat
Render ($7/mo)         → Run n8n for automation workflows OR cron jobs
ContentStudio ($50/mo) → Social media scheduling and publishing
```

If you want to avoid Render entirely, you can:
- Run automation scripts as Vercel Cron Jobs (free tier: once/day)
- Or run them as Supabase Edge Functions triggered by database changes
- Or just run them manually from your laptop with `node scripts/run-monthly.js`

### Render vs Railway vs Fly.io

| Platform | Free Tier | Paid | Best For |
|---|---|---|---|
| Render | 750 hrs/mo (sleeps) | $7/mo | Simple Node/Python services |
| Railway | $5 free credit/mo | Usage-based | Quick deploys, good DX |
| Fly.io | 3 shared VMs free | Usage-based | Global edge deployment |
| Supabase Edge Functions | 500K invocations/mo | $25/mo Pro | Serverless, integrated with DB |

**For starting out:** Supabase (free) + Vercel (free) is enough. Add Render ($7/mo) when you need always-on automation.

### Render Detailed Pricing (April 2026)

Render charges per SERVICE, not per website. Client websites go on Vercel (free).

**Web Services (backend API):**
| Plan | Cost | RAM | CPU |
|---|---|---|---|
| Free | $0/mo (sleeps after 15 min) | 512 MB | 0.1 |
| Starter | $7/mo | 512 MB | 0.5 |
| Standard | $25/mo | 2 GB | 1 |
| Pro | $85/mo | 4 GB | 2 |

**Postgres Database:**
| Plan | Cost | CPU | RAM |
|---|---|---|---|
| Free | $0 (deleted after 30 days!) | 0.1 | 256 MB |
| Basic-256mb | $6/mo | 0.1 | 256 MB |
| Basic-1gb | $19/mo | 0.5 | 1 GB |
| Pro-4gb | $55/mo | 1 | 4 GB |

**Cron Jobs:** ~$0.00016/minute (Starter) — a 5-minute monthly job costs pennies.

**Workspace Plans:**
| Plan | Cost | Notes |
|---|---|---|
| Hobby | $0/mo | Personal projects, 1 seat |
| Pro | $25/mo | Production apps, unlimited seats |

**What you'd pay on Render:**
- Backend API (Starter): $7/mo
- Postgres (Basic-256mb): $6/mo
- Cron job: ~$1/mo
- Workspace (Hobby): $0/mo
- **Total: ~$14/mo**

**BUT: Supabase is better for this project** because it bundles database + auth + file storage + realtime chat for $0-25/mo. Using Render for just the database means you'd need to build auth, storage, and realtime yourself.

### Recommended Architecture

**Starting out ($0/mo):**
- Vercel (free) → all frontends
- Supabase (free) → database, auth, storage, realtime
- Run automation scripts manually from laptop

**With paying clients (~$33/mo):**
- Vercel (free) → all frontends
- Supabase Pro ($25/mo) → database, auth, storage, realtime
- Render Starter ($7/mo + $1/mo cron) → backend API + scheduled automation

---

## Human Input: What to Automate vs What Needs You

### Fully Automate (no human needed)
- Image scoring and triage (Claude Vision)
- Hashtag generation
- Reformatting posts across platforms
- Scheduling and publishing
- Auto-cropping images to platform dimensions
- Generating image descriptions
- Content calendar structure

### Human Review (~15-20 min per client per month)
- Final approval of the content calendar
- Flagging sensitive content
- Checking brand accuracy

### Human Only (can't automate yet)
- Client onboarding (initial conversation)
- Strategy adjustments (if engagement drops)
- Crisis management (pause posts if PR issue)
- Upselling

### Ideal Monthly Workflow Per Client

```
Day 1:  Client drops images in portal
        → Auto: AI triages, scores, categorizes images
        → Auto: AI generates 30-post content calendar
        → Auto: AI generates gap-fill images where needed

Day 2:  YOU spend 15 minutes reviewing the calendar
        → Approve / reject / tweak individual posts
        → Hit "approve all" on the good ones

Day 3-30: Auto: Posts publish on schedule
          → Auto: Weekly performance summary emailed to you
          → Auto: Monthly report generated for client
```

---

## Accounts to Create

| Service | Cost | What For | URL |
|---|---|---|---|
| Supabase | Free tier | Database, auth, file storage, realtime | https://supabase.com |
| Anthropic | Pay-as-you-go | Claude API for content + vision | https://console.anthropic.com |
| fal.ai | Pay-as-you-go | Flux Kontext + Flux 2 Pro image APIs | https://fal.ai |
| ContentStudio | ~$50/mo | Social media scheduling + publishing | https://contentstudio.io |
| Vercel | Free tier | Hosting for all websites + portal | https://vercel.com |
| Formspree | Free tier | Contact forms on client sites | https://formspree.io |
| Cal.com | Free tier | Booking widget for client sites | https://cal.com |
| Namecheap | ~$10/yr per domain | Domain registration | https://namecheap.com |
| Stripe | 2.9% + 30¢/txn | Client billing | https://stripe.com |
| Claude Pro or Max | $20-100/mo | For building (Claude Code/Kiro) | https://anthropic.com |
| Canva Pro | $13/mo | Template designs, brand kits | https://canva.com |
| Render (optional) | $7/mo | n8n hosting / cron jobs | https://render.com |

---

## Claude Code Pricing

| Plan | Cost | What You Get | Best For |
|---|---|---|---|
| Pro | $20/mo | Claude Code access, standard limits | Light use, a few sites/month |
| Max 5x | $100/mo | 5x usage of Pro | Multiple sites + automation |
| Max 20x | $200/mo | 20x usage of Pro | Heavy daily use |
| API (pay-as-you-go) | ~$3/$15 per 1M tokens (Sonnet) | No subscription | Automation pipeline |

**Recommendation:** Claude Pro ($20/mo) for building websites interactively. Separate Claude API (pay-as-you-go) for the automated social media pipeline.

---

## Cost Breakdown Per Client (30 posts/month)

### Smart Approach (Sonnet + Haiku mix)

| Item | Tool | Cost |
|---|---|---|
| Image analysis (20 images) | Claude Sonnet Vision | ~$1-2 |
| Content generation (30 posts) | Claude Sonnet | ~$2-4 |
| Platform reformatting | Claude Haiku | ~$0.30-0.50 |
| Image editing (10 images) | Flux Kontext Max | ~$0.80 |
| Image generation (5 from scratch) | Flux 2 Pro | ~$0.15 |
| Text overlays (3 images) | Ideogram v3 | ~$0.15 |
| Scheduling | ContentStudio | ~$2-3 |
| **TOTAL PER CLIENT** | | **~$7-11/month** |

### Premium Everything (Opus + best tools)

| Item | Tool | Cost |
|---|---|---|
| Image analysis | Claude Opus Vision | ~$3-5 |
| Content generation | Claude Opus | ~$8-12 |
| Platform reformatting | Claude Opus | ~$5-8 |
| Image editing/generation | Flux Kontext Max + Pro | ~$1.50 |
| Scheduling | ContentStudio | ~$2-3 |
| **TOTAL PER CLIENT** | | **~$20-30/month** |

---

## Total Monthly Costs (Running the Business)

| Item | 0 clients | 5 clients | 15 clients |
|---|---|---|---|
| Supabase | $0 | $0 | $25 (Pro) |
| Claude API | $0 | ~$40 | ~$120 |
| fal.ai (Flux) | $0 | ~$5 | ~$15 |
| ContentStudio | $50 | $50 | $70 |
| Vercel | $0 | $0 | $0 |
| Claude Pro (for you) | $20 | $20 | $20 |
| Canva Pro | $13 | $13 | $13 |
| Render (optional) | $7 | $7 | $7 |
| Domains | $0 | ~$4 | ~$12 |
| Stripe fees | $0 | ~$120 | ~$360 |
| **TOTAL** | **$90** | **~$260** | **~$640** |

---

## Revenue Projections

### Pricing Tiers

| Package | What They Get | Monthly Price |
|---|---|---|
| Social Media Only | 30 posts/mo, 4 platforms | $700/mo |
| Website Only | Custom site + hosting + updates | $800 setup + $150/mo |
| Full Package | Social media + website + booking | $800 setup + $800/mo |

### Revenue at Scale

| Clients | Revenue/mo | Costs/mo | Profit/mo | Margin |
|---|---|---|---|---|
| 5 | ~$4,750 | ~$260 | ~$4,490 | 94.5% |
| 10 | ~$9,500 | ~$420 | ~$9,080 | 95.6% |
| 15 | ~$14,250 | ~$640 | ~$13,610 | 95.5% |
| 20 | ~$19,000 | ~$850 | ~$18,150 | 95.5% |

Plus one-time website setup fees: $800 × new clients per month.

---

## MASTER BUILD ORDER

### Phase 1: Foundation (Week 1-2)

- [ ] 1. Set up Supabase project (shared by all 3 projects)
- [ ] 2. Create database tables (clients, images, posts, messages, invoices)
- [ ] 3. Set up Claude API account + test basic calls
- [ ] 4. Set up fal.ai account (for Flux image APIs)
- [ ] 5. Build the SMMA automation: onboarding flow (scrape → brand voice)
- [ ] 6. Build the SMMA automation: image analysis pipeline
- [ ] 7. Build the SMMA automation: content generation pipeline
- [ ] 8. Test end-to-end: fake client → 30 posts generated

### Phase 2: Publishing + Portal (Week 3-4)

- [ ] 9. Set up ContentStudio account + API integration
- [ ] 10. Build the scheduling/publishing pipeline
- [ ] 11. Build the Client Portal PWA: auth + image upload
- [ ] 12. Build the Client Portal PWA: content calendar + approval
- [ ] 13. Build the Client Portal PWA: chat
- [ ] 14. Add PWA manifest + service worker + install prompt
- [ ] 15. Test: upload images via portal → pipeline generates posts → appear in calendar

### Phase 3: Website Builder (Week 5-6)

- [ ] 16. Create the Next.js template with Tailwind + Framer Motion
- [ ] 17. Build core sections: Hero, Services, Contact, Footer
- [ ] 18. Build secondary sections: Testimonials, FAQ, Gallery, Map, Booking
- [ ] 19. Build the site-config.json system
- [ ] 20. Build the new-client script (clone + deploy)
- [ ] 21. Deploy your own SMMA website using this system
- [ ] 22. Test: create 2 fake client sites end-to-end

### Phase 4: Your Own SMMA Website (Week 6-7)

- [ ] 23. Design your SMMA landing page (use your own template)
- [ ] 24. Add: pricing section, portfolio/case studies, booking call CTA
- [ ] 25. Add: demo of the client portal
- [ ] 26. Deploy to Vercel, connect your domain
- [ ] 27. Set up Stripe for recurring billing

### Phase 5: Polish + Launch (Week 7-8)

- [ ] 28. Build your admin dashboard (see all clients, posts, chats)
- [ ] 29. Add analytics reporting (monthly PDF report per client)
- [ ] 30. Add Stripe integration for invoicing
- [ ] 31. Onboard your first real client
- [ ] 32. Run the full cycle: onboard → generate → approve → publish → report

---

## Key Technical Decisions Summary

| Decision | Choice | Why |
|---|---|---|
| LLM for content | Claude Sonnet 4.6 | Best brand voice, good price |
| LLM for simple tasks | Claude Haiku 4.5 | 3x cheaper, fast |
| Image editing | Flux Kontext Max (fal.ai) | Keeps real products, changes surroundings |
| Image generation | Flux 2 Pro (fal.ai) | Best photorealism at $0.03/img |
| Text on images | Ideogram v3 | Best text rendering |
| Image analysis | Claude Vision (Sonnet) | Understands context, mood, composition |
| Database | Supabase (Postgres) | Free, includes auth + storage + realtime |
| Frontend hosting | Vercel | Free, auto-deploy from GitHub |
| Backend (if needed) | Render or Supabase Edge Functions | Cheap, simple |
| Social scheduling | ContentStudio | API access, white-label, multi-platform |
| Website framework | Next.js + Tailwind + Framer Motion | Free hosting, full control, fast |
| Client portal | Next.js PWA or React + Vite PWA | Installable, camera access, offline |
| Payments | Stripe | Industry standard, recurring billing |
| Domains | Namecheap | Cheapest reliable registrar |
| Booking embeds | Cal.com | Free, open source, clean embed |
| Contact forms | Formspree | Free tier, no backend needed |
| Website builder (NOT using) | Wix/Framer | Too expensive per site, less control |

---

## 21st.dev (Optional Enhancement)

21st.dev is a community-driven React component registry (YC-backed, 1.4M developers). It has an MCP server called "Magic" that integrates with Claude Code/Kiro/Cursor. You type `/ui create a pricing table` and it generates a polished component using shadcn/ui + Tailwind.

Useful for rapidly building client website sections. Not required but speeds up development.

---

## Remotion (Optional: Programmatic Video)

You already have Remotion in your current project. It can programmatically generate short-form video content from templates + client images. Useful for:
- Instagram Reels
- TikTok videos
- Story animations
- Product showcase videos

This is a Phase 6 enhancement — not needed for launch.

---

## Document Version

Created: April 30, 2026
Status: Planning phase — no code built yet for SMMA projects
