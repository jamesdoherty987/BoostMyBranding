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
    customDomainStatus: text('custom_domain_status'),
    customDomainVerifiedAt: timestamp('custom_domain_verified_at'),
    customDomainError: text('custom_domain_error'),
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
    tags: text('tags').array().default([] as unknown as string[]),
    aiDescription: text('ai_description'),
    aiSuggestions: jsonb('ai_suggestions'),
    qualityScore: integer('quality_score'),
    enhancedUrl: text('enhanced_url'),
    status: imageStatusEnum('status').default('pending').notNull(),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  },
  (table) => ({ clientIdx: index('client_images_client_idx').on(table.clientId) }),
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
