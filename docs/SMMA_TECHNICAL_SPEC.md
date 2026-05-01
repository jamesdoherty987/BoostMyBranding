# SMMA Platform — Technical Specification for Code Generation

> This document is a complete technical specification for an LLM to generate code.
> It contains exact file paths, TypeScript interfaces, API contracts, database schemas,
> environment variables, component props, and prompt templates.
> Feed this document (or individual phases) to Claude Code, Kiro, or Cursor to generate the codebase.

---

## GLOBAL RULES

- Language: TypeScript (strict mode) for all code
- Package manager: pnpm
- Monorepo tool: Turborepo
- Linting: ESLint + Prettier
- All dates stored as UTC in the database, displayed in client's local timezone
- All API responses follow: `{ data: T } | { error: string, code: string }`
- All monetary values stored as integers (cents), displayed as formatted currency
- Environment variables prefixed by app: `PORTAL_`, `API_`, `AUTO_` (automation)

---

## ENVIRONMENT VARIABLES

```env
# Database (Render PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/smma_db

# Auth (Better Auth)
BETTER_AUTH_SECRET=random-32-char-secret
BETTER_AUTH_URL=http://localhost:3000

# Claude API (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Image Generation (fal.ai)
FAL_KEY=fal-...

# Ideogram (text on images)
IDEOGRAM_API_KEY=...

# Cloudflare R2 (file storage)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=smma-uploads
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# ContentStudio (social media scheduling)
CONTENTSTUDIO_API_KEY=...
CONTENTSTUDIO_WORKSPACE_ID=...

# Stripe (payments)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_SOCIAL=price_...
STRIPE_PRICE_ID_WEBSITE=price_...
STRIPE_PRICE_ID_FULL=price_...

# Resend (email)
RESEND_API_KEY=re_...
FROM_EMAIL=hello@youragency.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## MONOREPO STRUCTURE

```
smma/
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml             # workspace config
├── turbo.json                      # Turborepo pipeline config
├── .env                            # Shared env vars (gitignored)
├── .gitignore
│
├── apps/
│   ├── web/                        # SMMA marketing website (Next.js 15, static export)
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── pricing/page.tsx
│   │   │   ├── portfolio/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   └── blog/page.tsx
│   │   └── components/             # Page-specific components
│   │
│   ├── portal/                     # Client portal PWA (Next.js 15, SSR)
│   │   ├── package.json
│   │   ├── next.config.ts          # PWA config via next-pwa
│   │   ├── tailwind.config.ts
│   │   ├── middleware.ts           # Auth middleware (Better Auth)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Login (magic link)
│   │   │   ├── dashboard/page.tsx  # Overview
│   │   │   ├── upload/page.tsx     # Image upload
│   │   │   ├── calendar/page.tsx   # Content calendar + approve/reject
│   │   │   ├── chat/page.tsx       # Real-time chat
│   │   │   ├── website/page.tsx    # Website change requests
│   │   │   ├── analytics/page.tsx  # Engagement stats
│   │   │   └── invoices/page.tsx   # Billing
│   │   ├── components/
│   │   │   ├── BottomNav.tsx
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── PostCard.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   └── InstallPrompt.tsx
│   │   └── public/
│   │       ├── manifest.json
│   │       └── sw.js
│   │
│   ├── api/                        # Backend API (Express.js, runs on Render)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # Express app entry point
│   │   │   ├── routes/
│   │   │   │   ├── clients.ts
│   │   │   │   ├── images.ts
│   │   │   │   ├── posts.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── websites.ts
│   │   │   │   ├── invoices.ts
│   │   │   │   ├── webhooks.ts     # Stripe + ContentStudio webhooks
│   │   │   │   └── automation.ts   # Trigger content generation
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts         # Better Auth middleware
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── upload.ts       # Multer config for image uploads
│   │   │   ├── services/
│   │   │   │   ├── claude.ts       # Claude API wrapper (content + vision)
│   │   │   │   ├── fal.ts          # fal.ai wrapper (Flux Kontext + Flux 2 Pro)
│   │   │   │   ├── ideogram.ts     # Ideogram API wrapper
│   │   │   │   ├── r2.ts           # Cloudflare R2 upload/download
│   │   │   │   ├── contentStudio.ts # ContentStudio scheduling API
│   │   │   │   ├── stripe.ts       # Stripe billing
│   │   │   │   └── resend.ts       # Email sending
│   │   │   └── cron/
│   │   │       ├── monthlyGeneration.ts  # Generate content for all clients
│   │   │       └── analyticsReport.ts    # Pull engagement stats
│   │   └── Dockerfile              # For Render deployment
│   │
│   └── client-site-template/       # Cloneable template for client websites
│       ├── package.json
│       ├── next.config.ts          # Static export config
│       ├── tailwind.config.ts
│       ├── config/
│       │   └── site.config.ts      # THE KEY FILE — all client data
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx            # Reads config, renders sections dynamically
│       └── components/
│           └── sections/           # Reusable section components
│
├── packages/
│   ├── ui/                         # Shared UI components (shadcn/ui based)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── section-wrapper.tsx  # Framer Motion scroll-reveal wrapper
│   │   │   └── animated-counter.tsx
│   │   └── tailwind.config.ts
│   │
│   ├── database/                   # Drizzle ORM schema + client
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   ├── src/
│   │   │   ├── index.ts            # Export db client
│   │   │   ├── schema.ts           # All table definitions
│   │   │   └── migrate.ts          # Migration runner
│   │   └── drizzle/                # Generated migrations
│   │
│   └── automation/                 # Content generation pipeline
│       ├── package.json
│       ├── src/
│       │   ├── onboarding/
│       │   │   ├── scrapeWebsite.ts
│       │   │   └── generateBrandVoice.ts
│       │   ├── images/
│       │   │   ├── analyzeImages.ts
│       │   │   ├── enhanceImages.ts
│       │   │   └── generateImages.ts
│       │   ├── content/
│       │   │   ├── generateCalendar.ts
│       │   │   ├── formatPerPlatform.ts
│       │   │   └── matchImagesToPost.ts
│       │   ├── publishing/
│       │   │   ├── schedulePosts.ts
│       │   │   └── generateReport.ts
│       │   └── prompts/
│       │       ├── brandVoice.ts
│       │       ├── imageAnalysis.ts
│       │       ├── contentCalendar.ts
│       │       ├── platformFormatter.ts
│       │       └── monthlyReport.ts
│       └── scripts/
│           ├── onboardClient.ts
│           ├── runMonthly.ts
│           └── runAllClients.ts
│
└── tooling/
    ├── eslint-config/
    ├── prettier-config/
    └── tsconfig/
```

---

## DATABASE SCHEMA (Drizzle ORM)

File: `packages/database/src/schema.ts`

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp, date, time, jsonb, decimal, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const postStatusEnum = pgEnum('post_status', ['draft', 'pending_approval', 'approved', 'scheduled', 'published', 'rejected']);
export const platformEnum = pgEnum('platform', ['instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'bluesky', 'pinterest']);
export const imageStatusEnum = pgEnum('image_status', ['pending', 'analyzing', 'approved', 'rejected', 'enhanced', 'used']);
export const messageTypeEnum = pgEnum('message_type', ['chat', 'website_request', 'feedback', 'system']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'pending', 'paid', 'overdue', 'cancelled']);
export const requestStatusEnum = pgEnum('request_status', ['pending', 'in_progress', 'completed', 'cancelled']);

// Clients
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessName: text('business_name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').unique().notNull(),
  phone: text('phone'),
  websiteUrl: text('website_url'),
  industry: text('industry'),
  brandVoice: text('brand_voice'),           // Generated brand voice document (markdown)
  brandColors: jsonb('brand_colors').$type<{ primary: string; secondary: string; accent: string }>(),
  logoUrl: text('logo_url'),
  socialAccounts: jsonb('social_accounts').$type<Record<string, string>>(), // { instagram: "...", facebook: "..." }
  contentStudioWorkspaceId: text('contentstudio_workspace_id'),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionTier: text('subscription_tier').default('social_only'), // social_only, website_only, full_package
  monthlyPrice: integer('monthly_price'),     // cents
  isActive: boolean('is_active').default(true),
  onboardedAt: timestamp('onboarded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Client images (uploaded by clients via portal)
export const clientImages = pgTable('client_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  fileUrl: text('file_url').notNull(),        // R2 URL
  fileName: text('file_name'),
  fileSizeBytes: integer('file_size_bytes'),
  mimeType: text('mime_type'),
  tags: text('tags').array(),                 // ['product', 'team', 'workspace', 'event']
  aiDescription: text('ai_description'),      // Claude Vision analysis
  aiSuggestions: jsonb('ai_suggestions').$type<{
    qualityScore: number;
    issues: string[];
    mood: string;
    bestPlatforms: string[];
    suggestedCrop: string;
    captionAngle: string;
    needsEditing: boolean;
    editingSuggestions: string[];
  }>(),
  enhancedUrl: text('enhanced_url'),          // Flux Kontext enhanced version URL
  status: imageStatusEnum('status').default('pending'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// Generated social media posts
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  imageId: uuid('image_id').references(() => clientImages.id),
  generatedImageUrl: text('generated_image_url'), // If AI-generated (not from client upload)
  caption: text('caption').notNull(),
  platform: platformEnum('platform').notNull(),
  hashtags: text('hashtags').array(),
  scheduledDate: date('scheduled_date'),
  scheduledTime: time('scheduled_time'),
  status: postStatusEnum('status').default('draft'),
  clientFeedback: text('client_feedback'),
  contentStudioPostId: text('contentstudio_post_id'),
  engagement: jsonb('engagement').$type<{
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
    impressions?: number;
  }>(),
  batchId: uuid('batch_id'),                  // Groups posts from same generation run
  createdAt: timestamp('created_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
});

// Chat messages (client <-> agency)
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender').notNull(),           // 'client' or 'agency'
  senderName: text('sender_name'),
  message: text('message'),
  attachmentUrl: text('attachment_url'),
  messageType: messageTypeEnum('message_type').default('chat'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Website change requests
export const websiteRequests = pgTable('website_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  description: text('description').notNull(),
  screenshotUrl: text('screenshot_url'),
  priority: text('priority').default('normal'), // low, normal, urgent
  status: requestStatusEnum('status').default('pending'),
  agencyNotes: text('agency_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Invoices
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(),        // cents
  currency: text('currency').default('EUR'),
  description: text('description'),
  lineItems: jsonb('line_items').$type<Array<{ description: string; amount: number }>>(),
  status: invoiceStatusEnum('status').default('pending'),
  dueDate: date('due_date'),
  stripeInvoiceId: text('stripe_invoice_id'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
});

// Content generation batches (tracks each monthly run)
export const contentBatches = pgTable('content_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  month: text('month').notNull(),             // "2026-05"
  imagesAnalyzed: integer('images_analyzed').default(0),
  postsGenerated: integer('posts_generated').default(0),
  postsApproved: integer('posts_approved').default(0),
  postsPublished: integer('posts_published').default(0),
  totalCostCents: integer('total_cost_cents').default(0), // API costs for this batch
  status: text('status').default('pending'),  // pending, generating, review, approved, published
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## API ROUTES

File: `apps/api/src/routes/*.ts`

All routes prefixed with `/api/v1`. Auth required unless noted.

### Clients

```
POST   /api/v1/clients                    # Create client (agency only)
GET    /api/v1/clients                    # List all clients (agency only)
GET    /api/v1/clients/:id                # Get client details
PATCH  /api/v1/clients/:id                # Update client
DELETE /api/v1/clients/:id                # Deactivate client (soft delete)
POST   /api/v1/clients/:id/onboard        # Trigger onboarding (scrape website, generate brand voice)
GET    /api/v1/clients/me                  # Get current client's own profile (portal)
```

### Images

```
POST   /api/v1/images/upload              # Upload image(s) — multipart/form-data, max 10MB per file
                                          # Body: files[], clientId, tags[]
                                          # Returns: { data: ClientImage[] }
GET    /api/v1/images?clientId=X&status=Y # List images for client
PATCH  /api/v1/images/:id                 # Update image (tags, status)
DELETE /api/v1/images/:id                 # Delete image (removes from R2 too)
POST   /api/v1/images/:id/analyze         # Trigger Claude Vision analysis
POST   /api/v1/images/:id/enhance         # Trigger Flux Kontext enhancement
```

### Posts

```
GET    /api/v1/posts?clientId=X&month=Y&status=Z  # List posts (filterable)
GET    /api/v1/posts/:id                           # Get single post
PATCH  /api/v1/posts/:id                           # Update post (edit caption, reschedule)
PATCH  /api/v1/posts/:id/approve                   # Client approves post
PATCH  /api/v1/posts/:id/reject                    # Client rejects post with feedback
         Body: { feedback: string }
POST   /api/v1/posts/batch-approve                 # Approve multiple posts
         Body: { postIds: string[] }
DELETE /api/v1/posts/:id                           # Delete post
```

### Content Generation (Automation)

```
POST   /api/v1/automation/generate         # Generate content for a client
         Body: { clientId: string, month: string, postsCount: number }
         Returns: { data: { batchId: string, postsGenerated: number } }
POST   /api/v1/automation/generate-all     # Generate for all active clients (cron trigger)
POST   /api/v1/automation/schedule         # Schedule approved posts to ContentStudio
         Body: { clientId: string, batchId: string }
POST   /api/v1/automation/report           # Generate monthly analytics report
         Body: { clientId: string, month: string }
```

### Messages (Chat)

```
GET    /api/v1/messages?clientId=X&limit=50&before=cursor  # Get messages (paginated)
POST   /api/v1/messages                    # Send message
         Body: { clientId: string, message: string, attachmentUrl?: string, messageType?: string }
PATCH  /api/v1/messages/read               # Mark messages as read
         Body: { messageIds: string[] }
```

### Website Requests

```
POST   /api/v1/website-requests            # Create request (from portal)
         Body: { clientId: string, description: string, screenshotUrl?: string, priority?: string }
GET    /api/v1/website-requests?clientId=X&status=Y  # List requests
PATCH  /api/v1/website-requests/:id        # Update status/notes (agency)
```

### Invoices

```
GET    /api/v1/invoices?clientId=X         # List invoices
POST   /api/v1/invoices                    # Create invoice (agency)
         Body: { clientId: string, amount: number, description: string, lineItems: [], dueDate: string }
```

### Webhooks (no auth — verified by signature)

```
POST   /api/v1/webhooks/stripe             # Stripe payment events
POST   /api/v1/webhooks/contentstudio      # Post published/failed events
```

---

## CLIENT WEBSITE TEMPLATE — SECTION COMPONENTS

File: `apps/client-site-template/config/site.config.ts`

```typescript
export interface SiteConfig {
  businessName: string;
  tagline: string;
  description: string;  // SEO meta description
  phone: string;
  email: string;
  address: string;
  colors: {
    primary: string;    // hex
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;    // Google Font name
    body: string;
  };
  socials: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    linkedin?: string;
    x?: string;
    youtube?: string;
  };
  services: Array<{
    name: string;
    description: string;
    icon: string;       // Lucide icon name
    image?: string;     // /images/service-name.jpg
    price?: string;
  }>;
  testimonials: Array<{
    name: string;
    text: string;
    rating: number;     // 1-5
    company?: string;
    image?: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  stats: Array<{
    value: number;
    suffix: string;     // "+", "%", "k"
    label: string;
  }>;
  booking?: {
    type: 'cal.com' | 'calendly' | 'link';
    url: string;
  };
  mapEmbed?: string;    // Google Maps embed URL
  gallery?: string[];   // Array of image paths
  sections: SectionType[];  // Ordered list of sections to render
}

export type SectionType =
  | 'hero-parallax'
  | 'hero-video'
  | 'hero-minimal'
  | 'services-grid'
  | 'services-list'
  | 'about'
  | 'before-after'
  | 'testimonials-carousel'
  | 'testimonials-grid'
  | 'stats-counter'
  | 'pricing-table'
  | 'faq-accordion'
  | 'gallery-grid'
  | 'contact-form'
  | 'google-map'
  | 'booking-widget'
  | 'cta-banner'
  | 'footer';
```

### Section Component Props

Each section component receives the full `SiteConfig` and renders its relevant data:

```typescript
// All section components follow this pattern:
interface SectionProps {
  config: SiteConfig;
}

// HeroParallax: Full-screen background image with parallax scroll, headline, CTA
// Uses Framer Motion useScroll + useTransform for parallax effect
// Image: /images/hero.jpg (must exist in public/images/)

// ServicesGrid: 3-column grid of service cards with Lucide icons
// Stagger animation on scroll using Framer Motion whileInView + staggerChildren

// TestimonialsCarousel: Auto-rotating testimonial cards with star ratings
// Uses Framer Motion AnimatePresence for slide transitions

// StatsCounter: Animated number counters that count up when scrolled into view
// Uses Framer Motion useInView + animate

// FAQAccordion: Expandable Q&A items with smooth height animation
// Uses Framer Motion layout animations

// ContactForm: Name, email, phone, message fields
// Submits to Formspree (action URL from env var NEXT_PUBLIC_FORMSPREE_ID)

// GoogleMapEmbed: Responsive iframe embed, 100% width, 400px height, rounded corners

// BookingWidget: Cal.com or Calendly embed based on config.booking.type

// Footer: Business name, address, phone, email, social links, copyright year
```

### Dynamic Page Renderer

File: `apps/client-site-template/app/page.tsx`

```typescript
// This file reads site.config.ts and renders sections in order.
// Pattern:
import { siteConfig } from '@/config/site.config';

const SECTION_MAP: Record<SectionType, React.ComponentType<SectionProps>> = {
  'hero-parallax': HeroParallax,
  'hero-video': HeroVideo,
  'hero-minimal': HeroMinimal,
  'services-grid': ServicesGrid,
  'services-list': ServicesList,
  'about': AboutSection,
  'before-after': BeforeAfterGallery,
  'testimonials-carousel': TestimonialsCarousel,
  'testimonials-grid': TestimonialsGrid,
  'stats-counter': StatsCounter,
  'pricing-table': PricingTable,
  'faq-accordion': FAQAccordion,
  'gallery-grid': GalleryGrid,
  'contact-form': ContactForm,
  'google-map': GoogleMapEmbed,
  'booking-widget': BookingWidget,
  'cta-banner': CTABanner,
  'footer': Footer,
};

export default function HomePage() {
  return (
    <main>
      <Navbar config={siteConfig} />
      {siteConfig.sections.map((sectionType, index) => {
        const Component = SECTION_MAP[sectionType];
        return Component ? <Component key={index} config={siteConfig} /> : null;
      })}
    </main>
  );
}
```

---

## AUTOMATION PROMPTS

### Brand Voice Generator

File: `packages/automation/src/prompts/brandVoice.ts`

```typescript
export const BRAND_VOICE_PROMPT = `You are a brand strategist. Analyze the following website content and create a comprehensive brand voice guide.

WEBSITE CONTENT:
{websiteMarkdown}

BUSINESS NAME: {businessName}
INDUSTRY: {industry}

Generate a brand voice guide in this exact JSON format:
{
  "tone": "2-3 word description (e.g., 'warm and professional')",
  "personality": "One sentence describing the brand as a person",
  "vocabulary": {
    "use": ["list of words/phrases to use"],
    "avoid": ["list of words/phrases to avoid"]
  },
  "sentenceStyle": "short/medium/long — describe preferred sentence length and structure",
  "emojiUsage": "none/minimal/moderate/heavy",
  "hashtagStyle": "describe hashtag approach",
  "callToAction": "preferred CTA style and examples",
  "targetAudience": "describe the ideal customer",
  "contentPillars": ["3-5 content themes that align with the brand"],
  "examplePosts": {
    "instagram": "Write one example Instagram post in this brand's voice",
    "linkedin": "Write one example LinkedIn post in this brand's voice",
    "facebook": "Write one example Facebook post in this brand's voice"
  }
}`;
```

### Image Analysis

File: `packages/automation/src/prompts/imageAnalysis.ts`

```typescript
export const IMAGE_ANALYSIS_PROMPT = `Analyze this image for social media suitability. You are evaluating images for a {industry} business called "{businessName}".

Return ONLY valid JSON (no markdown, no explanation):
{
  "qualityScore": <number 1-10>,
  "usable": <boolean>,
  "issues": [<list of issues like "blurry", "bad lighting", "cluttered background">],
  "subject": "<what is in the image>",
  "mood": "<professional/casual/energetic/warm/luxurious/rustic/modern>",
  "bestPlatforms": [<list from: "instagram_feed", "instagram_story", "linkedin", "facebook", "tiktok">],
  "suggestedCrop": "<portrait/landscape/square>",
  "captionAngle": "<suggested content angle for a social media post using this image>",
  "needsEditing": <boolean>,
  "editingSuggestions": [<list like "brighten", "crop tighter", "remove background clutter", "add warmth">],
  "fluxKontextPrompt": "<if needsEditing is true, write the exact prompt to send to Flux Kontext to enhance this image while keeping the main subject intact>"
}`;
```

### Content Calendar Generator

File: `packages/automation/src/prompts/contentCalendar.ts`

```typescript
export const CONTENT_CALENDAR_PROMPT = `You are a social media manager for "{businessName}", a {industry} business.

BRAND VOICE GUIDE:
{brandVoice}

AVAILABLE IMAGES THIS MONTH (with descriptions):
{imageDescriptions}

CURRENT MONTH: {month} {year}
POSTS TO GENERATE: {postsCount}
PLATFORMS: {platforms}

Generate a content calendar. For each post, return JSON in this exact format:
[
  {
    "dayOfMonth": <number 1-31>,
    "platform": "<instagram|facebook|linkedin|tiktok|x>",
    "caption": "<the full post caption in the brand's voice>",
    "hashtags": ["<relevant hashtags>"],
    "imageIndex": <number — index of the image from AVAILABLE IMAGES to use, or null if none fit>,
    "imageGenerationPrompt": "<if imageIndex is null, describe the image to generate with Flux 2 Pro>",
    "contentType": "<educational|promotional|behind-the-scenes|testimonial|seasonal|engagement>",
    "timeOfDay": "<morning|afternoon|evening>"
  }
]

RULES:
- Mix content types: no more than 2 promotional posts in a row
- Use real client images (imageIndex) for at least 60% of posts
- Vary platforms — don't post the same content on all platforms the same day
- Include seasonal/holiday references where appropriate for {month}
- Captions must match the brand voice guide exactly
- Instagram captions: 150-300 chars + hashtags. LinkedIn: 200-500 chars, professional tone. TikTok: 50-150 chars, casual. X: under 280 chars.
- Generate exactly {postsCount} posts`;
```

### Platform Formatter

File: `packages/automation/src/prompts/platformFormatter.ts`

```typescript
export const PLATFORM_FORMATTER_PROMPT = `Reformat this social media post for {targetPlatform}.

ORIGINAL POST (written for {sourcePlatform}):
Caption: {caption}
Hashtags: {hashtags}

BRAND VOICE: {brandVoiceSummary}

PLATFORM RULES:
- Instagram: 150-300 chars, 20-30 hashtags in first comment or end of caption, emoji-friendly
- LinkedIn: 200-500 chars, professional tone, 3-5 hashtags max, no emoji overuse
- Facebook: 100-250 chars, conversational, 2-5 hashtags, can include link
- TikTok: 50-150 chars, casual/trendy, 5-10 hashtags, hook in first line
- X (Twitter): Under 280 chars total including hashtags, punchy, 1-3 hashtags

Return ONLY JSON:
{
  "caption": "<reformatted caption for {targetPlatform}>",
  "hashtags": ["<platform-appropriate hashtags>"]
}`;
```

---

## KEY SERVICE IMPLEMENTATIONS

### Claude API Wrapper

File: `apps/api/src/services/claude.ts`

```typescript
// Use @anthropic-ai/sdk
// Default model: claude-sonnet-4-20250514
// For simple tasks (hashtags, reformatting): claude-haiku-4-20250414
// Enable prompt caching for brand voice (cache_control: { type: "ephemeral" })
// Enable batch API for monthly generation runs
// Vision: pass images as base64 in content array with type: "image"

interface ClaudeOptions {
  model?: 'sonnet' | 'haiku';
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  cacheSystemPrompt?: boolean;  // Enable prompt caching
}

export async function generateText(prompt: string, options?: ClaudeOptions): Promise<string>;
export async function analyzeImage(imageBase64: string, prompt: string, options?: ClaudeOptions): Promise<string>;
export async function generateJSON<T>(prompt: string, options?: ClaudeOptions): Promise<T>;
```

### fal.ai Wrapper (Image Generation/Editing)

File: `apps/api/src/services/fal.ts`

```typescript
// Use @fal-ai/client
// Flux Kontext Max: fal-ai/flux-pro/kontext/max — $0.08/image — for editing real photos
// Flux 2 Pro: fal-ai/flux-2-pro — $0.03/image — for generating from scratch
// Flux 2 Schnell: fal-ai/flux-2/schnell — $0.003/image — for cheap bulk generation

export async function enhanceImage(imageUrl: string, editPrompt: string): Promise<string>; // Returns new image URL
export async function generateImage(prompt: string, aspectRatio?: string): Promise<string>; // Returns image URL
```

### R2 Storage

File: `apps/api/src/services/r2.ts`

```typescript
// Use @aws-sdk/client-s3 with R2 endpoint
// Bucket structure: {clientId}/images/{filename}
// All uploads return public URL: R2_PUBLIC_URL/{key}

export async function uploadFile(clientId: string, file: Buffer, filename: string, contentType: string): Promise<string>;
export async function deleteFile(key: string): Promise<void>;
export async function getSignedUrl(key: string, expiresIn?: number): Promise<string>;
```

---

## CLIENT PORTAL PWA CONFIG

File: `apps/portal/public/manifest.json`

```json
{
  "name": "Agency Portal",
  "short_name": "Portal",
  "description": "Upload images, approve posts, chat with your agency",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Image Uploader Component

File: `apps/portal/components/ImageUploader.tsx`

```typescript
// Features:
// - Drag and drop zone
// - Camera capture (navigator.mediaDevices.getUserMedia) for mobile
// - Gallery picker (input type="file" accept="image/*" multiple)
// - Preview thumbnails before upload
// - Upload progress bar per image
// - Tag selector: product, team, workspace, event, other
// - Max 10 images per upload, max 10MB per image
// - Accepted types: image/jpeg, image/png, image/webp
// - Uploads to POST /api/v1/images/upload as multipart/form-data
// - Shows success/error toast per image

interface ImageUploaderProps {
  clientId: string;
  onUploadComplete: (images: ClientImage[]) => void;
}
```

### Post Approval Card

File: `apps/portal/components/PostCard.tsx`

```typescript
// Displays a single social media post for client review
// Shows: image preview, caption, platform badge, scheduled date, hashtags
// Actions: Approve (green check), Reject (red X with feedback textarea), Edit caption
// Swipeable on mobile (swipe right = approve, swipe left = reject)

interface PostCardProps {
  post: Post;
  onApprove: (postId: string) => void;
  onReject: (postId: string, feedback: string) => void;
}
```

---

## BUILD PHASES (Feed to LLM one at a time)

### PHASE 1: Monorepo + Database Setup

Prompt for LLM:
> "Set up a pnpm + Turborepo monorepo with the structure defined in this spec. Create apps/web (Next.js 15), apps/portal (Next.js 15 with PWA), apps/api (Express + TypeScript), apps/client-site-template (Next.js 15 static export). Create packages/ui (shadcn/ui + Tailwind v4), packages/database (Drizzle ORM with the schema from this spec), packages/automation (empty for now). Configure TypeScript strict mode, ESLint, Prettier. Set up Drizzle migrations. All env vars from the spec."

### PHASE 2: Backend API

Prompt for LLM:
> "Build the Express API server in apps/api with all routes from this spec. Use Drizzle ORM from packages/database. Implement Better Auth for authentication with magic link login. Implement all service wrappers (claude.ts, fal.ts, r2.ts, contentStudio.ts, stripe.ts, resend.ts). Add rate limiting, error handling, and request validation with Zod. Add Dockerfile for Render deployment."

### PHASE 3: Client Portal PWA

Prompt for LLM:
> "Build the client portal in apps/portal. Pages: login (magic link), dashboard (overview stats), upload (image uploader with camera + gallery + drag-drop), calendar (content calendar with approve/reject), chat (real-time with Socket.io), website requests, invoices. Use shadcn/ui from packages/ui. Add PWA manifest, service worker, install prompt. Mobile-first design with bottom tab navigation. Use Framer Motion for page transitions and micro-interactions."

### PHASE 4: Automation Pipeline

Prompt for LLM:
> "Build the content automation pipeline in packages/automation. Implement: scrapeWebsite (Jina Reader), generateBrandVoice (Claude with the prompt from this spec), analyzeImages (Claude Vision with the prompt from this spec), enhanceImages (Flux Kontext Max via fal.ai), generateImages (Flux 2 Pro via fal.ai), generateCalendar (Claude with the prompt from this spec), formatPerPlatform (Claude Haiku with the prompt from this spec), schedulePosts (ContentStudio API). Create CLI scripts: onboardClient.ts, runMonthly.ts, runAllClients.ts. Wire into the API routes in apps/api/src/routes/automation.ts."

### PHASE 5: Client Website Template

Prompt for LLM:
> "Build the client website template in apps/client-site-template. Create all section components from this spec (HeroParallax, ServicesGrid, TestimonialsCarousel, StatsCounter, FAQAccordion, ContactForm, GoogleMapEmbed, BookingWidget, Footer, etc). Each section reads from site.config.ts. Use Framer Motion for scroll animations (whileInView, staggerChildren, useScroll+useTransform for parallax). Use Tailwind v4 with CSS variables for colors from config. Static export via next.config.ts output: 'export'. Include a sample site.config.ts for a plumber business."

### PHASE 6: SMMA Marketing Website

Prompt for LLM:
> "Build the SMMA agency marketing website in apps/web. Sections: hero with animated gradient text and parallax, services (social media management, website building, content creation), pricing table (3 tiers: Social Only $700/mo, Website Only $800 setup + $150/mo, Full Package $800 setup + $800/mo), portfolio/case studies, testimonials, FAQ, contact form, footer. Modern, impressive design — this is the agency's own showcase. Use Framer Motion heavily for scroll animations, hover effects, and page transitions. Static export for Vercel."

---

## DEPLOYMENT

### Vercel (frontends)
- apps/web → Vercel project "smma-web" (custom domain: youragency.com)
- apps/portal → Vercel project "smma-portal" (custom domain: portal.youragency.com)
- apps/client-site-template → Clone per client, each gets own Vercel project

### Render (backend)
- apps/api → Render Web Service "smma-api" ($7/mo Starter)
- PostgreSQL → Render Postgres "smma-db" ($6/mo Basic-256mb)
- Cron: Render Cron Job for monthly content generation ($1/mo)

### Cloudflare R2 (file storage)
- Bucket: smma-uploads
- Public access enabled for serving images
- CORS configured for portal.youragency.com

---

## DEPENDENCIES (key packages)

```json
{
  "root": {
    "turbo": "^2",
    "typescript": "^5.5"
  },
  "apps/api": {
    "express": "^4.21",
    "better-auth": "^1",
    "drizzle-orm": "^0.36",
    "@anthropic-ai/sdk": "^0.39",
    "@fal-ai/client": "^1",
    "@aws-sdk/client-s3": "^3",
    "stripe": "^17",
    "resend": "^4",
    "multer": "^1.4",
    "zod": "^3.23",
    "node-cron": "^3",
    "socket.io": "^4.8",
    "helmet": "^8",
    "cors": "^2.8"
  },
  "apps/portal": {
    "next": "^15",
    "react": "^19",
    "tailwindcss": "^4",
    "framer-motion": "^12",
    "@tanstack/react-query": "^5",
    "socket.io-client": "^4.8",
    "next-pwa": "^5",
    "react-hook-form": "^7",
    "zod": "^3.23",
    "@hookform/resolvers": "^3"
  },
  "apps/client-site-template": {
    "next": "^15",
    "react": "^19",
    "tailwindcss": "^4",
    "framer-motion": "^12",
    "lucide-react": "^0.460"
  },
  "packages/database": {
    "drizzle-orm": "^0.36",
    "drizzle-kit": "^0.28",
    "postgres": "^3.4"
  }
}
```
