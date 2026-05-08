/**
 * Shared domain types across apps. Mirrors the Drizzle schema in
 * packages/database/src/schema.ts, plus the lightweight shape used by mock
 * fixtures (`scheduledFor`, `imageUrl`). UIs normalize both via helpers in
 * this package.
 */

export type Platform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'pinterest'
  | 'bluesky'
  | 'youtube'
  | 'google_business';

export type PostStatus =
  | 'draft'
  | 'pending_internal'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rejected';

export type ImageStatus = 'pending' | 'analyzing' | 'approved' | 'rejected' | 'enhanced' | 'used';

export type SubscriptionTier = 'social_only' | 'website_only' | 'full_package';

/**
 * Lifecycle state of a client's Stripe subscription.
 * - `none`: signed up but never paid — features locked
 * - `active`: paying in good standing
 * - `past_due`: payment failed, grace period
 * - `canceled`: previously paid, no longer — features locked
 */
export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';

export interface Client {
  id: string;
  businessName: string;
  /** URL-safe slug used for public site URLs (/sites/[slug]). Optional on the
   *  mock shape; present on all real DB rows. */
  slug?: string;
  contactName: string;
  email: string;
  /** Industry is nullable in the DB — treat as optional in the UI. */
  industry?: string | null;
  /**
   * Contact phone number. Optional in the DB and not present on mock
   * fixtures, so typed as nullable. Used by the agency-side client
   * editor, never shown directly in the portal.
   */
  phone?: string | null;
  /**
   * Free-text brand voice notes. Used by the AI when generating copy and
   * by the agency for account-manager handovers. Nullable in the DB.
   */
  brandVoice?: string | null;
  logoUrl?: string;
  brandColors?: { primary: string; secondary: string; accent: string };
  subscriptionTier: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartedAt?: string | null;
  stripeCustomerId?: string | null;
  /** Null when the agency hasn't set a monthly price yet. */
  monthlyPriceCents?: number | null;
  isActive: boolean;
  /** Nullable — set once the client finishes onboarding. */
  onboardedAt?: string | null;
  websiteUrl?: string;
  socialAccounts?: Record<string, string>;
  /** Generated website config JSON blob. Present on DB rows once a site is generated. */
  websiteConfig?: unknown;
  websiteGeneratedAt?: string | Date | null;
  /** Custom domain attached to the client's site (e.g. `murphysplumbing.com`).
   *  Lowercase, no protocol. Null/undefined until the agency attaches one. */
  customDomain?: string | null;
  customDomainStatus?: 'pending' | 'provisioning' | 'verified' | 'failed' | null;
  customDomainVerifiedAt?: string | Date | null;
  /**
   * Roll-up engagement stats. Computed by the API on demand and attached
   * to mock client rows. Real DB rows may not have it, so this field is
   * optional — UI code should default to zero when missing.
   */
  stats?: {
    postsThisMonth: number;
    pendingApproval: number;
    imagesUploaded: number;
    engagementRate: number;
  };
  /**
   * Per-client portal customization. Null/undefined means "use defaults",
   * so this field is safe to leave out on clients who haven't been
   * customized yet. When present, the portal nav + dashboard greeting
   * are tailored per client — see `PortalConfig` below for the shape.
   */
  portalConfig?: PortalConfig | null;
}

/**
 * Identifier for a portal tab. Kept as a string union so the type
 * narrows when consumers flip switches, while still letting the DB
 * accept forward-compatible tab keys we haven't shipped yet.
 */
export type PortalTabKey = 'home' | 'upload' | 'calendar' | 'chat' | 'settings';

/**
 * Per-client portal customization. Stored as a single JSONB blob on the
 * `clients` row. The shape is deliberately small so the agency-side
 * editor stays focused; richer theming (logos, font overrides) can slot
 * in later without another migration.
 *
 * Semantics:
 *   - `tabs` is an *override list*. Built-in tabs not mentioned use
 *     their default label + ordering. A tab with `hidden: true` is
 *     removed from the bottom nav entirely (still routable — we don't
 *     break deep links). Reorder by setting `order` (lower = earlier);
 *     tabs without an `order` are appended in the default sequence.
 *   - `customLinks` are extra entries appended after the built-in tabs.
 *     Useful for brand-specific actions like "Menu" or "Book a call".
 *   - `welcomeMessage` replaces the default "Hi, {name} 👋" greeting on
 *     the portal dashboard hero when set.
 */
export interface PortalConfig {
  tabs?: Array<{
    key: PortalTabKey | string;
    /** Override the default label. Falsy = keep default. */
    label?: string;
    /** Hide the tab from the bottom nav entirely. */
    hidden?: boolean;
    /**
     * Manual order. Lower values come first. Tabs without an order use
     * the built-in ordering (home, upload, calendar, chat, settings).
     */
    order?: number;
  }>;
  customLinks?: Array<{
    /** Stable id the UI uses as a React key + form id. */
    id: string;
    label: string;
    /** Absolute or root-relative URL. Validated before save. */
    href: string;
    /** Lucide icon name to render in the nav. Defaults to a link glyph. */
    icon?: string;
  }>;
  /**
   * Custom greeting on the dashboard hero. Null = use default. Empty
   * string is treated the same as null so the agency can clear it.
   */
  welcomeMessage?: string | null;
}

/**
 * Return a client's stats with safe zero-defaults. Use this everywhere
 * in the UI instead of `client.stats.X` — the DB doesn't include `stats`
 * on real clients, only mocks do.
 */
export function getClientStats(client: Pick<Client, 'stats'> | null | undefined) {
  const s = client?.stats;
  return {
    postsThisMonth: s?.postsThisMonth ?? 0,
    pendingApproval: s?.pendingApproval ?? 0,
    imagesUploaded: s?.imagesUploaded ?? 0,
    engagementRate: s?.engagementRate ?? 0,
  };
}

/** True when a client has paid and is in good standing. */
export function hasActiveSubscription(
  c: Pick<Client, 'subscriptionStatus'> | null | undefined,
): boolean {
  if (!c) return false;
  return c.subscriptionStatus === 'active' || c.subscriptionStatus === 'past_due';
}

/**
 * Default portal tab definitions in natural order. Agencies can hide,
 * rename, or reorder these per client via `PortalConfig.tabs`, but the
 * keys themselves are fixed (the portal routes them to real URLs).
 *
 * `tiers` controls which subscription tiers a tab is relevant to. It's
 * the data model's source of truth — the bottom nav and the
 * team-dashboard editor both read this.
 */
export const DEFAULT_PORTAL_TABS: Array<{
  key: PortalTabKey;
  label: string;
  href: string;
  tiers: SubscriptionTier[] | 'all';
  /** Icon name (lucide). Stored as a string so it can be serialized. */
  icon: string;
}> = [
  { key: 'home', label: 'Home', href: '/portal/dashboard', tiers: 'all', icon: 'Home' },
  {
    key: 'upload',
    label: 'Upload',
    href: '/portal/upload',
    tiers: ['social_only', 'full_package'],
    icon: 'Upload',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    href: '/portal/calendar',
    tiers: ['social_only', 'full_package'],
    icon: 'CalendarDays',
  },
  { key: 'chat', label: 'Chat', href: '/portal/chat', tiers: 'all', icon: 'MessageSquare' },
  { key: 'settings', label: 'You', href: '/portal/settings', tiers: 'all', icon: 'User' },
];

/**
 * Compute the final list of portal tabs for a specific client, merging
 * their per-client overrides with the built-in defaults. Pure function —
 * safe to call from both server + client components.
 *
 * Precedence:
 *   1. Drop built-in tabs whose `tiers` doesn't include the client's tier.
 *   2. Apply per-tab overrides from `PortalConfig.tabs` (hide / relabel /
 *      reorder). Unknown override keys are ignored — we never render a
 *      built-in tab that doesn't exist.
 *   3. Append custom links.
 *   4. Sort by (order ?? defaultIndex), then by insertion order as a
 *      stable tiebreak.
 */
export interface ResolvedPortalTab {
  key: string;
  label: string;
  href: string;
  icon: string;
  /** True when this is an agency-defined custom link, not a built-in tab. */
  isCustom: boolean;
}

export function resolvePortalTabs(
  tier: SubscriptionTier | null | undefined,
  config: PortalConfig | null | undefined,
): ResolvedPortalTab[] {
  const effectiveTier: SubscriptionTier = tier ?? 'social_only';
  const overrides = new Map<string, { label?: string; hidden?: boolean; order?: number }>();
  for (const t of config?.tabs ?? []) overrides.set(t.key, t);

  const builtIns: Array<ResolvedPortalTab & { defaultIndex: number; order: number }> =
    DEFAULT_PORTAL_TABS
      .filter((t) => t.tiers === 'all' || t.tiers.includes(effectiveTier))
      .map((t, i) => {
        const o = overrides.get(t.key);
        return {
          key: t.key,
          label: o?.label?.trim() || t.label,
          href: t.href,
          icon: t.icon,
          isCustom: false,
          defaultIndex: i,
          order: o?.order ?? i,
        };
      })
      .filter((t) => {
        const o = overrides.get(t.key);
        return !o?.hidden;
      });

  const custom = (config?.customLinks ?? []).map((l, i) => ({
    key: `custom:${l.id}`,
    label: l.label,
    href: l.href,
    icon: l.icon ?? 'Link2',
    isCustom: true as const,
    defaultIndex: builtIns.length + i,
    order: builtIns.length + i,
  }));

  return [...builtIns, ...custom]
    .sort((a, b) =>
      a.order === b.order ? a.defaultIndex - b.defaultIndex : a.order - b.order,
    )
    .map(({ defaultIndex: _d, order: _o, ...rest }) => rest);
}

/**
 * Validate a `PortalConfig` payload before save. Returns a list of
 * human-readable errors keyed by field path — empty array means valid.
 * Used by both the agency-side edit form and the API's PATCH handler
 * so invalid data can't land in the DB.
 */
export function validatePortalConfig(config: PortalConfig | null | undefined): string[] {
  if (!config) return [];
  const errors: string[] = [];
  const seenLinkIds = new Set<string>();
  for (const [i, link] of (config.customLinks ?? []).entries()) {
    if (!link.id || !link.id.trim()) errors.push(`Link ${i + 1}: id required`);
    else if (seenLinkIds.has(link.id)) errors.push(`Link ${i + 1}: duplicate id`);
    else seenLinkIds.add(link.id);
    if (!link.label || !link.label.trim()) errors.push(`Link ${i + 1}: label required`);
    if (!link.href || !link.href.trim()) errors.push(`Link ${i + 1}: URL required`);
    else if (!/^(https?:\/\/|\/)/i.test(link.href.trim()))
      errors.push(`Link ${i + 1}: URL must start with https:// or /`);
  }
  const seenTabKeys = new Set<string>();
  for (const [i, tab] of (config.tabs ?? []).entries()) {
    if (!tab.key) errors.push(`Tab ${i + 1}: key required`);
    else if (seenTabKeys.has(tab.key)) errors.push(`Tab ${i + 1}: duplicate key`);
    else seenTabKeys.add(tab.key);
    if (tab.label !== undefined && tab.label.length > 40)
      errors.push(`Tab ${i + 1}: label too long (max 40 chars)`);
  }
  if (config.welcomeMessage && config.welcomeMessage.length > 200)
    errors.push('Welcome message too long (max 200 chars)');
  return errors;
}

export interface ClientImage {
  id: string;
  clientId: string;
  fileUrl: string;
  fileName: string;
  /** Size on disk, in bytes. Missing from mock data. */
  fileSizeBytes?: number | null;
  /** Content-Type; we use the `video/*` prefix to distinguish videos. */
  mimeType?: string | null;
  /**
   * Optional provenance — where the asset came from. Used by the Media
   * Studio to filter between uploaded, AI-generated, template-rendered,
   * Canva-exported, and stock-sourced media. Missing on legacy rows; the
   * UI treats those as "uploaded".
   */
  source?: 'upload' | 'ai' | 'template' | 'canva' | 'stock' | null;
  tags: string[];
  aiDescription?: string | null;
  qualityScore?: number | null;
  /** URL of the Flux-Kontext-enhanced version when we've regenerated the image. */
  enhancedUrl?: string | null;
  status: ImageStatus;
  uploadedAt: string;
}

export interface Post {
  id: string;
  clientId: string;
  clientName?: string;
  /** Mock data uses `imageUrl`; DB rows use `generatedImageUrl`. Helpers below normalize. */
  imageUrl?: string;
  generatedImageUrl?: string | null;
  caption: string;
  platform: Platform;
  hashtags: string[];
  /** Mock data uses `scheduledFor`; DB rows use `scheduledAt`. */
  scheduledFor?: string;
  scheduledAt?: string | Date | null;
  status: PostStatus;
  clientFeedback?: string | null;
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
  } | null;
}

/** Pull the image URL off a Post regardless of which format it's in. */
export function postImageUrl(p: Post): string {
  return p.imageUrl ?? p.generatedImageUrl ?? '';
}

/** Pull the scheduled time off a Post as a Date. */
export function postScheduledAt(p: Post): Date {
  const raw = p.scheduledFor ?? p.scheduledAt;
  if (!raw) return new Date();
  return raw instanceof Date ? raw : new Date(raw);
}

export interface Message {
  id: string;
  clientId: string;
  sender: 'client' | 'agency';
  senderName: string;
  body: string;
  attachmentUrl?: string;
  createdAt: string;
  isRead: boolean;
}

export interface WebsiteRequest {
  id: string;
  clientId: string;
  description: string;
  priority: 'low' | 'normal' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: { message: string; code: string };
}
