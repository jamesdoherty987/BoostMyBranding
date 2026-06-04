/**
 * Drizzle schema — full production schema covering clients, users,
 * auth sessions, content pipeline, billing, chat, scheduling, and analytics.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ----- Enums -----
export const postStatusEnum = pgEnum('post_status', [
  'draft',
  'pending_internal',
  'pending_approval',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'rejected',
]);

export const platformEnum = pgEnum('platform', [
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'x',
  'pinterest',
  'bluesky',
  'youtube',
  'google_business',
]);

export const imageStatusEnum = pgEnum('image_status', [
  'pending',
  'analyzing',
  'approved',
  'rejected',
  'enhanced',
  'used',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'pending',
  'paid',
  'overdue',
  'cancelled',
]);

export const requestStatusEnum = pgEnum('request_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'social_only',
  'website_only',
  'full_package',
]);

/**
 * Subscription lifecycle. Separate from `clients.isActive` (which means "is
 * this client's generated site live") so that a lapsed subscriber keeps
 * their data but loses feature access.
 *
 *   none      — signed up, never paid. Default for new accounts.
 *   active    — Stripe subscription in good standing.
 *   past_due  — payment failed, grace period. Treat as locked.
 *   canceled  — ended. Locked.
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'none',
  'active',
  'past_due',
  'canceled',
]);

/**
 * Lifecycle states for a client's custom domain. Enforced at the DB level
 * so a bad write can't leave the row in a state the dashboard can't render.
 *
 *   pending       — row saved, waiting for the agency to add it to Vercel.
 *   provisioning  — added to Vercel, waiting for DNS to propagate.
 *   verified      — Vercel confirmed the domain is serving traffic.
 *   failed        — DNS/verification failed. Check custom_domain_error.
 */
export const customDomainStatusEnum = pgEnum('custom_domain_status', [
  'pending',
  'provisioning',
  'verified',
  'failed',
]);

export const roleEnum = pgEnum('role', ['agency_admin', 'agency_member', 'client']);

// ----- Users + Auth -----
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name'),
    role: roleEnum('role').default('client').notNull(),
    clientId: uuid('client_id'), // set when role='client'
    emailVerified: timestamp('email_verified'),
    image: text('image'),
    /**
     * bcrypt hash of the user's password. Null for users who only use
     * magic-link sign-in (or who were created before password auth landed).
     * Never logged; only compared via `bcrypt.compare`.
     */
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  }),
);

export const magicLinks = pgTable(
  'magic_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('magic_links_token_idx').on(table.tokenHash),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('sessions_token_idx').on(table.tokenHash),
    userIdx: index('sessions_user_idx').on(table.userId),
  }),
);

// ----- Clients -----
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessName: text('business_name').notNull(),
    /**
     * URL-safe slug, unique per client. Used for public site URLs
     * (`/sites/[slug]`). Generated at insert time from businessName, with
     * a numeric suffix appended if a collision is detected.
     */
    slug: text('slug').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').unique().notNull(),
    phone: text('phone'),
    websiteUrl: text('website_url'),
    industry: text('industry'),
    brandVoice: text('brand_voice'),
    brandColors: jsonb('brand_colors').$type<{ primary: string; secondary: string; accent: string }>(),
    logoUrl: text('logo_url'),
    socialAccounts: jsonb('social_accounts').$type<Record<string, string>>(),
    contentStudioWorkspaceId: text('contentstudio_workspace_id'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    subscriptionTier: subscriptionTierEnum('subscription_tier').default('social_only'),
    subscriptionStatus: subscriptionStatusEnum('subscription_status').default('none').notNull(),
    subscriptionStartedAt: timestamp('subscription_started_at'),
    monthlyPriceCents: integer('monthly_price_cents'),
    isActive: boolean('is_active').default(true).notNull(),
    onboardedAt: timestamp('onboarded_at'),
    /** Generated site config (see services/websites.ts::WebsiteConfig). */
    websiteConfig: jsonb('website_config'),
    websiteGeneratedAt: timestamp('website_generated_at'),
    /**
     * Custom domain the client wants their site served on (e.g. `murphysplumbing.com`).
     * Lowercase, no protocol, no trailing slash. When set, the `apps/web`
     * middleware rewrites matching hostnames to `/sites/[slug]` internally.
     */
    customDomain: text('custom_domain'),
    /**
     * Lifecycle of the custom domain:
     *   pending       — row saved, waiting for the agency to add it to Vercel.
     *   provisioning  — added to Vercel, waiting for DNS to propagate.
     *   verified      — Vercel confirmed the domain is serving traffic.
     *   failed        — DNS/verification failed. Check customDomainError.
     */
    customDomainStatus: customDomainStatusEnum('custom_domain_status'),
    customDomainVerifiedAt: timestamp('custom_domain_verified_at'),
    customDomainError: text('custom_domain_error'),
    /**
     * Per-client portal customization. Null means "use portal defaults".
     * When set, lets the agency hide/rename/reorder nav tabs, add extra
     * links, and override the dashboard welcome message — all on a
     * per-company basis so a restaurant's portal can surface a "Menu"
     * link and a plumber's can surface "Book a call".
     *
     * Shape documented in packages/core/src/types.ts as `PortalConfig`.
     */
    portalConfig: jsonb('portal_config').$type<{
      tabs?: Array<{
        key: string;
        label?: string;
        hidden?: boolean;
        order?: number;
      }>;
      customLinks?: Array<{
        id: string;
        label: string;
        href: string;
        icon?: string;
      }>;
      welcomeMessage?: string | null;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('clients_slug_idx').on(table.slug),
    customDomainIdx: uniqueIndex('clients_custom_domain_idx').on(table.customDomain),
  }),
);

// ----- Images -----
export const clientImages = pgTable(
  'client_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name'),
    fileSizeBytes: integer('file_size_bytes'),
    mimeType: text('mime_type'),
    /**
     * Provenance tag: upload | ai | template | canva | stock. Lets the
     * Media Studio filter by "videos I uploaded" vs. "AI-generated" vs.
     * "rendered from a template" vs. "designed in Canva". Nullable so
     * existing rows (pre-migration) default to "upload" in the UI.
     */
    source: text('source'),
    tags: text('tags').array().default([] as unknown as string[]),
    aiDescription: text('ai_description'),
    aiSuggestions: jsonb('ai_suggestions'),
    qualityScore: integer('quality_score'),
    enhancedUrl: text('enhanced_url'),
    status: imageStatusEnum('status').default('pending').notNull(),
    /**
     * Optional link to a product this media depicts. When set, the media
     * is shown in the product's gallery and AI generations targeting
     * that product prefer this media as a reference. Nullable — media
     * doesn't have to belong to a product.
     *
     * Foreign key declared without a `references()` here to avoid a
     * forward-reference cycle with the `products` table (declared later
     * in this file). The constraint is added via migration SQL.
     */
    productId: uuid('product_id'),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index('client_images_client_idx').on(table.clientId),
    productIdx: index('client_images_product_idx').on(table.productId),
  }),
);

// ----- Content batches -----
export const contentBatches = pgTable('content_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  month: text('month').notNull(), // "2026-05"
  imagesAnalyzed: integer('images_analyzed').default(0),
  postsGenerated: integer('posts_generated').default(0),
  postsApproved: integer('posts_approved').default(0),
  postsPublished: integer('posts_published').default(0),
  totalCostCents: integer('total_cost_cents').default(0),
  status: text('status').default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ----- Posts -----
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    batchId: uuid('batch_id').references(() => contentBatches.id),
    imageId: uuid('image_id').references(() => clientImages.id),
    generatedImageUrl: text('generated_image_url'),
    caption: text('caption').notNull(),
    platform: platformEnum('platform').notNull(),
    hashtags: text('hashtags').array().default([] as unknown as string[]),
    scheduledDate: date('scheduled_date'),
    scheduledTime: time('scheduled_time'),
    scheduledAt: timestamp('scheduled_at'),
    status: postStatusEnum('status').default('draft').notNull(),
    clientFeedback: text('client_feedback'),
    contentStudioPostId: text('contentstudio_post_id'),
    engagement: jsonb('engagement'),
    publishedAt: timestamp('published_at'),
    publishError: text('publish_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index('posts_client_idx').on(table.clientId),
    statusIdx: index('posts_status_idx').on(table.status),
    scheduledIdx: index('posts_scheduled_idx').on(table.scheduledAt),
  }),
);

// ----- Messages -----
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    sender: text('sender').notNull(), // 'client' | 'agency'
    senderId: uuid('sender_id'),
    senderName: text('sender_name'),
    body: text('body'),
    attachmentUrl: text('attachment_url'),
    messageType: text('message_type').default('chat'),
    isRead: boolean('is_read').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({ clientIdx: index('messages_client_idx').on(table.clientId) }),
);

// ----- Website change requests -----
export const websiteRequests = pgTable('website_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  description: text('description').notNull(),
  screenshotUrl: text('screenshot_url'),
  priority: text('priority').default('normal'),
  status: requestStatusEnum('status').default('pending').notNull(),
  agencyNotes: text('agency_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ----- Invoices -----
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').default('EUR'),
  description: text('description'),
  lineItems: jsonb('line_items'),
  status: invoiceStatusEnum('status').default('pending').notNull(),
  dueDate: date('due_date'),
  stripeInvoiceId: text('stripe_invoice_id'),
  hostedUrl: text('hosted_url'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
});

// ----- Scheduled job log -----
export const cronRuns = pgTable('cron_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobName: text('job_name').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  status: text('status').default('running'),
  details: jsonb('details'),
});

// ----- Leads (from generated client sites' contact forms) -----
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    message: text('message'),
    source: text('source').default('website_contact'),
    referer: text('referer'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({ clientIdx: index('leads_client_idx').on(table.clientId) }),
);

// ----- Canva connections -----
/**
 * Per-client Canva OAuth tokens. We store one connection per client so
 * the agency can design inside each client's own Canva workspace and
 * export designs straight into the client's media library.
 *
 * Tokens are encrypted at rest only via Postgres / provider encryption;
 * refresh happens on demand when the access token is within 60s of
 * expiry. `updated_at` is bumped on every refresh so we can see staleness.
 */
export const clientCanvaConnections = pgTable(
  'client_canva_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    canvaUserId: text('canva_user_id'),
    canvaTeamId: text('canva_team_id'),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    scopes: text('scopes'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: uniqueIndex('client_canva_connections_client_idx').on(table.clientId),
  }),
);


/* ═══════════════════════════════════════════════════════════════════ */
/* Brand intelligence — inspiration profiles, tone-of-voice pairs,     */
/* and first-class products catalog.                                   */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Lifecycle of an inspiration profile scrape.
 *
 *   idle       — created manually, no scrape run yet.
 *   scraping   — currently fetching + analysing the reference URL.
 *   ready      — scrape complete, profile populated.
 *   failed     — scrape errored; see `scrapeError`.
 */
export const inspirationProfileStatusEnum = pgEnum('inspiration_profile_status', [
  'idle',
  'scraping',
  'ready',
  'failed',
]);

/**
 * Per-client "brands I admire" library. Each row is one named
 * inspiration profile (e.g. "Starbucks", "Patagonia voice", "Apple
 * product photography"). The AI factors selected profiles into every
 * generation so outputs inherit the visual and copy style of the
 * reference — without copying trademarked assets verbatim.
 *
 * A single client can have many profiles. Profiles are created from a
 * reference URL (the scraper pulls copy samples + imagery) or manually.
 */
export const inspirationProfiles = pgTable(
  'inspiration_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),

    /** Human label shown in pickers. */
    name: text('name').notNull(),
    /** The reference site we scrape. Nullable for manual-only profiles. */
    referenceUrl: text('reference_url'),
    /** Optional logo URL pulled from the reference (display-only). */
    logoUrl: text('logo_url'),
    /** Free-form note from the user explaining why they picked this. */
    description: text('description'),

    /** Whether this profile should be factored into generations by default. */
    isEnabled: boolean('is_enabled').default(true).notNull(),

    /**
     * Structured visual analysis produced by Claude Vision after scraping.
     * Shape:
     *   { style, mood, composition, typographyNotes, visualMotifs: string[] }
     * Kept as jsonb so the shape can evolve without migrations.
     */
    visualAnalysis: jsonb('visual_analysis'),

    /**
     * Structured copy-voice analysis produced by Claude.
     * Shape:
     *   { toneDescriptors: string[], sentenceShape, vocabulary: string[],
     *     thingsToDo: string[], thingsToAvoid: string[] }
     */
    copyVoice: jsonb('copy_voice'),

    /** Extracted palette — list of hex colours, most prominent first. */
    colorPalette: jsonb('color_palette').$type<string[]>(),

    /** Snippets of copy lifted verbatim from the reference site, for prompt
     *  injection as "copy in this voice looks like…". */
    copySamples: jsonb('copy_samples').$type<string[]>(),

    status: inspirationProfileStatusEnum('status').default('idle').notNull(),
    scrapeError: text('scrape_error'),
    lastScrapedAt: timestamp('last_scraped_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index('inspiration_profiles_client_idx').on(table.clientId),
  }),
);

/**
 * Media attached to an inspiration profile — reference images/videos
 * the AI will use as visual guidance. These live on R2 under
 * `{clientId}/inspiration-profiles/{profileId}/…` so cleanup is simple.
 *
 * `source`:
 *   - `scrape` — pulled automatically from the reference URL (og:image,
 *     hero images, gallery thumbnails).
 *   - `upload` — the user hand-picked and uploaded.
 */
export const inspirationProfileMedia = pgTable(
  'inspiration_profile_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .references(() => inspirationProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    source: text('source').notNull(), // 'upload' | 'scrape'
    /** Per-item AI description — lets the generator cite specific refs. */
    aiDescription: text('ai_description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    profileIdx: index('inspiration_profile_media_profile_idx').on(table.profileId),
  }),
);

/**
 * Tone-of-voice pair training. Each row is a matched "good copy" /
 * "bad copy" example with an optional category and rationale. The AI
 * consumes these as few-shot examples so the voice guide isn't just
 * "friendly and professional" prose — it's grounded in actual strings.
 *
 *   category — free-form tag (e.g. "product_description", "ig_caption",
 *              "ad_headline"). Nullable for global pairs.
 *   goodExample  — a string the brand is happy with.
 *   badExample   — a string the brand would reject. Nullable if the user
 *                  wants to provide only good examples (still useful).
 *   explanation  — human note explaining *why* one is good and the other
 *                  isn't; injected into the Claude prompt.
 */
export const toneOfVoicePairs = pgTable(
  'tone_of_voice_pairs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    category: text('category'),
    goodExample: text('good_example').notNull(),
    badExample: text('bad_example'),
    explanation: text('explanation'),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index('tone_of_voice_pairs_client_idx').on(table.clientId),
  }),
);

/**
 * Product catalog status.
 *
 *   draft    — work-in-progress, not shown in generation pickers.
 *   active   — live, available as a target for ad/post generation.
 *   archived — retained for history, not shown in pickers.
 */
export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'active',
  'archived',
]);

/**
 * First-class product / service / feature object. Each product is a unit
 * the AI can target for ad or post generation — "make a Reel for product
 * X" — so outputs stay faithful to the actual SKU name, description, and
 * media. Previously this lived as a free-form array inside
 * `websiteConfig.products`; promoting it to a real table lets us:
 *
 *   - query and filter in the UI
 *   - link media (clientImages.productId) so "media of this product"
 *     is a one-query lookup
 *   - track per-product generation history
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** Optional SKU or reference code. */
    sku: text('sku'),
    /** Price in the smallest unit (cents for EUR/USD/GBP). Nullable for
     *  services or "contact for pricing" items. */
    priceCents: integer('price_cents'),
    currency: text('currency').default('EUR'),
    /** Primary hero image URL — duplicated from clientImages for fast list
     *  rendering without a join. */
    primaryImageUrl: text('primary_image_url'),
    /** Arbitrary tags: category, theme, campaign. */
    tags: text('tags').array().default([] as unknown as string[]),
    status: productStatusEnum('status').default('draft').notNull(),
    /** Free-form metadata: dimensions, materials, features, etc. */
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index('products_client_idx').on(table.clientId),
    statusIdx: index('products_status_idx').on(table.status),
  }),
);


/* ═══════════════════════════════════════════════════════════════════ */
/* Personal content automation                                          */
/*                                                                      */
/* A parallel content pipeline for the operator's own social accounts   */
/* (personal IG / TikTok / FB / YouTube Shorts), separate from the      */
/* client-facing agency tables. Each personal account locks to a        */
/* viral-content theme (educational, brainrot, finance, news, …) and   */
/* auto-generates N videos per day, fully automated.                    */
/*                                                                      */
/* These tables are owned by the authenticated user, not by a client    */
/* row, so they never leak into the client-scoped pipeline.             */
/* ═══════════════════════════════════════════════════════════════════ */

/** Lifecycle of a personal account's automation. */
export const personalAccountStatusEnum = pgEnum('personal_account_status', [
  'active',
  'paused',
  'archived',
]);

/** Lifecycle of a single generated personal post. */
export const personalPostStatusEnum = pgEnum('personal_post_status', [
  'queued',           // job enqueued, not started
  'scripting',        // Claude is writing the hook/script
  'sourcing_media',   // Pulling images/video from scrapers + AI
  'rendering',        // Remotion renderer running
  'ready',            // MP4 uploaded, awaiting schedule
  'scheduled',        // Posted to ContentStudio, awaiting publish
  'published',        // Live on the platform
  'failed',           // Errored out — see errorMessage
]);

/**
 * One personal social account. "@financebite_ig" is one row; "@financebite_tiktok"
 * is another. Each is locked to a single theme. Optional **scheduled generation**
 * (`auto_generate_on_schedule`) drives the 5-minute cron when `next_run_at` is due;
 * otherwise new videos start only from Generate.
 *
 * `themeId` references a theme in `services/personalThemes.ts` (no FK —
 * themes live in code so we can ship new ones without a migration).
 */
export const personalAccounts = pgTable(
  'personal_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    /** Display label — "FinanceBite IG", "DeepHistory TikTok", etc. */
    accountName: text('account_name').notNull(),
    /** The platform this account posts to. */
    platform: platformEnum('platform').notNull(),
    /** The @handle as it appears on the platform (informational). */
    handle: text('handle'),
    /** The ContentStudio workspace id the scheduler will post to. */
    contentStudioWorkspaceId: text('contentstudio_workspace_id'),
    /**
     * When set, schedules posts to this ContentStudio connected account id
     * (see GET …/contentstudio/accounts). Otherwise the first account for
     * `platform` in the workspace is used.
     */
    contentStudioAccountId: text('contentstudio_account_id'),

    /** Theme lock — see `services/personalThemes.ts::THEMES`. */
    themeId: text('theme_id').notNull(),
    /**
     * Free-form custom direction that layers on top of the theme defaults.
     * Example for a finance account: "focus on index funds and long-term
     * thinking, avoid day-trading or crypto hype".
     */
    customDirection: text('custom_direction'),
    /**
     * List of specific topic seeds the user wants covered (optional).
     * The generator picks one per post and rotates through them.
     */
    topicSeeds: text('topic_seeds').array().default([] as unknown as string[]),
    /**
     * Topics to explicitly avoid (trademarks, sensitive areas, politics, …).
     */
    topicBlacklist: text('topic_blacklist').array().default([] as unknown as string[]),

    /** Language for voiceover + captions. ISO 639-1. */
    language: text('language').default('en').notNull(),
    /** Preferred TTS voice id (provider-neutral — resolved in services/tts.ts). */
    voiceId: text('voice_id'),
    /** Accent / locale hint — 'en-US', 'en-GB', 'es-MX', … */
    locale: text('locale'),

    /** How many posts per day this account generates. 1–4. */
    postsPerDay: integer('posts_per_day').default(1).notNull(),
    /** UTC hour-of-day the scheduler starts generating (0-23). */
    postingHourUtc: integer('posting_hour_utc').default(8).notNull(),
    /** UTC minute within the hour (0-59). */
    postingMinuteUtc: integer('posting_minute_utc').default(0).notNull(),
    /** Minutes between posts when postsPerDay > 1. */
    postSpacingMinutes: integer('post_spacing_minutes').default(240).notNull(),
    /** When true, newly-generated posts skip the review queue. */
    autoApprove: boolean('auto_approve').default(true).notNull(),
    /** When false, generation still runs but scheduling is skipped. */
    autoSchedule: boolean('auto_schedule').default(true).notNull(),
    /**
     * When true, the API scheduler may call `generateForAccount` when
     * `next_run_at` is due. When false, new videos only start from Generate.
     */
    autoGenerateOnSchedule: boolean('auto_generate_on_schedule').default(false).notNull(),

    /** Brand accent color for on-screen text / progress bars. */
    accentColor: text('accent_color').default('#FFEC3D'),
    /** Logo overlay displayed in the corner of rendered videos. Nullable. */
    logoUrl: text('logo_url'),
    /** Watermark handle shown in-frame (e.g. "@financebite"). */
    watermarkHandle: text('watermark_handle'),

    status: personalAccountStatusEnum('status').default('active').notNull(),
    lastGeneratedAt: timestamp('last_generated_at'),
    nextRunAt: timestamp('next_run_at'),
    totalPosts: integer('total_posts').default(0).notNull(),

    /* ── Style bible + generator config (JSONB blobs) ─────── */
    /** User-written "this is the vibe" guide, palette, motifs, banned phrases. */
    styleBible: jsonb('style_bible').$type<PersonalAccountStyleBible>(),
    /** Provider selection, on/off switches, quality tier. */
    generatorConfig: jsonb('generator_config').$type<PersonalGeneratorConfig>(),
    /** Default character for this account (optional). */
    characterId: uuid('character_id'),

    /**
     * Primary output format for this account.
     *
     *   video        — full narrated short with beats + music (default)
     *   slideshow    — image-only carousel with beat transitions
     *   static_image — single still image post (no motion)
     */
    formatKind: text('format_kind').default('video').notNull(),

    /** Optional user-uploaded audio bed URL. Takes priority over music picker. */
    customAudioUrl: text('custom_audio_url'),
    customAudioAttribution: text('custom_audio_attribution'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('personal_accounts_user_idx').on(table.userId),
    statusIdx: index('personal_accounts_status_idx').on(table.status),
    nextRunIdx: index('personal_accounts_next_run_idx').on(table.nextRunAt),
    characterIdx: index('personal_accounts_character_idx').on(table.characterId),
  }),
);

/** One line in {@link personalPosts.renderActivityLog} while a post is encoding. */
export interface PersonalPostRenderActivityEntry {
  at: string;
  m: string;
}

/**
 * One row per generated post. Stores the full pipeline — script, assets,
 * rendered MP4, platform id — so re-rendering or debugging is a single
 * join away.
 */
export const personalPosts = pgTable(
  'personal_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .references(() => personalAccounts.id, { onDelete: 'cascade' })
      .notNull(),

    /** The viral-format template used for this render (remotion id). */
    templateId: text('template_id').notNull(),
    /** 'video' | 'slideshow' | 'static_image' — what we actually shipped. */
    postKind: text('post_kind').default('video').notNull(),
    /** Topic / angle chosen by the concept engine for this post. */
    topic: text('topic').notNull(),
    /** Claude's planned script: title, hook, body, outro, captions. */
    script: jsonb('script').notNull(),
    /** TTS audio URL — null when the template is silent. */
    voiceoverUrl: text('voiceover_url'),
    /** Background music URL + attribution metadata. */
    musicUrl: text('music_url'),
    musicAttribution: text('music_attribution'),
    /**
     * Ordered media assets used in the render. Each entry:
     *   { url, kind: 'image'|'video', source: 'pexels'|'unsplash'|'wikipedia'|'ai'|'news',
     *     attribution?, creditUrl? }
     */
    mediaAssets: jsonb('media_assets').$type<PersonalPostMediaAsset[]>(),
    /** The rendered MP4 URL on R2. */
    videoUrl: text('video_url'),
    /** Custom poster / YouTube thumbnail (JPEG on R2), e.g. long-form YouTube uploads. */
    thumbnailUrl: text('thumbnail_url'),
    /** Platform-specific caption (emoji + hashtags). */
    caption: text('caption'),
    hashtags: text('hashtags').array().default([] as unknown as string[]),
    /** Duration in seconds of the rendered MP4. */
    durationSeconds: integer('duration_seconds'),
    /** Quality score 0–100 from Claude after review. */
    qualityScore: integer('quality_score'),

    /** ContentStudio post id once scheduled. */
    contentStudioPostId: text('contentstudio_post_id'),
    scheduledAt: timestamp('scheduled_at'),
    publishedAt: timestamp('published_at'),
    publishUrl: text('publish_url'),

    status: personalPostStatusEnum('status').default('queued').notNull(),
    /** 0–100 while encoding (director stitch / Remotion); null when idle. */
    renderProgress: integer('render_progress'),
    /** Short human-readable encode phase for the dashboard (e.g. "Encoding shot 3/12…"). */
    renderProgressLabel: text('render_progress_label'),
    /** Recent encode log lines (timestamp + message) for "not stuck" UI; capped in the API. */
    renderActivityLog: jsonb('render_activity_log').$type<PersonalPostRenderActivityEntry[]>(),
    errorMessage: text('error_message'),
    /** Generation cost in cents (sum of Claude + TTS + scraper + render). */
    costCents: integer('cost_cents').default(0),

    /** Rolling engagement stats, hydrated by the analytics poller. */
    engagement: jsonb('engagement'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('personal_posts_account_idx').on(table.accountId),
    statusIdx: index('personal_posts_status_idx').on(table.status),
    scheduledIdx: index('personal_posts_scheduled_idx').on(table.scheduledAt),
  }),
);

/**
 * Cache of scraped external assets (Pexels/Unsplash/Wikipedia/Google News)
 * so we don't re-hit third-party APIs for repeated topics. Keyed by
 * source+query and expires after 7 days.
 */
export const personalScrapedAssets = pgTable(
  'personal_scraped_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 'pexels' | 'unsplash' | 'wikipedia' | 'google_news' | 'pixabay' */
    source: text('source').notNull(),
    /** Normalized search query used to fetch this batch. */
    queryKey: text('query_key').notNull(),
    /** 'image' | 'video' | 'music' | 'article' */
    assetType: text('asset_type').notNull(),
    /** Raw payload from the API (array of items). */
    items: jsonb('items').$type<PersonalScrapedItem[]>().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    lookupIdx: uniqueIndex('personal_scraped_lookup_idx').on(
      table.source,
      table.queryKey,
      table.assetType,
    ),
  }),
);

/** Shape of a media asset used inside personalPosts.mediaAssets. */
export interface PersonalPostMediaAsset {
  url: string;
  kind: 'image' | 'video';
  source:
    | 'pexels'
    | 'unsplash'
    | 'wikipedia'
    | 'pixabay'
    | 'ai'
    | 'news'
    | 'upload'
    | 'gameplay';
  attribution?: string;
  creditUrl?: string;
  width?: number;
  height?: number;
  focalX?: number;
  focalY?: number;
  /** Frame-range start (in seconds) this asset should own in the rendered video. */
  startAtSeconds?: number;
  /** Duration (in seconds) this asset should be on-screen. */
  durationSeconds?: number;
}

/** Shape of a single scraped item. */
export interface PersonalScrapedItem {
  url: string;
  /** Alternate higher-quality download URL when the provider offers one. */
  downloadUrl?: string;
  kind: 'image' | 'video' | 'music' | 'article';
  width?: number;
  height?: number;
  durationSeconds?: number;
  title?: string;
  description?: string;
  attribution?: string;
  creditUrl?: string;
  thumbnailUrl?: string;
}


/* ═══════════════════════════════════════════════════════════════════ */
/* Personal account assets & AI-influencer characters                  */
/*                                                                      */
/* Adds three concepts that lift the personal pipeline above generic    */
/* "AI slop":                                                           */
/*                                                                      */
/* 1. personal_account_media — user-uploaded reference media per       */
/*    account (a look book). Each asset carries a user-written         */
/*    description + tags + role ("style reference", "avatar", "B-roll",*/
/*    "brand asset") so the generator can pull exactly the right       */
/*    reference for each job.                                          */
/*                                                                      */
/* 2. personal_characters — reusable AI-influencer personas, each      */
/*    distilled from 1-10 reference images into a persistent character *
/*    sheet (appearance, wardrobe, voice, vibe). Every generation for  */
/*    that character then injects the sheet + reference images so the  */
/*    same face and body show up consistently across videos.           */
/*                                                                      */
/* 3. New columns on personal_accounts for: a style bible, a generator *
/*    configuration blob, voiceover settings, and a default character  */
/*    pointer.                                                         */
/* ═══════════════════════════════════════════════════════════════════ */

/** Role a reference asset plays in a generation. */
export const personalMediaRoleEnum = pgEnum('personal_media_role', [
  'style_reference',    // look/feel/palette guidance
  'avatar_reference',   // reference face/body for character consistency
  'brand_asset',        // logo, watermark, title card
  'broll',              // general footage for compositing
  'voice_sample',       // TTS voice clone source
  'music',              // custom music bed
  'inspiration',        // "make content like this"
  'location',           // background / environment
  'product',            // product being featured
]);

/** A single asset uploaded by the user into an account's library. */
export const personalAccountMedia = pgTable(
  'personal_account_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .references(() => personalAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    /** 'image' | 'video' | 'audio' */
    kind: text('kind').notNull(),
    role: personalMediaRoleEnum('role').default('inspiration').notNull(),
    /**
     * User-written description of what this asset is and how they want
     * the AI to use it. Free text, up to a few paragraphs. This is the
     * most important field for avoiding AI slop — the description lets
     * the user say exactly what "vibe" they want captured.
     *
     *   "This is the exact aesthetic I want — golden hour, 35mm film
     *    grain, slightly desaturated. Every video for this account
     *    should feel like this."
     */
    description: text('description'),
    /** Short tags for filtering. Free-form strings. */
    tags: text('tags').array().default([] as unknown as string[]),
    /** Claude's auto-description of the image, used as extra signal. */
    aiDescription: text('ai_description'),
    /** When true, the generator always prefers this asset when relevant. */
    isPinned: boolean('is_pinned').default(false).notNull(),
    /** When true, the asset is excluded from generation (kept for reference). */
    isArchived: boolean('is_archived').default(false).notNull(),
    /** Optional character this asset belongs to (avatar refs). */
    characterId: uuid('character_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('personal_account_media_account_idx').on(table.accountId),
    roleIdx: index('personal_account_media_role_idx').on(table.role),
    characterIdx: index('personal_account_media_character_idx').on(table.characterId),
  }),
);

/** Lifecycle of an AI-influencer character's training. */
export const personalCharacterStatusEnum = pgEnum('personal_character_status', [
  'draft',       // created, no reference images yet
  'analyzing',   // Claude Vision is distilling refs → sheet
  'ready',       // sheet complete, character usable
  'failed',
]);

/**
 * An AI-influencer persona. One row per character. The character sheet
 * is generated once by Claude Vision from the reference images, then
 * reused in every subsequent generation that targets this character —
 * so the "same person" shows up across videos without drift.
 *
 * A character can be attached to multiple accounts (e.g. a cooking
 * creator with an IG channel and a TikTok channel both use the same
 * face).
 */
export const personalCharacters = pgTable(
  'personal_characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    /** Short persona summary (18-year-old rocket scientist etc). */
    tagline: text('tagline'),
    /** Free-form detailed persona description. */
    backstory: text('backstory'),
    /**
     * Character sheet distilled from the reference images by Claude Vision.
     * Shape:
     * {
     *   appearance: { age, gender, ethnicity, hair, eyes, build, face, distinguishing },
     *   wardrobe:   { signature, palette, fabrics, accessories },
     *   setting:    { typicalEnvironment, lighting, props },
     *   voice:      { tone, pace, accent, vocabulary, catchphrases },
     *   vibe:       string[],
     *   doNotUse:   string[],
     * }
     */
    characterSheet: jsonb('character_sheet'),
    /**
     * Prompt fragment the generator injects verbatim when creating
     * images/videos for this character. Auto-generated from the sheet
     * but editable. Example:
     *   "A 28-year-old Korean woman with long black hair, round glasses,
     *    warm smile, wearing an oversized beige cardigan over a white
     *    tee, photographed in soft morning light at a minimalist desk
     *    with plants in the background, 35mm film aesthetic."
     */
    promptFragment: text('prompt_fragment'),
    /** Negative prompt — things to exclude ("no neon", "no tattoos"). */
    negativePrompt: text('negative_prompt'),
    /** TTS voice id this character speaks with. */
    voiceId: text('voice_id'),
    /** Locale the voice reads in. */
    locale: text('locale'),
    /** Current training state. */
    status: personalCharacterStatusEnum('status').default('draft').notNull(),
    /** Error from the last analysis run, if any. */
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('personal_characters_user_idx').on(table.userId),
  }),
);

/* ═══════════════════════════════════════════════════════════════════ */
/* Additional columns on personal_accounts                              */
/*                                                                      */
/* Declared at migration time via SQL — Drizzle merges these into the   */
/* existing table. Also surfaced below as re-exports on the table       */
/* object so typed queries pick them up.                                */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * Style bible + generator config type shapes. Stored on personal_accounts
 * as JSONB so schema evolves without migrations.
 */
export interface PersonalAccountStyleBible {
  /** Written description of the "vibe" — pasted verbatim into prompts. */
  vibe?: string;
  /** Things the account must always do. */
  dos?: string[];
  /** Things the account must never do (anti-slop guardrails). */
  donts?: string[];
  /** Reference color palette (hex codes). */
  palette?: string[];
  /** Typography / text styling hint. */
  typography?: string;
  /** Visual motifs to repeat ("always wide shot", "always handheld"). */
  motifs?: string[];
  /** Writing samples — Claude mimics these. */
  copySamples?: string[];
  /** Example video titles — inspire pacing and specificity; do not copy verbatim. */
  exampleVideoTitles?: string[];
  /**
   * Optional freeform notes for the title model (tone, curiosity angle, taboo patterns).
   * Shown only when generating the locked video title — not general script rules.
   */
  videoTitleGuidance?: string;
  /** Example script lines / hooks — inspire tone and rhythm only. */
  exampleScriptSnippets?: string[];
  /**
   * Full reference scripts (one string per script). Injected for structure,
   * pacing, and tone — the model must not copy wording or claims verbatim.
   */
  referenceFullScripts?: string[];
  /** Banned clichés — strings the script must not contain. */
  bannedPhrases?: string[];
}

export interface PersonalGeneratorConfig {
  /* ── Provider choices ─────────────────────────────────────── */
  /** Primary image generator. */
  imageModelId?: string;     // 'flux-pro-ultra' | 'nano-banana' | 'ideogram-v2' | 'seedream' | …
  /** Primary video generator. */
  videoModelId?: string;     // 'sora-2' | 'veo-3' | 'kling-v2' | 'runway-gen4' | 'minimax-hailuo' | 'none'
  /** TTS provider + voice. */
  ttsProvider?: 'elevenlabs' | 'openai' | 'cartesia' | 'none';
  ttsVoiceId?: string;
  /**
   * When `ttsVoiceId` is unset or `default`, maps to stock voices per provider.
   * `british` uses UK-leaning presets (OpenAI: fable/shimmer; ElevenLabs: Charlotte / Arnold).
   */
  voiceAccent?: 'american' | 'british';
  /** When `ttsVoiceId` is unset or `default`, picks male vs female stock voice. */
  voiceGender?: 'female' | 'male';

  /* ── On / off switches (configurable per-account) ─────────── */
  useVoiceover?: boolean;
  useMusic?: boolean;
  useSubtitles?: boolean;
  useAiVideo?: boolean;       // generate net-new video with Sora/Veo
  useAiImages?: boolean;      // generate still images with Flux/NanoBanana
  useScrapedMedia?: boolean;  // pull from Pexels/Unsplash/Wikipedia
  useCharacter?: boolean;     // inject character sheet into every gen

  /* ── Quality knobs ────────────────────────────────────────── */
  /** 'max' forces paid / top-tier models. 'balanced' picks mid-tier. 'budget' uses cheapest. */
  qualityTier?: 'max' | 'balanced' | 'budget';
  /** Aspect ratio. Defaults to 9:16 (Reels/TikTok). */
  aspectRatio?: '9:16' | '1:1' | '16:9' | '4:5';
  /** Minimum duration for AI-generated video clips (seconds). */
  clipMinSeconds?: number;
  /** Maximum duration for AI-generated video clips (seconds). */
  clipMaxSeconds?: number;
  /**
   * Target average seconds per beat (script path) or per shot (director prompt hint).
   * Clamped when applied (roughly 2–10s). Optional; defaults follow theme.
   */
  averageClipSeconds?: number;
  /**
   * Visual sourcing bias: `mixed` (default), still frames only, prefer motion clips,
   * or motion-only (no still-first shots — scraped/AI video where possible).
   */
  mediaPreference?: 'mixed' | 'stills_only' | 'motion_preferred' | 'video_only';
  /**
   * Edit rhythm — affects director shot duration clamps and how many cuts to plan.
   * `rapid` = shorter shots, more frequent scene changes (configurable feel).
   */
  cutPace?: 'relaxed' | 'normal' | 'rapid';
  /**
   * Optional keyword "pop" lower-third cards (names, places, stats) — not full captions.
   * `off` disables; `subtle` / `bold` tune director + overlay styling.
   */
  keywordPopStyle?: 'off' | 'subtle' | 'bold';
  /** When true, the director must add `imageCaption` on many ai_image shots for spoken dates, names, places, and key stats (≤4 words each). */
  allowSparseImageText?: boolean;
  /** TTS playback speed (0.85–1.2). OpenAI + ElevenLabs where supported. */
  ttsSpeed?: number;
  /**
   * Music level under voiceover in FFmpeg stitch (0.05–0.55). Default 0.22.
   */
  musicDuckUnderVoice?: number;
  /** Music level when there is no VO (solo bed), FFmpeg stitch. Default 0.55. */
  musicSoloVolume?: number;
  /** Remotion template background music gain 0–1 (optional). */
  musicBedVolume?: number;
  /** If true, scripts and director narration must stay grounded in verifiable facts. */
  trueStoriesOnly?: boolean;
  /** Freeform rules (multi-line) appended to script + director prompts. */
  extraContentRules?: string;

  /** Skip posts whose quality score is below this (0-100). */
  minQualityScore?: number;

  /* ── Research / grounding ─────────────────────────────────── */
  /** Let Claude browse recent web/news when writing scripts. */
  allowWebResearch?: boolean;
  /** Claude model for scriptwriting. */
  scriptModel?: 'sonnet' | 'opus';
  /**
   * When true the pipeline uses the multi-shot DIRECTOR path: storyboard
   * → per-shot generation → FFmpeg stitch. Produces editorial-quality
   * output with real cuts. Default true for new accounts.
   */
  useDirector?: boolean;
  /** Colour grade hint fed to FFmpeg after stitching. */
  colourGrade?:
    | 'natural'
    | 'warm'
    | 'cool'
    | 'teal_orange'
    | 'film'
    | 'bw'
    | 'high_contrast';
  /** Apply subtle letterbox bars. */
  letterbox?: boolean;
  /** Apply film-grain overlay. */
  filmGrain?: boolean;
  /**
   * When false, still images are encoded as static frames (no Ken Burns zoom/pan).
   * Default true.
   */
  kenBurnsOnStills?: boolean;

  /* ── Viral format + hook (optional) ──────────────────────── */
  /**
   * Viral format id from `VIRAL_FORMATS` (e.g. `problem-demo-payoff`,
   * `listicle-countdown`, `hook-build-payoff`). When set, the director
   * must hit the format's beat structure. When unset, the director
   * keeps its default behaviour.
   */
  viralFormatId?: string;
  /**
   * Hook formula id from `HOOK_FORMULAS` (e.g. `bold-claim`,
   * `curiosity-gap`). When set, the first shot's voiceover/onScreen
   * must follow the formula.
   */
  hookFormulaId?: string;

  /* ── Long-form animated explainer (1–8 min) ───────────────── */
  /**
   * When true the director plans a CHAPTER-structured storyboard
   * (5-8 chapters × 3-5 shots each) suitable for 60–480s videos. The
   * pipeline drops the usual short-form caps so we can render minutes
   * of content instead of seconds.
   */
  longformEnabled?: boolean;
  /**
   * Target runtime in seconds when longform is on. Clamped to 60–480
   * (1–8 minutes). Ignored when `longformEnabled` is false.
   */
  longformTargetSeconds?: number;
  /**
   * Visual style preset. Layered into every AI shot prompt so the
   * look stays consistent across all 30–60+ shots in the video.
   *
   *   storybook       — painterly, hand-drawn folk-tale look
   *   cartoon         — Kurzgesagt-style flat vector cartoon
   *   stick_figure    — minimalist whiteboard / napkin sketches
   *   claymation      — stop-motion clay / felt textures
   *   pixel_art       — retro 16-bit pixel scenes
   *   watercolour     — soft painted illustration
   *   custom          — no preset; fall back to the theme's visual
   *                     style plus any inspiration refs
   */
  longformAnimationStyle?:
    | 'storybook'
    | 'cartoon'
    | 'stick_figure'
    | 'claymation'
    | 'pixel_art'
    | 'watercolour'
    | 'custom';
  /**
   * Max AI-video shots in longform mode. Defaults scale with quality
   * tier (budget: 2, balanced: 5, max: 10). The rest of the shots
   * fall back to AI-image + Ken Burns, which is ~10× cheaper.
   */
  longformMaxAiVideoShots?: number;

  /**
   * FFmpeg encode quality when `PERSONAL_STITCH_PRESET` / `PERSONAL_STITCH_CRF`
   * are unset: `fast` = drafts, `balanced` = default, `high` = cleaner masters (more CPU).
   */
  stitchEncodePreset?: 'fast' | 'balanced' | 'high';
}

/** Shape of a character sheet distilled from reference images. */
export interface PersonalCharacterSheet {
  appearance: {
    age?: string;
    gender?: string;
    ethnicity?: string;
    hair?: string;
    eyes?: string;
    build?: string;
    face?: string;
    distinguishing?: string[];
  };
  wardrobe: {
    signature?: string;
    palette?: string[];
    fabrics?: string[];
    accessories?: string[];
  };
  setting: {
    typicalEnvironment?: string;
    lighting?: string;
    props?: string[];
  };
  voice: {
    tone?: string;
    pace?: string;
    accent?: string;
    vocabulary?: string;
    catchphrases?: string[];
  };
  vibe?: string[];
  doNotUse?: string[];
}

/* ═══════════════════════════════════════════════════════════════════ */
/* View/helper types only — actual column definitions live in SQL      */
/* migration 0010 and are consumed via Drizzle's raw-column mapping.   */
/*                                                                      */
/* We intentionally do not re-define personal_accounts here; instead    */
/* the migration adds the new columns and we read/write them through   */
/* getDb().execute for the typed-jsonb bits and through the existing   */
/* column accessors for the rest.                                      */
/* ═══════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════ */
/* Personal custom themes                                               */
/*                                                                      */
/* Lets the user add their own niches (or clone-to-edit the built-in   */
/* ones) without a code change. Stored per-user. On listing, these are */
/* merged with the built-in THEMES from code; when the ids collide,    */
/* the custom row wins ("override" semantics).                         */
/* ═══════════════════════════════════════════════════════════════════ */

export const personalCustomThemes = pgTable(
  'personal_custom_themes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** Stable slug used as theme id in personal_accounts.theme_id. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline').notNull(),
    description: text('description').notNull(),
    emoji: text('emoji').notNull().default('✨'),
    accentColor: text('accent_color').notNull().default('#6366F1'),
    viralityScore: integer('virality_score').default(7).notNull(),
    cpmTier: text('cpm_tier').default('medium').notNull(),
    /** Array of platforms this theme posts to. */
    preferredPlatforms: text('preferred_platforms').array().default([] as unknown as string[]),
    /** Template id from PersonalTemplateId — viral-text, slideshow, etc. */
    template: text('template').default('viral-text').notNull(),
    /** Ordered media sources. */
    mediaSources: text('media_sources').array().default([] as unknown as string[]),
    useVoiceover: boolean('use_voiceover').default(true).notNull(),
    useMusic: boolean('use_music').default(true).notNull(),
    hookFormulas: text('hook_formulas').array().default([] as unknown as string[]),
    topicSeeds: text('topic_seeds').array().default([] as unknown as string[]),
    voiceGuide: text('voice_guide').notNull().default(''),
    visualStyle: text('visual_style').notNull().default(''),
    musicMood: text('music_mood').default(''),
    targetDurationSeconds: integer('target_duration_seconds').default(35).notNull(),
    defaultHashtags: text('default_hashtags').array().default([] as unknown as string[]),
    requiresGroundedImages: boolean('requires_grounded_images').default(false).notNull(),
    defaultFormat: text('default_format').default('video'),
    /** When true, this row overrides a same-slug built-in. */
    overridesBuiltin: boolean('overrides_builtin').default(false).notNull(),
    /** Optional note shown in the UI ("cloned from Finance Bite"). */
    derivedFrom: text('derived_from'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('personal_custom_themes_user_idx').on(table.userId),
    slugIdx: uniqueIndex('personal_custom_themes_user_slug_idx').on(table.userId, table.slug),
  }),
);
